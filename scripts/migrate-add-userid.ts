/**
 * Migration script: Add userId field to all existing documents.
 *
 * Usage:
 *   npx tsx scripts/migrate-add-userid.ts <ADMIN_UID>
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON, OR
 *   - FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars set.
 *
 * This script:
 *   1. Batch-updates all docs in clients, plans, months, content_items, scheduled_tasks
 *      to set userId = <ADMIN_UID>.
 *   2. Copies settings/scheduling → settings/scheduling_<ADMIN_UID>.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: npx tsx scripts/migrate-add-userid.ts <ADMIN_UID>');
  process.exit(1);
}

// Initialize Firebase Admin
if (getApps().length === 0) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp();
  } else {
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
}

const db = getFirestore();
const BATCH_SIZE = 499;

async function migrateCollection(collectionName: string): Promise<number> {
  const snap = await db.collection(collectionName).get();
  if (snap.empty) {
    console.log(`  ${collectionName}: 0 docs (empty)`);
    return 0;
  }

  // Filter to only docs that don't already have userId set
  const docsToUpdate = snap.docs.filter((d) => d.data().userId !== uid);

  if (docsToUpdate.length === 0) {
    console.log(`  ${collectionName}: ${snap.size} docs (all already migrated)`);
    return 0;
  }

  for (let i = 0; i < docsToUpdate.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docsToUpdate.slice(i, i + BATCH_SIZE);
    for (const doc of chunk) {
      batch.update(doc.ref, { userId: uid });
    }
    await batch.commit();
  }

  console.log(`  ${collectionName}: updated ${docsToUpdate.length}/${snap.size} docs`);
  return docsToUpdate.length;
}

async function migrateSettings(): Promise<void> {
  const srcRef = db.collection('settings').doc('scheduling');
  const srcDoc = await srcRef.get();

  if (!srcDoc.exists) {
    console.log('  settings/scheduling: not found, skipping');
    return;
  }

  const destRef = db.collection('settings').doc(`scheduling_${uid}`);
  const destDoc = await destRef.get();

  if (destDoc.exists) {
    console.log(`  settings/scheduling_${uid}: already exists, skipping`);
    return;
  }

  await destRef.set(srcDoc.data()!);
  console.log(`  settings/scheduling → settings/scheduling_${uid}: copied`);
}

async function main() {
  console.log(`\nMigrating all documents to userId = ${uid}\n`);

  const collections = ['clients', 'plans', 'months', 'content_items', 'scheduled_tasks'];
  let total = 0;

  for (const col of collections) {
    total += await migrateCollection(col);
  }

  await migrateSettings();

  console.log(`\nDone. Updated ${total} documents total.\n`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
