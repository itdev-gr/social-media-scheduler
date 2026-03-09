// Content types
export type ContentType = 'POST' | 'VIDEO' | 'CAROUSEL' | 'STORY' | 'SCENARIO';

// Content item status
export type ContentStatus = 'todo' | 'doing' | 'done';

// Publish status for Post Bridge integration
export type PublishStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'partially_failed' | 'failed';

// Client approval status
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

// Social account from Post Bridge
export interface SocialAccount {
  id: number;
  platform: 'instagram' | 'facebook';
  name: string;
  username?: string;
}

// Firestore document interfaces
export interface Client {
  id?: string;
  userId?: string;
  name: string;
  createdAt: string; // ISO string
  notes?: string;
  active?: boolean; // defaults to true
  clickupId?: string;
  socialAccountIds?: number[]; // Post Bridge social account IDs assigned to this client
}

export interface Plan {
  id?: string;
  userId?: string;
  clientId: string;
  startMonth: string; // YYYY-MM
  monthsCount: number;
  postsPerMonth: number;
  scenariosPerMonth: number; // also determines videosPerMonth (1:1)
  carouselsPerMonth: number;
  storiesPerMonth: number;
  createdAt: string;
}

export interface Month {
  id?: string;
  userId?: string;
  clientId: string;
  planId: string;
  label: string; // YYYY-MM
  year: number;
  month: number; // 1-12
}

export interface ContentItem {
  id?: string;
  userId?: string;
  clientId: string;
  planId: string;
  monthId: string;
  monthLabel: string; // YYYY-MM
  type: ContentType;
  number: number; // e.g. 1, 2, 3 — global per type across all months
  scheduledDay: number; // day of month
  scheduledDate: string; // YYYY-MM-DD
  status: ContentStatus;
  customName?: string; // optional user-defined name displayed on calendar
  caption?: string;
  mediaIds?: string[];         // Post Bridge media IDs
  mediaUrls?: string[];        // Preview URLs for uploaded images
  platforms?: ('instagram' | 'facebook')[];
  postBridgePostId?: string;   // Post Bridge post ID after submission
  publishStatus?: PublishStatus;
  publishError?: string;
  retryCount?: number;
  scheduledPostTime?: string;  // HH:mm for time-of-day scheduling
  approvalStatus?: ApprovalStatus;
  clientNotes?: string;
}

// API request/response
export interface GenerateRequest {
  clientName: string;
  packageName?: string;
  startDate: string; // YYYY-MM-DD
  monthsCount: number;
  postsPerMonth: number;
  scenariosPerMonth: number; // creates both SCENARIO and VIDEO items
  carouselsPerMonth: number;
  storiesPerMonth: number;
  notes?: string;
  clickupId?: string;
}

export interface GenerateResponse {
  clientId: string;
  planId: string;
  monthsCreated: number;
  contentItemsCreated: number;
}

// Scheduling delay settings per package
export interface PackageDelays {
  postDelayDays: number;
  videoDelayDays: number;
  carouselDelayDays: number;
  storyDelayDays: number;
}

export const PACKAGE_NAMES = ['Edit Only', 'Starter', 'Growth', 'Performance', 'Custom'] as const;
export type PackageName = typeof PACKAGE_NAMES[number];

// Map of package name → delays
export type SchedulingSettings = Record<PackageName, PackageDelays>;

// Scheduled item from the scheduler
export interface ScheduledItem {
  type: ContentType;
  day: number;
  date: string; // YYYY-MM-DD
}
