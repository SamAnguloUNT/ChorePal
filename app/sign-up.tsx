import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
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
import PressableScale from '../components/PressableScale';
import { auth, db } from '../config/firebase';

export default function SignUpScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  // The party emoji in the hero gently bobs
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

  const handleSignUp = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Missing!', 'Please fill in all fields!');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error!', 'Passwords do not match!');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error!', 'Password must be at least 6 characters!');
      return;
    }
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    try {
      setLoading(true);
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      // Save parent profile to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name,
        email: cleanEmail,
        role: 'parent',
        createdAt: new Date(),
      });

      // Send the verification link. If this fails the account still exists, and the
      // parent can tap "Resend email" on the login screen.
      let sent = true;
      try {
        await sendEmailVerification(user);
      } catch (verifyError) {
        console.log('Verification email error:', verifyError);
        sent = false;
      }

      // Don't let them in until the email is verified: sign out and go back to login.
      await signOut(auth);

      Alert.alert(
        'Verify your email 📧',
        sent
          ? `We sent a verification link to ${cleanEmail}. Tap it (check spam too), then log in.`
          : 'Your account was created, but we could not send the verification email. Log in and tap "Resend email".',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Sign Up Failed!', error.message);
    } finally {
      setLoading(false);
    }
  };

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsDiffer = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <SafeAreaView style={styles.container}>
      {/* Soft decorative circles behind everything */}
      <View style={styles.circleTop} pointerEvents="none" />
      <View style={styles.circleBottom} pointerEvents="none" />

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
                <Text style={styles.heroGreeting}>Welcome to ChorePal</Text>
                <Text style={styles.heroTitle}>Create Account</Text>
                <Text style={styles.heroSub}>Sign up to get started!</Text>
              </View>
              <Animated.Text
                style={[
                  styles.heroEmoji,
                  { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] },
                ]}>
                🎉
              </Animated.Text>
            </View>
          </AnimatedEntry>

          {/* Form card */}
          <AnimatedEntry index={1}>
            <View style={styles.formCard}>

              <Text style={styles.label}>Full Name</Text>
              <View style={[styles.inputRow, focused === 'name' && styles.inputRowFocused]}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#9AA9A6"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  textContentType="name"
                  returnKeyType="next"
                  onFocus={() => setFocused('name')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputRow, focused === 'email' && styles.inputRowFocused]}>
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#9AA9A6"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  returnKeyType="next"
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputRow, focused === 'password' && styles.inputRowFocused]}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Create a password"
                  placeholderTextColor="#9AA9A6"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                />
                <PressableScale
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </PressableScale>
              </View>
              <Text style={styles.hint}>At least 6 characters</Text>

              <Text style={styles.label}>Confirm Password</Text>
              <View
                style={[
                  styles.inputRow,
                  focused === 'confirm' && styles.inputRowFocused,
                  passwordsDiffer && styles.inputRowError,
                  passwordsMatch && styles.inputRowOk,
                ]}>
                <Text style={styles.inputIcon}>🔐</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm your password"
                  placeholderTextColor="#9AA9A6"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={loading ? undefined : handleSignUp}
                  onFocus={() => setFocused('confirm')}
                  onBlur={() => setFocused(null)}
                />
                <PressableScale
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  accessibilityRole="button"
                  accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}>
                  <Text style={styles.eyeIcon}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
                </PressableScale>
              </View>
              {passwordsDiffer && <Text style={styles.errorHint}>Passwords do not match</Text>}
              {passwordsMatch && <Text style={styles.okHint}>Passwords match ✓</Text>}

              {/* Sign Up Button */}
              <PressableScale
                style={[styles.signUpBtn, loading && styles.signUpBtnDisabled]}
                onPress={loading ? undefined : handleSignUp}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Create account">
                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.signUpBtnText}>Creating Account...</Text>
                  </View>
                ) : (
                  <Text style={styles.signUpBtnText}>Create Account 🎉</Text>
                )}
              </PressableScale>
            </View>
          </AnimatedEntry>

          {/* Already have account */}
          <AnimatedEntry index={2}>
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <PressableScale
                style={styles.loginLinkBtn}
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Log in">
                <Text style={styles.loginLink}>Log In</Text>
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
  heroTitle: { fontSize: 25, fontWeight: '900', color: '#FFFFFF' },
  heroSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 3 },
  heroEmoji: { fontSize: 34 },

  // Form card
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    padding: 20,
    marginBottom: 18,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  label: { fontSize: 14, fontWeight: '800', color: '#1F2D2B', marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6FBFA',
    borderWidth: 1.5,
    borderColor: '#DDF1EE',
    borderRadius: 16,
    paddingLeft: 14,
    marginBottom: 16,
  },
  inputRowFocused: { borderColor: '#4ECDC4', backgroundColor: '#FFFFFF' },
  inputRowError: { borderColor: '#E63946' },
  inputRowOk: { borderColor: '#4ECDC4' },
  inputIcon: { fontSize: 17, marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, paddingRight: 12, fontSize: 16, color: '#1F2D2B' },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  eyeIcon: { fontSize: 18 },
  hint: { fontSize: 12, color: '#8A9996', fontWeight: '600', marginTop: -10, marginBottom: 16, marginLeft: 4 },
  errorHint: { fontSize: 12, color: '#E63946', fontWeight: '700', marginTop: -10, marginBottom: 14, marginLeft: 4 },
  okHint: { fontSize: 12, color: '#2A9D8F', fontWeight: '700', marginTop: -10, marginBottom: 14, marginLeft: 4 },

  // Sign Up Button
  signUpBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  signUpBtnDisabled: { backgroundColor: '#A8E6E2', shadowOpacity: 0, elevation: 0 },
  signUpBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Login link
  loginContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginText: { color: '#6B7C79', fontSize: 14, fontWeight: '600' },
  loginLinkBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  loginLink: { color: '#0F7F76', fontSize: 14, fontWeight: '800', textDecorationLine: 'underline' },
});