import { useRouter } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import PressableScale from '../components/PressableScale';
import { auth, db } from '../config/firebase';

const AVATARS = ['👧', '🧒', '👦', '😊', '😎', '🤩', '🦸', '🐶', '🐱', '🦊', '🐻', '🐼'];

export default function AddChildScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [pin, setPin] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('👧');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<'name' | 'age' | 'pin' | null>(null);

  const generateCode = (childName: string) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${childName.toUpperCase()}-${code}`;
  };

  const handleCreate = async () => {
    if (loading) return;

    const cleanName = name.trim();
    if (!cleanName || !age || !pin) {
      Alert.alert('Missing!', 'Please fill in all fields!');
      return;
    }
    if (pin.length !== 4) {
      Alert.alert('Invalid PIN!', 'PIN must be 4 digits!');
      return;
    }
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error!', 'You must be logged in!');
        return;
      }

      const code = generateCode(cleanName);

      // Save child to Firestore
      await addDoc(collection(db, 'children'), {
        name: cleanName,
        age: parseInt(age, 10),
        pin,
        avatar: selectedAvatar,
        code,
        parentId: user.uid,
        coinBalance: 0,
        createdAt: new Date(),
      });

      // Navigate to family code screen
      router.push({
        pathname: '/family-code',
        params: { name: cleanName, age, avatar: selectedAvatar, code },
      });
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
        style={styles.inner}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero header with a live preview of the new profile */}
          <View style={styles.hero}>
            <View style={styles.heroTopRow}>
              <View style={styles.profileSection}>
                <View style={styles.profileCircle}>
                  <Text style={styles.profileEmoji}>{selectedAvatar}</Text>
                </View>
                <View style={styles.heroNameBlock}>
                  <Text style={styles.heroGreeting}>Add a child 👶</Text>
                  <Text style={styles.heroName} numberOfLines={1}>
                    {name.trim() || 'New kid'}
                  </Text>
                  <Text style={styles.heroSub}>Set up your child's profile</Text>
                </View>
              </View>

              <PressableScale
                style={styles.backBtn}
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Text style={styles.backBtnText}>← Back</Text>
              </PressableScale>
            </View>
          </View>

          {/* Avatar picker */}
          <Text style={styles.sectionTitle}>Choose an avatar</Text>
          <View style={styles.card}>
            <View style={styles.avatarGrid}>
              {AVATARS.map((avatar) => (
                <PressableScale
                  key={avatar}
                  style={[
                    styles.avatarOption,
                    selectedAvatar === avatar && styles.avatarSelected,
                  ]}
                  onPress={() => setSelectedAvatar(avatar)}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose avatar ${avatar}`}
                >
                  <Text style={styles.avatarEmoji}>{avatar}</Text>
                </PressableScale>
              ))}
            </View>
          </View>

          {/* Details */}
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Child's name</Text>
            <TextInput
              style={[styles.input, focused === 'name' && styles.inputFocused]}
              placeholder="Enter child's name"
              placeholderTextColor="#9AA8A5"
              value={name}
              onChangeText={setName}
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused(null)}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={styles.label}>Age</Text>
            <TextInput
              style={[styles.input, focused === 'age' && styles.inputFocused]}
              placeholder="Enter child's age"
              placeholderTextColor="#9AA8A5"
              value={age}
              onChangeText={(t) => setAge(t.replace(/[^0-9]/g, ''))}
              onFocus={() => setFocused('age')}
              onBlur={() => setFocused(null)}
              keyboardType="number-pad"
              maxLength={2}
            />

            <Text style={styles.label}>4-digit PIN</Text>
            <Text style={styles.hint}>Your child will use this PIN to log in</Text>
            <TextInput
              style={[styles.input, styles.inputLast, focused === 'pin' && styles.inputFocused]}
              placeholder="Enter 4-digit PIN"
              placeholderTextColor="#9AA8A5"
              value={pin}
              onChangeText={(t) => setPin(t.replace(/[^0-9]/g, ''))}
              onFocus={() => setFocused('pin')}
              onBlur={() => setFocused(null)}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
            />
          </View>

          {/* Create button */}
          <PressableScale
            style={[styles.createBtn, loading && styles.createBtnDisabled]}
            onPress={handleCreate}
            accessibilityRole="button"
            accessibilityLabel="Create profile and generate code"
          >
            <Text style={styles.createBtnText}>
              {loading ? 'Creating...' : 'Create Profile & Generate Code 🎉'}
            </Text>
          </PressableScale>

          <Text style={styles.footnote}>
            You'll get a Family Code to share with your child so they can join.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3FBF9' },
  inner: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 60 },

  // Hero (same language as the dashboards)
  hero: {
    backgroundColor: '#0F7F76',
    borderRadius: 28,
    padding: 20,
    marginBottom: 22,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  profileSection: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  profileCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileEmoji: { fontSize: 34 },
  heroNameBlock: { flexShrink: 1 },
  heroGreeting: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    marginBottom: 2,
  },
  heroName: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  heroSub: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 3,
  },
  backBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 13, fontWeight: '800', color: '#0F7F76' },

  // Sections
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1F2D2B',
    marginBottom: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },

  // Avatars
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  avatarOption: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: '#F1F6F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  avatarSelected: {
    backgroundColor: '#E0F7F5',
    borderColor: '#4ECDC4',
  },
  avatarEmoji: { fontSize: 30 },

  // Form
  label: { fontSize: 14, fontWeight: '700', color: '#1F2D2B', marginBottom: 6 },
  hint: { fontSize: 12, color: '#6B7C79', marginBottom: 8, marginTop: -2 },
  input: {
    borderWidth: 1.5,
    borderColor: '#DDF1EE',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#1F2D2B',
    backgroundColor: '#F8FCFB',
    marginBottom: 16,
  },
  inputLast: { marginBottom: 0 },
  inputFocused: { borderColor: '#4ECDC4', backgroundColor: '#FFFFFF' },

  // Create button
  createBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  createBtnDisabled: { backgroundColor: '#A8E6E2', shadowOpacity: 0, elevation: 0 },
  createBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  footnote: {
    fontSize: 13,
    color: '#6B7C79',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 18,
  },
});