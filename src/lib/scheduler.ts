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
 * Scenarios and Videos are linked: scenariosPerMonth creates both types
 * on the same days.
 */
export function scheduleMonth(
  year: number,
  month: number,
  posts: number,
  scenarios: number,
  carousels: number,
  stories: number = 0
): ScheduledItem[] {
  const totalDays = daysInMonth(year, month);
  const occupied = new Set<number>();
  const items: ScheduledItem[] = [];

  // Schedule posts
  const postDays = scheduleContentDays(posts, totalDays, occupied);
  for (const day of postDays) {
    items.push({ type: 'POST', day, date: makeDate(year, month, day) });
  }

  // Schedule scenarios + videos on the same days
  const scenarioDays = scheduleContentDays(scenarios, totalDays, occupied);
  for (const day of scenarioDays) {
    items.push({ type: 'SCENARIO', day, date: makeDate(year, month, day) });
    items.push({ type: 'VIDEO', day, date: makeDate(year, month, day) });
  }

  // Schedule carousels
  const carouselDays = scheduleContentDays(carousels, totalDays, occupied);
  for (const day of carouselDays) {
    items.push({ type: 'CAROUSEL', day, date: makeDate(year, month, day) });
  }

  // Schedule stories
  const storyDays = scheduleContentDays(stories, totalDays, occupied);
  for (const day of storyDays) {
    items.push({ type: 'STORY', day, date: makeDate(year, month, day) });
  }

  items.sort((a, b) => a.day - b.day);

  return items;
}
