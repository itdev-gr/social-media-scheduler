import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/firebase-admin';
import { requireAdmin, verifyOwnership } from '../../../../lib/user-db';
import { getPostResults } from '../../../../lib/post-bridge';
import type { ContentItem, PublishStatus } from '../../../../lib/types';

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const uid = requireAdmin(locals);
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Content item ID is required' }), { status: 400 });
    }

    const db = getDb();
    const itemRef = db.collection('content_items').doc(id);
    const itemDoc = await itemRef.get();

    if (!itemDoc.exists) {
      return new Response(JSON.stringify({ error: 'Content item not found' }), { status: 404 });
    }

    verifyOwnership(itemDoc, uid);

    const item = itemDoc.data() as ContentItem;

    if (!item.postBridgePostId) {
      return new Response(
        JSON.stringify({ publishStatus: item.publishStatus || 'draft' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const results = await getPostResults(item.postBridgePostId);

    let newStatus: PublishStatus;
    let publishError: string | undefined;

    if (results.length === 0) {
      newStatus = item.publishStatus || 'publishing';
    } else {
      const allSuccess = results.every((r) => r.success);
      const someSuccess = results.some((r) => r.success);
      const errors = results.filter((r) => !r.success).map((r) => `${r.platform}: ${r.error || 'Unknown error'}`);

      if (allSuccess) {
        newStatus = 'published';
      } else if (someSuccess) {
        newStatus = 'partially_failed';
        publishError = errors.join('; ');
      } else {
        newStatus = 'failed';
        publishError = errors.join('; ');
      }
    }

    const updates: Record<string, unknown> = { publishStatus: newStatus };
    if (publishError) updates.publishError = publishError;
    await itemRef.update(updates);

    return new Response(
      JSON.stringify({ publishStatus: newStatus, publishError, results }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Status check error:', error);
    const status = error instanceof Error && error.message === 'Forbidden' ? 403 : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to check status' }),
      { status }
    );
  }
};
