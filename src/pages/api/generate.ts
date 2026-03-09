import type { APIRoute } from 'astro';
import { getDb } from '../../lib/firebase-admin';
import { requireAdmin } from '../../lib/user-db';
import type { GenerateRequest, GenerateResponse, Client, Plan, Month, ContentItem, ContentType, PackageDelays, PackageName } from '../../lib/types';
import { PACKAGE_NAMES } from '../../lib/types';
import { addDays } from '../../lib/date-utils';
import { schedulePeriod, type MonthStartDays } from '../../lib/scheduler';

async function batchWrite(
  db: FirebaseFirestore.Firestore,
  writes: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[]
) {
  const BATCH_SIZE = 499;
  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const chunk = writes.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const { ref, data } of chunk) {
      batch.set(ref, data);
    }
    await batch.commit();
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const uid = requireAdmin(locals);
    const body = (await request.json()) as GenerateRequest;

    if (!body.clientName?.trim()) {
      return new Response(JSON.stringify({ error: 'Client name is required' }), { status: 400 });
    }
    if (!body.startDate?.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return new Response(JSON.stringify({ error: 'Start date must be YYYY-MM-DD format' }), { status: 400 });
    }
    if (!body.monthsCount || body.monthsCount < 1 || body.monthsCount > 24) {
      return new Response(JSON.stringify({ error: 'Months count must be between 1 and 24' }), { status: 400 });
    }

    const db = getDb();
    const now = new Date().toISOString();

    // Fetch scheduling delay settings for the selected package
    const defaultDelays: PackageDelays = {
      postDelayDays: 0,
      videoDelayDays: 0,
      carouselDelayDays: 0,
      storyDelayDays: 0,
    };
    let delays = defaultDelays;
    const pkgName = body.packageName as PackageName | undefined;
    if (pkgName && PACKAGE_NAMES.includes(pkgName)) {
      const settingsDoc = await db.collection('settings').doc('scheduling_' + uid).get();
      if (settingsDoc.exists) {
        const data = settingsDoc.data() as Record<string, unknown>;
        if (data[pkgName] && typeof data[pkgName] === 'object') {
          delays = { ...defaultDelays, ...(data[pkgName] as Partial<PackageDelays>) };
        }
      }
    }

    // Create client
    const clientRef = db.collection('clients').doc();
    const client: Client = { userId: uid, name: body.clientName.trim(), createdAt: now, notes: body.notes || '', clickupId: body.clickupId || '' };
    if (Array.isArray(body.socialAccountIds) && body.socialAccountIds.length > 0) {
      client.socialAccountIds = body.socialAccountIds;
    }
    await clientRef.set(client);
    const clientId = clientRef.id;

    // Create plan
    const planRef = db.collection('plans').doc();
    const plan: Plan = {
      userId: uid,
      clientId,
      startMonth: body.startDate.substring(0, 7),
      monthsCount: body.monthsCount,
      postsPerMonth: body.postsPerMonth || 0,
      scenariosPerMonth: body.scenariosPerMonth || 0,
      carouselsPerMonth: body.carouselsPerMonth || 0,
      storiesPerMonth: body.storiesPerMonth || 0,
      createdAt: now,
    };
    await planRef.set(plan);
    const planId = planRef.id;

    const PERIOD_DAYS = 30;
    const clientStartDate = body.startDate; // YYYY-MM-DD

    // ── Create onboarding tasks in the task dashboard ──
    const onboardingTasks = [
      { title: 'Welcome email / call', dayOffset: 0 },
      { title: 'Create the scenarios', dayOffset: 1 },
      { title: 'Get access', dayOffset: 1 },
    ];
    const onboardingBatch = db.batch();
    for (const task of onboardingTasks) {
      const ref = db.collection('scheduled_tasks').doc();
      onboardingBatch.set(ref, {
        userId: uid,
        clientId,
        title: task.title,
        status: 'todo',
        scheduledDate: addDays(clientStartDate, task.dayOffset),
      });
    }
    await onboardingBatch.commit();

    // Calculate effective start dates per content type (delays from settings)
    const postStartDate = addDays(clientStartDate, delays.postDelayDays);
    const videoStartDate = addDays(clientStartDate, delays.videoDelayDays);
    const carouselStartDate = addDays(clientStartDate, delays.carouselDelayDays);
    const storyStartDate = addDays(clientStartDate, delays.storyDelayDays);

    // Helper: given a type's effective start date and a period's start/end dates,
    // returns the day (1-based) within the period from which scheduling should begin.
    function getFromDay(typeStartDate: string, periodStart: string, periodEnd: string): number {
      if (typeStartDate <= periodStart) return 1;
      if (typeStartDate > periodEnd) return PERIOD_DAYS + 1; // skip entirely
      // Calculate day offset within the period
      const startMs = new Date(periodStart + 'T00:00:00').getTime();
      const typeMs = new Date(typeStartDate + 'T00:00:00').getTime();
      return Math.floor((typeMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
    }

    // ── Schedule content using 30-day periods ──
    const allContentWrites: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[] = [];
    let contentItemsCreated = 0;
    const typeCounters = new Map<ContentType, number>();

    for (let i = 0; i < body.monthsCount; i++) {
      const periodStart = addDays(clientStartDate, i * PERIOD_DAYS);
      const periodEnd = addDays(clientStartDate, (i + 1) * PERIOD_DAYS - 1);
      const periodLabel = periodStart.substring(0, 7); // YYYY-MM of period start

      // Create month doc for this period
      const periodDate = new Date(periodStart + 'T00:00:00');
      const monthRef = db.collection('months').doc();
      const monthDoc: Month = {
        userId: uid,
        clientId,
        planId,
        label: periodLabel,
        year: periodDate.getFullYear(),
        month: periodDate.getMonth() + 1,
      };
      await monthRef.set(monthDoc);
      const monthId = monthRef.id;

      // Calculate per-type start days within this 30-day period
      const startDays: MonthStartDays = {
        posts: getFromDay(postStartDate, periodStart, periodEnd),
        scenarios: getFromDay(videoStartDate, periodStart, periodEnd),
        carousels: getFromDay(carouselStartDate, periodStart, periodEnd),
        stories: getFromDay(storyStartDate, periodStart, periodEnd),
      };

      // Schedule content for this 30-day period
      const scheduledItems = schedulePeriod(
        periodStart,
        PERIOD_DAYS,
        body.postsPerMonth || 0,
        body.scenariosPerMonth || 0,
        body.carouselsPerMonth || 0,
        body.storiesPerMonth || 0,
        startDays
      );

      for (const item of scheduledItems) {
        const currentNum = (typeCounters.get(item.type) || 0) + 1;
        typeCounters.set(item.type, currentNum);

        const contentRef = db.collection('content_items').doc();
        const contentItem: Omit<ContentItem, 'id'> = {
          userId: uid,
          clientId,
          planId,
          monthId,
          monthLabel: periodLabel,
          type: item.type,
          number: currentNum,
          scheduledDay: item.day,
          scheduledDate: item.date,
          status: 'todo',
        };
        allContentWrites.push({ ref: contentRef, data: contentItem as Record<string, unknown> });
        contentItemsCreated++;
      }
    }

    await batchWrite(db, allContentWrites);

    // Auto-create "edit" tasks one day before each content item
    const editTaskWrites: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[] = [];
    for (const write of allContentWrites) {
      const data = write.data;
      if (!data.type || !data.scheduledDate) continue;
      const postName = `${data.type} ${data.number}`;
      const editTaskDate = addDays(data.scheduledDate as string, -1);
      const editTaskRef = db.collection('scheduled_tasks').doc();
      editTaskWrites.push({
        ref: editTaskRef,
        data: {
          userId: uid,
          clientId,
          title: `Edit - ${postName} - ${client.name}`,
          status: 'todo',
          scheduledDate: editTaskDate,
        },
      });
    }
    await batchWrite(db, editTaskWrites);

    const response: GenerateResponse = {
      clientId,
      planId,
      monthsCreated: body.monthsCount,
      contentItemsCreated,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Generate error:', error);
    const status = error instanceof Error && error.message === 'Forbidden' ? 403 : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status }
    );
  }
};
