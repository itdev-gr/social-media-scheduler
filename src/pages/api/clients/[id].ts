import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/firebase-admin';
import { requireAdmin, verifyOwnership } from '../../../lib/user-db';

export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const uid = requireAdmin(locals);
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Client ID is required' }), { status: 400 });
    }

    const body = await request.json();

    if (body.action !== 'delete') {
      return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
    }

    const db = getDb();
    const ref = db.collection('clients').doc(id);
    const doc = await ref.get();

    if (!doc.exists) {
      return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 });
    }

    verifyOwnership(doc, uid);

    // Delete all related data in parallel
    const [plansSnap, monthsSnap, itemsSnap, scheduledTasksSnap] = await Promise.all([
      db.collection('plans').where('clientId', '==', id).get(),
      db.collection('months').where('clientId', '==', id).get(),
      db.collection('content_items').where('clientId', '==', id).get(),
      db.collection('scheduled_tasks').where('clientId', '==', id).get(),
    ]);

    const BATCH_SIZE = 499;
    const allRefs = [
      ref,
      ...plansSnap.docs.map((d) => d.ref),
      ...monthsSnap.docs.map((d) => d.ref),
      ...itemsSnap.docs.map((d) => d.ref),
      ...scheduledTasksSnap.docs.map((d) => d.ref),
    ];

    for (let i = 0; i < allRefs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      allRefs.slice(i, i + BATCH_SIZE).forEach((r) => batch.delete(r));
      await batch.commit();
    }

    return new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Client delete error:', error);
    const status = error instanceof Error && error.message === 'Forbidden' ? 403 : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status }
    );
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    const uid = requireAdmin(locals);
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Client ID is required' }), { status: 400 });
    }

    const body = await request.json();
    const clientUpdates: Record<string, unknown> = {};
    const planUpdates: Record<string, unknown> = {};

    // Client fields
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return new Response(JSON.stringify({ error: 'Name must be a non-empty string' }), { status: 400 });
      }
      clientUpdates.name = body.name.trim();
    }

    if (body.clickupId !== undefined) {
      if (typeof body.clickupId !== 'string') {
        return new Response(JSON.stringify({ error: 'ClickUp ID must be a string' }), { status: 400 });
      }
      clientUpdates.clickupId = body.clickupId;
    }

    if (body.notes !== undefined) {
      if (typeof body.notes !== 'string') {
        return new Response(JSON.stringify({ error: 'Notes must be a string' }), { status: 400 });
      }
      clientUpdates.notes = body.notes;
    }

    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') {
        return new Response(JSON.stringify({ error: 'Active must be a boolean' }), { status: 400 });
      }
      clientUpdates.active = body.active;
    }

    // Plan fields
    const planFields = ['postsPerMonth', 'scenariosPerMonth', 'carouselsPerMonth', 'storiesPerMonth'];
    for (const field of planFields) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== 'number' || body[field] < 0) {
          return new Response(JSON.stringify({ error: `${field} must be a non-negative number` }), { status: 400 });
        }
        planUpdates[field] = body[field];
      }
    }

    if (Object.keys(clientUpdates).length === 0 && Object.keys(planUpdates).length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), { status: 400 });
    }

    const db = getDb();

    // Update client
    if (Object.keys(clientUpdates).length > 0) {
      const ref = db.collection('clients').doc(id);
      const doc = await ref.get();
      if (!doc.exists) {
        return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 });
      }
      verifyOwnership(doc, uid);
      await ref.update(clientUpdates);
    }

    // Update plan
    if (Object.keys(planUpdates).length > 0) {
      const planSnap = await db.collection('plans').where('clientId', '==', id).limit(1).get();
      if (!planSnap.empty) {
        await planSnap.docs[0].ref.update(planUpdates);
      }
    }

    return new Response(JSON.stringify({ id, ...clientUpdates, ...planUpdates }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Client update error:', error);
    const status = error instanceof Error && error.message === 'Forbidden' ? 403 : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status }
    );
  }
};
