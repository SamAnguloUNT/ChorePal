import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  SafeAreaView, ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import Celebration from '../components/Celebration';
import FloatingBackground from '../components/FloatingBackground';
import TextToSpeech from '../components/TextToSpeech';
import { db } from '../config/firebase';
import { registerForPushNotifications, sendPushNotification } from '../utils/notifications';
import { uploadPhotoToStorage, uriToBase64 } from '../utils/uploadPhoto';
import { useHomeGeofence } from '../utils/useHomeGeofence';
import { analyzeImage } from '../utils/visionApi';

// Turns a chore's priority (string like "high" or a number 1-3) into a label + colors.
// Returns null when the chore has no priority so the badge is simply hidden.
const getPriorityInfo = (priority: any) => {
  if (priority === undefined || priority === null || priority === '') return null;
  const value = String(priority).trim().toLowerCase();
  if (value === 'high' || value === 'urgent' || value === '3') {
    return { label: 'High Priority', emoji: '🔴', bg: '#FFE5E5', color: '#E63946' };
  }
  if (value === 'medium' || value === 'normal' || value === '2') {
    return { label: 'Medium Priority', emoji: '🟡', bg: '#FFF3CD', color: '#B7791F' };
  }
  if (value === 'low' || value === '1') {
    return { label: 'Low Priority', emoji: '🟢', bg: '#E0FFF4', color: '#2A9D8F' };
  }
  return { label: `${String(priority)} Priority`, emoji: '⭐', bg: '#F0FFFE', color: '#2A9D8F' };
};

// Lower number = shows higher in the list. Chores with no priority go after the ranked ones.
const getPriorityRank = (priority: any) => {
  const value = String(priority ?? '').trim().toLowerCase();
  if (value === 'high' || value === 'urgent' || value === '3') return 0;
  if (value === 'medium' || value === 'normal' || value === '2') return 1;
  if (value === 'low' || value === '1') return 2;
  return 3;
};

// Handles a few common ways the parent app might store "optional".
const isChoreOptional = (chore: any) =>
  chore?.optional === true ||
  chore?.isOptional === true ||
  chore?.required === false ||
  String(chore?.type ?? '').toLowerCase() === 'optional' ||
  String(chore?.choreType ?? '').toLowerCase() === 'optional';

// Deadlines are saved by the parent app as "YYYY-MM-DD" strings (local dates).
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const toLocalDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Firestore Timestamp / Date -> milliseconds
const toMillis = (v: any): number => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
};

// DECLUTTER: each chore card shows at most ONE status chip instead of up to five.
// Most important message wins: approved > waiting > redo > overdue.
const getStatusChip = (chore: any) => {
  if (chore.verified) return { label: '✓ Approved', bg: '#E0FFF4', color: '#2A9D8F' };
  if (chore.completed) return { label: '⏳ Waiting', bg: '#FFF3CD', color: '#B7791F' };
  if (chore.feedbackStatus === 'rejected') return { label: 'Please redo', bg: '#FFE5E5', color: '#E63946' };
  if (chore.overdue) return { label: 'Overdue', bg: '#FFE5E5', color: '#E63946' };
  return null;
};

// Chore card that slides up and fades in, one after another.
function AnimatedEntry({ index, children }: { index: number; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 450,
      delay: Math.min(index, 8) * 90,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
      }}>
      {children}
    </Animated.View>
  );
}

