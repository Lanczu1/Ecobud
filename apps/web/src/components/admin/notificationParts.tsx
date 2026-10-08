import { ArrowLeftRight, Bell, BookOpen, Calendar, ClipboardList, Flag, Gift, IdCard, Megaphone, TriangleAlert, Trophy, type LucideIcon } from 'lucide-react';
import type { AdminNotification, NotificationCategory } from '../../services/adminNotifications';

const statusTone: Record<string,string>={
  'Needs action':'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  Resolved:'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  Update:'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};
// Same icons as the sidebar sections each record opens, so a row reads as "this came from Events".
const recordIcons: Record<string,LucideIcon>={
  id_verification:IdCard,challenge_submission:Trophy,challenge:Trophy,event_submission:Calendar,event:Calendar,
  redemption:Gift,listing:ArrowLeftRight,listing_report:Flag,lesson:BookOpen,announcement:Megaphone,
  review_summary:ClipboardList,delivery_failure:TriangleAlert,worker_failure:TriangleAlert,
};
export function RecordIcon({ recordType,unread=false }: { recordType: string; unread?: boolean }) {
  const Icon=recordIcons[recordType] ?? Bell;
  return <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${unread ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}><Icon className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>;
}
export function StatusChip({ status }: { status: string }) {
  return <span className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold ${statusTone[status]}`}>{status}</span>;
}
export const notificationCategoryLabels: Record<NotificationCategory,string>={ verification:'ID verification',challenge:'Challenges',event:'Events',swap:'Listings & reports',reward:'Rewards',learning:'Learning',announcement:'Announcements',system:'System alerts' };
export function notificationStatus(item: Pick<AdminNotification,'actionRequired' | 'resolvedAt'>) {
  return item.actionRequired ? item.resolvedAt ? 'Resolved' : 'Needs action' : 'Update';
}
