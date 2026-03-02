import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/firebase-admin';

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Client ID is required' }), { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.notes !== undefined) {
      if (typeof body.notes !== 'string') {
        return new Response(JSON.stringify({ error: 'Notes must be a string' }), { status: 400 });
      }
      updates.notes = body.notes;
    }

    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') {
        return new Response(JSON.stringify({ error: 'Active must be a boolean' }), { status: 400 });
      }
      updates.active = body.active;
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), { status: 400 });
    }

    const db = getDb();
    const ref = db.collection('clients').doc(id);
    const doc = await ref.get();

    if (!doc.exists) {
      return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 });
    }

    await ref.update(updates);

    return new Response(JSON.stringify({ id, ...updates }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Client update error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500 }
    );
  }
};
