import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/firebase-admin';
import { requireAdmin, verifyOwnership } from '../../../lib/user-db';
import { getSocialAccounts, createPost } from '../../../lib/post-bridge';
import type { ContentItem } from '../../../lib/types';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const uid = requireAdmin(locals);
    const body = await request.json();
    const { contentItemId, immediate, timezoneOffset } = body;

    if (!contentItemId) {
      return new Response(JSON.stringify({ error: 'contentItemId is required' }), { status: 400 });
    }

    const db = getDb();
    const itemRef = db.collection('content_items').doc(contentItemId);
    const itemDoc = await itemRef.get();

    if (!itemDoc.exists) {
      return new Response(JSON.stringify({ error: 'Content item not found' }), { status: 404 });
    }

    verifyOwnership(itemDoc, uid);

    const item = itemDoc.data() as ContentItem;

    if (!item.caption) {
      return new Response(JSON.stringify({ error: 'Caption is required to publish' }), { status: 400 });
    }

    if (!item.platforms || item.platforms.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one platform must be selected' }), { status: 400 });
    }

    console.log(`[PostBridge] Publishing contentItemId=${contentItemId}, platforms=${JSON.stringify(item.platforms)}, immediate=${!!immediate}`);

    // Look up social account IDs — use client's assigned accounts if available, otherwise match by platform
    const clientDoc = await db.collection('clients').doc(item.clientId).get();
    if (clientDoc.exists) {
      verifyOwnership(clientDoc, uid);
    }
    const clientData = clientDoc.exists ? clientDoc.data() as { socialAccountIds?: number[] } : {};

    let socialAccountIds: number[];
    if (clientData.socialAccountIds && clientData.socialAccountIds.length > 0) {
      // Filter client's assigned accounts to only the selected platforms
      const allAccounts = await getSocialAccounts();
      const clientAccountSet = new Set(clientData.socialAccountIds);
      socialAccountIds = allAccounts
        .filter((a) => clientAccountSet.has(a.id) && item.platforms!.includes(a.platform as 'instagram' | 'facebook'))
        .map((a) => a.id);
    } else {
      // Fallback: use all accounts matching selected platforms
      const allAccounts = await getSocialAccounts();
      socialAccountIds = allAccounts
        .filter((a) => item.platforms!.includes(a.platform as 'instagram' | 'facebook'))
        .map((a) => a.id);
    }

    if (socialAccountIds.length === 0) {
      await itemRef.update({ publishStatus: 'failed', publishError: 'No matching social accounts found for selected platforms' });
      return new Response(
        JSON.stringify({ error: 'No matching social accounts found for selected platforms' }),
        { status: 400 }
      );
    }

    // Build scheduled_at if not immediate
    let scheduledAt: string | undefined;
    if (!immediate && item.scheduledDate) {
      const time = item.scheduledPostTime || '12:00';
      // Convert local time to UTC using the client's timezone offset
      const localDate = new Date(`${item.scheduledDate}T${time}:00`);
      if (typeof timezoneOffset === 'number') {
        // timezoneOffset is in minutes from UTC (e.g. -120 for UTC+2)
        localDate.setMinutes(localDate.getMinutes() + timezoneOffset);
      }
      scheduledAt = localDate.toISOString();
    }

    await itemRef.update({ publishStatus: immediate ? 'publishing' : 'scheduled' });

    const post = await createPost({
      caption: item.caption,
      socialAccountIds,
      mediaIds: item.mediaIds,
      scheduledAt,
    });

    console.log(`[PostBridge] Response — postBridgePostId=${post.id}, contentItemId=${contentItemId}`);

    await itemRef.update({
      postBridgePostId: post.id,
      publishStatus: immediate ? 'publishing' : 'scheduled',
    });

    return new Response(
      JSON.stringify({ postBridgePostId: post.id, publishStatus: immediate ? 'publishing' : 'scheduled' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Publish error:', error);

    if (error instanceof Error && error.message === 'Forbidden') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    // Try to update the content item with failure status
    try {
      const body = await request.clone().json().catch(() => null);
      if (body?.contentItemId) {
        const db = getDb();
        const itemRef = db.collection('content_items').doc(body.contentItemId);
        const itemDoc = await itemRef.get();
        if (itemDoc.exists) {
          const current = itemDoc.data() as ContentItem;
          await itemRef.update({
            publishStatus: 'failed',
            publishError: error instanceof Error ? error.message : 'Unknown error',
            retryCount: (current.retryCount || 0) + 1,
          });
        }
      }
    } catch {
      // ignore secondary error
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to publish' }),
      { status: 500 }
    );
  }
};
