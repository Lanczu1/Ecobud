import { EventEmitter } from 'events';

const bus = new EventEmitter();
bus.setMaxListeners(0);

/** In-process change feed for the admin web stream. Carries no data, only "something changed". */
export const adminLiveEvents = {
  emit() {
    bus.emit('change');
  },
  subscribe(listener: () => void) {
    bus.on('change', listener);
    return () => { bus.off('change', listener); };
  },
};
