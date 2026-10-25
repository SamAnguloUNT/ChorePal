import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import AnimatedEntry from '../components/AnimatedEntry';
import PressableScale from '../components/PressableScale';
import { ChildTheme, useChildTheme } from '../utils/childTheme';

type RowProps = {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  last?: boolean;
};

// One big tappable row: icon, title, small description, chevron
function SettingsRow({ icon, title, subtitle, onPress, styles, last }: RowProps) {
  return (
    <>
      <PressableScale
        style={styles.row}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}>
        <View style={styles.rowIconBox}>
          <Text style={styles.rowIcon}>{icon}</Text>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSub}>{subtitle}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </PressableScale>
      {!last && <View style={styles.divider} />}
    </>
  );
}

export default function ChildSettingsScreen() {
  const router = useRouter();
  const { theme } = useChildTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [child, setChild] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('childSession')
        .then((s) => s && setChild(JSON.parse(s)))
        .catch(() => {});
    }, [])
  );

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('childSession');
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Top bar: back arrow + big title */}
        <View style={styles.topBar}>
          <PressableScale
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Text style={styles.backArrow}>←</Text>
          </PressableScale>
        </View>
        <Text style={styles.title}>Settings</Text>

        {/* Chosen avatar + name (display only, children can't change it) */}
        <AnimatedEntry index={0}>
          <View style={styles.profileRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarEmoji}>{child?.avatar || '👧'}</Text>
            </View>
            <View style={styles.profileText}>
              <Text style={styles.profileName} numberOfLines={1}>{child?.name || 'Hi there'}</Text>
              <Text style={styles.profileRole}>Child Account</Text>
            </View>
          </View>
        </AnimatedEntry>

        {/* Main options */}
        <AnimatedEntry index={1}>
          <View style={styles.card}>
            <SettingsRow
              styles={styles}
              icon="🔔"
              title="Notifications"
              subtitle="Set your home & turn alerts on or off"
              onPress={() => router.push('/child-notifications')}
            />
            <SettingsRow
              styles={styles}
              icon="🎨"
              title="App Theme"
              subtitle="Pick a theme"
              onPress={() => router.push('/child-theme')}
            />
            <SettingsRow
              styles={styles}
              icon="❓"
              title="Need Help?"
              subtitle="Learn how to use ChorePal"
              onPress={() => router.push('/child-help')}
              last
            />
          </View>
        </AnimatedEntry>

        {/* Log out */}
        <AnimatedEntry index={2}>
          <View style={[styles.card, styles.logoutCard]}>
            <SettingsRow
              styles={styles}
              icon="🚪"
              title="Log Out"
              subtitle="Log out of your account"
              onPress={handleLogout}
              last
            />
          </View>
        </AnimatedEntry>

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
    title: { fontSize: 36, fontWeight: '900', color: t.text, textAlign: 'center', marginBottom: 18 },

    profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 26, paddingHorizontal: 4 },
    avatarCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: t.card,
      borderWidth: 3,
      borderColor: t.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarEmoji: { fontSize: 50 },
    profileText: { flex: 1 },
    profileName: { fontSize: 28, fontWeight: '900', color: t.text },
    profileRole: { fontSize: 15, fontWeight: '700', color: t.muted, marginTop: 2 },

    card: {
      backgroundColor: t.card,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: t.border,
      overflow: 'hidden',
      shadowColor: t.primaryDark,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 2,
    },
    logoutCard: { marginTop: 18 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 22,
      paddingHorizontal: 16,
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
    rowTitle: { fontSize: 19, fontWeight: '900', color: t.text },
    rowSub: { fontSize: 13, fontWeight: '600', color: t.muted, marginTop: 3 },
    chevron: { fontSize: 30, color: t.primary, fontWeight: '700' },
    divider: { height: 1.5, backgroundColor: t.divider, marginHorizontal: 16 },
  });
