import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { auth, db } from '../config/firebase';

const EMOJI_OPTIONS = [
  '🎮', '📱', '🍦', '🍕', '🎬', '📚', '🎨', '🧸',
  '🏆', '⭐', '🎯', '🎪', '🛹', '🎵', '🍫', '🎠',
  '🚗', '✈️', '🏖️', '🎡', '🎁', '💰', '🦄', '🌈',
];

// Highest number of coins a single reward can cost. Change this one number to adjust the limit.
const MAX_COINS = 1000;

export default function CreateRewardScreen() {
  const router = useRouter();

  // When opened from the rewards list with an id, this screen edits that reward instead of creating one
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const editId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isEdit = !!editId;

  const scrollRef = useRef<ScrollView>(null);
  const descriptionY = useRef(0);

  const [title, setTitle] = useState('');
  const [coins, setCoins] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🎁');
  const [assignTo, setAssignTo] = useState<'all' | 'specific'>('all');
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [emojiModalVisible, setEmojiModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [children, setChildren] = useState<any[]>([]);

  // Load real children from Firestore
  useEffect(() => {
    const loadChildren = async () => {
      const user = auth.currentUser;
      if (user) {
        const childrenQuery = query(
          collection(db, 'children'),
          where('parentId', '==', user.uid)
        );
        const childrenSnap = await getDocs(childrenQuery);
        const childrenData = childrenSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setChildren(childrenData);
      }
    };
    loadChildren();
  }, []);

  // Edit mode: load the existing reward into the form
  useEffect(() => {
    if (!editId) return;
    const loadReward = async () => {
      try {
        const snap = await getDoc(doc(db, 'rewards', editId));
        if (!snap.exists()) {
          Alert.alert('Error!', 'This reward could not be found.', [
            { text: 'OK', onPress: () => router.back() }
          ]);
          return;
        }
        const d: any = snap.data();
        setTitle(d.title ?? '');
        setCoins(d.coinCost !== undefined && d.coinCost !== null ? String(d.coinCost) : '');
        setDescription(d.description ?? '');
        setSelectedEmoji(d.emoji || '🎁');
        if (d.availableTo && d.availableTo !== 'all') {
          setAssignTo('specific');
          setSelectedChildren([d.availableTo]);
        } else {
          setAssignTo('all');
        }
      } catch (error: any) {
        Alert.alert('Error!', error.message);
      } finally {
        setInitialLoading(false);
      }
    };
    loadReward();
  }, [editId]);

  const toggleChild = (id: string) => {
    if (isEdit) {
      // An existing reward belongs to exactly one child (or all), so only allow one selection
      setSelectedChildren([id]);
      return;
    }
    setSelectedChildren(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  // Scroll the description box above the keyboard when it is focused
  const scrollToDescription = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, descriptionY.current - 100), animated: true });
    }, 300);
  };

  // Keep only digits and never allow more than MAX_COINS
  const handleCoinsChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    if (!digits) { setCoins(''); return; }
    setCoins(String(Math.min(parseInt(digits, 10), MAX_COINS)));
  };

  const changeCoins = (delta: number) => {
    setCoins(prev => {
      const current = parseInt(prev || '0', 10) || 0;
      return String(Math.min(MAX_COINS, Math.max(0, current + delta)));
    });
  };

  const handleSave = async () => {
    const coinsNum = parseInt(coins, 10);
    if (!title.trim()) { Alert.alert('Missing!', 'Please enter a reward title!'); return; }
    if (!coinsNum || coinsNum < 1) { Alert.alert('Missing!', 'Please enter coin cost!'); return; }
    if (coinsNum > MAX_COINS) { Alert.alert('Too many coins!', `A reward can cost at most ${MAX_COINS} coins.`); return; }
    if (assignTo === 'specific' && selectedChildren.length === 0) {
      Alert.alert('Missing!', 'Please select at least one child!'); return;
    }

    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error!', 'You must be logged in!');
        return;
      }

      const rewardData = {
        title: title.trim(),
        emoji: selectedEmoji,
        coinCost: coinsNum,
        description,
      };

      if (isEdit && editId) {
        // Update the existing reward (keeps its owner and created date)
        await updateDoc(doc(db, 'rewards', editId), {
          ...rewardData,
          availableTo: assignTo === 'all' ? 'all' : selectedChildren[0],
          updatedAt: new Date(),
        });

        Alert.alert('Reward Updated! ✅', `"${title.trim()}" has been saved.`, [
          { text: 'OK', onPress: () => router.back() }
        ]);
        return;
      }

      if (assignTo === 'specific') {
        // Create a reward for each selected child
        for (const childId of selectedChildren) {
          await addDoc(collection(db, 'rewards'), {
            ...rewardData,
            availableTo: childId,
            redeemed: false,
            parentId: user.uid,
            createdAt: new Date(),
          });
        }
      } else {
        // Create one reward available to all children
        await addDoc(collection(db, 'rewards'), {
          ...rewardData,
          availableTo: 'all',
          redeemed: false,
          parentId: user.uid,
          createdAt: new Date(),
        });
      }

      Alert.alert('Reward Created! 🎉', `"${title.trim()}" has been added to the rewards catalog!`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Error!', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!editId) return;
    Alert.alert('Delete Reward?', `Are you sure you want to delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await deleteDoc(doc(db, 'rewards', editId));
            router.back();
          } catch (error: any) {
            Alert.alert('Error!', error.message);
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  if (isEdit && initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#4ECDC4" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { paddingBottom: 120 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}>

          {/* Back */}
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          {/* Title */}
          <Text style={styles.pageTitle}>{isEdit ? 'Edit Reward ✏️' : 'Create Reward ⭐'}</Text>

          {/* Emoji Picker */}
          <Text style={styles.label}>Reward Icon</Text>
          <TouchableOpacity
            style={styles.emojiPickerBtn}
            onPress={() => setEmojiModalVisible(true)}>
            <Text style={styles.selectedEmoji}>{selectedEmoji}</Text>
            <Text style={styles.emojiPickerText}>Tap to change</Text>
            <Text style={styles.emojiArrow}>›</Text>
          </TouchableOpacity>

          {/* Reward Title */}
          <Text style={styles.label}>Reward Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 1 Hour Screen Time"
            placeholderTextColor="#aaa"
            value={title}
            onChangeText={setTitle}
            autoCapitalize="words"
          />

          {/* Coin Cost */}
          <Text style={styles.label}>Coin Cost 🪙</Text>
          <View style={styles.coinsContainer}>
            <TouchableOpacity
              style={styles.coinBtn}
              onPress={() => changeCoins(-1)}>
              <Text style={styles.coinBtnText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.coinsInput}
              placeholder="0"
              placeholderTextColor="#aaa"
              value={coins}
              onChangeText={handleCoinsChange}
              keyboardType="number-pad"
              maxLength={String(MAX_COINS).length}
              textAlign="center"
            />
            <TouchableOpacity
              style={styles.coinBtn}
              onPress={() => changeCoins(1)}>
              <Text style={styles.coinBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 12, color: '#aaa', marginTop: -12, marginBottom: 16, fontStyle: 'italic' }}>
            Maximum {MAX_COINS} coins per reward
          </Text>

          {/* Description */}
          <View onLayout={(e) => { descriptionY.current = e.nativeEvent.layout.y; }}>
            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe the reward..."
              placeholderTextColor="#aaa"
              value={description}
              onChangeText={setDescription}
              onFocus={scrollToDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Available To */}
          <Text style={styles.label}>Available To</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, assignTo === 'all' && styles.toggleActive]}
              onPress={() => setAssignTo('all')}>
              <Text style={[styles.toggleText, assignTo === 'all' && styles.toggleTextActive]}>
                All Children
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, assignTo === 'specific' && styles.toggleActive]}
              onPress={() => setAssignTo('specific')}>
              <Text style={[styles.toggleText, assignTo === 'specific' && styles.toggleTextActive]}>
                Specific Child
              </Text>
            </TouchableOpacity>
          </View>

          {/* Child Selector — real children */}
          {assignTo === 'specific' && (
            <View style={styles.childSelector}>
              {children.length === 0 ? (
                <Text style={styles.noChildrenText}>No children added yet!</Text>
              ) : (
                children.map(child => (
                  <TouchableOpacity
                    key={child.id}
                    style={[styles.childChip, selectedChildren.includes(child.id) && styles.childChipSelected]}
                    onPress={() => toggleChild(child.id)}>
                    <Text style={styles.childChipEmoji}>{child.avatar}</Text>
                    <Text style={[styles.childChipText, selectedChildren.includes(child.id) && styles.childChipTextSelected]}>
                      {child.name}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* Preview Card */}
          <Text style={styles.label}>Preview</Text>
          <View style={styles.previewCard}>
            <View style={styles.previewLeft}>
              <View style={styles.previewEmojiBox}>
                <Text style={styles.previewEmoji}>{selectedEmoji}</Text>
              </View>
              <View>
                <Text style={styles.previewTitle}>{title || 'Reward Title'}</Text>
                <View style={styles.previewCoins}>
                  <Text style={styles.previewCoinsText}>🪙 {coins || '0'} coins</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.previewBtn}>
              <Text style={styles.previewBtnText}>BUY REWARD</Text>
            </TouchableOpacity>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.createBtn, loading && styles.createBtnDisabled]}
            onPress={handleSave}
            disabled={loading}>
            <Text style={styles.createBtnText}>
              {loading
                ? (isEdit ? 'Saving...' : 'Creating...')
                : (isEdit ? 'Save Changes ✅' : 'Create Reward 🎉')}
            </Text>
          </TouchableOpacity>

          {/* Delete Button (only when editing an existing reward) */}
          {isEdit && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={loading}>
              <Text style={styles.deleteBtnText}>Delete Reward</Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Emoji Picker Modal */}
      <Modal
        visible={emojiModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEmojiModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setEmojiModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Choose an Emoji</Text>
                  <TouchableOpacity onPress={() => setEmojiModalVisible(false)}>
                    <Text style={styles.closeText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.emojiGrid}>
                  {EMOJI_OPTIONS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={[styles.emojiOption, selectedEmoji === emoji && styles.emojiSelected]}
                      onPress={() => {
                        setSelectedEmoji(emoji);
                        setEmojiModalVisible(false);
                      }}>
                      <Text style={styles.emojiOptionText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
  inner: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  back: { marginBottom: 16 },
  backText: { fontSize: 16, color: '#4ECDC4', fontWeight: '600' },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#2D2D2D', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '700', color: '#444', marginBottom: 8 },
  emojiPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#F9F9F9',
    marginBottom: 20,
    gap: 12,
  },
  selectedEmoji: { fontSize: 32 },
  emojiPickerText: { flex: 1, fontSize: 15, color: '#888', fontWeight: '600' },
  emojiArrow: { fontSize: 22, color: '#CCC' },
  input: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#F9F9F9',
    marginBottom: 20,
  },
  textArea: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#F9F9F9',
    marginBottom: 20,
    minHeight: 90,
  },
  coinsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  coinBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinBtnText: { fontSize: 22, color: '#fff', fontWeight: '700' },
  coinsInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 13,
    fontSize: 20,
    fontWeight: '800',
    color: '#2D2D2D',
    backgroundColor: '#F9F9F9',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  toggleActive: { backgroundColor: '#4ECDC4' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#888' },
  toggleTextActive: { color: '#fff' },
  childSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    marginTop: -8,
    flexWrap: 'wrap',
  },
  noChildrenText: { fontSize: 14, color: '#888', fontStyle: 'italic' },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  childChipSelected: { backgroundColor: '#F0FFFE', borderColor: '#4ECDC4' },
  childChipEmoji: { fontSize: 18 },
  childChipText: { fontSize: 14, fontWeight: '600', color: '#888' },
  childChipTextSelected: { color: '#4ECDC4' },
  previewCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#EEE',
    gap: 12,
  },
  previewLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewEmojiBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#FFF8E1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F4B942',
  },
  previewEmoji: { fontSize: 28 },
  previewTitle: { fontSize: 15, fontWeight: '700', color: '#2D2D2D', marginBottom: 4 },
  previewCoins: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  previewCoinsText: { fontSize: 12, fontWeight: '700', color: '#F4B942' },
  previewBtn: {
    backgroundColor: '#F4B942',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  previewBtnText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  createBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  createBtnDisabled: { backgroundColor: '#A8E6E2', shadowOpacity: 0 },
  createBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  deleteBtn: {
    borderWidth: 1.5,
    borderColor: '#E63946',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  deleteBtnText: { color: '#E63946', fontSize: 17, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#2D2D2D' },
  closeText: { fontSize: 18, color: '#999' },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  emojiOption: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiSelected: { borderColor: '#4ECDC4', backgroundColor: '#F0FFFE' },
  emojiOptionText: { fontSize: 28 },
});