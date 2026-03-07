import type { APIRoute } from 'astro';
import { getDb } from '../../lib/firebase-admin';
import type { SchedulingSettings, PackageDelays } from '../../lib/types';
import { PACKAGE_NAMES } from '../../lib/types';

const SETTINGS_DOC_ID = 'scheduling';

const DEFAULT_DELAYS: PackageDelays = {
  postDelayDays: 0,
  videoDelayDays: 0,
  carouselDelayDays: 0,
  storyDelayDays: 0,
};

function buildDefaults(): SchedulingSettings {
  const settings = {} as SchedulingSettings;
  for (const name of PACKAGE_NAMES) {
    settings[name] = { ...DEFAULT_DELAYS };
  }
  return settings;
}

export const GET: APIRoute = async () => {
  try {
    const db = getDb();
    const doc = await db.collection('settings').doc(SETTINGS_DOC_ID).get();
    const defaults = buildDefaults();

    if (doc.exists) {
      const data = doc.data() as Record<string, unknown>;
      for (const name of PACKAGE_NAMES) {
        if (data[name] && typeof data[name] === 'object') {
          defaults[name] = { ...DEFAULT_DELAYS, ...(data[name] as Partial<PackageDelays>) };
        }
      }
    }

    return new Response(JSON.stringify(defaults), {
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
    const updates: Record<string, PackageDelays> = {};

    for (const name of PACKAGE_NAMES) {
      if (body[name]) {
        const pkg = body[name];
        updates[name] = {
          postDelayDays: Math.max(0, Math.floor(pkg.postDelayDays ?? 0)),
          videoDelayDays: Math.max(0, Math.floor(pkg.videoDelayDays ?? 0)),
          carouselDelayDays: Math.max(0, Math.floor(pkg.carouselDelayDays ?? 0)),
          storyDelayDays: Math.max(0, Math.floor(pkg.storyDelayDays ?? 0)),
        };
      }
    }

    const db = getDb();
    const ref = db.collection('settings').doc(SETTINGS_DOC_ID);
    await ref.set(updates, { merge: true });

    const doc = await ref.get();
    const defaults = buildDefaults();
    if (doc.exists) {
      const data = doc.data() as Record<string, unknown>;
      for (const name of PACKAGE_NAMES) {
        if (data[name] && typeof data[name] === 'object') {
          defaults[name] = { ...DEFAULT_DELAYS, ...(data[name] as Partial<PackageDelays>) };
        }
      }
    }

    return new Response(JSON.stringify(defaults), {
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
