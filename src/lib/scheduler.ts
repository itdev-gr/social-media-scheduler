import type { ContentType, ScheduledItem } from './types';
import { daysInMonth, makeDate } from './date-utils';

/**
 * Distributes `count` items evenly across `totalDays`, avoiding `occupiedDays`.
 * Returns an array of day numbers (1-based).
 */
export function scheduleContentDays(
  count: number,
  totalDays: number,
  occupiedDays: Set<number>
): number[] {
  if (count <= 0) return [];

  const step = totalDays / count;
  const days: number[] = [];

  for (let i = 0; i < count; i++) {
    let day = Math.round(1 + i * step);
    day = Math.max(1, Math.min(day, totalDays));
    while (occupiedDays.has(day) && day <= totalDays) {
      day++;
    }
    if (day > totalDays) {
      day = 1;
      while (occupiedDays.has(day) && day <= totalDays) {
        day++;
      }
    }
    days.push(day);
    occupiedDays.add(day);
  }

  return days;
}

/**
 * Schedules all content types for a given month, sharing one occupied set
 * so no two items land on the same day.
 */
export function scheduleMonth(
  year: number,
  month: number,
  posts: number,
  videos: number,
  carousels: number,
  stories: number = 0
): ScheduledItem[] {
  const totalDays = daysInMonth(year, month);
  const occupied = new Set<number>();
  const items: ScheduledItem[] = [];

  const contentTypes: { type: ContentType; count: number }[] = [
    { type: 'POST', count: posts },
    { type: 'VIDEO', count: videos },
    { type: 'CAROUSEL', count: carousels },
    { type: 'STORY', count: stories },
  ];

  for (const { type, count } of contentTypes) {
    const days = scheduleContentDays(count, totalDays, occupied);
    for (const day of days) {
      items.push({
        type,
        day,
        date: makeDate(year, month, day),
      });
    }
  }

  items.sort((a, b) => a.day - b.day);

  return items;
}
