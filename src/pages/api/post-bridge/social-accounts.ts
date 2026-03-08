import type { APIRoute } from 'astro';
import { getSocialAccounts } from '../../../lib/post-bridge';

export const GET: APIRoute = async () => {
  try {
    const allAccounts = await getSocialAccounts();
    const accounts = allAccounts
      .filter((a) => a.platform === 'instagram' || a.platform === 'facebook')
      .map((a) => ({
        id: a.id,
        platform: a.platform,
        name: a.name,
        username: a.username,
      }));

    return new Response(JSON.stringify({ accounts }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Social accounts error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch social accounts' }),
      { status: 500 }
    );
  }
};
