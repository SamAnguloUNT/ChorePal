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
import { useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db } from '../config/firebase';

const RADIUS_OPTIONS = [50, 100, 150, 200];

export default function SetHomeScreen() {
  const router = useRouter();
  const [saved, setSaved] = useState<any>(null);
  const [radius, setRadius] = useState(100);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists() && snap.data().homeLocation) {
        setSaved(snap.data().homeLocation);
        setRadius(snap.data().homeLocation.radius || 100);
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
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Home Location 🏠</Text>
        <Text style={styles.subtitle}>
          Stand at home, then tap the button below. Your children will get a reminder with their
          chore count when they arrive, and a nudge when they leave with chores still to do.
        </Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>CURRENT HOME</Text>
          {saved ? (
            <>
              <Text style={styles.statusValue}>
                {saved.latitude.toFixed(5)}, {saved.longitude.toFixed(5)}
              </Text>
              <Text style={styles.statusSub}>Radius: {saved.radius || 100} m</Text>
            </>
          ) : (
            <Text style={styles.statusEmpty}>Not set yet</Text>
          )}
        </View>

        <Text style={styles.label}>Radius</Text>
        <View style={styles.radiusRow}>
          {RADIUS_OPTIONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.radiusBtn, radius === r && styles.radiusBtnActive]}
              onPress={() => setRadius(r)}>
              <Text style={[styles.radiusText, radius === r && styles.radiusTextActive]}>
                {r} m
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>
          A bigger radius is more forgiving of GPS drift. 100 m works for most homes.
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
          onPress={handleUseCurrentLocation}
          disabled={loading}>
          <Text style={styles.primaryBtnText}>
            {loading ? 'Saving...' : saved ? 'Update to my current location 📍' : 'Use my current location 📍'}
          </Text>
        </TouchableOpacity>

        {saved && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear} disabled={loading}>
            <Text style={styles.clearBtnText}>Remove home location</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.footnote}>
          Reminders only fire while the child has the app open on their phone.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  back: { marginBottom: 16 },
  backText: { fontSize: 16, color: '#4ECDC4', fontWeight: '600' },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#2D2D2D', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', lineHeight: 20, marginBottom: 24 },
  statusCard: {
    backgroundColor: '#F0FFFE',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
    marginBottom: 24,
  },
  statusLabel: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 1, marginBottom: 6 },
  statusValue: { fontSize: 16, fontWeight: '700', color: '#2D2D2D' },
  statusSub: { fontSize: 13, color: '#888', marginTop: 2 },
  statusEmpty: { fontSize: 15, color: '#aaa', fontStyle: 'italic' },
  label: { fontSize: 14, fontWeight: '700', color: '#444', marginBottom: 8 },
  radiusRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  radiusBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  radiusBtnActive: { backgroundColor: '#F0FFFE', borderColor: '#4ECDC4' },
  radiusText: { fontSize: 14, fontWeight: '600', color: '#888' },
  radiusTextActive: { color: '#4ECDC4', fontWeight: '700' },
  hint: { fontSize: 12, color: '#aaa', fontStyle: 'italic', marginBottom: 24 },
  primaryBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnDisabled: { backgroundColor: '#A8E6E2' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  clearBtn: {
    borderWidth: 1.5,
    borderColor: '#E63946',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  clearBtnText: { color: '#E63946', fontSize: 15, fontWeight: '700' },
  footnote: { fontSize: 12, color: '#aaa', textAlign: 'center', marginTop: 8 },
});
