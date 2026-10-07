/** Runs once when the server starts. Starts the background channel checker. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return;
  const { startScheduler } = await import('./server/video/scheduler');
  startScheduler();
}
