import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import PressableScale from '../components/PressableScale';
import { auth, db } from '../config/firebase';

const RADIUS_OPTIONS = [50, 100, 150, 200];

// Slides up and fades in, staggered by index. Skips the motion when Reduce Motion is on.
function AnimatedEntry({
  index,
  skip,
  children,
}: {
  index: number;
  skip: boolean;
  children: React.ReactNode;
}) {
  const anim = useRef(new Animated.Value(skip ? 1 : 0)).current;
  useEffect(() => {
    if (skip) {
      anim.setValue(1);
      return;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 80,
      easing: Easing.out(Easing.back(1.1)),
      useNativeDriver: true,
    }).start();
  }, [anim, index, skip]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
      }}>
      {children}
    </Animated.View>
  );
}

export default function SetHomeScreen() {
  const router = useRouter();
  const [saved, setSaved] = useState<any>(null);
  const [radius, setRadius] = useState(100);
  const [loading, setLoading] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // The house emoji gently bobs in the hero
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      bob.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob, reduceMotion]);

  useEffect(() => {
    const load = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data().homeLocation) {
          setSaved(snap.data().homeLocation);
          setRadius(snap.data().homeLocation.radius || 100);
        }
      } catch (error) {
        console.error('Error loading home location:', error);
      }
    };
    load();
  }, []);

  // Writes (or clears) the home location on the parent's user doc AND every child doc.
  // Children can't read the parent's `users` doc, so each child doc gets its own copy.
  const writeHome = async (home: any | null) => {
    const user = auth.currentUser;
    if (!user) throw new Error('You must be logged in!');

    await updateDoc(doc(db, 'users', user.uid), {
      homeLocation: home ?? deleteField(),
    });

    const kids = await getDocs(
      query(collection(db, 'children'), where('parentId', '==', user.uid))
    );
    await Promise.all(
      kids.docs.map((d) =>
        updateDoc(d.ref, { homeLocation: home ?? deleteField() })
      )
    );
  };

  const handleUseCurrentLocation = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Location permission is required to set your home.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const home = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        radius,
      };

      await writeHome(home);
      setSaved(home);
      Alert.alert('Home saved! 🏠', 'Your children will now get arrival and departure reminders at this location.');
    } catch (error: any) {
      Alert.alert('Error!', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    Alert.alert('Remove home location?', 'Children will stop getting home reminders.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await writeHome(null);
            setSaved(null);
          } catch (error: any) {
            Alert.alert('Error!', error.message);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <PressableScale
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Text style={styles.backText}>← Back</Text>
          </PressableScale>
        </View>

        {/* Hero: current home status */}
        <AnimatedEntry index={0} skip={reduceMotion}>
          <View style={styles.hero}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.heroGreeting}>Home reminders</Text>
                <Text style={styles.heroTitle}>Home Location</Text>
                <Text style={styles.heroSub}>
                  {saved ? 'Your home is set ✓' : 'Not set yet'}
                </Text>
              </View>
              <Animated.Text
                style={[
                  styles.heroEmoji,
                  { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] },
                ]}>
                🏠
              </Animated.Text>
            </View>

            <View style={styles.heroStatus}>
              <Text style={styles.statusLabel}>CURRENT HOME</Text>
              {saved ? (
                <>
                  <Text style={styles.statusValue}>
                    {Number(saved.latitude).toFixed(5)}, {Number(saved.longitude).toFixed(5)}
                  </Text>
                  <Text style={styles.statusSub}>Radius: {saved.radius || 100} m</Text>
                </>
              ) : (
                <Text style={styles.statusEmpty}>Tap the button below while you're at home</Text>
              )}
            </View>
          </View>
        </AnimatedEntry>

        {/* How it works */}
        <AnimatedEntry index={1} skip={reduceMotion}>
          <View style={styles.infoCard}>
            <Text style={styles.infoEmoji}>💡</Text>
            <Text style={styles.infoText}>
              Stand at home, then tap the button below. Your children will get a reminder with their
              chore count when they arrive, and a nudge when they leave with chores still to do.
            </Text>
          </View>
        </AnimatedEntry>

        {/* Radius */}
        <AnimatedEntry index={2} skip={reduceMotion}>
          <Text style={styles.sectionTitle}>Radius</Text>
          <View style={styles.radiusRow}>
            {RADIUS_OPTIONS.map((r) => (
              <PressableScale
                key={r}
                style={[styles.radiusBtn, radius === r && styles.radiusBtnActive]}
                onPress={() => setRadius(r)}
                accessibilityRole="button"
                accessibilityLabel={`Set radius to ${r} meters`}>
                <Text style={[styles.radiusText, radius === r && styles.radiusTextActive]}>
                  {r} m
                </Text>
              </PressableScale>
            ))}
          </View>
          <Text style={styles.hint}>
            A bigger radius is more forgiving of GPS drift. 100 m works for most homes.
          </Text>
        </AnimatedEntry>

        {/* Actions */}
        <AnimatedEntry index={3} skip={reduceMotion}>
          <PressableScale
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={loading ? undefined : handleUseCurrentLocation}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Use my current location">
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Saving...</Text>
              </View>
            ) : (
              <Text style={styles.primaryBtnText}>
                {saved ? 'Update to my current location 📍' : 'Use my current location 📍'}
              </Text>
            )}
          </PressableScale>

          {saved && (
            <PressableScale
              style={[styles.clearBtn, loading && { opacity: 0.6 }]}
              onPress={loading ? undefined : handleClear}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Remove home location">
              <Text style={styles.clearBtnText}>Remove home location</Text>
            </PressableScale>
          )}

          <Text style={styles.footnote}>
            Reminders only fire while the child has the app open on their phone.
          </Text>
        </AnimatedEntry>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3FBF9' },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 50 },

  // Top bar
  topBar: { flexDirection: 'row', marginBottom: 12 },
  backBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
  },
  backText: { fontSize: 14, color: '#0F7F76', fontWeight: '800' },

  // Hero
  hero: {
    backgroundColor: '#0F7F76',
    borderRadius: 28,
    padding: 20,
    gap: 18,
    marginBottom: 16,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  heroTextBlock: { flexShrink: 1 },
  heroGreeting: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.88)', marginBottom: 2 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#FFFFFF' },
  heroSub: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  heroEmoji: { fontSize: 54 },
  heroStatus: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  statusLabel: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.75)', letterSpacing: 1, marginBottom: 6 },
  statusValue: { fontSize: 18, fontWeight: '900', color: '#FFD479' },
  statusSub: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 3 },
  statusEmpty: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)', fontStyle: 'italic' },

  // Info card
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    padding: 16,
    marginBottom: 22,
  },
  infoEmoji: { fontSize: 22 },
  infoText: { flex: 1, fontSize: 14, color: '#5B6B68', lineHeight: 21, fontWeight: '500' },

  // Radius
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#1F2D2B', marginBottom: 10 },
  radiusRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  radiusBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
  },
  radiusBtnActive: { backgroundColor: '#E6F8F6', borderColor: '#4ECDC4' },
  radiusText: { fontSize: 14, fontWeight: '700', color: '#7C8B88' },
  radiusTextActive: { color: '#0F7F76', fontWeight: '900' },
  hint: { fontSize: 12, color: '#8A9996', fontStyle: 'italic', marginBottom: 24 },

  // Buttons
  primaryBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryBtnDisabled: { backgroundColor: '#A8E6E2', shadowOpacity: 0, elevation: 0 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E63946',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  clearBtnText: { color: '#E63946', fontSize: 15, fontWeight: '800' },
  footnote: { fontSize: 12, color: '#8A9996', textAlign: 'center', marginTop: 8 },
});