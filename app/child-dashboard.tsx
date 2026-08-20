import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView, ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { db } from '../config/firebase';
import { requestNotificationPermissions, sendPushNotification } from '../utils/notifications';
import { uploadPhotoToStorage, uriToBase64 } from '../utils/uploadPhoto';
import { analyzeImage } from '../utils/visionApi';

export default function ChildDashboard() {
  const router = useRouter();
  const [childData, setChildData] = useState<any>(null);
  const [chores, setChores] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedChore, setSelectedChore] = useState<any>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      const session = await AsyncStorage.getItem('childSession');
      if (session) {
        const child = JSON.parse(session);
        setChildData(child);

        // Request notification permissions
        requestNotificationPermissions();

        // Load chores from Firestore
        const choresQuery = query(
          collection(db, 'chores'),
          where('assignedTo', 'in', ['all', child.id])
        );
        const choresSnap = await getDocs(choresQuery);
        let choresData = choresSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          completed: false,
          verified: false,
        }));

        // Load approved submissions
        const approvedQuery = query(
          collection(db, 'submissions'),
          where('childId', '==', child.id),
          where('status', '==', 'approved')
        );
        const approvedSnap = await getDocs(approvedQuery);
        const approvedChoreIds = approvedSnap.docs.map(d => d.data().choreId);

        // Load pending submissions
        const pendingQuery = query(
          collection(db, 'submissions'),
          where('childId', '==', child.id),
          where('status', '==', 'pending')
        );
        const pendingSnap = await getDocs(pendingQuery);
        const pendingChoreIds = pendingSnap.docs.map(d => d.data().choreId);

        // Update chore status
        choresData = choresData.map(chore => ({
          ...chore,
          completed: approvedChoreIds.includes(chore.id) || pendingChoreIds.includes(chore.id),
          verified: approvedChoreIds.includes(chore.id),
        }));

        setChores(choresData);
      }
    };
    loadData();
  }, []);

  const completedCount = chores.filter(c => c.completed).length;
  const progress = chores.length > 0 ? completedCount / chores.length : 0;

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
      setAiResult(aiAnalysis);

      // Step 3 — If AI rejects block submission
      if (!aiAnalysis.isComplete) {
        setSubmitting(false);
        Alert.alert(
          'AI Rejected ❌',
          `${aiAnalysis.description}\n\nPlease redo the chore and take a new photo!`,
          [{ text: 'Try Again', onPress: () => setPhoto(null) }]
        );
        return;
      }

      // Step 4 — Save submission to Firestore
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

      // Step 5 — Notify parent
      try {
        const { getDoc, doc: firestoreDoc } = await import('firebase/firestore');
        const parentDoc = await getDoc(firestoreDoc(db, 'users', childData.parentId));
        await sendPushNotification(
          parentDoc.exists() ? parentDoc.data().pushToken || null : null,
          '📸 Chore Submitted!',
          `${childData.name} submitted "${selectedChore.title}" for approval!`,
          { type: 'chore_submitted', choreId: selectedChore.id }
        );
      } catch (notifError) {
        console.log('Notification error:', notifError);
      }

      // Step 6 — Update local chore state
      setChores(prev => prev.map(c =>
        c.id === selectedChore.id ? { ...c, completed: true, verified: false } : c
      ));

      // Step 7 — Save progress to AsyncStorage
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

      setModalVisible(false);
      Alert.alert(
        'AI Approved & Submitted! 🎉',
        `Great job! Your chore has been verified by AI and sent to your parent for final approval. You could earn ${selectedChore.coins} coins!`,
        [{ text: 'Awesome!' }]
      );

    } catch (error: any) {
      Alert.alert('Error!', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.profileSection}>
            <TouchableOpacity style={styles.profileCircle} onPress={handleLogout}>
              <Text style={styles.profileEmoji}>{childData?.avatar || '👧'}</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.childName}>{childData?.name || 'Loading...'} ⭐</Text>
              <Text style={styles.childLabel}>CHILD'S LOGIN</Text>
            </View>
          </View>
          <View style={styles.coinsBadge}>
            <Text style={styles.coinsEmoji}>🪙</Text>
            <View>
              <Text style={styles.coinsAmount}>{childData?.coinBalance || 0}</Text>
              <Text style={styles.coinsLabel}>TOTAL COINS</Text>
            </View>
          </View>
        </View>

        {/* My Activities */}
        <Text style={styles.activitiesTitle}>MY ACTIVITIES 🎯</Text>

        {/* Progress Card */}
        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>DAILY PROGRESS</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
            <View style={[styles.progressThumb, { left: `${Math.max(0, progress * 100 - 3)}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {Math.round(progress * 100)}% Complete! {progress === 1 ? '🎉' : '💪'}
          </Text>
        </View>

        {/* To Do */}
        <Text style={styles.toDoTitle}>TO DO:</Text>
        <View style={styles.choresList}>
          {chores.length === 0 ? (
            <View style={styles.noChores}>
              <Text style={styles.noChoresEmoji}>🎉</Text>
              <Text style={styles.noChoresText}>No chores assigned yet!</Text>
            </View>
          ) : (
            chores.map((chore) => (
              <View
                key={chore.id}
                style={[
                  styles.choreCard,
                  chore.completed ? styles.choreCompleted : styles.choreIncomplete
                ]}>
                <View style={styles.choreLeft}>
                  <View style={[
                    styles.choreStatusIcon,
                    chore.completed ? styles.statusComplete : styles.statusIncomplete
                  ]}>
                    <Text style={styles.statusEmoji}>{chore.completed ? '✅' : '❌'}</Text>
                  </View>
                  <View>
                    <Text style={[
                      styles.choreTitle,
                      chore.completed && styles.choreTitleDone
                    ]}>{chore.title}</Text>
                    <Text style={styles.choreCoins}>
                      Due today | {chore.coins} 🪙
                    </Text>
                  </View>
                </View>
                {!chore.completed && (
                  <TouchableOpacity
                    style={styles.uploadBtn}
                    onPress={() => openVerification(chore)}>
                    <Text style={styles.uploadBtnText}>📸</Text>
                  </TouchableOpacity>
                )}
                {chore.completed && !chore.verified && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingText}>⏳</Text>
                  </View>
                )}
                {chore.completed && chore.verified && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedText}>✓</Text>
                  </View>
                )}
              </View>
            ))
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
          onPress={() => router.replace('/child-rewards')}>
          <Text style={styles.navEmoji}>⭐</Text>
          <Text style={styles.navText}>Rewards</Text>
        </TouchableOpacity>
      </View>

      {/* Verification Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => !submitting && setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => !submitting && setModalVisible(false)}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Good Job! 🎉</Text>
                <Text style={styles.modalSubtitle}>
                  Upload a photo of "{selectedChore?.title}" to verify!
                </Text>
                {photo && (
                  <Image source={{ uri: photo }} style={styles.photoPreview} />
                )}
                {aiResult && (
                  <View style={[
                    styles.aiResult,
                    aiResult.isComplete ? styles.aiResultSuccess : styles.aiResultWarning
                  ]}>
                    <Text style={styles.aiResultEmoji}>
                      {aiResult.isComplete ? '🤖✅' : '🤖⚠️'}
                    </Text>
                    <Text style={styles.aiResultText}>{aiResult.description}</Text>
                  </View>
                )}
                {!submitting && (
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
                )}
                {submitting ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4ECDC4" />
                    <Text style={styles.loadingText}>Uploading & analyzing with AI...</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.submitBtn, !photo && styles.submitBtnDisabled]}
                    onPress={submitVerification}
                    disabled={!photo}>
                    <Text style={styles.submitBtnText}>Submit for Approval ✅</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#F0FFFE',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
  },
  profileSection: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileEmoji: { fontSize: 28 },
  childName: { fontSize: 18, fontWeight: '800', color: '#2D2D2D' },
  childLabel: { fontSize: 10, color: '#888', fontWeight: '600' },
  coinsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4B942',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  coinsEmoji: { fontSize: 20 },
  coinsAmount: { fontSize: 18, fontWeight: '800', color: '#fff' },
  coinsLabel: { fontSize: 9, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  activitiesTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2D2D2D',
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: 1,
  },
  progressCard: {
    backgroundColor: '#F0FFFE',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4ECDC4',
  },
  progressLabel: { fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 10, textAlign: 'center', letterSpacing: 1 },
  progressBarBg: {
    height: 12,
    backgroundColor: '#DDD',
    borderRadius: 6,
    marginBottom: 8,
    position: 'relative',
    justifyContent: 'center',
  },
  progressBarFill: {
    height: 12,
    backgroundColor: '#F4B942',
    borderRadius: 6,
    position: 'absolute',
  },
  progressThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F4B942',
    position: 'absolute',
    top: -4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  progressText: { fontSize: 14, fontWeight: '700', color: '#4ECDC4', textAlign: 'center' },
  toDoTitle: { fontSize: 16, fontWeight: '800', color: '#2D2D2D', marginBottom: 12, letterSpacing: 1 },
  choresList: { gap: 12 },
  noChores: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  noChoresEmoji: { fontSize: 48 },
  noChoresText: { fontSize: 16, color: '#888', fontWeight: '600' },
  choreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
  },
  choreCompleted: { backgroundColor: '#F0FFF4', borderColor: '#4ECDC4' },
  choreIncomplete: { backgroundColor: '#FFF5F5', borderColor: '#FFB3B3' },
  choreLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  choreStatusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusComplete: { backgroundColor: '#E0FFF4' },
  statusIncomplete: { backgroundColor: '#FFE5E5' },
  statusEmoji: { fontSize: 16 },
  choreTitle: { fontSize: 14, fontWeight: '700', color: '#2D2D2D' },
  choreTitleDone: { textDecorationLine: 'line-through', color: '#888' },
  choreCoins: { fontSize: 12, color: '#888', marginTop: 2 },
  uploadBtn: {
    backgroundColor: '#4ECDC4',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnText: { fontSize: 16 },
  pendingBadge: {
    backgroundColor: '#FFF3CD',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingText: { fontSize: 16 },
  verifiedBadge: {
    backgroundColor: '#E0FFF4',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedText: { fontSize: 16, color: '#4ECDC4', fontWeight: '700' },
  bottomNav: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingVertical: 10,
    paddingBottom: 24,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 2 },
  navActive: {},
  navEmoji: { fontSize: 22 },
  navText: { fontSize: 11, color: '#888', fontWeight: '600' },
  navTextActive: { color: '#4ECDC4' },
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
  },
  closeBtn: { alignSelf: 'flex-end', marginBottom: 4 },
  closeText: { fontSize: 18, color: '#999' },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#2D2D2D', marginBottom: 6 },
  modalSubtitle: { fontSize: 14, color: '#888', marginBottom: 16, lineHeight: 20 },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#F0F0F0',
  },
  aiResult: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiResultSuccess: { backgroundColor: '#F0FFF4', borderWidth: 1, borderColor: '#4ECDC4' },
  aiResultWarning: { backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#F4B942' },
  aiResultEmoji: { fontSize: 24 },
  aiResultText: { flex: 1, fontSize: 13, color: '#444', fontWeight: '600' },
  photoButtons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  photoBtn: {
    flex: 1,
    backgroundColor: '#F0FFFE',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
    gap: 6,
  },
  photoBtnEmoji: { fontSize: 28 },
  photoBtnText: { fontSize: 13, fontWeight: '600', color: '#4ECDC4' },
  loadingContainer: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  loadingText: { fontSize: 14, color: '#888', fontWeight: '600' },
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
});