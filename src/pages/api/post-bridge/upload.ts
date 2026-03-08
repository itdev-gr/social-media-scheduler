import type { APIRoute } from 'astro';
import { createUploadUrl } from '../../../lib/post-bridge';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { mimeType, sizeBytes, name } = body;

    if (!mimeType || !sizeBytes || !name) {
      return new Response(
        JSON.stringify({ error: 'mimeType, sizeBytes, and name are required' }),
        { status: 400 }
      );
    }

    const result = await createUploadUrl(mimeType, sizeBytes, name);

    return new Response(
      JSON.stringify({ mediaId: result.media_id, uploadUrl: result.upload_url }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Upload URL error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to create upload URL' }),
      { status: 500 }
    );
  }
};
