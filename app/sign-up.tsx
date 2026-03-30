import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Image,
    Keyboard,
    KeyboardAvoidingView, Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';

export default function SignUpScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

            {/* Back */}
            <TouchableOpacity style={styles.back} onPress={() => router.back()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            {/* Logo */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            {/* Title */}
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up to get started with ChorePal!</Text>

            {/* Form */}
            <View style={styles.formSection}>

              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#aaa"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Create a password"
                  placeholderTextColor="#aaa"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}>
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Confirm your password"
                  placeholderTextColor="#aaa"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Text style={styles.eyeIcon}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

            </View>

            <TouchableOpacity style={styles.signUpBtn} onPress={() => router.replace('/parent-dashboard')}>
              <Text style={styles.signUpBtnText}>Create Account 🎉</Text>
            </TouchableOpacity>

            {/* Already have account */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.loginLink}>Log In</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  inner: { flex: 1 },
  content: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // Back
  back: { marginBottom: 8 },
  backText: { fontSize: 16, color: '#4ECDC4', fontWeight: '600' },

  // Logo
  logoContainer: { alignItems: 'center', marginBottom: 16 },
  logoImage: { width: 120, height: 120 },

  // Title
  title: { fontSize: 30, fontWeight: '800', color: '#2D2D2D', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#888', textAlign: 'center', marginTop: 6, marginBottom: 24 },

  // Form
  formSection: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#F9F9F9',
    marginBottom: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 10,
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    marginBottom: 16,
  },
  passwordInput: { flex: 1, padding: 13, fontSize: 15, color: '#333' },
  eyeBtn: { paddingHorizontal: 12 },
  eyeIcon: { fontSize: 18 },

  // Sign Up Button
  signUpBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  signUpBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // Login link
  loginContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginText: { color: '#888', fontSize: 14 },
  loginLink: { color: '#4ECDC4', fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
});