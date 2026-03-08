import type { ContentType, ScheduledItem } from './types';
import { daysInMonth, makeDate, addDays } from './date-utils';

/**
 * Distributes `count` items evenly across days [fromDay..totalDays], avoiding `occupiedDays`.
 * Returns an array of day numbers (1-based).
 * If fromDay > totalDays, returns empty (this type hasn't started yet in this month).
 */
export function scheduleContentDays(
  count: number,
  totalDays: number,
  occupiedDays: Set<number>,
  fromDay: number = 1
): number[] {
  if (count <= 0 || fromDay > totalDays) return [];

  const availableDays = totalDays - fromDay + 1;
  const step = availableDays / count;
  const days: number[] = [];

  for (let i = 0; i < count; i++) {
    let day = Math.round(fromDay + i * step);
    day = Math.max(fromDay, Math.min(day, totalDays));
    while (occupiedDays.has(day) && day <= totalDays) {
      day++;
    }
    if (day > totalDays) {
      day = fromDay;
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
 * Per-type start days within a month.
 * Each value is the first day (1-based) from which that type can be scheduled.
 * A value greater than the month's total days means the type is skipped entirely.
 */
export interface MonthStartDays {
  posts: number;
  scenarios: number;
  carousels: number;
  stories: number;
}

/**
 * Schedules all content types for a given month, sharing one occupied set
 * so no two items land on the same day.
 * Scenarios and Videos are linked: scenariosPerMonth creates both types
 * on the same days.
 * `startDays` controls which day each type starts from in this month.
 */
export function scheduleMonth(
  year: number,
  month: number,
  posts: number,
  scenarios: number,
  carousels: number,
  stories: number = 0,
  startDays: MonthStartDays = { posts: 1, scenarios: 1, carousels: 1, stories: 1 }
): ScheduledItem[] {
  const totalDays = daysInMonth(year, month);
  const occupied = new Set<number>();
  const items: ScheduledItem[] = [];

  // Schedule posts
  const postDays = scheduleContentDays(posts, totalDays, occupied, startDays.posts);
  for (const day of postDays) {
    items.push({ type: 'POST', day, date: makeDate(year, month, day) });
  }

  // Schedule scenarios + videos on the same days
  const scenarioDays = scheduleContentDays(scenarios, totalDays, occupied, startDays.scenarios);
  for (const day of scenarioDays) {
    items.push({ type: 'SCENARIO', day, date: makeDate(year, month, day) });
    items.push({ type: 'VIDEO', day, date: makeDate(year, month, day) });
  }

  // Schedule carousels
  const carouselDays = scheduleContentDays(carousels, totalDays, occupied, startDays.carousels);
  for (const day of carouselDays) {
    items.push({ type: 'CAROUSEL', day, date: makeDate(year, month, day) });
  }

  // Schedule stories
  const storyDays = scheduleContentDays(stories, totalDays, occupied, startDays.stories);
  for (const day of storyDays) {
    items.push({ type: 'STORY', day, date: makeDate(year, month, day) });
  }

  items.sort((a, b) => a.day - b.day);

  return items;
}

/**
 * Schedules content for a 30-day period starting from a given date.
 * Each "month" is a fixed 30-day window, not a calendar month.
 * `startDays` controls per-type offsets within the period (1-based day within the 30-day window).
 */
export function schedulePeriod(
  periodStart: string, // YYYY-MM-DD
  periodDays: number,  // typically 30
  posts: number,
  scenarios: number,
  carousels: number,
  stories: number = 0,
  startDays: MonthStartDays = { posts: 1, scenarios: 1, carousels: 1, stories: 1 }
): ScheduledItem[] {
  const occupied = new Set<number>();
  const items: ScheduledItem[] = [];

  // Schedule posts
  const postDays = scheduleContentDays(posts, periodDays, occupied, startDays.posts);
  for (const day of postDays) {
    items.push({ type: 'POST', day, date: addDays(periodStart, day - 1) });
  }

  // Schedule scenarios + videos on the same days
  const scenarioDays = scheduleContentDays(scenarios, periodDays, occupied, startDays.scenarios);
  for (const day of scenarioDays) {
    items.push({ type: 'SCENARIO', day, date: addDays(periodStart, day - 1) });
    items.push({ type: 'VIDEO', day, date: addDays(periodStart, day - 1) });
  }

  // Schedule carousels
  const carouselDays = scheduleContentDays(carousels, periodDays, occupied, startDays.carousels);
  for (const day of carouselDays) {
    items.push({ type: 'CAROUSEL', day, date: addDays(periodStart, day - 1) });
  }

  // Schedule stories
  const storyDays = scheduleContentDays(stories, periodDays, occupied, startDays.stories);
  for (const day of storyDays) {
    items.push({ type: 'STORY', day, date: addDays(periodStart, day - 1) });
  }

  items.sort((a, b) => a.day - b.day);

  return items;
}
