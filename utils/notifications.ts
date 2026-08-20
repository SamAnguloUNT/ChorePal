import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../config/firebase';

// Configure how notifications appear when app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Schedule a local notification
export const scheduleLocalNotification = async (
  title: string,
  body: string,
) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null, // null = show immediately
    });
  } catch (error) {
    console.log('Local notification error:', error);
  }
};

// Request notification permissions
export const requestNotificationPermissions = async () => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'ChorePal',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4ECDC4',
      });
    }
    return status === 'granted';
  } catch (error) {
    console.log('Permission error:', error);
    return false;
  }
};

// Register for push notifications (gracefully handles Expo Go limitation)
export const registerForPushNotifications = async (
  userId: string,
  userType: 'parent' | 'child'
): Promise<string | null> => {
  try {
    if (!Device.isDevice) {
      console.log('Must use real device for notifications');
      return null;
    }

    const granted = await requestNotificationPermissions();
    if (!granted) {
      console.log('Notification permission denied');
      return null;
    }

    // Try to get push token — will fail gracefully in Expo Go
    try {
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'd9a5e69b-ac88-4dd6-9eb1-b52cbf5f5da0',
      })).data;

      console.log('Push token:', token);

      const collection = userType === 'parent' ? 'users' : 'children';
      await updateDoc(doc(db, collection, userId), {
        pushToken: token,
      });

      return token;
    } catch (pushError) {
      console.log('Push token not available (Expo Go limitation) — using local notifications only');
      return null;
    }

  } catch (error) {
    console.log('Notification setup error:', error);
    return null;
  }
};

// Send push notification — falls back to local if no push token
export const sendPushNotification = async (
  expoPushToken: string | null,
  title: string,
  body: string,
  data?: object
) => {
  // If no push token use local notification instead
  if (!expoPushToken) {
    await scheduleLocalNotification(title, body);
    return;
  }

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: expoPushToken,
        sound: 'default',
        title,
        body,
        data: data || {},
      }),
    });
  } catch (error) {
    console.log('Push failed, falling back to local:', error);
    await scheduleLocalNotification(title, body);
  }
};