import { Prisma } from '@prisma/client';
import nodemailer from 'nodemailer';
import { prisma } from '../prismaClient';
import { welcomeEmail } from './welcomeEmail';
import { supabaseRealtimeService } from './supabaseRealtimeService';
const mail = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }, connectionTimeout: 10000, socketTimeout: 20000 });
type EventRow = {
    key: string;
    type: string;
    related_id: string;
    title: string;
    message: string;
    user_id: string | null;
    cursor: string | null;
    created_at: Date;
    available_at: Date;
};
type Delivery = {
    id: string;
    notification_id: string;
    channel: string;
    destination: string;
    attempts: number;
    receipt: string | null;
};
async function fanout() {
    await prisma.$transaction(async (tx) => {
        const events = await tx.$queryRaw<EventRow[]> `SELECT * FROM notification_events WHERE NOT completed AND available_at<=CURRENT_TIMESTAMP ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`;
        const e = events[0];
        if (!e)
            return;
        if (e.type === 'challenge') {
            const c = await tx.challenge.findUnique({ where: { id: e.related_id } });
            if (!c || !c.active || (c.endDate && c.endDate <= new Date())) {
                await tx.$executeRaw `UPDATE notification_events SET completed=true WHERE key=${e.key}`;
                return;
            }
            if (c.startDate && c.startDate > new Date()) {
                await tx.$executeRaw `UPDATE notification_events SET available_at=${c.startDate} WHERE key=${e.key}`;
                return;
            }
        }
        const users = await tx.user.findMany({ where: { status: 'active', role: 'user', createdAt: { lte: e.available_at }, ...(e.user_id ? { id: e.user_id } : e.cursor ? { id: { gt: e.cursor } } : {}) }, orderBy: { id: 'asc' }, take: 200, select: { id: true, email: true } });
        if (users.length) {
            await tx.notification.createMany({ skipDuplicates: true, data: users.map(u => ({ userId: u.id, notificationKey: e.key, type: e.type, title: e.title, message: e.message, relatedId: e.related_id, relatedType: e.type, priority: ['challenge', 'verification', 'swap', 'reward'].includes(e.type) ? 'high' : e.type === 'event' ? 'medium' : 'low' })) });
            const ids = Prisma.join(users.map(u => u.id));
            await tx.$executeRaw `INSERT INTO notification_deliveries(id,notification_id,channel,destination) SELECT md5(n.id || ':realtime'),n.id,'realtime',n.user_id FROM notifications n WHERE n.notification_key=${e.key} AND n.user_id IN (${ids}) ON CONFLICT DO NOTHING`;
            if (e.type === 'verification')
                await tx.$executeRaw `INSERT INTO notification_deliveries(id,notification_id,channel,destination) SELECT md5(n.id || ':email'),n.id,'email',u.email FROM notifications n JOIN users u ON u.id=n.user_id WHERE n.notification_key=${e.key} AND n.user_id IN (${ids}) ON CONFLICT DO NOTHING`;
            await tx.$executeRaw `INSERT INTO notification_deliveries(id,notification_id,channel,destination) SELECT md5(n.id || ':push:' || d.token),n.id,'push',d.token FROM notifications n JOIN notification_devices d ON d.user_id=n.user_id JOIN users u ON u.id=d.user_id WHERE n.notification_key=${e.key} AND n.user_id IN (${ids}) AND d.session_version=u."sessionVersion" ON CONFLICT DO NOTHING`;
        }
        await tx.$executeRaw `UPDATE notification_events SET cursor=${users.at(-1)?.id ?? e.cursor},completed=${users.length < 200 || !!e.user_id} WHERE key=${e.key}`;
    }, { timeout: 30000 });
}
async function expo(path: string, body: unknown) {
    const r = await fetch('https://exp.host/--/api/v2/push/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (!r.ok)
        throw Object.assign(new Error('Push HTTP ' + r.status), { retrySafe: r.status === 429 });
    return (await r.json()) as any;
}
export async function deliverNotification(d: Delivery) {
    const n = await prisma.notification.findUnique({ where: { id: d.notification_id }, include: { user: { select: { status: true, email: true, sessionVersion: true } } } });
    if (!n || n.user.status !== 'active')
        return 'cancelled';
    if (d.channel === 'email') {
        if (n.user.email !== d.destination)
            return 'cancelled';
        await mail.sendMail({ from: `"ECOBUD" <${process.env.GMAIL_USER}>`, to: d.destination, messageId: `<welcome-${n.userId}@ecobud.app>`, ...welcomeEmail(process.env.ECOBUD_WELCOME_URL || 'ecobud://') });
        return 'sent';
    }
    if (d.channel === 'realtime') {
        if (!await supabaseRealtimeService.publishUserNotice(n.userId, { scope: 'notifications', title: n.title, message: n.message }))
            throw new Error('Realtime unavailable');
        return 'sent';
    }
    const devices = await prisma.$queryRaw<any[]> `SELECT token FROM notification_devices WHERE token=${d.destination} AND user_id=${n.userId} AND session_version=${n.user.sessionVersion}`;
    if (!devices.length)
        return 'cancelled';
    const result = d.receipt ? (await expo('getReceipts', { ids: [d.receipt] })).data?.[d.receipt] : (await expo('send', { to: d.destination, title: n.title, body: n.message, sound: 'default', data: { notificationId: n.id }, channelId: 'ecobud', priority: n.priority === 'high' ? 'high' : 'normal' })).data;
    if (!result)
        return 'receipt';
    if (result.status === 'error') {
        if (result.details?.error === 'DeviceNotRegistered')
            await prisma.$executeRaw `DELETE FROM notification_devices WHERE token=${d.destination}`;
        if (result.details?.error === 'MessageRateExceeded') {
            await prisma.$executeRaw `UPDATE notification_deliveries SET receipt=NULL WHERE id=${d.id}`;
            return 'pending';
        }
        console.warn('notification_delivery_rejected', d.id, result.details?.error);
        return 'failed';
    }
    if (!d.receipt && result.id) {
        await prisma.$executeRaw `UPDATE notification_deliveries SET receipt=${result.id} WHERE id=${d.id}`;
        return 'receipt';
    }
    return 'sent';
}
let running = false;
let timer: NodeJS.Timeout | undefined;
export async function notificationTick() {
    if (running)
        return;
    running = true;
    try {
        await fanout();
        // Stale network sends are ambiguous: never blindly resend email/push after a crash.
        await prisma.$executeRaw `UPDATE notification_deliveries SET state='uncertain' WHERE state='sending' AND next_at<CURRENT_TIMESTAMP - interval '5 minutes'`;
        const jobs = await prisma.$queryRaw<Delivery[]> `UPDATE notification_deliveries SET state='sending',attempts=attempts+1,next_at=CURRENT_TIMESTAMP WHERE id IN (SELECT id FROM notification_deliveries WHERE state IN ('pending','receipt') AND next_at<=CURRENT_TIMESTAMP AND attempts<20 ORDER BY next_at LIMIT 5 FOR UPDATE SKIP LOCKED) RETURNING *`;
        for (const d of jobs) {
            let state: string;
            try {
                state = await deliverNotification(d);
            }
            catch (error: any) {
                state = d.channel === 'realtime' ? 'pending' : d.receipt ? 'receipt' : error?.retrySafe || (d.channel === 'email' && (['ECONNECTION', 'EDNS'].includes(error?.code) || (error?.responseCode >= 400 && error?.responseCode < 500))) ? 'pending' : 'uncertain';
                console.error('notification_delivery_failed', d.id, state);
            }
            await prisma.$executeRaw `UPDATE notification_deliveries SET state=${state},next_at=${new Date(Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(d.attempts, 6)))} WHERE id=${d.id}`;
        }
    }
    catch {
        console.error('notification_worker_failed');
    }
    finally {
        running = false;
    }
}
export function startNotificationWorker() { void notificationTick(); timer = setInterval(() => void notificationTick(), 10000); timer.unref(); }
export function stopNotificationWorker() { if (timer)
    clearInterval(timer); }

export async function sendDirectNotification(params: {
    userId: string;
    type: string;
    title: string;
    message: string;
    relatedId?: string;
    relatedType?: string;
    priority?: string;
    notificationKey?: string;
}) {
    try {
        const key = params.notificationKey || `${params.type}:${params.relatedId || 'direct'}:${Date.now()}`;
        const user = await prisma.user.findUnique({
            where: { id: params.userId },
            select: { id: true, email: true, status: true, sessionVersion: true }
        });

        if (!user || user.status !== 'active') {
            return null;
        }

        const notification = await prisma.notification.create({
            data: {
                userId: user.id,
                notificationKey: key,
                type: params.type,
                title: params.title,
                message: params.message,
                relatedId: params.relatedId || null,
                relatedType: params.relatedType || params.type,
                priority: params.priority || (['challenge', 'verification', 'swap', 'reward'].includes(params.type) ? 'high' : 'medium'),
            }
        });

        // Insert deliveries for realtime and push
        await prisma.$executeRaw`
            INSERT INTO notification_deliveries(id, notification_id, channel, destination)
            VALUES (${`rt_${notification.id}`}, ${notification.id}, 'realtime', ${user.id})
            ON CONFLICT DO NOTHING
        `;

        const devices = await prisma.$queryRaw<any[]>`
            SELECT token FROM notification_devices 
            WHERE user_id = ${user.id} AND session_version = ${user.sessionVersion}
        `;

        for (const dev of devices) {
            await prisma.$executeRaw`
                INSERT INTO notification_deliveries(id, notification_id, channel, destination)
                VALUES (${`push_${notification.id}_${dev.token}`}, ${notification.id}, 'push', ${dev.token})
                ON CONFLICT DO NOTHING
            `;
        }

        // Trigger an immediate tick or deliver right away
        void notificationTick();

        return notification;
    } catch (err) {
        console.error('Failed to send direct notification:', err);
        return null;
    }
}
