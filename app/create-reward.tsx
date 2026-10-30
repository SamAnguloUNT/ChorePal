import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import PressableScale from '../components/PressableScale';
import { auth, db } from '../config/firebase';

// Icon choices grouped so parents can find one quickly.
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Screens & Media', emojis: ['🎮', '📱', '📺', '🎬', '🎵', '🎧', '🎲', '🧩'] },
  { label: 'Treats', emojis: ['🍦', '🍕', '🍫', '🍩', '🍪', '🧁', '🍔', '🥤'] },
  { label: 'Outings', emojis: ['🎡', '🎠', '🎪', '🏖️', '🏊', '⚽', '🛹', '🚗'] },
  { label: 'Other', emojis: ['🧸', '🎨', '📚', '🎁', '💰', '🏆', '⭐', '🦄', '🌈', '✈️', '🌙', '👑'] },
];
const QUICK_EMOJIS = ['🎁', '🎮', '🍦', '🍕', '🎬', '🧸', '🏆', '💰'];

// One-tap starting points. Parents can edit everything after picking one.
const TEMPLATES = [
  { emoji: '📱', title: '30 Min Extra Screen Time', coins: 20, description: 'Can be used any day after homework is done.' },
  { emoji: '🍦', title: 'Ice Cream Trip', coins: 40, description: 'A trip out for your favorite ice cream.' },
  { emoji: '🍕', title: 'Pick Dinner Tonight', coins: 30, description: 'Choose what the family has for dinner.' },
  { emoji: '🌙', title: 'Stay Up 30 Min Late', coins: 35, description: 'Valid on Friday or Saturday nights.' },
  { emoji: '🎬', title: 'Family Movie Night Pick', coins: 50, description: 'Choose the movie and the snacks.' },
  { emoji: '🧸', title: 'New Toy', coins: 200, description: 'A toy of your choice, within an agreed price limit.' },
  { emoji: '🎡', title: 'Day Trip of Your Choice', coins: 400, description: 'Park, zoo, museum or arcade.' },
];

const COIN_PRESETS = [10, 25, 50, 100, 250];
const MAX_TITLE = 40;

// Highest number of coins a single reward can cost. Change this one number to adjust the limit.
const MAX_COINS = 1000;

// Palette (matches the Create Chore screen)
const TEAL = '#11847D';
const TEAL_DARK = '#126F67';
const TEAL_SOFT = '#E6F8F5';
const BG = '#F1FAF8';
const SURFACE = '#FFFFFF';
const BORDER = '#DCEBE8';
const CARD_BORDER = '#E3F0ED';
const INPUT_BG = '#F7FBFA';
const TOGGLE_BG = '#EFF7F5';
const HEADING = '#203532';
const INK = '#263A36';
const MUTED = '#718683';
const SUBTLE = '#9AABA8';
const COIN = '#A86E10';
const COIN_SOFT = '#FFF8E1';
const DANGER = '#D73E4B';

