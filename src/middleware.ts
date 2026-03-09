import { defineMiddleware } from 'astro:middleware';
import { getAdminAuth, getDb } from './lib/firebase-admin';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname === p + '/');
}

export const onRequest = defineMiddleware(async ({ request, locals, redirect, url }, next) => {
  const pathname = url.pathname;

  if (isPublicPath(pathname)) {
    // If authenticated user visits /login, redirect to /
    if (pathname === '/login' || pathname === '/login/') {
      const cookie = parseCookie(request.headers.get('cookie') || '', '__session');
      if (cookie) {
        try {
          await getAdminAuth().verifySessionCookie(cookie, true);
          return redirect('/');
        } catch {
          // Invalid cookie, let them see login
        }
      }
    }
    locals.user = null;
    return next();
  }

  const cookie = parseCookie(request.headers.get('cookie') || '', '__session');

  if (!cookie) {
    return handleUnauthenticated(pathname, redirect);
  }

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifySessionCookie(cookie, true);

    // Read user type from Firestore
    const db = getDb();
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    const userData = userDoc.data();
    const userType = userData?.type === 'admin' ? 'admin' : 'user';

    locals.user = {
      uid: decoded.uid,
      email: decoded.email || '',
      type: userType,
    };

    // Regular users can only access / and /api/auth/*
    if (userType === 'user' && pathname !== '/' && !pathname.startsWith('/api/auth')) {
      if (pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
      }
      return redirect('/');
    }

    return next();
  } catch {
    return handleUnauthenticated(pathname, redirect);
  }
});

function handleUnauthenticated(pathname: string, redirect: (path: string, status?: number) => Response): Response {
  if (pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  return redirect('/login');
}

function parseCookie(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : undefined;
}
