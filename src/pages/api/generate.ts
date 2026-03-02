import type { APIRoute } from 'astro';
import { getDb } from '../../lib/firebase-admin';
import type { GenerateRequest, GenerateResponse, Client, Plan, Month, ContentItem } from '../../lib/types';
import { generateMonthSequence } from '../../lib/date-utils';
import { scheduleMonth } from '../../lib/scheduler';

async function batchWrite(
  db: FirebaseFirestore.Firestore,
  writes: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[]
) {
  const BATCH_SIZE = 499;
  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const chunk = writes.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const { ref, data } of chunk) {
      batch.set(ref, data);
    }
    await batch.commit();
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as GenerateRequest;

    if (!body.clientName?.trim()) {
      return new Response(JSON.stringify({ error: 'Client name is required' }), { status: 400 });
    }
    if (!body.startMonth?.match(/^\d{4}-\d{2}$/)) {
      return new Response(JSON.stringify({ error: 'Start month must be YYYY-MM format' }), { status: 400 });
    }
    if (!body.monthsCount || body.monthsCount < 1 || body.monthsCount > 24) {
      return new Response(JSON.stringify({ error: 'Months count must be between 1 and 24' }), { status: 400 });
    }

    const db = getDb();
    const now = new Date().toISOString();

    // Create client
    const clientRef = db.collection('clients').doc();
    const client: Client = { name: body.clientName.trim(), createdAt: now };
    await clientRef.set(client);
    const clientId = clientRef.id;

    // Create plan
    const planRef = db.collection('plans').doc();
    const plan: Plan = {
      clientId,
      startMonth: body.startMonth,
      monthsCount: body.monthsCount,
      postsPerMonth: body.postsPerMonth || 0,
      videosPerMonth: body.videosPerMonth || 0,
      carouselsPerMonth: body.carouselsPerMonth || 0,
      createdAt: now,
    };
    await planRef.set(plan);
    const planId = planRef.id;

    // Generate month sequence
    const months = generateMonthSequence(body.startMonth, body.monthsCount);

    const allContentWrites: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[] = [];
    let contentItemsCreated = 0;

    for (const m of months) {
      // Create month doc
      const monthRef = db.collection('months').doc();
      const monthDoc: Month = {
        clientId,
        planId,
        label: m.label,
        year: m.year,
        month: m.month,
      };
      await monthRef.set(monthDoc);
      const monthId = monthRef.id;

      // Schedule content for this month
      const scheduledItems = scheduleMonth(
        m.year,
        m.month,
        body.postsPerMonth || 0,
        body.videosPerMonth || 0,
        body.carouselsPerMonth || 0
      );

      for (const item of scheduledItems) {
        const contentRef = db.collection('content_items').doc();
        const contentItem: Omit<ContentItem, 'id'> = {
          clientId,
          planId,
          monthId,
          monthLabel: m.label,
          type: item.type,
          scheduledDay: item.day,
          scheduledDate: item.date,
          status: 'todo',
        };
        allContentWrites.push({ ref: contentRef, data: contentItem as Record<string, unknown> });
        contentItemsCreated++;
      }
    }

    await batchWrite(db, allContentWrites);

    const response: GenerateResponse = {
      clientId,
      planId,
      monthsCreated: months.length,
      contentItemsCreated,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Generate error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500 }
    );
  }
};
