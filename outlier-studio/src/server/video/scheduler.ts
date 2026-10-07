import 'server-only';
import { env } from '../env';
import { refreshDue } from './tracking';
import { MONITORED_PLATFORMS, platformConfigured } from './platforms';

const TICK_MS = 10 * 60_000;
const FIRST_TICK_MS = 20_000;

type State = { started?: boolean; running?: boolean };
const state = ((globalThis as Record<string, unknown>).__trackingScheduler ??= {}) as State;

async function tick(): Promise<void> {
  if (state.running || !MONITORED_PLATFORMS.some(platformConfigured)) return;
  state.running = true;
  try {
    const result = await refreshDue(20);
    if (result.checked > 0) console.log(`[tracking] checked ${result.checked} channel(s)${result.stoppedEarly ? ', stopped early (quota or key problem)' : ''}`);
  } catch (err) {
    console.error('[tracking] scheduled check failed', err);
  } finally {
    state.running = false;
  }
}

/**
 * Checks due channels every ten minutes for as long as this server process
 * runs. On hosts that do not keep a process alive (serverless), set
 * DISABLE_SCHEDULER=1 and call POST /api/cron/refresh on a schedule instead.
 */
export function startScheduler(): void {
  const e = env();
  if (state.started || e.NODE_ENV === 'test' || e.DISABLE_SCHEDULER === '1') return;
  state.started = true;
  setTimeout(() => void tick(), FIRST_TICK_MS).unref();
  setInterval(() => void tick(), TICK_MS).unref();
}
