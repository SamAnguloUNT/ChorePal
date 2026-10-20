import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, increment, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView, Modal, Platform,
  SafeAreaView, ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import PressableScale from '../components/PressableScale';
import { db } from '../config/firebase';
import { sendPushNotification } from '../utils/notifications';
import { deletePhotoFromStorage } from '../utils/photoCleanup';

const PRIORITY_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  low: { label: '🟢 Low', bg: '#E0FFF4', color: '#2A9D8F' },
  medium: { label: '🟡 Medium', bg: '#FFF3CD', color: '#B7791F' },
  high: { label: '🔴 High', bg: '#FFE5E5', color: '#E63946' },
};

// Slides up and fades in, staggered by index. Skips the motion when Reduce Motion is on.
function AnimatedEntry({
  index,
  skip,
  children,
}: {
  index: number;
  skip: boolean;
  children: React.ReactNode;
}) {
  const anim = useRef(new Animated.Value(skip ? 1 : 0)).current;
  useEffect(() => {
    if (skip) {
      anim.setValue(1);
      return;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 80,
      easing: Easing.out(Easing.back(1.1)),
      useNativeDriver: true,
    }).start();
  }, [anim, index, skip]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
      }}>
      {children}
    </Animated.View>
  );
}

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
  const [reduceMotion, setReduceMotion] = useState(false);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const { width: winW, height: winH } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

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

  // FIX: Look the child up by the childId saved on the submission instead of matching on
  // the child's name. Matching by name could pick the wrong child (two kids with the same
  // name) and give them the coins and the notification.
  const getChildDoc = async () => {
    const submissionSnap = await getDoc(doc(db, 'submissions', id as string));
    const childId = submissionSnap.exists() ? submissionSnap.data().childId : null;
    if (!childId) return null;

    const childSnap = await getDoc(doc(db, 'children', childId));
    return childSnap.exists() ? childSnap : null;
  };

  // Privacy: once the parent has decided (approve OR reject) the photo is no longer needed,
  // so delete it from Storage and clear its link from the submission. The submission itself
  // stays (status, comment, coins) because the child's chore list depends on it.
  const removeSubmissionPhoto = async () => {
    try {
      const ref = doc(db, 'submissions', id as string);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      if (!data.photoURL && !data.photoPath) return;

      const deleted = await deletePhotoFromStorage({
        photoPath: data.photoPath,
        photoURL: data.photoURL,
      });
      if (deleted) {
        await updateDoc(ref, { photoURL: null, photoPath: null, photoDeletedAt: new Date() });
      }
    } catch (error) {
      // Never block approving/rejecting because the cleanup failed
      console.log('Photo cleanup failed:', error);
    }
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

              // Find the child first. If we can't, stop BEFORE marking the submission
              // approved, so a chore is never approved without the coins being awarded.
              const childDoc = await getChildDoc();
              if (!childDoc) {
                Alert.alert('Error!', 'Could not find this child\'s account. Nothing was changed.');
                return;
              }

              // Update submission status
              await updateDoc(doc(db, 'submissions', id as string), {
                status: 'approved',
                parentComment: comment.trim(),
                approvedAt: new Date(),
              });

              // Add coins
              await updateDoc(doc(db, 'children', childDoc.id), {
                coinBalance: increment(parseInt(choreCoins as string)),
              });

              // Delete the submitted photo now that the parent is done with it
              await removeSubmissionPhoto();

              // Notify child (logs "No push token for recipient" if the child has none)
              try {
                await sendPushNotification(
                  childDoc.data()?.pushToken || null,
                  '🎉 Chore Approved!',
                  `Your parent approved "${choreTitle}"! You earned ${choreCoins} coins!${comment.trim() ? ` Parent says: "${comment.trim()}"` : ''}`,
                  { type: 'chore_approved', comment: comment.trim() }
                );
              } catch (notifError) {
                console.log('Notification error:', notifError);
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
                parentComment: comment.trim(),
                rejectedAt: new Date(),
              });

              // Delete the submitted photo now that the parent is done with it
              await removeSubmissionPhoto();

              // Notify child (logs "No push token for recipient" if the child has none)
              try {
                const childDoc = await getChildDoc();
                await sendPushNotification(
                  childDoc?.data()?.pushToken || null,
                  '❌ Chore Rejected',
                  `Your parent rejected "${choreTitle}". Please redo the chore and resubmit!${comment.trim() ? ` Parent says: "${comment.trim()}"` : ''}`,
                  { type: 'chore_rejected', comment: comment.trim() }
                );
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

  const isAiApproved = aiApproved === 'true';
  const parsedConfidence = parseFloat(aiConfidence as string);
  const confidencePercent = Number.isFinite(parsedConfidence) ? Math.round(parsedConfidence * 100) : 0;
  const priorityStyle = PRIORITY_STYLES[String(priority ?? 'medium').toLowerCase()] || PRIORITY_STYLES.medium;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}>

          {/* Top bar */}
          <View style={styles.topBar}>
            <PressableScale
              style={styles.backBtn}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back">
              <Text style={styles.backText}>← Back</Text>
            </PressableScale>
          </View>

          {/* Hero: who submitted what */}
          <AnimatedEntry index={0} skip={reduceMotion}>
            <View style={styles.hero}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroLeft}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarEmoji}>{childAvatar || '👧'}</Text>
                  </View>
                  <View style={styles.heroNameBlock}>
                    <Text style={styles.heroGreeting}>Review chore</Text>
                    <Text style={styles.heroName} numberOfLines={1}>{childName}</Text>
                    <Text style={styles.heroSub}>Submitted {submittedAt}</Text>
                  </View>
                </View>
                <View style={[styles.heroPriority, { backgroundColor: priorityStyle.bg }]}>
                  <Text style={[styles.heroPriorityText, { color: priorityStyle.color }]}>
                    {priorityStyle.label}
                  </Text>
                </View>
              </View>

              <View style={styles.heroChoreRow}>
                <Text style={styles.heroChoreTitle} numberOfLines={3}>{choreTitle}</Text>
                <View style={styles.heroCoins}>
                  <Text style={styles.heroCoinsEmoji}>🪙</Text>
                  <Text style={styles.heroCoinsValue}>{choreCoins}</Text>
                </View>
              </View>
            </View>
          </AnimatedEntry>

          {/* AI Result */}
          <AnimatedEntry index={1} skip={reduceMotion}>
            <Text style={styles.sectionTitle}>ChorePal Verification</Text>
            <View style={[
              styles.aiCard,
              isAiApproved ? styles.aiCardApproved : styles.aiCardWarning
            ]}>
              <View style={styles.aiHeader}>
                <View style={[styles.aiEmojiBox, { backgroundColor: isAiApproved ? '#E0FFF4' : '#FFF3CD' }]}>
                  <Text style={styles.aiEmoji}>{isAiApproved ? '🤖✅' : '🤖⚠️'}</Text>
                </View>
                <View style={styles.aiInfo}>
                  <Text style={styles.aiStatus}>
                    {isAiApproved ? 'ChorePal approved' : 'Needs your review'}
                  </Text>
                  <View style={styles.confidenceTrack}>
                    <View
                      style={[
                        styles.confidenceFill,
                        {
                          width: `${Math.max(0, Math.min(100, confidencePercent))}%`,
                          backgroundColor: isAiApproved ? '#4ECDC4' : '#F4B942',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.aiConfidence}>Confidence: {confidencePercent}%</Text>
                </View>
              </View>
              {!!aiDescription && <Text style={styles.aiDescription}>{aiDescription}</Text>}
            </View>
          </AnimatedEntry>

          {/* Photo */}
          <AnimatedEntry index={2} skip={reduceMotion}>
            <Text style={styles.sectionTitle}>Submitted photo</Text>
            {loadingPhoto ? (
              <View style={styles.photoLoading}>
                <ActivityIndicator size="large" color="#4ECDC4" />
                <Text style={styles.photoLoadingText}>Loading photo...</Text>
              </View>
            ) : photoURL ? (
              <PressableScale
                style={styles.photoCard}
                onPress={() => setPhotoViewerVisible(true)}
                accessibilityRole="imagebutton"
                accessibilityLabel="View photo full screen">
                <Image
                  source={{ uri: photoURL }}
                  style={styles.photo}
                  resizeMode="cover"
                />
                <View style={styles.expandHint}>
                  <Text style={styles.expandHintText}>🔍 Tap to view full photo</Text>
                </View>
              </PressableScale>
            ) : (
              <View style={styles.noPhoto}>
                <Text style={styles.noPhotoEmoji}>📷</Text>
                <Text style={styles.noPhotoText}>No photo available</Text>
              </View>
            )}
            <Text style={styles.photoNote}>
              🔒 This photo is deleted as soon as you approve or reject.
            </Text>
          </AnimatedEntry>

          {/* Comment */}
          <AnimatedEntry index={3} skip={reduceMotion}>
            <Text style={styles.sectionTitle}>Leave a comment</Text>
            <Text style={styles.sectionHint}>Optional. Your child will see this.</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="e.g. Great job! Next time make sure to tuck in the corners 😊"
              placeholderTextColor="#9AA9A6"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
              textAlignVertical="top"
            />
          </AnimatedEntry>

          {/* Action Buttons */}
          <AnimatedEntry index={4} skip={reduceMotion}>
            <View style={styles.actionsRow}>
              <PressableScale
                style={[styles.rejectBtn, loading && styles.btnDisabled]}
                onPress={loading ? undefined : handleReject}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Reject chore">
                <Text style={styles.rejectBtnText}>❌ Reject</Text>
              </PressableScale>
              <PressableScale
                style={[styles.approveBtn, loading && styles.btnDisabled]}
                onPress={loading ? undefined : handleApprove}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Approve chore">
                {loading ? (
                  <View style={styles.processingRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.approveBtnText}>Processing...</Text>
                  </View>
                ) : (
                  <Text style={styles.approveBtnText}>✅ Approve</Text>
                )}
              </PressableScale>
            </View>
          </AnimatedEntry>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Full-screen photo viewer */}
      <Modal
        visible={photoViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoViewerVisible(false)}>
        <View style={styles.viewerOverlay}>
          {/* Pinch to zoom works on iOS; Android shows the full photo without zoom */}
          <ScrollView
            style={styles.viewerScroll}
            contentContainerStyle={styles.viewerContent}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}>
            {photoURL && (
              <Image
                source={{ uri: photoURL }}
                style={{ width: winW, height: winH * 0.8 }}
                resizeMode="contain"
              />
            )}
          </ScrollView>

          <SafeAreaView style={styles.viewerTopBar} pointerEvents="box-none">
            <PressableScale
              style={styles.viewerCloseBtn}
              onPress={() => setPhotoViewerVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Close photo">
              <Text style={styles.viewerCloseText}>✕ Close</Text>
            </PressableScale>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3FBF9' },
  inner: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 120 },

  // Top bar
  topBar: { flexDirection: 'row', marginBottom: 12 },
  backBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
  },
  backText: { fontSize: 14, color: '#0F7F76', fontWeight: '800' },

  // Hero
  hero: {
    backgroundColor: '#0F7F76',
    borderRadius: 28,
    padding: 20,
    gap: 18,
    marginBottom: 22,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 32 },
  heroNameBlock: { flexShrink: 1 },
  heroGreeting: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  heroName: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  heroSub: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  heroPriority: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  heroPriorityText: { fontSize: 12, fontWeight: '800' },
  heroChoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  heroChoreTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  heroCoins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD479',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroCoinsEmoji: { fontSize: 18 },
  heroCoinsValue: { fontSize: 18, fontWeight: '900', color: '#7A4F0B' },

  // Sections
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#1F2D2B', marginBottom: 10 },
  sectionHint: { fontSize: 13, fontWeight: '600', color: '#6B7C79', marginTop: -6, marginBottom: 10 },

  // AI card
  aiCard: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1.5,
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  aiCardApproved: { borderColor: '#4ECDC4', backgroundColor: '#F4FFFB' },
  aiCardWarning: { borderColor: '#F4B942', backgroundColor: '#FFFBEF' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiEmojiBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiEmoji: { fontSize: 22 },
  aiInfo: { flex: 1 },
  aiStatus: { fontSize: 17, fontWeight: '800', color: '#1F2D2B' },
  confidenceTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E3EAE9',
    marginTop: 8,
    overflow: 'hidden',
  },
  confidenceFill: { height: 6, borderRadius: 3 },
  aiConfidence: { fontSize: 12, color: '#6B7C79', fontWeight: '700', marginTop: 5 },
  aiDescription: { fontSize: 14, color: '#3D4D4A', lineHeight: 20, fontWeight: '500' },

  // Photo
  photoCard: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  photo: { width: '100%', height: 300, backgroundColor: '#EEF2F1' },
  expandHint: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  expandHintText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  // Full-screen viewer
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  viewerScroll: { flex: 1 },
  viewerContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  viewerTopBar: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'flex-end' },
  viewerCloseBtn: {
    marginTop: 10,
    marginRight: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  viewerCloseText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  photoLoading: {
    height: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoLoadingText: { fontSize: 14, color: '#6B7C79', fontWeight: '600' },
  noPhoto: {
    height: 130,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  noPhotoEmoji: { fontSize: 30 },
  noPhotoText: { color: '#6B7C79', fontSize: 14, fontWeight: '700' },
  photoNote: {
    fontSize: 12,
    color: '#6B7C79',
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 22,
    textAlign: 'center',
  },

  // Comment
  commentInput: {
    borderWidth: 1.5,
    borderColor: '#DDF1EE',
    borderRadius: 18,
    padding: 14,
    fontSize: 15,
    color: '#1F2D2B',
    backgroundColor: '#FFFFFF',
    marginBottom: 24,
    minHeight: 100,
  },

  // Actions
  actionsRow: { flexDirection: 'row', gap: 12 },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E63946',
  },
  rejectBtnText: { color: '#E63946', fontSize: 16, fontWeight: '800' },
  approveBtn: {
    flex: 1,
    backgroundColor: '#4ECDC4',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  approveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  processingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnDisabled: { opacity: 0.6 },
});