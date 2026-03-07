import type { APIRoute } from 'astro';
import { getDb } from '../../lib/firebase-admin';
import type { ContentType, ContentStatus } from '../../lib/types';

const VALID_TYPES: ContentType[] = ['POST', 'VIDEO', 'CAROUSEL', 'STORY'];
const VALID_STATUSES: ContentStatus[] = ['todo', 'doing', 'done'];

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    if (!body.clientId || typeof body.clientId !== 'string') {
      return new Response(JSON.stringify({ error: 'clientId is required' }), { status: 400 });
    }
    if (!body.type || !VALID_TYPES.includes(body.type)) {
      return new Response(
        JSON.stringify({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }),
        { status: 400 }
      );
    }
    if (!body.scheduledDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.scheduledDate)) {
      return new Response(JSON.stringify({ error: 'scheduledDate must be YYYY-MM-DD' }), { status: 400 });
    }

    const status: ContentStatus = body.status && VALID_STATUSES.includes(body.status) ? body.status : 'todo';

    const db = getDb();

    // Verify client exists
    const clientDoc = await db.collection('clients').doc(body.clientId).get();
    if (!clientDoc.exists) {
      return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 });
    }

    // Find plan
    const planSnap = await db.collection('plans').where('clientId', '==', body.clientId).limit(1).get();
    if (planSnap.empty) {
      return new Response(JSON.stringify({ error: 'No plan found for this client' }), { status: 404 });
    }
    const planId = planSnap.docs[0].id;

    // Determine month
    const monthLabel = body.scheduledDate.substring(0, 7);
    const [yearStr, monthStr] = monthLabel.split('-');
    const year = parseInt(yearStr);
    const monthNum = parseInt(monthStr);

    // Find or create month doc
    let monthId: string;
    const monthSnap = await db
      .collection('months')
      .where('clientId', '==', body.clientId)
      .where('label', '==', monthLabel)
      .limit(1)
      .get();

    if (monthSnap.empty) {
      const monthRef = db.collection('months').doc();
      await monthRef.set({
        clientId: body.clientId,
        planId,
        label: monthLabel,
        year,
        month: monthNum,
      });
      monthId = monthRef.id;
    } else {
      monthId = monthSnap.docs[0].id;
    }

    // Count existing items of this type for numbering
    const existingSnap = await db
      .collection('content_items')
      .where('clientId', '==', body.clientId)
      .where('type', '==', body.type)
      .get();
    const nextNumber = existingSnap.size + 1;

    // Create content item
    const scheduledDay = new Date(body.scheduledDate + 'T00:00:00').getDate();
    const contentRef = db.collection('content_items').doc();
    const contentItem: Record<string, unknown> = {
      clientId: body.clientId,
      planId,
      monthId,
      monthLabel,
      type: body.type,
      number: nextNumber,
      scheduledDay,
      scheduledDate: body.scheduledDate,
      status,
    };
    if (body.customName && typeof body.customName === 'string' && body.customName.trim()) {
      contentItem.customName = body.customName.trim();
    }
    await contentRef.set(contentItem);

    return new Response(JSON.stringify({ id: contentRef.id, ...contentItem }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Create task error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500 }
    );
  }
};
