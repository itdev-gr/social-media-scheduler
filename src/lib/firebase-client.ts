import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

let app: FirebaseApp;

function getApp(): FirebaseApp {
  if (getApps().length === 0) {
    app = initializeApp({
      apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
      authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
    });
  } else {
    app = getApps()[0];
  }
  return app;
}

export function getClientDb(): Firestore {
  return getFirestore(getApp());
}

export function getClientAuth(): Auth {
  return getAuth(getApp());
}
