import { adminDelete, adminGet, adminPost, API_HOST } from '../utils/adminApi';
import type { AdminSection } from '../components/admin/AdminSidebar';

export const notificationCategories = ['verification','challenge','event','swap','reward','learning','announcement','system'] as const;
export type NotificationCategory = typeof notificationCategories[number];
export interface AdminNotification {
  id: string; category: NotificationCategory; title: string; message: string; recordType: string; recordId: string;
  barangays: string[]; actionRequired: boolean; resolvedAt: string | null; createdAt: string; isRead: boolean;
  targetRecordId?: string | null;
  diagnostics?: { channel: string; state: string; count: number }[];
}
export interface NotificationPage {
  items: AdminNotification[]; unreadCount: number; actionCount: number;
  next: { before: string; beforeId: string } | null;
}
export interface NotificationPreferences {
  pushCategories: NotificationCategory[]; quietStart: number | null; quietEnd: number | null; publicKey: string | null;
}
export function adminHref(section: AdminSection, extra: Record<string,string> = {}) {
  return `#admin?${new URLSearchParams({ section,...extra })}`;
}
export function notificationTarget(...types: string[]) {
  const q = new URLSearchParams(window.location.hash.split('?')[1] || '');
  return types.includes(q.get('kind') || '') ? q.get('record') : null;
}
export function notificationRecordHref(item: AdminNotification, role: string) {
  const sections: Record<string,AdminSection> = {
    id_verification: 'ID Verification',challenge_submission: 'Challenges',event_submission: 'Events',
    redemption: 'Redeem',listing: 'Give and Get Hub',listing_report: 'Give and Get Hub',
    lesson: 'Learning Content',challenge: 'Challenges',event: 'Events',announcement: 'Announcements',
  };
  if (item.recordType==='id_verification' && role==='admin') return null;
  if (['listing', 'listing_report'].includes(item.recordType) && role !== 'moderator') return null;
  const section = sections[item.recordType];
  const record=item.targetRecordId===undefined ? item.recordId : item.targetRecordId;
  return section && record ? adminHref(section,{ kind: item.recordType,record }) : null;
}
export function browserPushSupported() {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
function publicKeyBytes(key: string): Uint8Array<ArrayBuffer> {
  const raw = atob(key.replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(raw,value => value.charCodeAt(0));
}
export async function enableBrowserPush(publicKey: string) {
  if (!browserPushSupported()) throw new Error('This browser needs HTTPS and browser push support.');
  const permission = await Notification.requestPermission();
  if (permission!=='granted') throw new Error('Notifications were not allowed. You can change this in browser settings.');
  const reg = await navigator.serviceWorker.register('/admin-notifications-sw.js');
  await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKeyBytes(publicKey) });
  try { await adminPost('/admin/notifications/subscriptions',subscription.toJSON()); }
  catch (error) { await subscription.unsubscribe(); throw error; }
  return true;
}
export async function browserPushEnabled() {
  if (!browserPushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return Boolean(await reg?.pushManager.getSubscription());
}
export async function restoreBrowserPush() {
  if (!browserPushSupported() || Notification.permission!=='granted') return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const subscription = await reg?.pushManager.getSubscription();
  if (subscription) await adminPost('/admin/notifications/subscriptions',subscription.toJSON());
}
export async function disableBrowserPush() {
  if (!browserPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const res = await fetch(`${API_HOST}/api/admin/notifications/subscriptions`,{ method:'DELETE',headers: {
    'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('ecobud_admin_token') || ''}` },body:JSON.stringify({ endpoint:sub.endpoint }) });
  if (!res.ok) throw new Error('Could not disable browser alerts. Retry while connected.');
  await sub.unsubscribe();
}
export async function revokeAdminPushSession() {
  await adminDelete('/admin/notifications/subscriptions/session');
}
export function fetchNotificationPage(params = new URLSearchParams()) {
  return adminGet<NotificationPage>(`/admin/notifications?${params}`,{ bypassCache:true });
}
