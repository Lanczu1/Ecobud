export type NotificationType =
  | 'challenge'
  | 'verification'
  | 'swap'
  | 'chat'
  | 'event'
  | 'reward'
  | 'learning'
  | 'streak'
  | 'leaderboard'
  | 'system';

export interface AppNotification {
    id: string;
    type: NotificationType | string;
    title: string;
    message: string;
    createdAt: string;
    isRead: boolean;
    relatedId: string | null;
    relatedType: string | null;
}
export interface NotificationPage {
    items: AppNotification[];
    unreadCount: number;
    nextOffset: number | null;
}