export default function ChildDashboard() {
  const router = useRouter();
  const [childData, setChildData] = useState<any>(null);
  const [chores, setChores] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedChore, setSelectedChore] = useState<any>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  const [disciplineNotification, setDisciplineNotification] = useState<any>(null);
  const [disciplineModalVisible, setDisciplineModalVisible] = useState(false);

  // ---- Animations ----
  // Avatar bobs up and down, coin wobbles, progress bar fills smoothly.
  const bob = useRef(new Animated.Value(0)).current;
  const wobble = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const wobbleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(wobble, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(wobble, { toValue: -1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(1500),
      ])
    );
    bobLoop.start();
    wobbleLoop.start();
    return () => {
      bobLoop.stop();
      wobbleLoop.stop();
    };
  }, [bob, wobble]);

  useEffect(() => {
    const loadData = async () => {
      const session = await AsyncStorage.getItem('childSession');
      if (session) {
        const child = JSON.parse(session);
        setChildData(child);

        // Asks for permission AND saves this child's push token to their children doc,
        // so the parent can send approve/reject notifications to this device.
        registerForPushNotifications(child.id, 'child');

        // FIX: Without a parentId we can't tell which family this child belongs to,
        // and querying with `undefined` would throw. Show no chores instead of
        // risking chores from other families.
        if (!child.parentId) {
          console.log('Child session is missing parentId — cannot load chores.');
          setChores([]);
          return;
        }

        // FIX: Scope chores to this child's parent. Previously, 'all' matched every
        // parent's "all children" chores in the whole database.
        // NOTE: This query needs a composite index on parentId + assignedTo.
        // Firestore will log a link to create it the first time this runs.
        const choresQuery = query(
          collection(db, 'chores'),
          where('parentId', '==', child.parentId),
          where('assignedTo', 'in', ['all', child.id])
        );
        const choresSnap = await getDocs(choresQuery);
        let choresData = choresSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          completed: false,
          verified: false,
        }));

        const approvedQuery = query(
          collection(db, 'submissions'),
          where('childId', '==', child.id),
          where('status', '==', 'approved')
        );
        const approvedSnap = await getDocs(approvedQuery);
        const approvedChoreIds = approvedSnap.docs.map(d => d.data().choreId);

        const pendingQuery = query(
          collection(db, 'submissions'),
          where('childId', '==', child.id),
          where('status', '==', 'pending')
        );
        const pendingSnap = await getDocs(pendingQuery);
        const pendingChoreIds = pendingSnap.docs.map(d => d.data().choreId);

        // Parent feedback: look at approved + rejected submissions and keep the newest
        // review for each chore (its status and the comment the parent wrote).
        const rejectedQuery = query(
          collection(db, 'submissions'),
          where('childId', '==', child.id),
          where('status', '==', 'rejected')
        );
        const rejectedSnap = await getDocs(rejectedQuery);
        const latestReview: Record<string, { when: number; status: string; comment: string }> = {};
        [...approvedSnap.docs, ...rejectedSnap.docs].forEach(d => {
          const s: any = d.data();
          const when = Math.max(toMillis(s.approvedAt), toMillis(s.rejectedAt), toMillis(s.submittedAt));
          const existing = latestReview[s.choreId];
          if (!existing || when > existing.when) {
            latestReview[s.choreId] = {
              when,
              status: s.status,
              comment: String(s.parentComment || '').trim(),
            };
          }
        });

        choresData = choresData.map(chore => {
          const isPending = pendingChoreIds.includes(chore.id);
          const review = latestReview[chore.id];
          return {
            ...chore,
            completed: approvedChoreIds.includes(chore.id) || isPending,
            verified: approvedChoreIds.includes(chore.id),
            // Hide an old note while a newer resubmission is waiting for review
            feedback: !isPending && review ? review.comment : '',
            feedbackStatus: !isPending && review ? review.status : null,
          };
        });

        setChores(choresData);
      }
    };
    loadData();
  }, []);

  // Listen for Discipline System deductions in real time.
  // If the child is using the app when points are removed, the popup appears immediately.
  // If the app was closed, the newest unseen deduction appears the next time the child opens the dashboard.
  useEffect(() => {
    if (!childData?.id) return;

    const childRef = doc(db, 'children', childData.id);

    const unsubscribe = onSnapshot(childRef, async (snapshot) => {
      if (!snapshot.exists()) return;

      const freshChildData = {
        id: snapshot.id,
        ...snapshot.data(),
      } as any;

      // Keep the displayed coin balance current.
      setChildData((previous: any) => ({
        ...previous,
        ...freshChildData,
      }));

      const history = Array.isArray(freshChildData.disciplineHistory)
        ? freshChildData.disciplineHistory
        : [];

      // Only treat entries that actually removed points as deductions.
      const validDeductions = history.filter(
        (item: any) => Number(item?.pointsDeducted || 0) > 0
      );

      if (validDeductions.length === 0) return;

      // The Discipline System appends new entries to the history array.
      const latestDeduction = validDeductions[validDeductions.length - 1];

      const notificationId = [
        latestDeduction.createdAt || '',
        latestDeduction.pointsDeducted || 0,
        latestDeduction.reason || '',
      ].join('|');

      const storageKey = `lastSeenDiscipline_${childData.id}`;
      const lastSeen = await AsyncStorage.getItem(storageKey);

      if (lastSeen !== notificationId) {
        setDisciplineNotification(latestDeduction);
        setDisciplineModalVisible(true);

        // Remember this deduction so the same popup does not appear repeatedly.
        await AsyncStorage.setItem(storageKey, notificationId);
      }
    });

    return unsubscribe;
  }, [childData?.id]);

  // NOTE: Auto-speak useEffect was removed.
  // The child now taps the TextToSpeech button to hear the AI feedback.

  // Order: required chores first, then optional ones. Inside each group, unfinished
  // chores come before finished ones, and higher priority comes first.
  // The dashboard only shows chores due TODAY, plus overdue chores that still aren't approved
  // so they don't silently disappear. Future chores live on the Calendar page.
  const today = toLocalDateString(new Date());
  const hasDeadline = (c: any) => typeof c.deadline === 'string' && DATE_RE.test(c.deadline);
  const visibleChores = chores
    .filter(c => !hasDeadline(c) || c.deadline === today || (c.deadline < today && !c.verified))
    .map(c => ({ ...c, overdue: hasDeadline(c) && c.deadline < today }));
  const upcomingCount = chores.filter(c => hasDeadline(c) && c.deadline > today).length;

  const sortedChores = [...visibleChores].sort((a, b) => {
    const optionalDiff = Number(isChoreOptional(a)) - Number(isChoreOptional(b));
    if (optionalDiff !== 0) return optionalDiff;
    const doneDiff = Number(a.completed) - Number(b.completed);
    if (doneDiff !== 0) return doneDiff;
    return getPriorityRank(a.priority) - getPriorityRank(b.priority);
  });

  // Optional chores are bonus work, so they don't count against daily progress.
  const requiredChores = visibleChores.filter(c => !isChoreOptional(c));
  const completedCount = requiredChores.filter(c => c.completed).length;
  const progress = requiredChores.length > 0 ? completedCount / requiredChores.length : 0;

  // Smoothly animate the progress bar whenever progress changes.
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width can't use the native driver
    }).start();
  }, [progress, progressAnim]);

  // Home reminders: "Welcome home, you have N chores" on arrival, and
  // "Don't forget your chores" on leaving. Foreground-only (works in Expo Go).
  // `homeLocation` is copied onto the child doc by the parent app.
  useHomeGeofence(
    childData?.homeLocation,
    requiredChores.filter(c => !c.completed).length
  );

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('childSession');
          router.replace('/');
        }
      }
    ]);
  };

  const openVerification = (chore: any) => {
    setSelectedChore(chore);
    setPhoto(null);
    setAiResult(null);
    setSubmitted(false);
    setModalVisible(true);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera permission is required!');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
      setAiResult(null);
      setSubmitted(false);
    }
  };

  const uploadPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
      setAiResult(null);
      setSubmitted(false);
    }
  };

  const submitVerification = async () => {
    if (!photo) {
      Alert.alert('No photo!', 'Please take or upload a photo first!');
      return;
    }

    try {
      setSubmitting(true);

      // Step 1 — Upload photo to Firebase Storage
      const photoPath = `submissions/${childData.id}/${selectedChore.id}_${Date.now()}.jpg`;
      const photoURL = await uploadPhotoToStorage(photo, photoPath);

      // Step 2 — Run Google Vision AI
      const base64 = await uriToBase64(photo);
      const aiAnalysis = await analyzeImage(base64, selectedChore.title);

      // Step 3 — Show AI result in modal
      setAiResult(aiAnalysis);

      // Step 4 — If AI rejects block submission
      if (!aiAnalysis.isComplete) {
        setSubmitting(false);
        return;
      }

      // Step 5 — Save submission to Firestore
      await addDoc(collection(db, 'submissions'), {
        choreId: selectedChore.id,
        choreTitle: selectedChore.title,
        choreCoins: selectedChore.coins,
        childId: childData.id,
        childName: childData.name,
        childAvatar: childData.avatar,
        parentId: childData.parentId,
        photoURL,
        aiApproved: aiAnalysis.isComplete,
        aiConfidence: aiAnalysis.confidence,
        aiDescription: aiAnalysis.description,
        status: 'pending',
        submittedAt: new Date(),
      });

      // Step 6 — Mark as submitted
      setSubmitted(true);

      // Step 7 — Notify parent
      try {
        // Child sessions aren't signed in to Firebase Auth, so reading the parent's
        // `users` doc is denied by security rules. Use the parent's push token that the
        // parent app copies onto each child doc (`parentPushToken`) instead.
        await sendPushNotification(
          childData.parentPushToken || null,
          '📸 Chore Submitted!',
          `${childData.name} submitted "${selectedChore.title}" for approval!`,
          { type: 'chore_submitted', choreId: selectedChore.id }
        );
      } catch (notifError) {
        console.log('Notification error:', notifError);
      }

      // Step 8 — Update local chore state
      setChores(prev => prev.map(c =>
        c.id === selectedChore.id ? { ...c, completed: true, verified: false } : c
      ));

      // Step 9 — Save progress to AsyncStorage
      const session = await AsyncStorage.getItem('childSession');
      if (session) {
        const child = JSON.parse(session);
        await AsyncStorage.setItem('childSession', JSON.stringify({
          ...child,
          choreProgress: chores.map(c => ({
            id: c.id,
            completed: c.id === selectedChore.id ? true : c.completed,
            verified: c.verified,
          }))
        }));
      }

    } catch (error: any) {
      Alert.alert('Error!', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const todoCount = requiredChores.filter(c => !c.completed).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Fun animated background: floating stars, bubbles and coins (behind everything) */}
      <FloatingBackground />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero: greeting, coins, and progress. The old stats row was merged in here. */}
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.profileSection}>
              <Animated.View
                style={[
                  styles.profileCircle,
                  { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] },
                ]}>
                <Text style={styles.profileEmoji}>{childData?.avatar || '👧'}</Text>
              </Animated.View>
              <View style={styles.heroNameBlock}>
                <Text style={styles.heroGreeting} numberOfLines={1}>
                  Hi, {childData?.name || 'there'}!
                </Text>
                <Text style={styles.heroSub}>
                  {requiredChores.length === 0
                    ? 'No chores to do right now'
                    : todoCount === 0
                      ? 'All done today! 🎉'
                      : todoCount === 1
                        ? '1 chore to go'
                        : `${todoCount} chores to go`}
                </Text>
              </View>
            </View>
            {/* Small icon-only log out so it stops competing with the content */}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Log out">
              <Text style={styles.logoutBtnEmoji}>🚪</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.coinPill}>
            <Animated.Text
              style={[
                styles.coinPillEmoji,
                { transform: [{ rotate: wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] }) }] },
              ]}>
              🪙
            </Animated.Text>
            <Text style={styles.coinPillValue}>{childData?.coinBalance || 0}</Text>
            <Text style={styles.coinPillLabel}>coins</Text>
          </View>

          <View>
            <View style={styles.heroProgressRow}>
              <Text style={styles.heroProgressLabel}>Today's progress</Text>
              <Text style={styles.heroProgressCount}>
                {requiredChores.length === 0
                  ? '-'
                  : `${completedCount} of ${requiredChores.length}`}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Chores */}
        <Text style={styles.sectionTitle}>Today's chores</Text>
        <View style={styles.choresList}>
          {visibleChores.length === 0 ? (
            <View style={styles.noChores}>
              <Text style={styles.noChoresEmoji}>🎉</Text>
              <Text style={styles.noChoresText}>No chores due today</Text>
              <Text style={styles.noChoresHint}>
                {upcomingCount > 0
                  ? `You have ${upcomingCount} chore${upcomingCount === 1 ? '' : 's'} coming up. Check the Calendar!`
                  : 'New chores from your parent will show up here.'}
              </Text>
            </View>
          ) : (
            sortedChores.map((chore, index) => {
              const priority = getPriorityInfo(chore.priority);
              const optional = isChoreOptional(chore);
              const statusChip = getStatusChip(chore);
              // Priority is shown only by the stripe color now (no extra chip).
              const stripeColor = chore.completed
                ? '#C9D6D4'
                : optional
                  ? '#7B61FF'
                  : priority?.color || '#4ECDC4';
              return (
                <Fragment key={chore.id}>
                  {/* Section header shown once, right before the first optional chore */}
                  {optional && (index === 0 || !isChoreOptional(sortedChores[index - 1])) && (
                    <Text style={styles.optionalHeader}>⭐ Bonus chores</Text>
                  )}
                  <AnimatedEntry index={index}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => openVerification(chore)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open chore: ${chore.title}`}
                      style={[styles.choreCard, chore.completed && styles.choreCardDone]}>
                      <View style={[styles.priorityStripe, { backgroundColor: stripeColor }]} />
                      <View style={styles.choreBody}>
                        <View style={[
                          styles.statusCircle,
                          chore.completed && !chore.verified && styles.statusPending,
                          chore.verified && styles.statusDone,
                        ]}>
                          {chore.verified && <Text style={styles.statusMark}>✓</Text>}
                          {chore.completed && !chore.verified && <Text style={styles.statusPendingMark}>⏳</Text>}
                        </View>

                        <View style={styles.choreTextBlock}>
                          <Text
                            style={[styles.choreTitle, chore.completed && styles.choreTitleDone]}
                            numberOfLines={2}>
                            {chore.title}
                          </Text>
                          <View style={styles.chipRow}>
                            <View style={[styles.chip, { backgroundColor: '#FFF3CD' }]}>
                              <Text style={[styles.chipText, { color: '#B7791F' }]}>🪙 {chore.coins ?? 0}</Text>
                            </View>
                            {statusChip && (
                              <View style={[styles.chip, { backgroundColor: statusChip.bg }]}>
                                <Text style={[styles.chipText, { color: statusChip.color }]}>{statusChip.label}</Text>
                              </View>
                            )}
                          </View>
                          {!!chore.feedback && (
                            <Text style={styles.feedbackLine} numberOfLines={1}>
                              💬 {chore.feedback}
                            </Text>
                          )}
                        </View>

                        {/* Text-to-speech: read the chore aloud */}
                        <TextToSpeech
                          text={`${chore.title}. It's worth ${chore.coins ?? 0} coins.`}
                          size={24}
                        />
                      </View>
                    </TouchableOpacity>
                  </AnimatedEntry>
                </Fragment>
              );
            })
          )}
        </View>

      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={[styles.navItem, styles.navActive]}>
          <Text style={styles.navEmoji}>📋</Text>
          <Text style={[styles.navText, styles.navTextActive]}>Chores</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.replace('/child-calendar')}>
          <Text style={styles.navEmoji}>📅</Text>
          <Text style={styles.navText}>Calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.replace('/child-rewards')}>
          <Text style={styles.navEmoji}>⭐</Text>
          <Text style={styles.navText}>Rewards</Text>
        </TouchableOpacity>
      </View>

      {/* Automatic Discipline Deduction Notification */}
      <Modal
        visible={disciplineModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDisciplineModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDisciplineModalVisible(false)}>
          <View style={styles.disciplineModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.disciplineModalCard}>
                <TouchableOpacity
                  style={styles.disciplineCloseButton}
                  onPress={() => setDisciplineModalVisible(false)}
                >
                  <Text style={styles.disciplineCloseText}>✕</Text>
                </TouchableOpacity>

                <Text style={styles.disciplineModalEmoji}>⚠️</Text>
                <Text style={styles.disciplineModalTitle}>Point Deduction</Text>

                <Text style={styles.disciplinePointsLost}>
                  -{disciplineNotification?.pointsDeducted || 0} points
                </Text>

                <Text style={styles.disciplineReasonLabel}>Reason</Text>
                <Text style={styles.disciplineReasonText}>
                  {disciplineNotification?.reason || 'No reason provided.'}
                </Text>

                {/* Text-to-speech: read the deduction and reason aloud */}
                <View style={styles.speakRow}>
                  <TextToSpeech
                    text={`You lost ${disciplineNotification?.pointsDeducted || 0} points. The reason is: ${disciplineNotification?.reason || 'No reason provided.'}`}
                    size={28}
                  />
                </View>

                <TouchableOpacity
                  style={styles.disciplineDoneButton}
                  onPress={() => setDisciplineModalVisible(false)}
                >
                  <Text style={styles.disciplineDoneButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Verification Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!submitting) {
            setModalVisible(false);
            setAiResult(null);
            setPhoto(null);
            setSubmitted(false);
          }
        }}>
        <TouchableWithoutFeedback onPress={() => !submitting && !aiResult && setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>

                {/* Close button — only show if not submitting and no result yet */}
                {!submitting && !aiResult && (
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => {
                      setModalVisible(false);
                      setPhoto(null);
                    }}>
                    <Text style={styles.closeText}>✕</Text>
                  </TouchableOpacity>
                )}

                <ScrollView showsVerticalScrollIndicator={false}>

                <Text style={styles.modalTitle}>
                  {aiResult
                    ? aiResult.isComplete
                      ? 'Great Job! 🎉'
                      : 'Not Quite! 🤔'
                    : selectedChore?.title || 'Chore'}
                </Text>

                <Text style={styles.modalSubtitle}>
                  {aiResult
                    ? aiResult.isComplete
                      ? submitted
                        ? 'Your chore has been sent to your parent for final approval!'
                        : 'AI is reviewing your photo...'
                      : 'Please redo the chore and try again!'
                    : selectedChore?.completed
                      ? selectedChore?.verified
                        ? 'Your parent approved this chore. Nice work! ✅'
                        : 'Waiting for your parent to approve this chore ⏳'
                      : 'Take or upload a photo to show you finished!'}
                </Text>

                {/* Chore details: priority, coins, and description with text-to-speech */}
                {!aiResult && selectedChore && (
                  <>
                    <View style={styles.detailBadges}>
                      {isChoreOptional(selectedChore) && (
                        <View style={styles.optionalBadge}>
                          <Text style={styles.optionalBadgeText}>⭐ Optional bonus</Text>
                        </View>
                      )}
                      {getPriorityInfo(selectedChore.priority) && (
                        <View style={[
                          styles.priorityBadge,
                          { backgroundColor: getPriorityInfo(selectedChore.priority)!.bg }
                        ]}>
                          <Text style={[
                            styles.priorityBadgeText,
                            { color: getPriorityInfo(selectedChore.priority)!.color }
                          ]}>
                            {getPriorityInfo(selectedChore.priority)!.emoji}{' '}
                            {getPriorityInfo(selectedChore.priority)!.label}
                          </Text>
                        </View>
                      )}
                      <View style={styles.coinBadge}>
                        <Text style={styles.coinBadgeText}>
                          🪙 {selectedChore.coins ?? 0} coins
                        </Text>
                      </View>
                    </View>

                    <View style={styles.descriptionBox}>
                      <View style={styles.descriptionHeader}>
                        <Text style={styles.descriptionLabel}>WHAT TO DO</Text>
                        <TextToSpeech
                          text={[
                            selectedChore.title,
                            selectedChore.description || 'No description provided.',
                            getPriorityInfo(selectedChore.priority)
                              ? `This is a ${getPriorityInfo(selectedChore.priority)!.label.toLowerCase()} chore.`
                              : '',
                            `It's worth ${selectedChore.coins ?? 0} coins.`,
                          ].filter(Boolean).join(' ')}
                          size={28}
                        />
                      </View>
                      <Text style={styles.descriptionText}>
                        {selectedChore.description || 'No description provided.'}
                      </Text>
                    </View>

                    {/* Comment the parent left when they reviewed this chore */}
                    {!!selectedChore.feedback && (
                      <View style={styles.feedbackBox}>
                        <View style={styles.descriptionHeader}>
                          <Text style={styles.descriptionLabel}>
                            {selectedChore.feedbackStatus === 'rejected'
                              ? 'PARENT FEEDBACK - PLEASE REDO'
                              : 'MESSAGE FROM YOUR PARENT'}
                          </Text>
                          <TextToSpeech
                            text={`Your parent says: ${selectedChore.feedback}`}
                            size={28}
                          />
                        </View>
                        <Text style={styles.descriptionText}>{selectedChore.feedback}</Text>
                      </View>
                    )}
                  </>
                )}

                {/* Photo Preview */}
                {photo && (
                  <Image source={{ uri: photo }} style={styles.photoPreview} />
                )}

                {/* AI Feedback */}
                {aiResult && (
                  <View style={[
                    styles.aiFeedback,
                    aiResult.isComplete ? styles.aiFeedbackSuccess : styles.aiFeedbackWarning
                  ]}>
                    <Text style={styles.aiFeedbackEmoji}>
                      {aiResult.isComplete ? '🤖✅' : '🤖❌'}
                    </Text>
                    <Text style={styles.aiFeedbackText}>{aiResult.description}</Text>
                    {/* Text-to-speech: only plays when the child taps the button */}
                    <TextToSpeech
                      text={
                        aiResult.isComplete
                          ? `Great job! ${aiResult.description}`
                          : `Not quite! ${aiResult.description} Please redo the chore and try again.`
                      }
                      size={24}
                    />
                  </View>
                )}

                {/* Buttons */}
                {submitting ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4ECDC4" />
                    <Text style={styles.loadingText}>Analyzing with AI... Please wait!</Text>
                  </View>
                ) : aiResult && aiResult.isComplete && submitted ? (
                  // AI approved and submitted — show done button
                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={() => {
                      setModalVisible(false);
                      setAiResult(null);
                      setPhoto(null);
                      setSubmitted(false);
                    }}>
                    <Text style={styles.doneBtnText}>Awesome! I'll wait for approval 🎉</Text>
                  </TouchableOpacity>
                ) : aiResult && !aiResult.isComplete ? (
                  // AI rejected — show retry button
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => {
                      setPhoto(null);
                      setAiResult(null);
                      setSubmitted(false);
                    }}>
                    <Text style={styles.retryBtnText}>Try Again 📸</Text>
                  </TouchableOpacity>
                ) : selectedChore?.completed ? (
                  // Chore already submitted/approved — nothing to upload, just close
                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={() => setModalVisible(false)}>
                    <Text style={styles.doneBtnText}>Close</Text>
                  </TouchableOpacity>
                ) : (
                  // No result yet — show camera/upload and submit
                  <>
                    <View style={styles.photoButtons}>
                      <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                        <Text style={styles.photoBtnEmoji}>📷</Text>
                        <Text style={styles.photoBtnText}>Take Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.photoBtn} onPress={uploadPhoto}>
                        <Text style={styles.photoBtnEmoji}>📤</Text>
                        <Text style={styles.photoBtnText}>Upload</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={[styles.submitBtn, !photo && styles.submitBtnDisabled]}
                      onPress={submitVerification}
                      disabled={!photo}>
                      <Text style={styles.submitBtnText}>Submit for AI Review ✅</Text>
                    </TouchableOpacity>
                  </>
                )}

                </ScrollView>
              </View>
            </TouchableWithoutFeedback>

            {/* Confetti burst when the chore was sent to the parent. Plays once, then
                disappears when the child closes the popup (submitted resets to false). */}
            {submitted && (
              <Celebration source={require('../assets/images/confetti.json')} />
            )}
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Softer sky-to-mint feel; the floating background shows through.
  container: { flex: 1, backgroundColor: '#EAF9F6' },
  scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 130 },

  // Hero
  hero: {
    backgroundColor: '#0F7F76',
    borderRadius: 32,
    padding: 20,
    gap: 16,
    marginBottom: 18,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
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
  heroGreeting: { fontSize: 26, fontWeight: '900', color: '#FFFFFF' },
  heroSub: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.88)', marginTop: 2 },
  logoutBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnEmoji: { fontSize: 18 },

  // Coin balance (replaces the old 3-tile stats row)
  coinPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF4D6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  coinPillEmoji: { fontSize: 22 },
  coinPillValue: { fontSize: 22, fontWeight: '900', color: '#B7791F' },
  coinPillLabel: { fontSize: 13, fontWeight: '700', color: '#B7791F' },

  heroProgressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  heroProgressLabel: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  heroProgressCount: { fontSize: 14, fontWeight: '800', color: '#FFD479' },
  progressBarBg: {
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressBarFill: { height: 16, backgroundColor: '#F4B942', borderRadius: 8 },

  // Chores
  sectionTitle: { fontSize: 22, fontWeight: '900', color: '#1F2D2B', marginBottom: 12 },
  choresList: { gap: 12 },
  noChores: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#DDF1EE',
  },
  noChoresEmoji: { fontSize: 56 },
  noChoresText: { fontSize: 18, fontWeight: '800', color: '#1F2D2B' },
  noChoresHint: { fontSize: 14, color: '#6B7C79', textAlign: 'center' },
  optionalHeader: { fontSize: 17, fontWeight: '800', color: '#7B61FF', marginTop: 12 },
  choreCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  choreCardDone: { backgroundColor: '#F1F5F4' },
  priorityStripe: { width: 8 },
  choreBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  statusCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#4ECDC4',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPending: { backgroundColor: '#FFF3CD', borderColor: '#F4B942' },
  statusDone: { backgroundColor: '#4ECDC4', borderColor: '#4ECDC4' },
  statusMark: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  statusPendingMark: { fontSize: 18 },
  choreTextBlock: { flex: 1 },
  choreTitle: { fontSize: 18, fontWeight: '800', color: '#1F2D2B' },
  choreTitleDone: { textDecorationLine: 'line-through', color: '#8A9996' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: '700' },

  // Parent feedback
  feedbackLine: { marginTop: 8, fontSize: 13, color: '#12756D', fontStyle: 'italic', lineHeight: 18 },
  feedbackBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#F4B942',
  },

  // Bottom nav
  bottomNav: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 26,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: 18 },
  navActive: { backgroundColor: '#E6F8F6' },
  navEmoji: { fontSize: 24 },
  navText: { fontSize: 12, color: '#7C8B88', fontWeight: '700' },
  navTextActive: { color: '#0F7F76' },

  // Automatic Discipline System deduction popup
  disciplineModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  disciplineModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 7,
  },
  disciplineCloseButton: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  disciplineCloseText: {
    fontSize: 18,
    color: '#999',
    fontWeight: '700',
  },
  disciplineModalEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  disciplineModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2D2D2D',
    marginBottom: 10,
  },
  disciplinePointsLost: {
    fontSize: 24,
    fontWeight: '800',
    color: '#E63946',
    marginBottom: 18,
  },
  disciplineReasonLabel: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '800',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  disciplineReasonText: {
    alignSelf: 'stretch',
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 12,
    color: '#444',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFD6D6',
  },
  speakRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  disciplineDoneButton: {
    alignSelf: 'stretch',
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  disciplineDoneButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxHeight: '90%',
  },
  closeBtn: { alignSelf: 'flex-end', marginBottom: 4 },
  closeText: { fontSize: 18, color: '#999' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#2D2D2D', marginBottom: 6 },
  modalSubtitle: { fontSize: 14, color: '#888', marginBottom: 16, lineHeight: 20 },
  photoPreview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#F0F0F0',
  },
  aiFeedback: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1.5,
  },
  aiFeedbackSuccess: { backgroundColor: '#F0FFF4', borderColor: '#4ECDC4' },
  aiFeedbackWarning: { backgroundColor: '#FFF8E1', borderColor: '#F4B942' },
  aiFeedbackEmoji: { fontSize: 22 },
  aiFeedbackText: { fontSize: 14, color: '#444', fontWeight: '500', lineHeight: 20 },
  optionalBadge: {
    backgroundColor: '#EFEAFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  optionalBadgeText: { fontSize: 13, fontWeight: '800', color: '#7B61FF' },
  detailBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  priorityBadge: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  priorityBadgeText: { fontSize: 13, fontWeight: '800' },
  coinBadge: {
    backgroundColor: '#FFF3CD',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  coinBadgeText: { fontSize: 13, fontWeight: '800', color: '#B7791F' },
  descriptionBox: {
    backgroundColor: '#F0FFFE',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
  },
  descriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  descriptionLabel: { fontSize: 11, fontWeight: '800', color: '#888', letterSpacing: 1 },
  descriptionText: { fontSize: 16, color: '#2D2D2D', lineHeight: 23, fontWeight: '500' },
  photoButtons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  photoBtn: {
    flex: 1,
    backgroundColor: '#F0FFFE',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
    gap: 6,
  },
  photoBtnEmoji: { fontSize: 26 },
  photoBtnText: { fontSize: 13, fontWeight: '600', color: '#4ECDC4' },
  loadingContainer: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  loadingText: { fontSize: 14, color: '#888', fontWeight: '600', textAlign: 'center' },
  submitBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: '#CCC', shadowOpacity: 0 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  doneBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  retryBtn: {
    backgroundColor: '#E63946',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  retryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});