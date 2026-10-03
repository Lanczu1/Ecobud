import { useEffect, useRef, useState } from 'react';
import { AppState, DeviceEventEmitter, Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { ecobudApi } from '../../shared/api/ecobudApi';

// Remote push notification token listeners & Expo push tokens are no longer supported in Expo Go (SDK 53+)
const isExpoGo = isRunningInExpoGo() || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
// Direct FCM registration is currently configured for the checked-in Android app.
// iOS needs a Firebase Messaging native integration before enabling this path.
const nativePush = Platform.OS === 'android' && !isExpoGo;

if (nativePush) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Graceful fallback
  }
}

export function useNotifications(token?: string, pushEnabled: boolean = true) {
  const [count, setCount] = useState(0);
  const deviceTokenRef = useRef<string | undefined>(undefined);
  const registrationQueue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let alive = true;
    if (!token) { setCount(0); return; }
    const refresh = () => {
      void ecobudApi.notifications(token).then(page => { if (alive) setCount(page.unreadCount); }).catch(() => {});
    };
    const register = (updatedToken?: string) => {
      if (!nativePush || !alive) return Promise.resolve();
      registrationQueue.current = registrationQueue.current.then(async () => {
        if (!alive) return;
        try {
          if (!pushEnabled) {
            const deviceToken = deviceTokenRef.current ?? String((await Notifications.getDevicePushTokenAsync()).data);
            if (!alive) return;
            await ecobudApi.unregisterPush(token, deviceToken);
            deviceTokenRef.current = undefined;
            return;
          }
          if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('ecobud', { name: 'ECOBUD', importance: Notifications.AndroidImportance.HIGH });
          let permissions = await Notifications.getPermissionsAsync();
          if (!permissions.granted && permissions.canAskAgain) permissions = await Notifications.requestPermissionsAsync();
          if (!alive) return;
          if (!permissions.granted) {
            if (deviceTokenRef.current) {
              await ecobudApi.unregisterPush(token, deviceTokenRef.current);
              deviceTokenRef.current = undefined;
            }
            return;
          }
          // Android returns an FCM registration token, which the API sends through
          // Firebase Admin directly. This avoids routing device pushes through Expo.
          const deviceToken = updatedToken ?? String((await Notifications.getDevicePushTokenAsync()).data);
          if (alive) {
            await ecobudApi.registerPush(token, deviceToken);
            deviceTokenRef.current = deviceToken;
          }
        } catch { console.warn('Push registration unavailable; in-app notifications remain available.'); }
      });
      return registrationQueue.current;
    };
    refresh();
    void register();
    const interval = setInterval(() => { if (AppState.currentState === 'active') { refresh(); void register(); } }, 30000);
    const app = AppState.addEventListener('change', state => { if (state === 'active') { refresh(); void register(); } });
    const changed = DeviceEventEmitter.addListener('notificationsChanged', refresh);
    const inboxChanged = DeviceEventEmitter.addListener('notificationsInboxRefresh', refresh);
    const subscriptions: { remove(): void }[] = [];
    if (nativePush && pushEnabled) {
      try {
        subscriptions.push(Notifications.addNotificationReceivedListener(() => {
          refresh(); DeviceEventEmitter.emit('notificationsInboxRefresh');
          DeviceEventEmitter.emit('announcementsChanged');
        }));
        const response = (result: Notifications.NotificationResponse) => {
          const id = result.notification.request.content.data?.notificationId;
          if (alive && typeof id === 'string') { refresh(); DeviceEventEmitter.emit('openNotification', id); }
        };
        subscriptions.push(Notifications.addNotificationResponseReceivedListener(response));
        subscriptions.push(Notifications.addPushTokenListener(device => void register(String(device.data))));
        void Notifications.getLastNotificationResponseAsync().then(result => {
          if (result && alive) { response(result); void Notifications.clearLastNotificationResponseAsync(); }
        }).catch(() => {});
      } catch (err) {
        console.warn('Native push listeners disabled in current environment:', err);
      }
    }
    return () => {
      alive = false;
      clearInterval(interval); app.remove(); changed.remove(); inboxChanged.remove(); subscriptions.forEach(subscription => subscription.remove());
    };
  }, [token, pushEnabled]);
  return count;
}
