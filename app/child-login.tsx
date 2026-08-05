import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView, Platform,
  SafeAreaView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { db } from '../config/firebase';

export default function ChildLoginScreen() {
  const router = useRouter();
  const [familyCode, setFamilyCode] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (familyCode.length < 4) {
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
        where('code', '==', familyCode.toUpperCase())
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

              <Text style={styles.label}>Family Code</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter family code"
                placeholderTextColor="#aaa"
                value={familyCode}
                onChangeText={setFamilyCode}
                autoCapitalize="characters"
              />

              <Text style={styles.label}>Your PIN</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your 4-digit PIN"
                placeholderTextColor="#aaa"
                value={pin}
                onChangeText={setPin}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
              />

              <TouchableOpacity
                style={[styles.joinBtn, loading && styles.joinBtnDisabled]}
                onPress={handleJoin}
                disabled={loading}>
                <Text style={styles.joinBtnText}>
                  {loading ? 'Joining...' : 'Join 🚀'}
                </Text>
              </TouchableOpacity>
            </View>

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
    borderWidth: 1,
    borderColor: '#EEE',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2D2D2D',
    marginBottom: 8,
    lineHeight: 30,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
    lineHeight: 20,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
    marginBottom: 16,
    letterSpacing: 2,
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
  joinBtnDisabled: { backgroundColor: '#A8E6E2', shadowOpacity: 0 },
  joinBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});