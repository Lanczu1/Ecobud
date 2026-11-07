import { fetch } from 'expo/fetch';
import { API_BASE } from '../api/ecobudApi';

export interface RealtimeMessage { event: string; payload: Record<string, any> }
interface Listener {
  onMessage: (message: RealtimeMessage) => void;
  onStatus?: (live: boolean) => void;
  onExpired?: () => void;
}
interface Connection { listeners: Set<Listener>; controller?: AbortController; timer?: ReturnType<typeof setTimeout>; live: boolean; delay: number; stopped: boolean }
const connections = new Map<string, Connection>();

export function subscribeAuthenticatedRealtime(token: string, listener: Listener) {
  let connection = connections.get(token);
  if (!connection) {
    connection = { listeners: new Set(), live: false, delay: 1000, stopped: false };
    connections.set(token, connection);
  }
  const current = connection;
  current.listeners.add(listener);
  listener.onStatus?.(current.live);
  const status = (live: boolean) => { current.live = live; current.listeners.forEach(item => item.onStatus?.(live)); };
  const open = async () => {
    if (current.stopped || current.controller) return;
    const controller = new AbortController();
    current.controller = controller;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const touch = () => { if (watchdog) clearTimeout(watchdog); watchdog = setTimeout(() => controller.abort(), 45_000); };
    try {
      touch();
      const response = await fetch(`${API_BASE}/realtime/user-stream`, { headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }, signal: controller.signal });
      if (response.status === 401 || response.status === 403) {
        current.stopped = true;
        current.listeners.forEach(item => item.onExpired?.());
        return;
      }
      if (!response.ok || !response.body) throw new Error('Realtime unavailable.');
      status(true);
      current.delay = 1000;
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!current.stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        touch();
        buffer += decoder.decode(value, { stream: true });
        if (buffer.length > 65536) throw new Error('Realtime message exceeds limit.');
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const data = frame.split('\n').find(line => line.startsWith('data: '));
          if (!data) continue;
          try {
            const message = JSON.parse(data.slice(6)) as RealtimeMessage;
            if (typeof message.event === 'string' && message.payload && typeof message.payload === 'object') {
              current.listeners.forEach(item => { try { item.onMessage(message); } catch {} });
            }
          } catch {}
        }
      }
    } catch {} finally {
      if (watchdog) clearTimeout(watchdog);
      void reader?.cancel().catch(() => undefined);
      controller.abort();
      current.controller = undefined;
      status(false);
      if (!current.stopped && current.listeners.size) {
        current.timer = setTimeout(() => { current.timer = undefined; void open(); }, current.delay);
        current.delay = Math.min(30_000, current.delay * 2);
      }
    }
  };
  if (!current.controller && !current.timer) void open();
  return () => {
    current.listeners.delete(listener);
    listener.onStatus?.(false);
    if (!current.listeners.size) {
      current.stopped = true;
      if (current.timer) clearTimeout(current.timer);
      current.controller?.abort();
      connections.delete(token);
    }
  };
}
