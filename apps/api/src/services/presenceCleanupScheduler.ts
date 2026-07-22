import { PRESENCE_HEARTBEAT_INTERVAL_MS, presenceService } from './presenceService';

const DEFAULT_PRESENCE_CLEANUP_INTERVAL_MS = Math.min(
  PRESENCE_HEARTBEAT_INTERVAL_MS,
  30_000,
);

let cleanupInterval: NodeJS.Timeout | null = null;
let cleanupInFlight = false;

const resolveCleanupIntervalMs = () => {
  const configuredValue = Number(process.env.PRESENCE_CLEANUP_INTERVAL_MS ?? '');

  if (Number.isFinite(configuredValue) && configuredValue > 0) {
    return configuredValue;
  }

  return DEFAULT_PRESENCE_CLEANUP_INTERVAL_MS;
};

const runCleanupTick = async () => {
  if (cleanupInFlight) {
    return;
  }

  cleanupInFlight = true;

  try {
    await presenceService.cleanupStaleSessions({ publish: true });
  } catch (error) {
    console.error('Presence cleanup tick failed.', error);
  } finally {
    cleanupInFlight = false;
  }
};

export const startPresenceCleanupScheduler = () => {
  if (cleanupInterval) {
    return cleanupInterval;
  }

  const intervalMs = resolveCleanupIntervalMs();
  cleanupInterval = setInterval(() => {
    void runCleanupTick();
  }, intervalMs);

  void runCleanupTick();

  return cleanupInterval;
};

export const stopPresenceCleanupScheduler = () => {
  if (!cleanupInterval) {
    return;
  }

  clearInterval(cleanupInterval);
  cleanupInterval = null;
};
