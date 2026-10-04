import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../config/firebase';

// Configure how notifications appear when the app is open.
// NOTE: Newer SDKs (53+) use shouldShowBanner / shouldShowList instead of shouldShowAlert.
// If TypeScript complains, you are on an older SDK — swap these two for shouldShowAlert: true.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Schedule a local notification on THIS device only.
// Use this for things that happen on the same phone (e.g. geofence events),
// NOT for notifying another person.
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
    // Android: the channel must exist before asking for permission (required on Android 13+)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'ChorePal',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4ECDC4',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.log('Permission error:', error);
    return false;
  }
};

// Register this device for push notifications and save the token to Firestore.
// Call this after login for BOTH parents and children.
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

    try {
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'd9a5e69b-ac88-4dd6-9eb1-b52cbf5f5da0',
      })).data;

      console.log('Push token:', token);

      const collectionName = userType === 'parent' ? 'users' : 'children';
      await updateDoc(doc(db, collectionName, userId), {
        pushToken: token,
      });

      return token;
    } catch (pushError) {
      console.log('Could not get push token (likely Expo Go) — remote push will not work:', pushError);
      return null;
    }
  } catch (error) {
    console.log('Notification setup error:', error);
    return null;
  }
};

// Send a remote push to a specific token.
// IMPORTANT: this no longer falls back to a local notification. A local fallback
// fires on the SENDER's phone, so the parent/child who should get the message never does.
// Returns true only if Expo accepted the message.
export const sendPushNotification = async (
  expoPushToken: string | null,
  title: string,
  body: string,
  data?: object
): Promise<boolean> => {
  if (!expoPushToken) {
    console.log('No push token for recipient — notification NOT sent:', title);
    return false;
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: expoPushToken,
        sound: 'default',
        channelId: 'default',
        priority: 'high',
        title,
        body,
        data: data || {},
      }),
    });

    // Expo returns HTTP 200 even when delivery fails, so check the body.
    const result = await response.json();
    const ticket = Array.isArray(result?.data) ? result.data[0] : result?.data;
    if (ticket?.status === 'error') {
      console.log('Expo push error:', ticket.message, ticket.details);
      return false;
    }
    return true;
  } catch (error) {
    console.log('Push request failed:', error);
    return false;
  }
};

// Look up a user's saved push token and notify them.
// Use this everywhere instead of reading tokens by hand:
//   notifyUser('parent', childData.parentId, 'Chore Submitted!', '...')
//   notifyUser('child', submission.childId, 'Chore Approved!', '...')
export const notifyUser = async (
  userType: 'parent' | 'child',
  userId: string,
  title: string,
  body: string,
  data?: object
): Promise<boolean> => {
  try {
    const collectionName = userType === 'parent' ? 'users' : 'children';
    const snap = await getDoc(doc(db, collectionName, userId));
    const token = snap.exists() ? (snap.data().pushToken as string | undefined) : undefined;
    return await sendPushNotification(token || null, title, body, data);
  } catch (error) {
    console.log('notifyUser error:', error);
    return false;
  }
};