import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/firebase-admin';
import { getSocialAccounts, createPost } from '../../../lib/post-bridge';
import type { ContentItem } from '../../../lib/types';

const MAX_RETRIES = 3;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { contentItemId } = body;

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
    const currentRetry = item.retryCount || 0;

    if (currentRetry >= MAX_RETRIES) {
      return new Response(
        JSON.stringify({ error: 'Maximum retry attempts reached (3). This post has permanently failed.' }),
        { status: 400 }
      );
    }

    if (!item.caption || !item.platforms || item.platforms.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Caption and platforms are required to retry' }),
        { status: 400 }
      );
    }

    console.log(`[PostBridge] Retrying contentItemId=${contentItemId}, attempt ${currentRetry + 1}/${MAX_RETRIES}`);

    await itemRef.update({
      publishStatus: 'publishing',
      retryCount: currentRetry + 1,
      publishError: '',
    });

    // Use client's assigned accounts if available
    const clientDoc = await db.collection('clients').doc(item.clientId).get();
    const clientData = clientDoc.exists ? clientDoc.data() as { socialAccountIds?: number[] } : {};

    let socialAccountIds: number[];
    const allAccounts = await getSocialAccounts();
    if (clientData.socialAccountIds && clientData.socialAccountIds.length > 0) {
      const clientAccountSet = new Set(clientData.socialAccountIds);
      socialAccountIds = allAccounts
        .filter((a) => clientAccountSet.has(a.id) && item.platforms!.includes(a.platform as 'instagram' | 'facebook'))
        .map((a) => a.id);
    } else {
      socialAccountIds = allAccounts
        .filter((a) => item.platforms!.includes(a.platform as 'instagram' | 'facebook'))
        .map((a) => a.id);
    }

    if (socialAccountIds.length === 0) {
      await itemRef.update({ publishStatus: 'failed', publishError: 'No matching social accounts found' });
      return new Response(
        JSON.stringify({ error: 'No matching social accounts found' }),
        { status: 400 }
      );
    }

    const post = await createPost({
      caption: item.caption,
      socialAccountIds,
      mediaIds: item.mediaIds,
    });

    console.log(`[PostBridge] Retry success — postBridgePostId=${post.id}, contentItemId=${contentItemId}`);

    await itemRef.update({
      postBridgePostId: post.id,
      publishStatus: 'publishing',
    });

    return new Response(
      JSON.stringify({ postBridgePostId: post.id, publishStatus: 'publishing', retryCount: currentRetry + 1 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Retry error:', error);

    try {
      const body = await request.clone().json().catch(() => null);
      if (body?.contentItemId) {
        const db = getDb();
        await db.collection('content_items').doc(body.contentItemId).update({
          publishStatus: 'failed',
          publishError: error instanceof Error ? error.message : 'Retry failed',
        });
      }
    } catch {
      // ignore
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Retry failed' }),
      { status: 500 }
    );
  }
};
