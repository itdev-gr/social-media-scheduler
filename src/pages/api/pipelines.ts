import type { APIRoute } from 'astro';
import { getDb } from '../../lib/firebase-admin';

export const GET: APIRoute = async ({ url }) => {
  try {
    const db = getDb();
    const monthParam = url.searchParams.get('month');
    const statusParam = url.searchParams.get('status');
    const clientIdParam = url.searchParams.get('clientId');

    let query: FirebaseFirestore.Query = db.collection('content_items');

    if (clientIdParam) {
      query = query.where('clientId', '==', clientIdParam);
    }
    if (monthParam) {
      query = query.where('monthLabel', '==', monthParam);
    }
    if (statusParam) {
      query = query.where('status', '==', statusParam);
    }

    query = query.orderBy('scheduledDate', 'asc');

    const snap = await query.get();
    const items = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Enrich with client names (parallel batch lookups)
    const clientIds = [...new Set(items.map((i: any) => i.clientId))];
    const clientMap = new Map<string, string>();
    const chunks: string[][] = [];
    for (let i = 0; i < clientIds.length; i += 30) {
      const chunk = clientIds.slice(i, i + 30);
      if (chunk.length > 0) chunks.push(chunk);
    }
    const clientSnaps = await Promise.all(
      chunks.map((chunk) => db.collection('clients').where('__name__', 'in', chunk).get())
    );
    for (const snap of clientSnaps) {
      snap.docs.forEach((d) => clientMap.set(d.id, (d.data() as { name: string }).name));
    }

    const enriched = items.map((item: any) => ({
      ...item,
      clientName: clientMap.get(item.clientId) || 'Unknown',
    }));

    return new Response(JSON.stringify(enriched), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Pipelines error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500 }
    );
  }
};
