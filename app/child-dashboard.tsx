import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  SafeAreaView, ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

const MOCK_CHORES = [
  { id: '1', title: 'Make your bed', coins: 5, completed: false, verified: false },
  { id: '2', title: 'Wash the dishes', coins: 8, completed: true, verified: true },
  { id: '3', title: 'Take out trash', coins: 10, completed: false, verified: false },
  { id: '4', title: 'Clean your room', coins: 12, completed: false, verified: false },
];

export default function ChildDashboard() {
  const router = useRouter(); 
  const [chores, setChores] = useState(MOCK_CHORES);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedChore, setSelectedChore] = useState<any>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  const completedCount = chores.filter(c => c.completed).length;
  const progress = completedCount / chores.length;
  const totalCoins = chores.filter(c => c.completed).reduce((sum, c) => sum + c.coins, 0);

  const openVerification = (chore: any) => {
    setSelectedChore(chore);
    setPhoto(null);
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
    }
  };

  const submitVerification = () => {
    if (!photo) {
      Alert.alert('No photo!', 'Please take or upload a photo first!');
      return;
    }
    setChores(prev => prev.map(c =>
      c.id === selectedChore.id ? { ...c, completed: true, verified: false } : c
    ));
    setModalVisible(false);
    Alert.alert('Submitted! 🎉', 'Your chore has been submitted for parent approval!');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.profileSection}>
            <View style={styles.profileCircle}>
              <Text style={styles.profileEmoji}>🐶</Text>
            </View>
            <View>
              <Text style={styles.childName}>Sarah ⭐</Text>
              <Text style={styles.childLabel}>CHILD'S LOGIN</Text>
            </View>
          </View>
          <View style={styles.coinsBadge}>
            <Text style={styles.coinsEmoji}>🪙</Text>
            <View>
              <Text style={styles.coinsAmount}>${totalCoins}</Text>
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
            <View style={[styles.progressThumb, { left: `${progress * 100 - 3}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {Math.round(progress * 100)}% Complete! {progress === 1 ? '🎉' : '💪'}
          </Text>
        </View>

        {/* To Do */}
        <Text style={styles.toDoTitle}>TO DO:</Text>
        <View style={styles.choresList}>
          {chores.map((chore) => (
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
          ))}
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
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>

                {/* Close */}
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setModalVisible(false)}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>

                <Text style={styles.modalTitle}>Good Job! 🎉</Text>
                <Text style={styles.modalSubtitle}>
                  Upload a photo of "{selectedChore?.title}" to verify!
                </Text>

                {/* Photo Preview */}
                {photo && (
                  <Image source={{ uri: photo }} style={styles.photoPreview} />
                )}

                {/* Camera & Upload Buttons */}
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

                {/* Submit */}
                <TouchableOpacity
                  style={[styles.submitBtn, !photo && styles.submitBtnDisabled]}
                  onPress={submitVerification}>
                  <Text style={styles.submitBtnText}>Submit for Approval ✅</Text>
                </TouchableOpacity>

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

  // Header
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

  // Activities Title
  activitiesTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2D2D2D',
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: 1,
  },

  // Progress
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

  // To Do
  toDoTitle: { fontSize: 16, fontWeight: '800', color: '#2D2D2D', marginBottom: 12, letterSpacing: 1 },
  choresList: { gap: 12 },
  choreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
  },
  choreCompleted: { backgroundColor: '#00020121', borderColor: '#cd4e4e00' },
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

  // Bottom Nav
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

  // Modal
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
