import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import AnimatedEntry from '../components/AnimatedEntry';
import FloatingBackground from '../components/FloatingBackground';
import PressableScale from '../components/PressableScale';
import { db } from '../config/firebase';

// Codes are NAME-XXXX. Names vary in length, so the dash always goes before the last 4 characters.
// A dash inside the name (MARY-JANE-AB12) is kept; one typed in the wrong spot is moved.
const formatFamilyCode = (code: string) =>
  code
    .trim()
    .toUpperCase()
    .replace(/-(?=.{0,3}$)/g, '')
    .replace(/^(.+?)-?(.{4})$/, '$1-$2');

export default function ChildLoginScreen() {
  const router = useRouter();
  const [familyCode, setFamilyCode] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  // The rocket in the hero gently bobs
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

  const handleJoin = async () => {
    // Join can be tapped while the code field still has focus, so format here too
    const code = formatFamilyCode(familyCode);
    setFamilyCode(code);

    if (code.length < 4) {
      Alert.alert('Invalid Code!', 'Please enter a valid family code!');
      return;
    }
    if (pin.length !== 4) {
      Alert.alert('Invalid PIN!', 'Please enter your 4 digit PIN!');
      return;
    }
    try {
      setLoading(true);

      // Search Firestore for matching family code
      const childQuery = query(
        collection(db, 'children'),
        where('code', '==', code)
      );
      const childSnap = await getDocs(childQuery);

      if (childSnap.empty) {
        Alert.alert('Invalid Code!', 'No family found with that code. Please check and try again!');
        return;
      }

      const childDoc = childSnap.docs[0];
      const childData = childDoc.data();

      // Validate PIN
      if (childData.pin !== pin) {
        Alert.alert('Wrong PIN!', 'That PIN is incorrect. Please try again!');
        return;
      }

      // Save child session to AsyncStorage
      await AsyncStorage.setItem('childSession', JSON.stringify({
        id: childDoc.id,
        name: childData.name,
        avatar: childData.avatar,
        coinBalance: childData.coinBalance,
        parentId: childData.parentId,
        code: childData.code,
        // Carry the child's own settings into the session so a new login still respects
        // "notifications off" and a saved home before the dashboard syncs with Firestore.
        notificationsEnabled: childData.notificationsEnabled,
        homeLocation: childData.homeLocation,
      }));

      router.replace('/child-dashboard');

    } catch (error: any) {
      Alert.alert('Error!', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Soft decorative circles + floating orbs behind everything */}
      <View style={styles.circleTop} pointerEvents="none" />
      <View style={styles.circleBottom} pointerEvents="none" />
      {!reduceMotion && <FloatingBackground />}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}>

          {/* Back */}
          <View style={styles.topBar}>
            <PressableScale
              style={styles.backBtn}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back">
              <Text style={styles.backText}>← Back</Text>
            </PressableScale>
          </View>

          {/* Hero */}
          <AnimatedEntry index={0}>
            <View style={styles.hero}>
              <View style={styles.heroLogoTile}>
                <Image
                  source={require('../assets/images/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.heroText}>
                <Text style={styles.heroGreeting}>Hi there! 👋</Text>
                <Text style={styles.heroTitle}>Let's get started</Text>
                <Text style={styles.heroSub}>Join with your family code</Text>
              </View>
              <Animated.Text
                style={[
                  styles.heroEmoji,
                  { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] },
                ]}>
                🚀
              </Animated.Text>
            </View>
          </AnimatedEntry>

          {/* Card */}
          <AnimatedEntry index={1}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Have a family code?{'\n'}Enter it here!</Text>
              <Text style={styles.cardSubtitle}>
                Ask your parent for the family code to join their account.
              </Text>

              <Text style={styles.label}>🔑 Family Code</Text>
              <TextInput
                style={[styles.input, focused === 'code' && styles.inputFocused]}
                placeholder="Enter family code"
                placeholderTextColor="#9AA9A6"
                value={familyCode}
                onChangeText={setFamilyCode}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="next"
                onFocus={() => setFocused('code')}
                onBlur={() => {
                  setFocused(null);
                  setFamilyCode(formatFamilyCode);
                }}
              />

              <Text style={styles.label}>🔢 Your PIN</Text>
              <TextInput
                style={[styles.input, focused === 'pin' && styles.inputFocused]}
                placeholder="Enter your 4-digit PIN"
                placeholderTextColor="#9AA9A6"
                value={pin}
                onChangeText={setPin}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                onFocus={() => setFocused('pin')}
                onBlur={() => setFocused(null)}
              />

              <PressableScale
                style={[styles.joinBtn, loading && styles.joinBtnDisabled]}
                onPress={loading ? undefined : handleJoin}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Join">
                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.joinBtnText}>Joining...</Text>
                  </View>
                ) : (
                  <Text style={styles.joinBtnText}>Join 🚀</Text>
                )}
              </PressableScale>
            </View>
          </AnimatedEntry>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3FBF9' },
  inner: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 40 },

  // Decorative background circles
  circleTop: {
    position: 'absolute',
    top: -90,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(78, 205, 196, 0.16)',
  },
  circleBottom: {
    position: 'absolute',
    bottom: -70,
    left: -70,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(244, 185, 66, 0.14)',
  },

  // Back
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#0F7F76',
    borderRadius: 28,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  heroLogoTile: {
    width: 78,
    height: 78,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: { width: 62, height: 62 },
  heroText: { flex: 1 },
  heroGreeting: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.88)' },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  heroSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 3 },
  heroEmoji: { fontSize: 34 },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    padding: 22,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: { fontSize: 22, fontWeight: '900', color: '#1F2D2B', marginBottom: 8, lineHeight: 30 },
  cardSubtitle: { fontSize: 14, color: '#6B7C79', marginBottom: 20, lineHeight: 20, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '800', color: '#1F2D2B', marginBottom: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: '#DDF1EE',
    borderRadius: 16,
    padding: 14,
    fontSize: 17,
    color: '#1F2D2B',
    backgroundColor: '#F6FBFA',
    marginBottom: 16,
    letterSpacing: 2,
  },
  inputFocused: { borderColor: '#4ECDC4', backgroundColor: '#FFFFFF' },
  joinBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  joinBtnDisabled: { backgroundColor: '#A8E6E2', shadowOpacity: 0, elevation: 0 },
  joinBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});