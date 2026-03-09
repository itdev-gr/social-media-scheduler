import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App;
let db: Firestore;

function getApp(): App {
  if (getApps().length === 0) {
    const privateKey = (import.meta.env.FIREBASE_PRIVATE_KEY || '')
      .replace(/\\n/g, '\n');

    app = initializeApp({
      credential: cert({
        projectId: import.meta.env.FIREBASE_PROJECT_ID,
        clientEmail: import.meta.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  } else {
    app = getApps()[0];
  }
  return app;
}

export function getDb(): Firestore {
  if (!db) {
    db = getFirestore(getApp());
  }
  return db;
}

export function getAdminAuth(): Auth {
  return getAuth(getApp());
}
