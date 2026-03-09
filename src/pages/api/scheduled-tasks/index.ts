import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/firebase-admin';
import { requireAdmin, verifyOwnership } from '../../../lib/user-db';

const VALID_STATUSES = ['todo', 'doing', 'done'];

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const uid = requireAdmin(locals);
    const body = await request.json();

    if (!body.clientId || typeof body.clientId !== 'string') {
      return new Response(JSON.stringify({ error: 'clientId is required' }), { status: 400 });
    }
    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      return new Response(JSON.stringify({ error: 'title is required' }), { status: 400 });
    }
    if (!body.scheduledDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.scheduledDate)) {
      return new Response(JSON.stringify({ error: 'scheduledDate must be YYYY-MM-DD' }), { status: 400 });
    }
    const status = body.status && VALID_STATUSES.includes(body.status) ? body.status : 'todo';

    const db = getDb();

    const clientDoc = await db.collection('clients').doc(body.clientId).get();
    if (!clientDoc.exists) {
      return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 });
    }
    verifyOwnership(clientDoc, uid);

    const taskData = {
      userId: uid,
      clientId: body.clientId,
      title: body.title.trim(),
      status,
      scheduledDate: body.scheduledDate,
    };

    const ref = db.collection('scheduled_tasks').doc();
    await ref.set(taskData);

    return new Response(JSON.stringify({ id: ref.id, ...taskData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Scheduled task create error:', error);
    const statusCode = error instanceof Error && error.message === 'Forbidden' ? 403 : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: statusCode }
    );
  }
};
