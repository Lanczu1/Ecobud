import { useEffect, useState } from 'react';
import { AppState, DeviceEventEmitter, Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { ecobudApi } from '../../shared/api/ecobudApi';

// Remote push notification token listeners & Expo push tokens are no longer supported in Expo Go (SDK 53+)
const isExpoGo = isRunningInExpoGo() || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const nativePush = Platform.OS !== 'web' && !isExpoGo;

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

export function useNotifications(token?: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    let registering = false;
    let deviceToken: string | undefined;
    if (!token) { setCount(0); return; }
    const refresh = () => {
      void ecobudApi.notifications(token).then(page => { if (alive) setCount(page.unreadCount); }).catch(() => {});
    };
    const register = async () => {
      if (!nativePush || registering || !alive) return;
      registering = true;
      try {
        if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('ecobud', { name: 'ECOBUD', importance: Notifications.AndroidImportance.HIGH });
        let permissions = await Notifications.getPermissionsAsync();
        if (!permissions.granted && permissions.canAskAgain) permissions = await Notifications.requestPermissionsAsync();
        if (!permissions.granted) {
          if (deviceToken) await ecobudApi.unregisterPush(token, deviceToken);
          return;
        }
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
        if (!projectId) return;
        deviceToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        if (alive) {
          await ecobudApi.registerPush(token, deviceToken);
          if (!alive) await ecobudApi.unregisterPush(token, deviceToken);
        }
      } catch { console.warn('Push registration unavailable; in-app notifications remain available.'); }
      finally { registering = false; }
    };
    refresh();
    void register();
    const interval = setInterval(() => { if (AppState.currentState === 'active') refresh(); }, 30000);
    const app = AppState.addEventListener('change', state => { if (state === 'active') { refresh(); void register(); } });
    const changed = DeviceEventEmitter.addListener('notificationsChanged', refresh);
    const subscriptions: { remove(): void }[] = [];
    if (nativePush) {
      try {
        subscriptions.push(Notifications.addNotificationReceivedListener(() => {
          refresh(); DeviceEventEmitter.emit('notificationsInboxRefresh');
        }));
        const response = (result: Notifications.NotificationResponse) => {
          const id = result.notification.request.content.data?.notificationId;
          if (alive && typeof id === 'string') { refresh(); DeviceEventEmitter.emit('openNotification', id); }
        };
        subscriptions.push(Notifications.addNotificationResponseReceivedListener(response));
        subscriptions.push(Notifications.addPushTokenListener(() => void register()));
        void Notifications.getLastNotificationResponseAsync().then(result => {
          if (result && alive) { response(result); void Notifications.clearLastNotificationResponseAsync(); }
        }).catch(() => {});
      } catch (err) {
        console.warn('Native push listeners disabled in current environment:', err);
      }
    }
    return () => {
      alive = false;
      clearInterval(interval); app.remove(); changed.remove(); subscriptions.forEach(subscription => subscription.remove());
      if (deviceToken) void ecobudApi.unregisterPush(token, deviceToken).catch(() => {});
    };
  }, [token]);
  return count;
}
