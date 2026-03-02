import type { APIRoute } from 'astro';
import { getDb } from '../../lib/firebase-admin';

export const GET: APIRoute = async () => {
  try {
    const db = getDb();
    const snapshot = await db
      .collection('clients')
      .orderBy('createdAt', 'desc')
      .get();

    const clients = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return new Response(JSON.stringify(clients), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Clients error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500 }
    );
  }
};
