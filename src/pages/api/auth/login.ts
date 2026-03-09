import type { APIRoute } from 'astro';
import { getAdminAuth, getDb } from '../../../lib/firebase-admin';

export const POST: APIRoute = async ({ request }) => {
  const { idToken } = await request.json();

  if (!idToken) {
    return new Response(JSON.stringify({ error: 'Missing idToken' }), { status: 400 });
  }

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);

    // Reject tokens older than 5 minutes
    const fiveMinutes = 5 * 60;
    const now = Math.floor(Date.now() / 1000);
    if (now - decoded.auth_time > fiveMinutes) {
      return new Response(JSON.stringify({ error: 'Token too old. Please sign in again.' }), { status: 401 });
    }

    // Create session cookie (5 days)
    const expiresIn = 5 * 24 * 60 * 60 * 1000;
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

    // Create Firestore user doc on first login
    const db = getDb();
    const userRef = db.collection('users').doc(decoded.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      await userRef.set({
        uid: decoded.uid,
        email: decoded.email || '',
        type: 'user',
        createdAt: new Date().toISOString(),
      });
    }

    const isProd = import.meta.env.PROD;
    const cookieFlags = [
      `__session=${sessionCookie}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      'Max-Age=432000',
      ...(isProd ? ['Secure'] : []),
    ].join('; ');

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Set-Cookie': cookieFlags,
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Authentication failed' }), { status: 401 });
  }
};
