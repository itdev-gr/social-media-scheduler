import type { APIRoute } from 'astro';

export const POST: APIRoute = async () => {
  const cookieFlags = [
    '__session=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ');

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Set-Cookie': cookieFlags,
      'Content-Type': 'application/json',
    },
  });
};
