import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/firebase-admin';

const VALID_STATUSES = ['todo', 'doing', 'done'];

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Task ID is required' }), { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return new Response(JSON.stringify({ error: 'Title must be a non-empty string' }), { status: 400 });
      }
      updates.title = body.title.trim();
    }

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return new Response(JSON.stringify({ error: 'Invalid status' }), { status: 400 });
      }
      updates.status = body.status;
    }

    if (body.scheduledDate !== undefined) {
      if (typeof body.scheduledDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.scheduledDate)) {
        return new Response(JSON.stringify({ error: 'scheduledDate must be YYYY-MM-DD' }), { status: 400 });
      }
      updates.scheduledDate = body.scheduledDate;
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), { status: 400 });
    }

    const db = getDb();
    const ref = db.collection('scheduled_tasks').doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404 });
    }

    await ref.update(updates);

    return new Response(JSON.stringify({ id, ...doc.data(), ...updates }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Scheduled task update error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500 }
    );
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Task ID is required' }), { status: 400 });
    }

    const db = getDb();
    const ref = db.collection('scheduled_tasks').doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404 });
    }

    await ref.delete();

    return new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Scheduled task delete error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500 }
    );
  }
};
