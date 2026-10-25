import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { deleteField, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import AnimatedEntry from '../components/AnimatedEntry';
import PressableScale from '../components/PressableScale';
import { db } from '../config/firebase';
import { ChildTheme, useChildTheme } from '../utils/childTheme';
import {
  registerForPushNotifications,
  requestNotificationPermissions,
} from '../utils/notifications';

const DEFAULT_RADIUS = 100;

export default function ChildNotificationsScreen() {
  const router = useRouter();
  const { theme } = useChildTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [child, setChild] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);
  const [home, setHome] = useState<any>(null);
  const [savingHome, setSavingHome] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const session = await AsyncStorage.getItem('childSession');
        if (!session) return;
        const c = JSON.parse(session);
        setChild(c);
        setNotificationsEnabled(c.notificationsEnabled !== false);
        setHome(c.homeLocation || null);

        // Pull the freshest copy from Firestore (the parent may have set a home too)
        try {
          const snap = await getDoc(doc(db, 'children', c.id));
          if (snap.exists()) {
            const fresh: any = snap.data();
            setNotificationsEnabled(fresh.notificationsEnabled !== false);
            setHome(fresh.homeLocation || null);
          }
        } catch (error) {
          console.log('Could not refresh child settings:', error);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Keep the saved child session in step with what we change here.
  // `remove` lists keys to delete from the session (e.g. homeLocation).
  const patchSession = async (patch: Record<string, any>, remove: string[] = []) => {
    const session = await AsyncStorage.getItem('childSession');
    if (!session) return;
    const next = { ...JSON.parse(session), ...patch };
    remove.forEach((k) => delete next[k]);
    await AsyncStorage.setItem('childSession', JSON.stringify(next));
  };

  const handleToggle = async (enabled: boolean) => {
    if (!child) return;
    try {
      setSavingToggle(true);

      if (enabled) {
        const granted = await requestNotificationPermissions();
        if (!granted) {
          setNotificationsEnabled(false);
          Alert.alert(
            'Notifications are off',
            'ChorePal needs permission first. Ask a parent to turn notifications on in your phone settings.'
          );
          return;
        }
        // Saves this device's push token on the child's record
        await registerForPushNotifications(child.id, 'child');
        await updateDoc(doc(db, 'children', child.id), { notificationsEnabled: true });
        await patchSession({ notificationsEnabled: true });
      } else {
        await updateDoc(doc(db, 'children', child.id), {
          notificationsEnabled: false,
          pushToken: null,
        });
        await patchSession({ notificationsEnabled: false });
      }

      setNotificationsEnabled(enabled);
    } catch (error: any) {
      console.error('Child notification toggle error:', error);
      Alert.alert('Oops!', 'Could not change your notifications. Please try again.');
    } finally {
      setSavingToggle(false);
    }
  };

  const handleSetHome = async () => {
    if (!child) return;
    try {
      setSavingHome(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'ChorePal needs your location to set your home.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const newHome = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        radius: home?.radius || DEFAULT_RADIUS,
      };

      await updateDoc(doc(db, 'children', child.id), { homeLocation: newHome });
      await patchSession({ homeLocation: newHome });
      setHome(newHome);
      Alert.alert('Home saved! 🏠', "You'll get chore reminders when you arrive and leave.");
    } catch (error: any) {
      console.error('Set home error:', error);
      Alert.alert('Oops!', 'Could not save your home. Please try again.');
    } finally {
      setSavingHome(false);
    }
  };

  const handleRemoveHome = () => {
    if (!child) return;
    Alert.alert('Remove home?', "You won't get home reminders anymore.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setSavingHome(true);
            await updateDoc(doc(db, 'children', child.id), { homeLocation: deleteField() });
            await patchSession({}, ['homeLocation']);
            setHome(null);
          } catch (error: any) {
            Alert.alert('Oops!', 'Could not remove your home. Please try again.');
          } finally {
            setSavingHome(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.topBar}>
          <PressableScale
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back to settings">
            <Text style={styles.backArrow}>←</Text>
          </PressableScale>
        </View>
        <Text style={styles.title}>Notifications</Text>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <>
            {/* Turn alerts on / off */}
            <AnimatedEntry index={0}>
              <View style={styles.card}>
                <View style={styles.rowIconBox}>
                  <Text style={styles.rowIcon}>{notificationsEnabled ? '🔔' : '🔕'}</Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Notifications</Text>
                  <Text style={styles.rowSub}>
                    {notificationsEnabled
                      ? 'On: you get chore alerts and home reminders'
                      : 'Off: no alerts or home reminders'}
                  </Text>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleToggle}
                  disabled={savingToggle}
                  trackColor={{ false: theme.border, true: theme.primary }}
                />
              </View>
            </AnimatedEntry>

            {/* Home location */}
            <AnimatedEntry index={1}>
              <View style={styles.homeCard}>
                <View style={styles.homeTop}>
                  <Text style={styles.homeEmoji}>🏠</Text>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>My Home</Text>
                    <Text style={styles.rowSub}>
                      {home ? 'Your home is set ✓' : 'Not set yet'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.homeHelp}>
                  Stand at home and tap the button. ChorePal will remind you about your chores when
                  you get home, and when you leave with chores still to do.
                </Text>

                <PressableScale
                  style={[styles.primaryBtn, savingHome && { opacity: 0.6 }]}
                  onPress={savingHome ? undefined : handleSetHome}
                  disabled={savingHome}
                  accessibilityRole="button"
                  accessibilityLabel="Set my home to where I am now">
                  {savingHome ? (
                    <ActivityIndicator size="small" color={theme.onPrimary} />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {home ? 'Update my home 📍' : 'Set my home here 📍'}
                    </Text>
                  )}
                </PressableScale>

                {!!home && (
                  <PressableScale
                    style={styles.removeBtn}
                    onPress={savingHome ? undefined : handleRemoveHome}
                    disabled={savingHome}
                    accessibilityRole="button"
                    accessibilityLabel="Remove my home">
                    <Text style={styles.removeBtnText}>Remove my home</Text>
                  </PressableScale>
                )}
              </View>
            </AnimatedEntry>

            <Text style={styles.footnote}>
              Home reminders only pop up while ChorePal is open on your phone.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: ChildTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 50 },

    topBar: { flexDirection: 'row', marginBottom: 6 },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.card,
      borderWidth: 1.5,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backArrow: { fontSize: 22, color: t.primaryDark, fontWeight: '800' },
    title: { fontSize: 34, fontWeight: '900', color: t.text, textAlign: 'center', marginBottom: 20 },
    loading: { paddingVertical: 60, alignItems: 'center' },

    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: t.card,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: t.border,
      padding: 18,
      marginBottom: 16,
    },
    rowIconBox: {
      width: 52,
      height: 52,
      borderRadius: 18,
      backgroundColor: t.tint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowIcon: { fontSize: 26 },
    rowText: { flex: 1 },
    rowTitle: { fontSize: 18, fontWeight: '900', color: t.text },
    rowSub: { fontSize: 13, fontWeight: '600', color: t.muted, marginTop: 3 },

    homeCard: {
      backgroundColor: t.card,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: t.border,
      padding: 18,
      gap: 14,
    },
    homeTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    homeEmoji: { fontSize: 44 },
    homeHelp: { fontSize: 14, color: t.muted, lineHeight: 21, fontWeight: '500' },
    primaryBtn: {
      backgroundColor: t.primary,
      borderRadius: 18,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 54,
    },
    primaryBtnText: { color: t.onPrimary, fontSize: 17, fontWeight: '900' },
    removeBtn: {
      borderWidth: 2,
      borderColor: t.danger,
      borderRadius: 18,
      paddingVertical: 13,
      alignItems: 'center',
    },
    removeBtnText: { color: t.danger, fontSize: 15, fontWeight: '800' },
    footnote: { fontSize: 12, color: t.muted, textAlign: 'center', marginTop: 18 },
  });
