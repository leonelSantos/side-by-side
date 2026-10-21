import { format, isSameDay } from 'date-fns';

// Visible part of each day in the calendar grid
export const START_HOUR = 6;
export const END_HOUR = 24;
export const HOUR_PX = 48;

export const minutesOf = (d) => d.getHours() * 60 + d.getMinutes();

// Start/end minutes within a day; an end on a later day counts as midnight (24:00)
export function spanMinutes(start, end) {
  const s = minutesOf(start);
  const e = isSameDay(start, end) ? minutesOf(end) : 24 * 60;
  return [s, e];
}

// Absolute position for a span in a day column, or null if it's outside the visible hours
export function spanStyle(s, e) {
  const lo = START_HOUR * 60;
  const hi = END_HOUR * 60;
  const a = Math.max(s, lo);
  const b = Math.min(e, hi);
  if (b <= a) return null;
  return { top: ((a - lo) / 60) * HOUR_PX, height: Math.max(((b - a) / 60) * HOUR_PX, 16) };
}

export const toHHMM = (m) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export const fmt = (d) => format(d, d.getMinutes() ? 'h:mma' : 'ha').toLowerCase();

export const hourLabel = (h) => (h === 0 || h === 24 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`);

// Overlap of two lists of [start, end] intervals
export function intersect(a, b) {
  const out = [];
  for (const x of a) for (const y of b) {
    const s = Math.max(x[0], y[0]);
    const e = Math.min(x[1], y[1]);
    if (e > s) out.push([s, e]);
  }
  return merge(out);
}

export function merge(list) {
  const sorted = [...list].sort((p, q) => p[0] - q[0]);
  const out = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else out.push([...iv]);
  }
  return out;
}

export const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
