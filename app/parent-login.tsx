import { useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

export default function ParentLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [familyCode, setFamilyCode] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>

            {/* Logo */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            {/* Title */}
            <Text style={styles.title}>Parent Login</Text>

            {/* Form */}
            <View style={styles.formSection}>
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
                  placeholder="Enter your password"
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
            </View>

            {/* Buttons */}
            <View style={styles.buttonsSection}>
              <TouchableOpacity style={styles.loginBtn}>
                <Text style={styles.loginBtnText}>Log In</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Don't have an account?</Text>
                <View style={styles.dividerLine} />
              </View>
              <TouchableOpacity style={styles.signUpBtn}>
                <Text style={styles.signUpBtnText}>Sign Up</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModalVisible(true)}>
                <Text style={styles.childLink}>I'm a child!</Text>
              </TouchableOpacity>
            </View>

          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Family Code Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalContainer}>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setModalVisible(false)}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Have a family code?{'\n'}Enter it here!</Text>
                <TextInput
                  style={styles.codeInput}
                  placeholder="Enter family code"
                  placeholderTextColor="#aaa"
                  value={familyCode}
                  onChangeText={setFamilyCode}
                  autoCapitalize="characters"
                />
                <TouchableOpacity style={styles.joinBtn}>
                  <Text style={styles.joinBtnText}>Join</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFDF7' },
  inner: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: 'flex-start',
    gap: 20,
  },

  // Logo
  logoContainer: { alignItems: 'center' },
  logoImage: { width: 180, height: 180 },

  // Title
  title: { fontSize: 30, fontWeight: '800', color: '#2D2D2D', textAlign: 'center' },

  // Form
  formSection: {},
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  passwordInput: { flex: 1, padding: 13, fontSize: 15, color: '#333' },
  eyeBtn: { paddingHorizontal: 12 },
  eyeIcon: { fontSize: 18 },

  // Buttons
  buttonsSection: {},
  loginBtn: {
    backgroundColor: '#F4B942',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#F4B942',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  loginBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  forgotBtn: { alignItems: 'center', marginBottom: 20 },
  forgotText: { color: '#E63946', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#DDD' },
  dividerText: { marginHorizontal: 10, color: '#999', fontSize: 13 },
  signUpBtn: {
    backgroundColor: '#F4B942',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#F4B942',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  signUpBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  childLink: {
    textAlign: 'center',
    color: '#E63946',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 40,
  },
  closeBtn: { alignSelf: 'flex-end', marginBottom: 8 },
  closeText: { fontSize: 18, color: '#999' },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2D2D2D',
    marginBottom: 20,
    lineHeight: 30,
  },
  codeInput: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
    marginBottom: 16,
    letterSpacing: 2,
  },
  joinBtn: {
    backgroundColor: '#F4B942',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#F4B942',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  joinBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
