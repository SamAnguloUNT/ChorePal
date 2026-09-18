import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, increment, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView, Platform,
  SafeAreaView, ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { auth, db } from '../config/firebase';
import { sendPushNotification } from '../utils/notifications';

export default function ApprovalDetailScreen() {
  const router = useRouter();
  const {
    id,
    childName,
    childAvatar,
    choreTitle,
    choreCoins,
    submittedAt,
    priority,
    aiApproved,
    aiConfidence,
    aiDescription,
  } = useLocalSearchParams();

  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(true);

  useEffect(() => {
    const loadSubmission = async () => {
      try {
        const submissionDoc = await getDoc(doc(db, 'submissions', id as string));
        if (submissionDoc.exists()) {
          setPhotoURL(submissionDoc.data().photoURL);
        }
      } catch (error) {
        console.error('Error loading submission:', error);
      } finally {
        setLoadingPhoto(false);
      }
    };
    loadSubmission();
  }, [id]);

  const findChildDoc = async () => {
    const childQuery = query(
      collection(db, 'children'),
      where('parentId', '==', auth.currentUser?.uid)
    );
    const childSnap = await getDocs(childQuery);
    return childSnap.docs.find(d => d.data().name === childName);
  };

  const handleApprove = () => {
    Alert.alert(
      'Approve Chore? ✅',
      `Approve "${choreTitle}" for ${childName}? They will earn ${choreCoins} coins!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              setLoading(true);

              // Update submission status
              await updateDoc(doc(db, 'submissions', id as string), {
                status: 'approved',
                parentComment: comment,
                approvedAt: new Date(),
              });

              // Find child and add coins
              const childDoc = await findChildDoc();
              if (childDoc) {
                await updateDoc(doc(db, 'children', childDoc.id), {
                  coinBalance: increment(parseInt(choreCoins as string)),
                });

                // Notify child
                try {
                  if (childDoc.data().pushToken) {
                    await sendPushNotification(
                      childDoc.data().pushToken,
                      '🎉 Chore Approved!',
                      `Your parent approved "${choreTitle}"! You earned ${choreCoins} coins!`,
                      { type: 'chore_approved' }
                    );
                  }
                } catch (notifError) {
                  console.log('Notification error:', notifError);
                }
              }

              Alert.alert('Approved! 🎉', `${childName} earned ${choreCoins} coins!`, [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error: any) {
              Alert.alert('Error!', error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleReject = () => {
    Alert.alert(
      'Reject Chore? ❌',
      `Reject "${choreTitle}" for ${childName}? They will need to redo it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);

              await updateDoc(doc(db, 'submissions', id as string), {
                status: 'rejected',
                parentComment: comment,
                rejectedAt: new Date(),
              });

              // Notify child
              try {
                const childDoc = await findChildDoc();
                if (childDoc && childDoc.data().pushToken) {
                  await sendPushNotification(
                    childDoc.data().pushToken,
                    '❌ Chore Rejected',
                    `Your parent rejected "${choreTitle}". Please redo the chore and resubmit!`,
                    { type: 'chore_rejected' }
                  );
                }
              } catch (notifError) {
                console.log('Notification error:', notifError);
              }

              Alert.alert(
                'Rejected',
                `${childName} has been notified to redo the chore.`,
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (error: any) {
              Alert.alert('Error!', error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const PRIORITY_COLORS: Record<string, string> = {
    low: '#66BB6A',
    medium: '#F4B942',
    high: '#E63946',
  };

  const isAiApproved = aiApproved === 'true';
  const confidencePercent = Math.round(parseFloat(aiConfidence as string) * 100);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.backText}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Review Chore</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Child Info */}
            <View style={styles.childCard}>
              <View style={styles.childLeft}>
                <View style={styles.childAvatarCircle}>
                  <Text style={styles.childAvatarEmoji}>{childAvatar}</Text>
                </View>
                <View>
                  <Text style={styles.childName}>{childName}</Text>
                  <Text style={styles.submittedAt}>Submitted {submittedAt}</Text>
                </View>
              </View>
              <View style={[styles.priorityBadge, {
                backgroundColor: PRIORITY_COLORS[priority as string] + '20',
                borderColor: PRIORITY_COLORS[priority as string]
              }]}>
                <Text style={[styles.priorityText, { color: PRIORITY_COLORS[priority as string] }]}>
                  {(priority as string).toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Chore Details */}
            <View style={styles.choreCard}>
              <Text style={styles.choreTitle}>{choreTitle}</Text>
              <View style={styles.coinsRow}>
                <Text style={styles.coinsLabel}>Reward</Text>
                <View style={styles.coinsBadge}>
                  <Text style={styles.coinsText}>🪙 {choreCoins} coins</Text>
                </View>
              </View>
            </View>

            {/* AI Result */}
            <Text style={styles.sectionLabel}>ChorePal Verification Result</Text>
            <View style={[
              styles.aiCard,
              isAiApproved ? styles.aiCardApproved : styles.aiCardWarning
            ]}>
              <View style={styles.aiHeader}>
                <Text style={styles.aiEmoji}>{isAiApproved ? '🤖✅' : '🤖⚠️'}</Text>
                <View style={styles.aiInfo}>
                  <Text style={styles.aiStatus}>
                    {isAiApproved ? 'ChorePal Approved' : 'Needs Review'}
                  </Text>
                  <Text style={styles.aiConfidence}>
                    Confidence: {confidencePercent}%
                  </Text>
                </View>
              </View>
              <Text style={styles.aiDescription}>{aiDescription}</Text>
            </View>

            {/* Photo */}
            <Text style={styles.sectionLabel}>Submitted Photo</Text>
            {loadingPhoto ? (
              <View style={styles.photoLoading}>
                <ActivityIndicator size="large" color="#4ECDC4" />
                <Text style={styles.photoLoadingText}>Loading photo...</Text>
              </View>
            ) : photoURL ? (
              <Image
                source={{ uri: photoURL }}
                style={styles.photo}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.noPhoto}>
                <Text style={styles.noPhotoText}>No photo available</Text>
              </View>
            )}

            {/* Comment */}
            <Text style={styles.sectionLabel}>Leave a Comment (optional)</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="e.g. Great job! Next time make sure to tuck in the corners 😊"
              placeholderTextColor="#aaa"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.rejectBtn, loading && styles.btnDisabled]}
                onPress={handleReject}
                disabled={loading}>
                <Text style={styles.rejectBtnText}>❌ Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.approveBtn, loading && styles.btnDisabled]}
                onPress={handleApprove}
                disabled={loading}>
                <Text style={styles.approveBtnText}>
                  {loading ? 'Processing...' : '✅ Approve'}
                </Text>
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
  scroll: { paddingBottom: 40 },
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
  backText: { fontSize: 16, color: '#4ECDC4', fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#2D2D2D' },
  childCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    marginTop: 20,
    backgroundColor: '#F0FFFE',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
    marginBottom: 16,
  },
  childLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  childAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  childAvatarEmoji: { fontSize: 26 },
  childName: { fontSize: 16, fontWeight: '800', color: '#2D2D2D' },
  submittedAt: { fontSize: 12, color: '#888', marginTop: 2 },
  priorityBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1.5,
  },
  priorityText: { fontSize: 12, fontWeight: '700' },
  choreCard: {
    marginHorizontal: 24,
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  choreTitle: { fontSize: 18, fontWeight: '800', color: '#2D2D2D', marginBottom: 10 },
  coinsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  coinsLabel: { fontSize: 14, color: '#888', fontWeight: '600' },
  coinsBadge: {
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F4B942',
  },
  coinsText: { fontSize: 14, fontWeight: '700', color: '#F4B942' },
  aiCard: {
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    gap: 8,
  },
  aiCardApproved: { backgroundColor: '#F0FFF4', borderColor: '#4ECDC4' },
  aiCardWarning: { backgroundColor: '#FFF8E1', borderColor: '#F4B942' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiEmoji: { fontSize: 32 },
  aiInfo: { flex: 1 },
  aiStatus: { fontSize: 16, fontWeight: '800', color: '#2D2D2D' },
  aiConfidence: { fontSize: 13, color: '#888', marginTop: 2 },
  aiDescription: { fontSize: 13, color: '#444', lineHeight: 18 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444',
    marginBottom: 10,
    paddingHorizontal: 24,
  },
  photo: {
    width: '100%',
    height: 280,
    marginBottom: 20,
    backgroundColor: '#F0F0F0',
  },
  photoLoading: {
    height: 200,
    marginHorizontal: 24,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 8,
  },
  photoLoadingText: { fontSize: 14, color: '#888' },
  noPhoto: {
    height: 120,
    marginHorizontal: 24,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  noPhotoText: { color: '#888', fontSize: 14 },
  commentInput: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 13,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#F9F9F9',
    marginBottom: 24,
    minHeight: 90,
    marginHorizontal: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E63946',
  },
  rejectBtnText: { color: '#E63946', fontSize: 16, fontWeight: '700' },
  approveBtn: {
    flex: 1,
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
  approveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
});