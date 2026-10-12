// While every realtime channel is subscribed, server signals drive refreshes and the
// timers only run as a slower safety net. Any drop puts the timers back at full speed.
const SLOW_POLL_FACTOR = 2;

let healthy = false;
let connections = 0;

export const setRealtimeHealthy = (next: boolean) => {
  if (next === healthy) return;
  healthy = next;
  if (next) connections += 1;
};

export const isRealtimeHealthy = () => healthy;

export function startFallbackPoll(run: () => void, intervalMs: number) {
  let skipped = 0;
  let seenConnections = connections;
  const timer = setInterval(() => {
    // Signals sent while the channels were down were missed, so the first tick after a reconnect always runs.
    const reconnected = seenConnections !== connections;
    seenConnections = connections;
    if (healthy && !reconnected && skipped < SLOW_POLL_FACTOR - 1) {
      skipped += 1;
      return;
    }
    skipped = 0;
    run();
  }, intervalMs);
  return () => clearInterval(timer);
}
