/** Pure calculations behind the feed. Kept free of I/O so they are easy to test. */

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

const DAY = 86_400_000;

/**
 * The channel's "normal" for one kind of video: the median views of its
 * recent uploads. Videos under a day old are left out while there are at
 * least five older ones, because they have not had time to collect views.
 */
export function baselineViews(videos: { viewCount: number | null; publishedAt: Date }[], now = new Date()): number | null {
  const counted = videos.filter((v): v is { viewCount: number; publishedAt: Date } => v.viewCount !== null);
  const settled = counted.filter((v) => now.getTime() - v.publishedAt.getTime() >= DAY);
  return median((settled.length >= 5 ? settled : counted).map((v) => v.viewCount));
}

/** How many times the channel's normal a video reached, to one decimal place. */
export function outlierMultiple(views: number | null, baseline: number | null): number | null {
  if (views === null || baseline === null || baseline <= 0) return null;
  return Math.round((views / baseline) * 10) / 10;
}

/** Shortest gap between two checks that gives a meaningful rate. */
export const MIN_RATE_WINDOW_HOURS = 0.25;

/** Views gained per hour between two checks. Null when the gap is too short or a count is missing. */
export function viewsPerHour(prev: { viewCount: number | null; takenAt: Date } | undefined, views: number | null, now: Date): number | null {
  if (!prev || prev.viewCount === null || views === null) return null;
  const hours = (now.getTime() - prev.takenAt.getTime()) / 3_600_000;
  if (hours < MIN_RATE_WINDOW_HOURS) return null;
  return Math.max(0, Math.round(((views - prev.viewCount) / hours) * 10) / 10);
}
