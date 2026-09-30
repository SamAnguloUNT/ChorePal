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
  TouchableOpacity,
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

    const deduction = Number.parseInt(points, 10);

    if (
      !Number.isFinite(deduction) ||
      deduction <= 0
    ) {
      Alert.alert(
        'Invalid Amount',
        'Enter a valid number of points.'
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

                  updatedBalance = Math.max(
                    0,
                    currentBalance - deduction
                  );

                  removed =
                    currentBalance - updatedBalance;

                  transaction.update(
                    childRef,
                    {
                      coinBalance:
                        updatedBalance,

                      disciplineHistory:
                        arrayUnion({
                          pointsDeducted:
                            removed,

                          reason:
                            reason.trim(),

                          parentId:
                            user.uid,

                          createdAt:
                            new Date().toISOString(),
                        }),
                    }
                  );
                }
              );

              Alert.alert(
                'Points Removed',
                `${removed} point${
                  removed === 1 ? '' : 's'
                } removed. New balance: ${updatedBalance}.`
              );

              setPoints('');
              setReason('');

              await loadChildren();
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

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>

        <TouchableOpacity
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>
            ← Back
          </Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Discipline System
        </Text>

        <View style={styles.headerSpacer} />

      </View>

      {/* Prevent keyboard from blocking form */}
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
        keyboardVerticalOffset={0}
      >

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >

          {/* Select Child */}
          <Text style={styles.label}>
            Select Child
          </Text>

          {children.length === 0 ? (

            <Text style={styles.emptyText}>
              No children found.
            </Text>

          ) : (

            children.map((child) => (

              <TouchableOpacity
                key={child.id}
                style={[
                  styles.childCard,

                  selectedChild?.id ===
                    child.id &&
                    styles.selectedChild,
                ]}
                onPress={() =>
                  setSelectedChild(child)
                }
              >

                <Text style={styles.avatar}>
                  {child.avatar || '👧'}
                </Text>

                <View style={styles.childInfo}>

                  <Text style={styles.childName}>
                    {child.name || 'Child'}
                  </Text>

                  <Text style={styles.balance}>
                    {child.coinBalance || 0} 🪙
                  </Text>

                </View>

              </TouchableOpacity>

            ))

          )}

          {/* Points */}
          <Text style={styles.label}>
            Points to Remove
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Example: 10"
            keyboardType="number-pad"
            value={points}
            onChangeText={setPoints}
          />

          {/* Reason */}
          <Text style={styles.label}>
            Reason
          </Text>

          <TextInput
            style={[
              styles.input,
              styles.reasonInput,
            ]}
            placeholder="Example: Uploaded a false chore photo"
            value={reason}
            onChangeText={setReason}
            multiline
          />

          {/* Remove Points */}
          <TouchableOpacity
            style={[
              styles.deductButton,
              loading &&
                styles.disabledButton,
            ]}
            disabled={loading}
            onPress={deductPoints}
          >
            <Text
              style={styles.deductButtonText}
            >
              {loading
                ? 'Please Wait...'
                : '⚠️ Remove Points'}
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
    backgroundColor: '#FFFFFF',
  },

  keyboardContainer: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },

  backText: {
    fontSize: 16,
    color: '#4ECDC4',
    fontWeight: '600',
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2D2D2D',
  },

  headerSpacer: {
    width: 52,
  },

  content: {
    padding: 24,
    paddingBottom: 120,
  },

  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2D',
    marginBottom: 10,
    marginTop: 16,
  },

  emptyText: {
    color: '#888',
    fontSize: 14,
    marginBottom: 10,
  },

  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#EEEEEE',
  },

  selectedChild: {
    backgroundColor: '#FFF3F3',
    borderColor: '#E63946',
  },

  avatar: {
    fontSize: 32,
    marginRight: 14,
  },

  childInfo: {
    flex: 1,
  },

  childName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D2D2D',
  },

  balance: {
    marginTop: 4,
    fontSize: 14,
    color: '#888',
  },

  input: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },

  reasonInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },

  deductButton: {
    marginTop: 30,
    backgroundColor: '#E63946',
    padding: 17,
    borderRadius: 14,
    alignItems: 'center',
  },

  deductButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  disabledButton: {
    opacity: 0.5,
  },

});