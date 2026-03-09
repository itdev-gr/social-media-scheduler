/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly FIREBASE_PROJECT_ID: string;
  readonly FIREBASE_CLIENT_EMAIL: string;
  readonly FIREBASE_PRIVATE_KEY: string;
  readonly PUBLIC_FIREBASE_API_KEY: string;
  readonly PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  readonly PUBLIC_FIREBASE_PROJECT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    user: {
      uid: string;
      email: string;
      type: 'admin' | 'user';
    } | null;
  }
}
