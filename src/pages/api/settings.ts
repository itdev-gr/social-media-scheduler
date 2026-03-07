import type { APIRoute } from 'astro';
import { getDb } from '../../lib/firebase-admin';
import type { SchedulingSettings } from '../../lib/types';

const SETTINGS_DOC_ID = 'scheduling';
const DEFAULTS: SchedulingSettings = {
  postDelayDays: 0,
  videoDelayDays: 0,
  carouselDelayDays: 0,
  storyDelayDays: 0,
};

export const GET: APIRoute = async () => {
  try {
    const db = getDb();
    const doc = await db.collection('settings').doc(SETTINGS_DOC_ID).get();

    const settings: SchedulingSettings = doc.exists
      ? { ...DEFAULTS, ...(doc.data() as Partial<SchedulingSettings>) }
      : DEFAULTS;

    return new Response(JSON.stringify(settings), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Settings GET error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500 }
    );
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as Partial<SchedulingSettings>;

    const updates: Partial<SchedulingSettings> = {};
    if (body.postDelayDays !== undefined) {
      updates.postDelayDays = Math.max(0, Math.floor(body.postDelayDays));
    }
    if (body.videoDelayDays !== undefined) {
      updates.videoDelayDays = Math.max(0, Math.floor(body.videoDelayDays));
    }
    if (body.carouselDelayDays !== undefined) {
      updates.carouselDelayDays = Math.max(0, Math.floor(body.carouselDelayDays));
    }
    if (body.storyDelayDays !== undefined) {
      updates.storyDelayDays = Math.max(0, Math.floor(body.storyDelayDays));
    }

    const db = getDb();
    const ref = db.collection('settings').doc(SETTINGS_DOC_ID);
    await ref.set(updates, { merge: true });

    const doc = await ref.get();
    const settings: SchedulingSettings = { ...DEFAULTS, ...(doc.data() as Partial<SchedulingSettings>) };

    return new Response(JSON.stringify(settings), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Settings PATCH error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500 }
    );
  }
};
