import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Keyboard,
    KeyboardAvoidingView, Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';

const AVATARS = ['👧', '🧒', '👦', '😊', '😎', '🤩', '🦸', '🐶', '🐱', '🦊', '🐻', '🐼'];

export default function AddChildScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [pin, setPin] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('👧');

  const generateCode = (childName: string) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${childName.toUpperCase()}-${code}`;
  };

  const handleCreate = () => {
    if (!name || !age || !pin) {
      alert('Please fill in all fields!');
      return;
    }
    if (pin.length !== 4) {
      alert('PIN must be 4 digits!');
      return;
    }
    const code = generateCode(name);
    router.push({
      pathname: '/family-code',
      params: { name, age, avatar: selectedAvatar, code }
    });
  };

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

            {/* Title */}
            <Text style={styles.title}>Add a Child 👶</Text>
            <Text style={styles.subtitle}>Set up your child's profile</Text>

            {/* Avatar Picker */}
            <Text style={styles.label}>Choose an Avatar</Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map((avatar) => (
                <TouchableOpacity
                  key={avatar}
                  style={[styles.avatarOption, selectedAvatar === avatar && styles.avatarSelected]}
                  onPress={() => setSelectedAvatar(avatar)}>
                  <Text style={styles.avatarEmoji}>{avatar}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Form */}
            <Text style={styles.label}>Child's Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter child's name"
              placeholderTextColor="#aaa"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter child's age"
              placeholderTextColor="#aaa"
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              maxLength={2}
            />

            <Text style={styles.label}>4-Digit PIN for Child</Text>
            <Text style={styles.hint}>Your child will use this PIN to log in</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 4-digit PIN"
              placeholderTextColor="#aaa"
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
            />

            {/* Create Button */}
            <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
              <Text style={styles.createBtnText}>Create Profile & Generate Code 🎉</Text>
            </TouchableOpacity>

          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  inner: { flex: 1 },
  content: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 40 },
  back: { marginBottom: 16 },
  backText: { fontSize: 16, color: '#4ECDC4', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '800', color: '#2D2D2D', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#888', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6 },
  hint: { fontSize: 12, color: '#aaa', marginBottom: 8, marginTop: -4 },
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
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  avatarOption: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarSelected: {
    borderColor: '#4ECDC4',
    backgroundColor: '#F0FFFE',
  },
  avatarEmoji: { fontSize: 26 },
  createBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});