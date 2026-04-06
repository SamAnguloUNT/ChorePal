import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    Keyboard,
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

const MOCK_CHILDREN = [
  { id: '1', name: 'Sarah', avatar: '👧' },
  { id: '2', name: 'Jacob', avatar: '🧒' },
];

const EMOJI_OPTIONS = [
  '🎮', '📱', '🍦', '🍕', '🎬', '📚', '🎨', '🧸',
  '🏆', '⭐', '🎯', '🎪', '🛹', '🎵', '🍫', '🎠',
  '🚗', '✈️', '🏖️', '🎡', '🎁', '💰', '🦄', '🌈',
];

export default function CreateRewardScreen() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [coins, setCoins] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🎁');
  const [assignTo, setAssignTo] = useState<'all' | 'specific'>('all');
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [emojiModalVisible, setEmojiModalVisible] = useState(false);

  const toggleChild = (id: string) => {
    setSelectedChildren(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleCreate = () => {
    if (!title) { Alert.alert('Missing!', 'Please enter a reward title!'); return; }
    if (!coins) { Alert.alert('Missing!', 'Please enter coin cost!'); return; }
    if (assignTo === 'specific' && selectedChildren.length === 0) {
      Alert.alert('Missing!', 'Please select at least one child!'); return;
    }
    Alert.alert('Reward Created! 🎉', `"${title}" has been added to the rewards catalog!`, [
      { text: 'OK', onPress: () => router.back() }
    ]);
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
            <Text style={styles.pageTitle}>Create Reward ⭐</Text>

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
                onPress={() => setCoins(prev => String(Math.max(0, parseInt(prev || '0') - 1)))}>
                <Text style={styles.coinBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.coinsInput}
                placeholder="0"
                placeholderTextColor="#aaa"
                value={coins}
                onChangeText={setCoins}
                keyboardType="number-pad"
                textAlign="center"
              />
              <TouchableOpacity
                style={styles.coinBtn}
                onPress={() => setCoins(prev => String(parseInt(prev || '0') + 1))}>
                <Text style={styles.coinBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Description */}
            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe the reward..."
              placeholderTextColor="#aaa"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

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

            {/* Child Selector */}
            {assignTo === 'specific' && (
              <View style={styles.childSelector}>
                {MOCK_CHILDREN.map(child => (
                  <TouchableOpacity
                    key={child.id}
                    style={[styles.childChip, selectedChildren.includes(child.id) && styles.childChipSelected]}
                    onPress={() => toggleChild(child.id)}>
                    <Text style={styles.childChipEmoji}>{child.avatar}</Text>
                    <Text style={[styles.childChipText, selectedChildren.includes(child.id) && styles.childChipTextSelected]}>
                      {child.name}
                    </Text>
                  </TouchableOpacity>
                ))}
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

            {/* Create Button */}
            <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
              <Text style={styles.createBtnText}>Create Reward 🎉</Text>
            </TouchableOpacity>

            {/* Delete Button */}
            <TouchableOpacity style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>Delete Reward</Text>
            </TouchableOpacity>

          </ScrollView>
        </TouchableWithoutFeedback>
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

  // Back
  back: { marginBottom: 16 },
  backText: { fontSize: 16, color: '#4ECDC4', fontWeight: '600' },

  // Page Title
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#2D2D2D', marginBottom: 24 },

  // Label
  label: { fontSize: 14, fontWeight: '700', color: '#444', marginBottom: 8 },

  // Emoji Picker Button
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

  // Input
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

  // Coins
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

  // Toggle
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

  // Child Selector
  childSelector: { flexDirection: 'row', gap: 10, marginBottom: 16, marginTop: -8 },
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

  // Preview Card
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

  // Create Button
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
  createBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // Delete Button
  deleteBtn: {
    borderWidth: 1.5,
    borderColor: '#E63946',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  deleteBtnText: { color: '#E63946', fontSize: 17, fontWeight: '700' },

  // Modal
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
