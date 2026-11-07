import type { Response } from 'express';
import type { AuthenticatedRequest } from '../http/authentication';
import { prisma } from '../prismaClient';
import { TokenService } from '../security/tokenService';
import { residentLiveEvents } from './residentLiveEvents';

const connections = new Map<string, number>();

export async function streamSessionActive(req: AuthenticatedRequest) {
  try {
    const token = TokenService.verify(req.headers.authorization!.slice('Bearer '.length));
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { role: true, status: true, sessionVersion: true } });
    return Boolean(token.userId === req.auth!.userId && user && user.status === 'active' && user.role === req.auth!.role && user.sessionVersion === token.sessionVersion);
  } catch { return false; }
}

export function openResidentStream(req: AuthenticatedRequest, res: Response) {
  const userId = req.auth!.userId;
  if ((connections.get(userId) ?? 0) >= 3) { res.status(429).json({ message: 'Too many realtime connections.' }); return; }
  connections.set(userId, (connections.get(userId) ?? 0) + 1);
  let closed = false;
  let queued = 0;
  let chain = Promise.resolve();
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-store, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write(': connected\n\n');
  const close = () => {
    if (closed) return;
    closed = true;
    unsubscribe();
    clearInterval(heartbeat);
    clearTimeout(lifetime);
    const count = (connections.get(userId) ?? 1) - 1;
    if (count) connections.set(userId, count); else connections.delete(userId);
    res.end();
  };
  const send = (data: unknown) => {
    if (++queued > 100) { close(); return; }
    chain = chain.then(async () => {
      if (closed) return;
      if (!await streamSessionActive(req)) { close(); return; }
      if (!closed && !res.write(data ? `data: ${JSON.stringify(data)}\n\n` : ': ping\n\n')) close();
    }).catch(close).finally(() => { queued--; });
  };
  const unsubscribe = residentLiveEvents.subscribe(userId, message => send({ event: message.event, payload: message.payload }));
  const heartbeat = setInterval(() => send(null), 15_000);
  const lifetime = setTimeout(close, 5 * 60_000);
  res.once('close', close);
}
