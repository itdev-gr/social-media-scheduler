import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/firebase-admin';
import { getSocialAccounts, createPost } from '../../../lib/post-bridge';
import type { ContentItem } from '../../../lib/types';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { contentItemId, immediate } = body;

    if (!contentItemId) {
      return new Response(JSON.stringify({ error: 'contentItemId is required' }), { status: 400 });
    }

    const db = getDb();
    const itemRef = db.collection('content_items').doc(contentItemId);
    const itemDoc = await itemRef.get();

    if (!itemDoc.exists) {
      return new Response(JSON.stringify({ error: 'Content item not found' }), { status: 404 });
    }

    const item = itemDoc.data() as ContentItem;

    if (!item.caption) {
      return new Response(JSON.stringify({ error: 'Caption is required to publish' }), { status: 400 });
    }

    if (!item.platforms || item.platforms.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one platform must be selected' }), { status: 400 });
    }

    console.log(`[PostBridge] Publishing contentItemId=${contentItemId}, platforms=${JSON.stringify(item.platforms)}, immediate=${!!immediate}`);

    // Look up social account IDs for selected platforms
    const allAccounts = await getSocialAccounts();
    const socialAccountIds = allAccounts
      .filter((a) => item.platforms!.includes(a.platform as 'instagram' | 'facebook'))
      .map((a) => a.id);

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
      scheduledAt = `${item.scheduledDate}T${time}:00.000Z`;
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