// Gentle fade-in, staggered by index. Skipped when Reduce Motion is on.
function AnimatedEntry({ index, skip, children }: { index: number; skip: boolean; children: React.ReactNode }) {
  const [anim] = useState(() => new Animated.Value(skip ? 1 : 0));
  useEffect(() => {
    if (skip) {
      anim.setValue(1);
      return;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      delay: Math.min(index, 8) * 40,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index, skip]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}>
      {children}
    </Animated.View>
  );
}

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
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  // Load children from Firestore
  useEffect(() => {
    const loadFamily = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const childrenSnap = await getDocs(query(collection(db, 'children'), where('parentId', '==', user.uid)));
        setChildren(childrenSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error: any) {
        Alert.alert('Something went wrong', error.message);
      }
    };
    loadFamily();
  }, []);

  // Edit mode: load the existing reward into the form
  useEffect(() => {
    if (!editId) return;
    const loadReward = async () => {
      try {
        const snap = await getDoc(doc(db, 'rewards', editId));
        if (!snap.exists()) {
          Alert.alert('Reward not found', 'This reward may have been deleted.', [
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
        Alert.alert('Something went wrong', error.message);
      } finally {
        setInitialLoading(false);
      }
    };
    loadReward();
  }, [editId]);

  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setTitle(t.title);
    setCoins(String(Math.min(t.coins, MAX_COINS)));
    setDescription(t.description);
    setSelectedEmoji(t.emoji);
  };

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

  const finish = (heading: string, message: string) => {
    Alert.alert(heading, message, [{ text: 'Done', onPress: () => router.back() }]);
  };

  const handleSave = async () => {
    const coinsNum = parseInt(coins, 10);
    if (!title.trim()) { Alert.alert('Title required', 'Please enter a title for this reward.'); return; }
    if (!coinsNum || coinsNum < 1) { Alert.alert('Cost required', 'Please enter a coin cost of at least 1.'); return; }
    if (coinsNum > MAX_COINS) { Alert.alert('Cost too high', `A reward can cost at most ${MAX_COINS} coins.`); return; }
    if (assignTo === 'specific' && selectedChildren.length === 0) {
      Alert.alert('No children selected', 'Please select at least one child.'); return;
    }

    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Signed out', 'Please sign in to save this reward.');
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
        finish('Changes saved', `"${title.trim()}" has been updated.`);
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

      finish('Reward created', `"${title.trim()}" has been added to your rewards.`);
    } catch (error: any) {
      Alert.alert('Something went wrong', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!editId) return;
    Alert.alert('Delete reward?', `"${title}" will be permanently removed.`, [
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
            Alert.alert('Something went wrong', error.message);
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
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }

  const coinsNum = parseInt(coins || '0', 10) || 0;
  const assignedNames =
    assignTo === 'all'
      ? 'All children'
      : children.filter(c => selectedChildren.includes(c.id)).map(c => c.name).join(', ') || 'No one selected';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.topBar}>
            <PressableScale style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
              <Text style={styles.backText}>‹ Back</Text>
            </PressableScale>
          </View>
          <Text style={styles.pageTitle}>{isEdit ? 'Edit Reward' : 'New Reward'}</Text>
          <Text style={styles.pageSubtitle}>
            {isEdit ? 'Update the details below and save your changes.' : 'Set up a reward your children can redeem with coins.'}
          </Text>

          {/* Preview */}
          <AnimatedEntry index={0} skip={reduceMotion}>
            <Text style={styles.sectionCaption}>PREVIEW</Text>
            <View style={styles.preview}>
              <View style={styles.previewTop}>
                <View style={styles.previewIcon}>
                  <Text style={styles.previewEmoji}>{selectedEmoji}</Text>
                </View>
                <View style={styles.previewInfo}>
                  <Text style={styles.previewTitle} numberOfLines={2}>{title.trim() || 'Reward title'}</Text>
                  <Text style={styles.previewFor} numberOfLines={1}>Available to: {assignedNames}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.previewBottom}>
                <View style={styles.coinBadge}>
                  <Text style={styles.coinBadgeText}>🪙 {coinsNum} coins</Text>
                </View>
                <View style={styles.redeemBtn}>
                  <Text style={styles.redeemBtnText}>Redeem</Text>
                </View>
              </View>
            </View>
          </AnimatedEntry>

          {/* Suggestions (new rewards only) */}
          {!isEdit && (
            <AnimatedEntry index={1} skip={reduceMotion}>
              <Text style={styles.sectionLabel}>Suggestions</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.templateRow}
                style={styles.templateScroll}>
                {TEMPLATES.map(t => {
                  const active = title === t.title;
                  return (
                    <PressableScale
                      key={t.title}
                      style={[styles.templateChip, active && styles.templateChipActive]}
                      onPress={() => applyTemplate(t)}
                      pressedScale={0.97}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Use suggestion: ${t.title}, ${t.coins} coins`}>
                      <Text style={styles.templateEmoji}>{t.emoji}</Text>
                      <Text style={styles.templateTitle} numberOfLines={2}>{t.title}</Text>
                      <Text style={styles.templateCoins}>{t.coins} coins</Text>
                    </PressableScale>
                  );
                })}
              </ScrollView>
            </AnimatedEntry>
          )}

          {/* Icon */}
          <AnimatedEntry index={2} skip={reduceMotion}>
            <View style={styles.card}>
              <SectionHeader title="Icon" />
              <View style={styles.emojiRow}>
                {QUICK_EMOJIS.map(e => (
                  <PressableScale
                    key={e}
                    style={[styles.emojiQuick, selectedEmoji === e && styles.emojiQuickActive]}
                    onPress={() => setSelectedEmoji(e)}
                    pressedScale={0.94}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedEmoji === e }}
                    accessibilityLabel={`Icon ${e}`}>
                    <Text style={styles.emojiQuickText}>{e}</Text>
                  </PressableScale>
                ))}
                <PressableScale
                  style={styles.emojiMore}
                  onPress={() => setEmojiModalVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="More icons">
                  <Text style={styles.emojiMoreText}>More</Text>
                </PressableScale>
              </View>
            </View>
          </AnimatedEntry>

          {/* Details */}
          <AnimatedEntry index={3} skip={reduceMotion}>
            <View style={styles.card}>
              <SectionHeader title="Title" right={`${title.length}/${MAX_TITLE}`} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Ice Cream Trip"
                placeholderTextColor={SUBTLE}
                value={title}
                onChangeText={setTitle}
                maxLength={MAX_TITLE}
                autoCapitalize="words"
              />
              <View onLayout={(e) => { descriptionY.current = e.nativeEvent.layout.y; }}>
                <Text style={styles.subLabel}>Description <Text style={styles.optional}>(optional)</Text></Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g. Weekends only, after homework is done"
                  placeholderTextColor={SUBTLE}
                  value={description}
                  onChangeText={setDescription}
                  onFocus={scrollToDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </AnimatedEntry>

          {/* Cost */}
          <AnimatedEntry index={4} skip={reduceMotion}>
            <View style={styles.card}>
              <SectionHeader title="Coin cost" />
              <View style={styles.coinsRow}>
                <PressableScale style={styles.stepBtn} onPress={() => changeCoins(-5)} pressedScale={0.94} accessibilityRole="button" accessibilityLabel="Decrease by 5 coins">
                  <Text style={styles.stepBtnText}>−5</Text>
                </PressableScale>
                <View style={styles.coinsBox}>
                  <TextInput
                    style={styles.coinsInput}
                    placeholder="0"
                    placeholderTextColor={SUBTLE}
                    value={coins}
                    onChangeText={handleCoinsChange}
                    keyboardType="number-pad"
                    maxLength={String(MAX_COINS).length}
                    textAlign="center"
                    accessibilityLabel="Coin cost"
                  />
                  <Text style={styles.coinsUnit}>coins</Text>
                </View>
                <PressableScale style={styles.stepBtn} onPress={() => changeCoins(5)} pressedScale={0.94} accessibilityRole="button" accessibilityLabel="Increase by 5 coins">
                  <Text style={styles.stepBtnText}>+5</Text>
                </PressableScale>
              </View>
              <View style={styles.presetRow}>
                {COIN_PRESETS.map(p => (
                  <PressableScale
                    key={p}
                    style={[styles.presetChip, coinsNum === p && styles.presetChipActive]}
                    onPress={() => setCoins(String(p))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: coinsNum === p }}
                    accessibilityLabel={`${p} coins`}>
                    <Text style={[styles.presetText, coinsNum === p && styles.presetTextActive]}>{p}</Text>
                  </PressableScale>
                ))}
              </View>
              <Text style={styles.helper}>Maximum {MAX_COINS} coins</Text>
            </View>
          </AnimatedEntry>

          {/* Availability */}
          <AnimatedEntry index={5} skip={reduceMotion}>
            <View style={styles.card}>
              <SectionHeader title="Available to" />
              <View style={styles.toggleRow}>
                <PressableScale
                  style={[styles.toggleBtn, assignTo === 'all' && styles.toggleActive]}
                  onPress={() => setAssignTo('all')}
                  pressedScale={0.98}
                  accessibilityRole="button"
                  accessibilityState={{ selected: assignTo === 'all' }}>
                  <Text style={[styles.toggleText, assignTo === 'all' && styles.toggleTextActive]}>All children</Text>
                </PressableScale>
                <PressableScale
                  style={[styles.toggleBtn, assignTo === 'specific' && styles.toggleActive]}
                  onPress={() => setAssignTo('specific')}
                  pressedScale={0.98}
                  accessibilityRole="button"
                  accessibilityState={{ selected: assignTo === 'specific' }}>
                  <Text style={[styles.toggleText, assignTo === 'specific' && styles.toggleTextActive]}>Specific children</Text>
                </PressableScale>
              </View>

              {assignTo === 'specific' && (
                <View style={styles.childSelector}>
                  {children.length === 0 ? (
                    <Text style={styles.helper}>No children have been added yet.</Text>
                  ) : (
                    children.map(child => {
                      const on = selectedChildren.includes(child.id);
                      return (
                        <PressableScale
                          key={child.id}
                          style={[styles.childChip, on && styles.childChipSelected]}
                          onPress={() => toggleChild(child.id)}
                          pressedScale={0.97}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}>
                          <View style={styles.childAvatar}>
                            <Text style={styles.childChipEmoji}>{child.avatar}</Text>
                          </View>
                          <Text style={[styles.childChipText, on && styles.childChipTextSelected]}>{child.name}</Text>
                          {on && <Text style={styles.childCheck}>✓</Text>}
                        </PressableScale>
                      );
                    })
                  )}
                </View>
              )}
            </View>
          </AnimatedEntry>

          {isEdit && (
            <PressableScale style={styles.deleteBtn} onPress={handleDelete} disabled={loading} accessibilityRole="button">
              <Text style={styles.deleteBtnText}>Delete Reward</Text>
            </PressableScale>
          )}
        </ScrollView>

        {/* Sticky save bar */}
        <View style={styles.bottomBar}>
          <PressableScale
            style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={loading}
            pressedScale={0.98}
            accessibilityRole="button">
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>{isEdit ? 'Save Changes' : 'Create Reward'}</Text>
            )}
          </PressableScale>
        </View>
      </KeyboardAvoidingView>

      {/* Icon Picker Modal */}
      <Modal
        visible={emojiModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEmojiModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setEmojiModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Choose an icon</Text>
                  <PressableScale onPress={() => setEmojiModalVisible(false)} accessibilityRole="button" accessibilityLabel="Close">
                    <Text style={styles.closeText}>Done</Text>
                  </PressableScale>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {EMOJI_GROUPS.map(group => (
                    <View key={group.label} style={styles.emojiGroup}>
                      <Text style={styles.emojiGroupLabel}>{group.label.toUpperCase()}</Text>
                      <View style={styles.emojiGrid}>
                        {group.emojis.map(emoji => (
                          <PressableScale
                            key={emoji}
                            style={[styles.emojiOption, selectedEmoji === emoji && styles.emojiSelected]}
                            onPress={() => {
                              setSelectedEmoji(emoji);
                              setEmojiModalVisible(false);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Icon ${emoji}`}>
                            <Text style={styles.emojiOptionText}>{emoji}</Text>
                          </PressableScale>
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

// Simple section header used at the top of each card.
function SectionHeader({ title, right }: { title: string; right?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right ? <Text style={styles.counter}>{right}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  inner: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 130 },

  // Header
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backBtn: { paddingVertical: 12, paddingRight: 12 },
  backText: { fontSize: 15, color: '#127E78', fontWeight: '700' },
  pageTitle: { fontSize: 26, fontWeight: '800', color: HEADING },
  pageSubtitle: { fontSize: 14, color: MUTED, marginTop: 5, marginBottom: 24, lineHeight: 20 },

  // Preview
  sectionCaption: { fontSize: 12, fontWeight: '700', color: MUTED, letterSpacing: 0.8, marginBottom: 9 },
  preview: {
    backgroundColor: SURFACE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: '#0C665F',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  previewTop: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  previewIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#E4F8F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmoji: { fontSize: 29 },
  previewInfo: { flex: 1 },
  previewTitle: { fontSize: 18, fontWeight: '800', color: INK, marginBottom: 4 },
  previewFor: { fontSize: 13, color: MUTED },
  divider: { height: 1, backgroundColor: CARD_BORDER, marginHorizontal: 18 },
  previewBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, paddingTop: 14 },
  coinBadge: { backgroundColor: COIN_SOFT, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  coinBadgeText: { fontSize: 14, fontWeight: '800', color: COIN },
  redeemBtn: { backgroundColor: TEAL, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  redeemBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  // Suggestions
  sectionLabel: { fontSize: 21, fontWeight: '800', color: HEADING, marginTop: 26, marginBottom: 12 },
  templateScroll: { marginHorizontal: -20, marginBottom: 24 },
  templateRow: { paddingHorizontal: 20, gap: 10 },
  templateChip: {
    width: 132,
    borderRadius: 18,
    padding: 14,
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
    gap: 6,
  },
  templateChipActive: { borderColor: '#11A79B', backgroundColor: TEAL_SOFT },
  templateEmoji: { fontSize: 24 },
  templateTitle: { fontSize: 14, fontWeight: '700', color: INK, minHeight: 36, lineHeight: 18 },
  templateCoins: { fontSize: 12, fontWeight: '700', color: COIN },

  // Cards
  card: {
    backgroundColor: SURFACE,
    borderRadius: 22,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: INK },
  counter: { fontSize: 12, fontWeight: '600', color: SUBTLE },
  subLabel: { fontSize: 14, fontWeight: '700', color: INK, marginBottom: 9 },
  optional: { fontWeight: '500', color: SUBTLE },
  helper: { fontSize: 12, color: MUTED },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 13,
    padding: 14,
    fontSize: 16,
    color: INK,
    backgroundColor: INPUT_BG,
    marginBottom: 16,
  },
  textArea: { minHeight: 105, marginBottom: 0 },

  // Icon picker
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiQuick: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: TOGGLE_BG,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  emojiQuickActive: { borderColor: '#11A79B', backgroundColor: TEAL_SOFT },
  emojiQuickText: { fontSize: 24 },
  emojiMore: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: INPUT_BG,
  },
  emojiMoreText: { fontSize: 14, fontWeight: '700', color: TEAL },

  // Coins
  coinsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  stepBtn: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 16, color: '#FFFFFF', fontWeight: '700' },
  coinsBox: {
    flex: 1,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 13,
    backgroundColor: INPUT_BG,
  },
  coinsInput: { minWidth: 56, fontSize: 20, fontWeight: '800', color: INK, paddingVertical: 0 },
  coinsUnit: { fontSize: 14, fontWeight: '600', color: MUTED },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  presetChip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: TOGGLE_BG,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  presetChipActive: { backgroundColor: TEAL, borderColor: TEAL },
  presetText: { fontSize: 13, fontWeight: '700', color: MUTED },
  presetTextActive: { color: '#FFFFFF' },

  // Availability
  toggleRow: { flexDirection: 'row', backgroundColor: TOGGLE_BG, borderRadius: 14, padding: 4, gap: 4 },
  toggleBtn: { flex: 1, paddingVertical: 13, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  toggleActive: { backgroundColor: TEAL },
  toggleText: { fontSize: 13, fontWeight: '700', color: MUTED, textAlign: 'center' },
  toggleTextActive: { color: '#FFFFFF' },
  childSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: INPUT_BG,
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
  },
  childChipSelected: { backgroundColor: TEAL_SOFT, borderColor: '#11A79B' },
  childAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  childChipEmoji: { fontSize: 18 },
  childChipText: { fontSize: 14, fontWeight: '700', color: MUTED },
  childChipTextSelected: { color: TEAL_DARK },
  childCheck: { fontSize: 14, fontWeight: '800', color: TEAL },

  // Delete
  deleteBtn: {
    borderWidth: 1.5,
    borderColor: '#E65A62',
    backgroundColor: '#FFF5F5',
    borderRadius: 15,
    padding: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  deleteBtnText: { color: DANGER, fontSize: 16, fontWeight: '800' },

  // Sticky bottom bar
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: 'rgba(241,250,248,0.97)',
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  saveBtn: {
    backgroundColor: TEAL,
    borderRadius: 15,
    padding: 17,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  // Icon modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '75%',
  },
  modalHandle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: BORDER, marginBottom: 14 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: INK },
  closeText: { fontSize: 15, fontWeight: '800', color: TEAL, padding: 4 },
  emojiGroup: { marginBottom: 18 },
  emojiGroupLabel: { fontSize: 12, fontWeight: '700', color: MUTED, letterSpacing: 0.8, marginBottom: 9 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiOption: {
    width: 54,
    height: 54,
    borderRadius: 15,
    backgroundColor: TOGGLE_BG,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  emojiSelected: { borderColor: '#11A79B', backgroundColor: TEAL_SOFT },
  emojiOptionText: { fontSize: 28 },
});
