import { EventEmitter } from 'events';

export interface ResidentLiveEvent {
  event: string;
  audience: 'global' | 'user';
  userId?: string;
  payload: Record<string, unknown>;
}

const bus = new EventEmitter();
bus.setMaxListeners(0);

export const residentLiveEvents = {
  publish(message: ResidentLiveEvent) { bus.emit('change', message); },
  subscribe(userId: string, listener: (message: ResidentLiveEvent) => void) {
    const scoped = (message: ResidentLiveEvent) => {
      if (message.audience === 'global' || message.userId === userId) listener(message);
    };
    bus.on('change', scoped);
    return () => { bus.off('change', scoped); };
  },
};
