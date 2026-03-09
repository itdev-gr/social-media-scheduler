import type { APIRoute } from 'astro';
import { getDb } from '../../lib/firebase-admin';
import { requireAdmin } from '../../lib/user-db';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const uid = requireAdmin(locals);
    const db = getDb();
    const snapshot = await db
      .collection('clients')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();

    const clients = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return new Response(JSON.stringify(clients), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Clients error:', error);
    const status = error instanceof Error && error.message === 'Forbidden' ? 403 : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status }
    );
  }
};
