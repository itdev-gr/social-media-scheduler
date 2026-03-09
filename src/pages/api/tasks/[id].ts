import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/firebase-admin';
import { requireAdmin, verifyOwnership } from '../../../lib/user-db';
import type { ContentStatus, ContentType, ApprovalStatus } from '../../../lib/types';

const VALID_STATUSES: ContentStatus[] = ['todo', 'doing', 'done'];
const VALID_TYPES: ContentType[] = ['POST', 'VIDEO', 'CAROUSEL', 'STORY'];
const VALID_APPROVAL_STATUSES: ApprovalStatus[] = ['pending', 'approved', 'rejected'];

export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const uid = requireAdmin(locals);
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Item ID is required' }), { status: 400 });
    }

    const db = getDb();
    const ref = db.collection('content_items').doc(id);
    const doc = await ref.get();

    if (!doc.exists) {
      return new Response(JSON.stringify({ error: 'Content item not found' }), { status: 404 });
    }

    verifyOwnership(doc, uid);

    await ref.delete();

    return new Response(JSON.stringify({ id, deleted: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete error:', error);
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
      return new Response(JSON.stringify({ error: 'Item ID is required' }), { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    // Status
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return new Response(
          JSON.stringify({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` }),
          { status: 400 }
        );
      }
      updates.status = body.status;
    }

    // Type
    if (body.type !== undefined) {
      if (!VALID_TYPES.includes(body.type)) {
        return new Response(
          JSON.stringify({ error: `Type must be one of: ${VALID_TYPES.join(', ')}` }),
          { status: 400 }
        );
      }
      updates.type = body.type;
    }

    // Custom name
    if (body.customName !== undefined) {
      if (typeof body.customName !== 'string') {
        return new Response(
          JSON.stringify({ error: 'customName must be a string' }),
          { status: 400 }
        );
      }
      updates.customName = body.customName.trim();
    }

    // Caption
    if (body.caption !== undefined) {
      updates.caption = typeof body.caption === 'string' ? body.caption : '';
    }

    // Media IDs
    if (body.mediaIds !== undefined) {
      updates.mediaIds = Array.isArray(body.mediaIds) ? body.mediaIds : [];
    }

    // Media URLs
    if (body.mediaUrls !== undefined) {
      updates.mediaUrls = Array.isArray(body.mediaUrls) ? body.mediaUrls : [];
    }

    // Platforms
    if (body.platforms !== undefined) {
      if (Array.isArray(body.platforms)) {
        updates.platforms = body.platforms.filter((p: string) => p === 'instagram' || p === 'facebook');
      } else {
        updates.platforms = [];
      }
    }

    // Scheduled post time
    if (body.scheduledPostTime !== undefined) {
      if (typeof body.scheduledPostTime === 'string' && /^\d{2}:\d{2}$/.test(body.scheduledPostTime)) {
        updates.scheduledPostTime = body.scheduledPostTime;
      }
    }

    // Scheduled date
    if (body.scheduledDate !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.scheduledDate)) {
        return new Response(
          JSON.stringify({ error: 'scheduledDate must be YYYY-MM-DD' }),
          { status: 400 }
        );
      }
      updates.scheduledDate = body.scheduledDate;
      updates.scheduledDay = new Date(body.scheduledDate + 'T00:00:00').getDate();
      // Update monthLabel to match the new date
      updates.monthLabel = body.scheduledDate.substring(0, 7);
    }

    // Approval status
    if (body.approvalStatus !== undefined) {
      if (!VALID_APPROVAL_STATUSES.includes(body.approvalStatus)) {
        return new Response(
          JSON.stringify({ error: `approvalStatus must be one of: ${VALID_APPROVAL_STATUSES.join(', ')}` }),
          { status: 400 }
        );
      }
      updates.approvalStatus = body.approvalStatus;
    }

    // Client notes
    if (body.clientNotes !== undefined) {
      updates.clientNotes = typeof body.clientNotes === 'string' ? body.clientNotes : '';
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), { status: 400 });
    }

    const db = getDb();
    const ref = db.collection('content_items').doc(id);
    const doc = await ref.get();

    if (!doc.exists) {
      return new Response(JSON.stringify({ error: 'Content item not found' }), { status: 404 });
    }

    verifyOwnership(doc, uid);

    await ref.update(updates);

    return new Response(JSON.stringify({ id, ...updates }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Update error:', error);
    const status = error instanceof Error && error.message === 'Forbidden' ? 403 : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status }
    );
  }
};
