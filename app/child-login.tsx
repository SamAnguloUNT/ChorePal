import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView, Platform,
  SafeAreaView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

export default function ChildLoginScreen() {
  const router = useRouter();
  const [familyCode, setFamilyCode] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>

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

            {/* Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Have a family code?{'\n'}Enter it here!</Text>
              <Text style={styles.cardSubtitle}>
                Ask your parent for the family code to join their account.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Enter family code"
                placeholderTextColor="#aaa"
                value={familyCode}
                onChangeText={setFamilyCode}
                autoCapitalize="characters"
                letterSpacing={4}
              />

              <TouchableOpacity style={styles.joinBtn}>
                <Text style={styles.joinBtnText}>Join 🚀</Text>
              </TouchableOpacity>
            </View>

            {/* Spacing */}
            <View style={{ flex: 1 }} />

          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  inner: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 40,
  },
  back: { marginBottom: 12 },
  backText: { fontSize: 16, color: '#4ECDC4', fontWeight: '600' },
  logoContainer: { alignItems: 'center', marginBottom: 24 },
  logoImage: { width: 140, height: 140 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2D2D2D',
    marginBottom: 8,
    lineHeight: 32,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    color: '#333',
    backgroundColor: '#FAFAFA',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 4,
  },
  joinBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  joinBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },

});
