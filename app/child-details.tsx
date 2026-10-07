import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { auth, db } from '../config/firebase';

export default function ChildDetailsScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    childId?: string | string[];
  }>();

  const childId = Array.isArray(params.childId)
    ? params.childId[0]
    : params.childId;

  const [child, setChild] = useState<any>(null);
  const [chores, setChores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [age, setAge] = useState('');
  const [pin, setPin] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadChild();

      return () => {
        Keyboard.dismiss();
      };
    }, [childId])
  );

  const loadChild = async () => {
    if (!childId) {
      Alert.alert('Error', 'No child account was selected.');
      router.back();
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      router.replace('/');
      return;
    }

    try {
      setLoading(true);

      const childRef = doc(db, 'children', childId);
      const childSnap = await getDoc(childRef);

      if (!childSnap.exists()) {
        Alert.alert(
          'Child Not Found',
          'This child account no longer exists.'
        );

        router.back();
        return;
      }

      const data = {
        id: childSnap.id,
        ...childSnap.data(),
      } as any;

      if (data.parentId !== user.uid) {
        Alert.alert(
          'Access Denied',
          'You do not have permission to view this child account.'
        );

        router.back();
        return;
      }

      setChild(data);
      setName(data.name || '');
      setAvatar(data.avatar || '');
      setAge(data.age != null ? String(data.age) : '');
      setPin(data.pin != null ? String(data.pin) : '');

      const choresSnap = await getDocs(
        query(
          collection(db, 'chores'),
          where('parentId', '==', user.uid)
        )
      );

      const choresForChild = choresSnap.docs
        .map((choreDoc) => ({
          id: choreDoc.id,
          ...choreDoc.data(),
        }))
        .filter(
          (chore: any) =>
            chore.assignedTo === childId ||
            chore.assignedTo === 'all'
        );

      setChores(choresForChild);
    } catch (error) {
      console.error('Error loading child details:', error);

      Alert.alert(
        'Error',
        'Unable to load this child account. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDeadline = (deadline: any) => {
    if (!deadline) {
      return 'No deadline';
    }

    try {
      if (typeof deadline?.toDate === 'function') {
        return deadline.toDate().toLocaleDateString();
      }

      if (deadline?.seconds) {
        return new Date(
          deadline.seconds * 1000
        ).toLocaleDateString();
      }

      const date = new Date(deadline);

      return Number.isNaN(date.getTime())
        ? String(deadline)
        : date.toLocaleDateString();
    } catch {
      return String(deadline);
    }
  };

  const handleAvatarChange = (text: string) => {
    if (text === '') {
      setAvatar('');
      return;
    }

    const emojiRegex = /\p{Extended_Pictographic}/u;
    const match = text.match(emojiRegex);

    if (match) {
      setAvatar(match[0]);
    }
  };

  const handleSave = async () => {
    if (!childId) return;

    Keyboard.dismiss();

    if (!name.trim()) {
      Alert.alert(
        'Missing Name',
        'Please enter the child\'s name.'
      );
      return;
    }

    if (!avatar.trim()) {
      Alert.alert(
        'Missing Avatar',
        'Please enter an emoji for the child avatar.'
      );
      return;
    }

    if (pin && !/^\d{4}$/.test(pin)) {
      Alert.alert(
        'Invalid PIN',
        'The child PIN must be exactly 4 numbers.'
      );
      return;
    }

    try {
      setSaving(true);

      const updates: any = {
        name: name.trim(),
        avatar: avatar.trim(),
      };

      if (age.trim()) {
        updates.age = Number(age);
      }

      if (pin.trim()) {
        updates.pin = pin.trim();
      }

      await updateDoc(
        doc(db, 'children', childId),
        updates
      );

      setChild((current: any) => ({
        ...current,
        ...updates,
      }));

      setEditing(false);

      Alert.alert(
        'Saved',
        'The child account has been updated.'
      );
    } catch (error) {
      console.error('Error updating child:', error);

      Alert.alert(
        'Error',
        'Unable to update the child account. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!childId || !child) {
      return;
    }

    Keyboard.dismiss();

    Alert.alert(
      'Delete Child Account',
      `Are you sure you want to permanently delete ${
        child.name || 'this child'
      }?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const user = auth.currentUser;

              if (!user) {
                Alert.alert(
                  'Error',
                  'You must be signed in to delete a child account.'
                );
                return;
              }

              await deleteDoc(
                doc(db, 'children', childId)
              );

              Alert.alert(
                'Child Deleted',
                'This child account has been permanently deleted from ChorePal.',
                [
                  {
                    text: 'OK',
                    onPress: () =>
                      router.replace('/parent-dashboard'),
                  },
                ]
              );
            } catch (error: any) {
              console.error(
                'Error deleting child:',
                error
              );

              if (error?.code === 'permission-denied') {
                Alert.alert(
                  'Permission Denied',
                  'Firestore is currently blocking child deletion.'
                );
                return;
              }

              Alert.alert(
                'Error',
                'Unable to delete the child account. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />

          <Text style={styles.loadingText}>
            Loading child account...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!child) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              router.back();
            }}
          >
            <Text style={styles.backText}>
              ← Back
            </Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Child Account
          </Text>

          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios'
              ? 'interactive'
              : 'on-drag'
          }
        >
          <View style={styles.profileCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {child.avatar || '🙂'}
              </Text>
            </View>

            <Text style={styles.childName}>
              {child.name}
            </Text>

            <Text style={styles.childLabel}>
              CHILD ACCOUNT
            </Text>
          </View>

          <Text style={styles.sectionTitle}>
            Login Information
          </Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <Text style={styles.infoLabel}>
                  Family Code
                </Text>

                {child.code && (
                  <Text style={styles.copyHint}>
                    Press and hold the code to copy
                  </Text>
                )}
              </View>

              <Text
                style={styles.codeText}
                selectable
              >
                {child.code || 'Not available'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                Age
              </Text>

              <Text style={styles.infoValue}>
                {child.age ?? 'Not set'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                Coins
              </Text>

              <Text style={styles.infoValue}>
                {child.coinBalance ?? 0} 🪙
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>
            Assigned Chores
          </Text>

          {chores.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>
                📋
              </Text>

              <Text style={styles.emptyTitle}>
                No chores assigned
              </Text>

              <Text style={styles.emptyText}>
                This child does not have any chores yet.
              </Text>
            </View>
          ) : (
            chores.map((chore) => (
              <View
                key={chore.id}
                style={styles.choreCard}
              >
                <View style={styles.choreTopRow}>
                  <Text style={styles.choreTitle}>
                    {chore.title || 'Untitled Chore'}
                  </Text>

                  <Text style={styles.coinText}>
                    {chore.coins ?? 0} 🪙
                  </Text>
                </View>

                {!!chore.description && (
                  <Text style={styles.choreDescription}>
                    {chore.description}
                  </Text>
                )}

                <Text style={styles.choreDeadline}>
                  Due: {formatDeadline(chore.deadline)}
                </Text>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>
            Manage Account
          </Text>

          {!editing ? (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                Keyboard.dismiss();
                setEditing(true);
              }}
            >
              <Text style={styles.editButtonText}>
                ✏️ Edit Child Account
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editCard}>
              <Text style={styles.inputLabel}>
                Name
              </Text>

              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Child's name"
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              <Text style={styles.inputLabel}>
                Avatar Emoji
              </Text>

              <TextInput
                style={[
                  styles.input,
                  styles.avatarInput,
                ]}
                value={avatar}
                onChangeText={handleAvatarChange}
                placeholder="🙂"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              <Text style={styles.inputLabel}>
                Age
              </Text>

              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                placeholder="Age"
                keyboardType="number-pad"
              />

              <Text style={styles.inputLabel}>
                4-Digit PIN
              </Text>

              <TextInput
                style={styles.input}
                value={pin}
                onChangeText={setPin}
                placeholder="1234"
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
              />

              <Text style={styles.keyboardHint}>
                Swipe down on the page to close the keyboard.
              </Text>

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    Keyboard.dismiss();

                    setName(child.name || '');
                    setAvatar(child.avatar || '');

                    setAge(
                      child.age != null
                        ? String(child.age)
                        : ''
                    );

                    setPin(
                      child.pin != null
                        ? String(child.pin)
                        : ''
                    );

                    setEditing(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={styles.saveButtonText}>
                    {saving
                      ? 'Saving...'
                      : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
          >
            <Text style={styles.deleteButtonText}>
              🗑️ Delete Child Account
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F8',
  },

  keyboardView: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },

  backText: {
    fontSize: 16,
    color: '#0D9488',
    fontWeight: '700',
  },

  headerTitle: {
    fontSize: 20,
    color: '#134E4A',
    fontWeight: '800',
  },

  scroll: {
    padding: 20,
    paddingBottom: 140,
    flexGrow: 1,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  loadingText: {
    color: '#64748B',
    fontSize: 14,
  },

  profileCard: {
    backgroundColor: '#E8F8F7',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },

  avatarCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  avatarText: {
    fontSize: 42,
  },

  childName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#134E4A',
  },

  childLabel: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
    letterSpacing: 1,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 18,
    marginBottom: 24,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },

  infoLeft: {
    flex: 1,
  },

  infoLabel: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },

  infoValue: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },

  copyHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },

  codeText: {
    color: '#0D9488',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },

  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },

  emptyEmoji: {
    fontSize: 30,
    marginBottom: 8,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },

  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },

  choreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  choreTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },

  choreTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },

  coinText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D9488',
  },

  choreDescription: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 18,
  },

  choreDeadline: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
  },

  editButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },

  editButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  editCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 7,
    marginTop: 10,
  },

  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontSize: 15,
  },

  avatarInput: {
    fontSize: 28,
    textAlign: 'center',
  },

  keyboardHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 10,
  },

  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },

  cancelButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },

  cancelButtonText: {
    color: '#475569',
    fontWeight: '700',
  },

  saveButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#0D9488',
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  deleteButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E63946',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },

  deleteButtonText: {
    color: '#E63946',
    fontSize: 15,
    fontWeight: '800',
  },
});