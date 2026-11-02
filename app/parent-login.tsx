import { useRouter } from 'expo-router';
import {
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
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
import { auth } from '../config/firebase';

export default function ParentLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  // The family emoji in the hero gently bobs
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
        Animated.timing(bob, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob, reduceMotion]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing!', 'Please enter your email and password!');
      return;
    }
    try {
      setLoading(true);
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = credential.user;

      // Only verified emails get in. Everyone else is signed straight back out.
      if (!user.emailVerified) {
        Alert.alert(
          'Verify your email 📧',
          `Please tap the verification link we sent to ${user.email} (check spam too), then log in again.`,
          [
            { text: 'OK', style: 'cancel', onPress: () => signOut(auth) },
            {
              text: 'Resend email',
              onPress: async () => {
                try {
                  await sendEmailVerification(user);
                  Alert.alert('Sent! 📧', `A new link is on its way to ${user.email}.`);
                } catch (resendError: any) {
                  if (resendError.code === 'auth/too-many-requests') {
                    Alert.alert('Slow down', 'Too many requests. Please wait a few minutes and try again.');
                  } else {
                    Alert.alert('Error!', resendError.message);
                  }
                } finally {
                  await signOut(auth);
                }
              },
            },
          ],
          { cancelable: false } // Android: tapping outside must not leave them signed in
        );
        return;
      }

      router.replace('/parent-dashboard');
    } catch (error: any) {
      Alert.alert('Login Failed!', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Enter your email', 'Type your email address above, then tap Forgot Password again.');
      return;
    }
    try {
      setResetLoading(true);
      await sendPasswordResetEmail(auth, trimmed);
      Alert.alert(
        'Check your email!',
        'If an account exists for that address, a password reset link is on its way. Check your spam folder too.'
      );
    } catch (error: any) {
      if (error.code === 'auth/invalid-email') {
        Alert.alert('Invalid email', 'Please enter a valid email address.');
      } else if (error.code === 'auth/too-many-requests') {
        Alert.alert('Slow down', 'Too many attempts. Please try again later.');
      } else {
        Alert.alert('Error!', error.message);
      }
    } finally {
      setResetLoading(false);
    }
  };

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
                <Text style={styles.heroGreeting}>Welcome back 👋</Text>
                <Text style={styles.heroTitle}>Parent Login</Text>
                <Text style={styles.heroSub}>Manage chores, rewards and approvals</Text>
              </View>
              <Animated.Text
                style={[
                  styles.heroEmoji,
                  { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] },
                ]}>
                👨‍👩‍👧
              </Animated.Text>
            </View>
          </AnimatedEntry>

          {/* Form card */}
          <AnimatedEntry index={1}>
            <View style={styles.formCard}>
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
                  placeholder="Enter your password"
                  placeholderTextColor="#9AA9A6"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={loading ? undefined : handleLogin}
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

              <PressableScale
                style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                onPress={loading ? undefined : handleLogin}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Log in">
                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.loginBtnText}>Logging in...</Text>
                  </View>
                ) : (
                  <Text style={styles.loginBtnText}>Log In</Text>
                )}
              </PressableScale>

              <PressableScale
                style={styles.forgotBtn}
                onPress={resetLoading ? undefined : handleForgotPassword}
                disabled={resetLoading}
                accessibilityRole="button"
                accessibilityLabel="Forgot password">
                <Text style={styles.forgotText}>
                  {resetLoading ? 'Sending...' : 'Forgot Password?'}
                </Text>
              </PressableScale>
            </View>
          </AnimatedEntry>

          {/* Sign up + child */}
          <AnimatedEntry index={2}>
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Don't have an account?</Text>
              <View style={styles.dividerLine} />
            </View>

            <PressableScale
              style={styles.signUpBtn}
              onPress={() => router.push('/sign-up')}
              accessibilityRole="button"
              accessibilityLabel="Sign up">
              <Text style={styles.signUpBtnText}>Sign Up</Text>
            </PressableScale>

            <PressableScale
              style={styles.childBtn}
              onPress={() => router.push('/child-login')}
              accessibilityRole="button"
              accessibilityLabel="I'm a child">
              <Text style={styles.childEmoji}>🧒</Text>
              <Text style={styles.childLink}>I'm a child!</Text>
            </PressableScale>
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
    marginBottom: 20,
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
  inputIcon: { fontSize: 17, marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, paddingRight: 12, fontSize: 16, color: '#1F2D2B' },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  eyeIcon: { fontSize: 18 },

  // Buttons
  loginBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  loginBtnDisabled: { backgroundColor: '#A8E6E2', shadowOpacity: 0, elevation: 0 },
  loginBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  forgotBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
  forgotText: { color: '#E63946', fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },

  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  dividerLine: { flex: 1, height: 1.5, backgroundColor: '#DDF1EE' },
  dividerText: { marginHorizontal: 10, color: '#6B7C79', fontSize: 13, fontWeight: '600' },
  signUpBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4ECDC4',
    marginBottom: 14,
  },
  signUpBtnText: { color: '#0F7F76', fontSize: 17, fontWeight: '800' },
  childBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E6F8F6',
    borderRadius: 18,
    paddingVertical: 13,
  },
  childEmoji: { fontSize: 20 },
  childLink: { color: '#0F7F76', fontSize: 15, fontWeight: '800' },
});
