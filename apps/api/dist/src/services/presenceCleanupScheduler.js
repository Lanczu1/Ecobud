"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopPresenceCleanupScheduler = exports.startPresenceCleanupScheduler = void 0;
const presenceService_1 = require("./presenceService");
const DEFAULT_PRESENCE_CLEANUP_INTERVAL_MS = Math.min(presenceService_1.PRESENCE_HEARTBEAT_INTERVAL_MS, 30_000);
let cleanupInterval = null;
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
        await presenceService_1.presenceService.cleanupStaleSessions({ publish: true });
    }
    catch (error) {
        console.error('Presence cleanup tick failed.', error);
    }
    finally {
        cleanupInFlight = false;
    }
};
const startPresenceCleanupScheduler = () => {
    if (cleanupInterval) {
        return cleanupInterval;
    }
    const intervalMs = resolveCleanupIntervalMs();
    cleanupInterval = setInterval(() => {
        void runCleanupTick();
    }, intervalMs);
    cleanupInterval.unref?.();
    void runCleanupTick();
    return cleanupInterval;
};
exports.startPresenceCleanupScheduler = startPresenceCleanupScheduler;
const stopPresenceCleanupScheduler = () => {
    if (!cleanupInterval) {
        return;
    }
    clearInterval(cleanupInterval);
    cleanupInterval = null;
};
exports.stopPresenceCleanupScheduler = stopPresenceCleanupScheduler;
