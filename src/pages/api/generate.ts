import type { APIRoute } from 'astro';
import { getDb } from '../../lib/firebase-admin';
import type { GenerateRequest, GenerateResponse, Client, Plan, Month, ContentItem, ContentType, SchedulingSettings } from '../../lib/types';
import { generateMonthSequence, addDays, daysInMonth } from '../../lib/date-utils';
import { scheduleMonth, type MonthStartDays } from '../../lib/scheduler';

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

    // Fetch scheduling delay settings
    const settingsDoc = await db.collection('settings').doc('scheduling').get();
    const delays: SchedulingSettings = {
      postDelayDays: 0,
      videoDelayDays: 0,
      carouselDelayDays: 0,
      storyDelayDays: 0,
      ...(settingsDoc.exists ? (settingsDoc.data() as Partial<SchedulingSettings>) : {}),
    };

    // Create client
    const clientRef = db.collection('clients').doc();
    const client: Client = { name: body.clientName.trim(), createdAt: now, notes: body.notes || '', clickupId: body.clickupId || '' };
    await clientRef.set(client);
    const clientId = clientRef.id;

    // Create plan
    const planRef = db.collection('plans').doc();
    const plan: Plan = {
      clientId,
      startMonth: body.startMonth,
      monthsCount: body.monthsCount,
      postsPerMonth: body.postsPerMonth || 0,
      scenariosPerMonth: body.scenariosPerMonth || 0,
      carouselsPerMonth: body.carouselsPerMonth || 0,
      storiesPerMonth: body.storiesPerMonth || 0,
      createdAt: now,
    };
    await planRef.set(plan);
    const planId = planRef.id;

    // Generate month sequence
    const months = generateMonthSequence(body.startMonth, body.monthsCount);

    // ── Step 1: Calculate effective start dates per content type ──
    // Start date = today + delay (from settings)
    const todayStr = now.substring(0, 10); // YYYY-MM-DD
    const postStartDate = addDays(todayStr, delays.postDelayDays);
    const videoStartDate = addDays(todayStr, delays.videoDelayDays);   // also used for scenarios
    const carouselStartDate = addDays(todayStr, delays.carouselDelayDays);
    const storyStartDate = addDays(todayStr, delays.storyDelayDays);

    // Helper: given an effective start date (YYYY-MM-DD) and a month (year, month),
    // returns the day-of-month from which scheduling should begin.
    // If the start date is before this month → 1 (full month available).
    // If the start date is within this month → that day.
    // If the start date is after this month → totalDays+1 (skip entirely).
    function getFromDay(startDate: string, year: number, month: number, totalDays: number): number {
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;
      if (startDate <= monthStart) return 1;
      if (startDate > monthEnd) return totalDays + 1;
      return parseInt(startDate.substring(8, 10), 10);
    }

    // ── Step 2: Schedule content using the calculated start dates ──
    const allContentWrites: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[] = [];
    let contentItemsCreated = 0;

    // Global counters per content type for numbering
    const typeCounters = new Map<ContentType, number>();

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

      // Calculate per-type start days for this month based on pre-calculated dates
      const totalDays = daysInMonth(m.year, m.month);
      const startDays: MonthStartDays = {
        posts: getFromDay(postStartDate, m.year, m.month, totalDays),
        scenarios: getFromDay(videoStartDate, m.year, m.month, totalDays),
        carousels: getFromDay(carouselStartDate, m.year, m.month, totalDays),
        stories: getFromDay(storyStartDate, m.year, m.month, totalDays),
      };

      // Schedule content for this month using the calculated start days
      const scheduledItems = scheduleMonth(
        m.year,
        m.month,
        body.postsPerMonth || 0,
        body.scenariosPerMonth || 0,
        body.carouselsPerMonth || 0,
        body.storiesPerMonth || 0,
        startDays
      );

      for (const item of scheduledItems) {
        const currentNum = (typeCounters.get(item.type) || 0) + 1;
        typeCounters.set(item.type, currentNum);

        const contentRef = db.collection('content_items').doc();
        const contentItem: Omit<ContentItem, 'id'> = {
          clientId,
          planId,
          monthId,
          monthLabel: m.label,
          type: item.type,
          number: currentNum,
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
