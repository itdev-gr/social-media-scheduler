// Content types
export type ContentType = 'POST' | 'VIDEO' | 'CAROUSEL';

// Content item status
export type ContentStatus = 'todo' | 'doing' | 'done';

// Firestore document interfaces
export interface Client {
  id?: string;
  name: string;
  createdAt: string; // ISO string
}

export interface Plan {
  id?: string;
  clientId: string;
  startMonth: string; // YYYY-MM
  monthsCount: number;
  postsPerMonth: number;
  videosPerMonth: number;
  carouselsPerMonth: number;
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
  scheduledDay: number; // day of month
  scheduledDate: string; // YYYY-MM-DD
  status: ContentStatus;
}

// API request/response
export interface GenerateRequest {
  clientName: string;
  startMonth: string; // YYYY-MM
  monthsCount: number;
  postsPerMonth: number;
  videosPerMonth: number;
  carouselsPerMonth: number;
}

export interface GenerateResponse {
  clientId: string;
  planId: string;
  monthsCreated: number;
  contentItemsCreated: number;
}

// Scheduled item from the scheduler
export interface ScheduledItem {
  type: ContentType;
  day: number;
  date: string; // YYYY-MM-DD
}
