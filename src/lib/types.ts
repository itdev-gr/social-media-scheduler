// Content types
export type ContentType = 'POST' | 'VIDEO' | 'CAROUSEL' | 'STORY' | 'SCENARIO';

// Content item status
export type ContentStatus = 'todo' | 'doing' | 'done';

// Firestore document interfaces
export interface Client {
  id?: string;
  name: string;
  createdAt: string; // ISO string
  notes?: string;
  active?: boolean; // defaults to true
  clickupId?: string;
}

export interface Plan {
  id?: string;
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
  clientId: string;
  planId: string;
  label: string; // YYYY-MM
  year: number;
  month: number; // 1-12
}

export interface ContentItem {
  id?: string;
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
}

// API request/response
export interface GenerateRequest {
  clientName: string;
  startMonth: string; // YYYY-MM
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

// Scheduling delay settings
export interface SchedulingSettings {
  postDelayDays: number;
  videoDelayDays: number;
  carouselDelayDays: number;
}

// Scheduled item from the scheduler
export interface ScheduledItem {
  type: ContentType;
  day: number;
  date: string; // YYYY-MM-DD
}
