
import { useRouter } from 'expo-router';
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
} from 'react-native';

import { auth, db } from '../config/firebase';

type Child = {
  id: string;
  name?: string;
  avatar?: string;
  coinBalance?: number;
  [key: string]: any;
};

export default function DisciplineScreen() {
  const router = useRouter();

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  // Load children belonging to logged-in parent
  const loadChildren = async () => {
    try {
      const user = auth.currentUser;

      if (!user) {
        Alert.alert('Error', 'Parent must be logged in.');
        return;
      }

      const childrenQuery = query(
        collection(db, 'children'),
        where('parentId', '==', user.uid)
      );

      const snapshot = await getDocs(childrenQuery);

      const childData = snapshot.docs.map((childDoc) => ({
        id: childDoc.id,
        ...childDoc.data(),
      })) as Child[];

      setChildren(childData);

      // Refresh selected child's balance
      if (selectedChild) {
        const updatedSelectedChild = childData.find(
          (child) => child.id === selectedChild.id
        );

        if (updatedSelectedChild) {
          setSelectedChild(updatedSelectedChild);
        }
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Could not load children.'
      );
    }
  };

  useEffect(() => {
    loadChildren();
  }, []);

  // Remove points from selected child
  const deductPoints = () => {
    if (!selectedChild) {
      Alert.alert(
        'Select Child',
        'Please select a child.'
      );

      return;
    }

    const deduction = Number(points.trim());

    if (
      !Number.isSafeInteger(deduction) ||
      deduction <= 0
    ) {
      Alert.alert(
        'Invalid Amount',
        'Enter a valid number of points.'
      );

      return;
    }

    // Check the displayed balance
    const displayedBalance = Number(
      selectedChild.coinBalance || 0
    );

    if (deduction > displayedBalance) {
      Alert.alert(
        'Not Enough Points',
        `This child only has ${displayedBalance} point${
          displayedBalance === 1 ? '' : 's'
        }. You cannot remove ${deduction}.`
      );
      return;
    }

    if (!reason.trim()) {
      Alert.alert(
        'Reason Required',
        'Please enter a reason for the deduction.'
      );

      return;
    }

    Alert.alert(
      'Remove Points?',
      `Remove ${deduction} points from ${
        selectedChild.name || 'this child'
      }?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',

          onPress: async () => {
            try {
              setLoading(true);

              const user = auth.currentUser;

              if (!user) {
                throw new Error(
                  'Parent must be logged in.'
                );
              }

              const childRef = doc(
                db,
                'children',
                selectedChild.id
              );

              let removed = 0;
              let updatedBalance = 0;

              await runTransaction(
                db,
                async (transaction) => {
                  const childSnapshot =
                    await transaction.get(childRef);

                  if (!childSnapshot.exists()) {
                    throw new Error(
                      'Child account not found.'
                    );
                  }

                  const currentBalance = Number(
                    childSnapshot.data().coinBalance || 0
                  );

                  // Check latest Firebase balance
                  if (
                    !Number.isFinite(currentBalance) ||
                    deduction > currentBalance
                  ) {
                    throw new Error(
                      `Not enough points. This child currently has ${currentBalance} point${
                        currentBalance === 1 ? '' : 's'
                      }.`
                    );
                  }

                  updatedBalance =
                    currentBalance - deduction;

                  removed = deduction;

                  transaction.update(
                    childRef,
                    {
                      coinBalance: updatedBalance,

                      disciplineHistory: arrayUnion({
                        pointsDeducted: removed,
                        reason: reason.trim(),
                        parentId: user.uid,
                        createdAt: new Date().toISOString(),
                      }),
                    }
                  );
                }
              );

              setPoints('');
              setReason('');

              Alert.alert(
                'Points Removed',
                `${removed} point${
                  removed === 1 ? '' : 's'
                } removed. New balance: ${updatedBalance}.`,
                [
                  {
                    text: 'OK',
                    onPress: () =>
                      router.replace('/parent-dashboard'),
                  },
                ],
                { cancelable: false }
              );
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.message ||
                  'Could not remove points.'
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const selectedBalance = Number(
    selectedChild?.coinBalance || 0
  );

  const requestedPoints = Number(points.trim());

  const exceedsBalance = Boolean(
    selectedChild &&
    points.trim() &&
    Number.isFinite(requestedPoints) &&
    requestedPoints > selectedBalance
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={
          Platform.OS === 'ios' ? 'padding' : 'height'
        }
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* Back Button */}
          <Pressable
            onPress={() =>
              router.replace('/parent-dashboard')
            }
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Return to Parent Dashboard"
          >
            <Text style={styles.backText}>
              ‹  Back to Dashboard
            </Text>
          </Pressable>

          {/* Discipline Header */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Text style={styles.heroEmoji}>
                ⚖️
              </Text>
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>
                Discipline
              </Text>

              <Text style={styles.heroSubtitle}>
                Manage points fairly and keep track
                of deductions.
              </Text>
            </View>
          </View>

          {/* Child Selection */}
          <Text style={styles.sectionTitle}>
            Choose a Child
          </Text>

          <Text style={styles.sectionDescription}>
            Tap an account to see its available points.
          </Text>

          {children.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No children found for this account.
              </Text>
            </View>
          ) : (
            <View style={styles.childrenContainer}>
              {children.map((child) => {
                const isSelected =
                  selectedChild?.id === child.id;

                return (
                  <Pressable
                    key={child.id}
                    onPress={() =>
                      setSelectedChild(child)
                    }
                    style={({ pressed }) => [
                      styles.childCard,
                      isSelected &&
                        styles.selectedChild,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: isSelected,
                    }}
                    accessibilityLabel={`Select ${
                      child.name || 'Child'
                    }, ${
                      child.coinBalance || 0
                    } points available`}
                  >
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatar}>
                        {child.avatar || '👧'}
                      </Text>
                    </View>

                    <View style={styles.childInfo}>
                      <Text style={styles.childName}>
                        {child.name || 'Child'}
                      </Text>

                      <Text style={styles.balance}>
                        {child.coinBalance || 0} points
                        available
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.selectionIndicator,
                        isSelected &&
                          styles.selectionActive,
                      ]}
                    >
                      {isSelected ? '✓' : '○'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Remove Points Section */}
          <Text style={styles.sectionTitle}>
            Remove Points
          </Text>

          <View style={styles.formCard}>
            {selectedChild && (
              <View style={styles.balanceBanner}>
                <Text style={styles.balanceBannerLabel}>
                  Available balance
                </Text>

                <Text style={styles.balanceBannerAmount}>
                  {selectedBalance} 🪙
                </Text>
              </View>
            )}

            <Text style={styles.label}>
              Points to Remove
            </Text>

            <TextInput
              style={[
                styles.input,
                exceedsBalance && styles.inputError,
              ]}
              placeholder="Example: 10"
              placeholderTextColor="#9AA8A6"
              keyboardType="number-pad"
              value={points}
              onChangeText={setPoints}
              editable={!loading}
            />

            {exceedsBalance && (
              <Text style={styles.errorText}>
                You cannot remove more than{' '}
                {selectedBalance} points.
              </Text>
            )}

            <Text style={styles.label}>
              Reason
            </Text>

            <TextInput
              style={[
                styles.input,
                styles.reasonInput,
              ]}
              placeholder="Example: Uploaded an incorrect chore photo"
              placeholderTextColor="#9AA8A6"
              value={reason}
              onChangeText={setReason}
              editable={!loading}
              multiline
            />

            {/* Remove Points Button */}
            <Pressable
              style={({ pressed }) => [
                styles.deductButton,
                (loading ||
                  !selectedChild ||
                  exceedsBalance) &&
                  styles.disabledButton,
                pressed && styles.pressed,
              ]}
              disabled={
                loading ||
                !selectedChild ||
                exceedsBalance
              }
              onPress={deductPoints}
              accessibilityRole="button"
            >
              <Text style={styles.deductButtonText}>
                {loading
                  ? 'Removing Points...'
                  : 'Remove Points'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1FAF8',
  },

  keyboardContainer: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingRight: 16,
  },

  backText: {
    color: '#127E78',
    fontSize: 15,
    fontWeight: '700',
  },

  pressed: {
    opacity: 0.72,
  },

  hero: {
    backgroundColor: '#11847D',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 26,
    shadowColor: '#0C665F',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },

  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#E4F8F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  heroEmoji: {
    fontSize: 29,
  },

  heroCopy: {
    flex: 1,
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 3,
  },

  heroSubtitle: {
    color: '#E4F8F4',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#203532',
    marginBottom: 4,
  },

  sectionDescription: {
    fontSize: 13,
    color: '#718683',
    marginBottom: 14,
  },

  childrenContainer: {
    marginBottom: 25,
    marginTop: 8,
  },

  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 11,
    borderWidth: 2,
    borderColor: '#E3F0ED',
  },

  selectedChild: {
    borderColor: '#19B5A8',
    backgroundColor: '#F4FFFD',
  },

  avatarCircle: {
    backgroundColor: '#DFF8F4',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  avatar: {
    fontSize: 28,
  },

  childInfo: {
    flex: 1,
  },

  childName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#263A36',
  },

  balance: {
    fontSize: 13,
    color: '#748783',
    marginTop: 4,
  },

  selectionIndicator: {
    fontSize: 26,
    color: '#C8DBD7',
  },

  selectionActive: {
    color: '#11A79B',
    fontWeight: '800',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    marginVertical: 12,
    marginBottom: 26,
  },

  emptyText: {
    color: '#718683',
    textAlign: 'center',
  },

  formCard: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E3F0ED',
  },

  balanceBanner: {
    backgroundColor: '#E6F8F5',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  balanceBannerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#246F69',
  },

  balanceBannerAmount: {
    fontSize: 19,
    fontWeight: '800',
    color: '#126F67',
  },

  label: {
    color: '#263A36',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 13,
    marginBottom: 9,
  },

  input: {
    backgroundColor: '#F7FBFA',
    borderWidth: 1,
    borderColor: '#DCEBE8',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#263A36',
  },

  inputError: {
    borderColor: '#DE515B',
  },

  errorText: {
    color: '#C73945',
    fontSize: 12,
    marginTop: 7,
  },

  reasonInput: {
    minHeight: 105,
    textAlignVertical: 'top',
  },

  deductButton: {
    backgroundColor: '#E65A62',
    borderRadius: 15,
    padding: 17,
    alignItems: 'center',
    marginTop: 24,
  },

  deductButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  disabledButton: {
    opacity: 0.45,
  },
});
