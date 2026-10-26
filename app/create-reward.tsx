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
import Celebration from '../components/Celebration';
import FloatingBackground from '../components/FloatingBackground';
import PalMascot, { PalMood } from '../components/PalMascot';
import PressableScale from '../components/PressableScale';
import { auth, db } from '../config/firebase';

// Emoji choices grouped so parents can find one quickly.
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Fun & Screens', emojis: ['🎮', '📱', '📺', '🎬', '🎵', '🎧', '🎲', '🧩'] },
  { label: 'Treats', emojis: ['🍦', '🍕', '🍫', '🍩', '🍪', '🧁', '🍔', '🥤'] },
  { label: 'Outings', emojis: ['🎡', '🎠', '🎪', '🏖️', '🏊', '⚽', '🛹', '🚗'] },
  { label: 'Stuff & Special', emojis: ['🧸', '🎨', '📚', '🎁', '💰', '🏆', '⭐', '🦄', '🌈', '✈️', '🌙', '👑'] },
];
const QUICK_EMOJIS = ['🎁', '🎮', '🍦', '🍕', '🎬', '🧸', '🏆', '💰'];

// One-tap starting points. Parents can edit everything after picking one.
// Each idea gets its own candy color so the row feels playful.
const TEMPLATES = [
  { emoji: '📱', title: '30 Min Extra Screen Time', coins: 20, description: 'Use it any day after homework is done.', bg: '#E3F2FF', border: '#7BB8F0', color: '#1C5F9E' },
  { emoji: '🍦', title: 'Ice Cream Trip', coins: 40, description: 'A trip to get your favorite ice cream.', bg: '#FFE8F1', border: '#F59BBE', color: '#A23462' },
  { emoji: '🍕', title: 'Pick Dinner Tonight', coins: 30, description: 'You choose what the family eats for dinner!', bg: '#FFF1DE', border: '#F7B866', color: '#9A5B0E' },
  { emoji: '🌙', title: 'Stay Up 30 Min Late', coins: 35, description: 'Good for a Friday or Saturday night.', bg: '#EFEAFF', border: '#A994F2', color: '#5A43B8' },
  { emoji: '🎬', title: 'Family Movie Night Pick', coins: 50, description: 'You choose the movie and the snacks.', bg: '#FFE9E4', border: '#F39B85', color: '#A6402A' },
  { emoji: '🧸', title: 'New Toy', coins: 200, description: 'A toy of your choice (we will agree on a price limit).', bg: '#E6F8EE', border: '#78D3A0', color: '#1E7A4A' },
  { emoji: '🎡', title: 'Day Trip of Your Choice', coins: 400, description: 'Park, zoo, museum or arcade — you pick!', bg: '#FFF8D9', border: '#F2D25C', color: '#8A6A00' },
];

// What Pal says as the parent fills in the form (0-3 steps done).
const PAL_LINES = [
  "Let's make a reward! Pick an idea or start fresh 🎈",
  'Ooh, nice! Now give it a price 🪙',
  'Almost there! Who gets to buy it? 🙌',
  "Woohoo! The kids are gonna love this! 🎉",
];

const COIN_PRESETS = [10, 25, 50, 100, 250];
const MAX_TITLE = 40;

// Highest number of coins a single reward can cost. Change this one number to adjust the limit.
const MAX_COINS = 1000;

// Friendly label so parents can see at a glance how "big" a reward is.
function priceTier(coins: number) {
  if (coins <= 0) return { label: 'Set a price', bg: 'rgba(255,255,255,0.18)', color: '#FFFFFF' };
  if (coins <= 30) return { label: '🍬 Small treat', bg: '#E0FFF4', color: '#2A9D8F' };
  if (coins <= 150) return { label: '⭐ Nice reward', bg: '#FFF3CD', color: '#B7791F' };
  return { label: '🏆 Big goal', bg: '#F1ECFF', color: '#6A4FD8' };
}

// Slides up and fades in, staggered by index. Skips the motion when Reduce Motion is on.
function AnimatedEntry({ index, skip, children }: { index: number; skip: boolean; children: React.ReactNode }) {
  const [anim] = useState(() => new Animated.Value(skip ? 1 : 0));
  useEffect(() => {
    if (skip) {
      anim.setValue(1);
      return;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 70,
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

export default function CreateRewardScreen() {
  const router = useRouter();

  // When opened from the rewards list with an id, this screen edits that reward instead of creating one
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const editId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isEdit = !!editId;

  const scrollRef = useRef<ScrollView>(null);
  const descriptionY = useRef(0);
  const [emojiPop] = useState(() => new Animated.Value(1));

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
  const [avgChoreCoins, setAvgChoreCoins] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  // Load real children from Firestore, plus the parent's chores so we can show "≈ N chores"
  useEffect(() => {
    const loadFamily = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const childrenSnap = await getDocs(query(collection(db, 'children'), where('parentId', '==', user.uid)));
        setChildren(childrenSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error: any) {
        Alert.alert('Error!', error.message);
      }
      try {
        const choresSnap = await getDocs(query(collection(db, 'chores'), where('parentId', '==', user.uid)));
        const values = choresSnap.docs
          .map(d => Number((d.data() as any).coins))
          .filter(n => Number.isFinite(n) && n > 0);
        if (values.length) setAvgChoreCoins(values.reduce((a, b) => a + b, 0) / values.length);
      } catch {
        // The chore estimate is only a hint, so the screen works fine without it
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

  // Little bounce on the preview icon whenever the emoji changes
  const pickEmoji = (emoji: string) => {
    setSelectedEmoji(emoji);
    if (reduceMotion) return;
    emojiPop.setValue(0.6);
    Animated.spring(emojiPop, { toValue: 1, speed: 18, bounciness: 14, useNativeDriver: true }).start();
  };

  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setTitle(t.title);
    setCoins(String(Math.min(t.coins, MAX_COINS)));
    setDescription(t.description);
    pickEmoji(t.emoji);
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

  const finish = (heading: string, message: string, party: boolean) => {
    if (party && !reduceMotion) setCelebrate(true);
    Alert.alert(heading, message, [{ text: 'OK', onPress: () => router.back() }]);
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
        finish('Reward Updated! ✅', `"${title.trim()}" has been saved.`, false);
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

      finish('Reward Created! 🎉', `"${title.trim()}" has been added to the rewards catalog!`, true);
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
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0F7F76" />
        </View>
      </SafeAreaView>
    );
  }

  const coinsNum = parseInt(coins || '0', 10) || 0;
  const tier = priceTier(coinsNum);
  const choresNeeded = avgChoreCoins > 0 && coinsNum > 0 ? Math.max(1, Math.round(coinsNum / avgChoreCoins)) : 0;
  const assignedNames =
    assignTo === 'all'
      ? 'All kids'
      : children.filter(c => selectedChildren.includes(c.id)).map(c => c.name).join(', ') || 'Pick a kid';

  // Pal ticks off his clipboard as the form fills in
  const stepsDone =
    (title.trim() ? 1 : 0) +
    (coinsNum > 0 ? 1 : 0) +
    (title.trim() && coinsNum > 0 && (assignTo === 'all' || selectedChildren.length > 0) ? 1 : 0);
  const palMood: PalMood = stepsDone === 3 ? 'party' : 'working';
  const palLine = isEdit ? 'Change anything you like, then tap save! ✏️' : PAL_LINES[stepsDone];

  return (
    <SafeAreaView style={styles.container}>
      {!reduceMotion && <FloatingBackground />}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}>

          {/* Top bar */}
          <View style={styles.topBar}>
            <PressableScale style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
              <Text style={styles.backText}>← Back</Text>
            </PressableScale>
            <Text style={styles.pageTitle}>{isEdit ? 'Edit Reward ✏️' : 'New Reward 🎁'}</Text>
          </View>

          {/* Hero: Pal + live ticket preview */}
          <AnimatedEntry index={0} skip={reduceMotion}>
            <View style={styles.hero}>
              <View style={styles.palRow}>
                <PalMascot mood={palMood} checked={stepsDone} size={96} reduceMotion={reduceMotion} />
                <View style={styles.bubble}>
                  <View style={styles.bubbleTail} />
                  <Text style={styles.bubbleText}>{palLine}</Text>
                </View>
              </View>

              <Text style={styles.heroCaption}>👀 What your kids will see</Text>
              <View style={styles.ticket}>
                <View style={styles.ticketTop}>
                  <Animated.View style={[styles.ticketEmojiCircle, { transform: [{ scale: emojiPop }] }]}>
                    <Text style={styles.ticketEmoji}>{selectedEmoji}</Text>
                    <Text style={styles.sparkle}>✨</Text>
                  </Animated.View>
                  <View style={styles.ticketInfo}>
                    <Text style={styles.ticketTitle} numberOfLines={2}>{title.trim() || 'Your awesome reward'}</Text>
                    <Text style={styles.ticketFor} numberOfLines={1}>For: {assignedNames}</Text>
                  </View>
                </View>
                {/* Dashed tear line with notches, like a real ticket */}
                <View style={styles.tearRow}>
                  <View style={[styles.notch, styles.notchLeft]} />
                  <View style={styles.tearLine} />
                  <View style={[styles.notch, styles.notchRight]} />
                </View>
                <View style={styles.ticketBottom}>
                  <View style={styles.coinBadge}>
                    <Text style={styles.coinBadgeText}>🪙 {coinsNum}</Text>
                  </View>
                  <View style={styles.buyBtn}>
                    <Text style={styles.buyBtnText}>BUY IT! 🛒</Text>
                  </View>
                </View>
              </View>

              <View style={styles.heroPills}>
                <View style={[styles.tierPill, { backgroundColor: tier.bg }]}>
                  <Text style={[styles.tierText, { color: tier.color }]}>{tier.label}</Text>
                </View>
                {choresNeeded > 0 && (
                  <View style={styles.choresPill}>
                    <Text style={styles.choresText}>🧹 ≈ {choresNeeded} chore{choresNeeded === 1 ? '' : 's'} to earn</Text>
                  </View>
                )}
              </View>
            </View>
          </AnimatedEntry>

          {/* Quick ideas (new rewards only) */}
          {!isEdit && (
            <AnimatedEntry index={1} skip={reduceMotion}>
              <Text style={styles.sectionLabel}>💡 Quick ideas</Text>
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
                      style={[
                        styles.templateChip,
                        { backgroundColor: t.bg, borderColor: active ? t.color : t.border },
                        active && styles.templateChipActive,
                      ]}
                      onPress={() => applyTemplate(t)}
                      accessibilityRole="button"
                      accessibilityLabel={`Use idea: ${t.title}, ${t.coins} coins`}>
                      <Text style={styles.templateEmoji}>{t.emoji}</Text>
                      <Text style={[styles.templateTitle, { color: t.color }]} numberOfLines={2}>{t.title}</Text>
                      <View style={styles.templateCoins}>
                        <Text style={styles.templateCoinsText}>🪙 {t.coins}</Text>
                      </View>
                      {active && <Text style={[styles.templateCheck, { backgroundColor: t.color }]}>✓</Text>}
                    </PressableScale>
                  );
                })}
              </ScrollView>
            </AnimatedEntry>
          )}

          {/* Step 1: picture */}
          <AnimatedEntry index={2} skip={reduceMotion}>
            <View style={[styles.card, { borderColor: '#F59BBE' }]}>
              <StepHeader n={1} color="#E85A93" text="Pick a picture 🎨" />
              <View style={styles.emojiRow}>
                {QUICK_EMOJIS.map(e => (
                  <PressableScale
                    key={e}
                    style={[styles.emojiQuick, selectedEmoji === e && styles.emojiQuickActive]}
                    onPress={() => pickEmoji(e)}
                    pressedScale={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Icon ${e}`}>
                    <Text style={styles.emojiQuickText}>{e}</Text>
                  </PressableScale>
                ))}
                <PressableScale
                  style={styles.emojiMore}
                  onPress={() => setEmojiModalVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="More icons">
                  <Text style={styles.emojiMoreText}>More ➕</Text>
                </PressableScale>
              </View>
            </View>
          </AnimatedEntry>

          {/* Step 2: name */}
          <AnimatedEntry index={3} skip={reduceMotion}>
            <View style={[styles.card, { borderColor: '#7BB8F0' }]}>
              <StepHeader n={2} color="#3B8DDB" text="Name it ✏️" right={`${title.length}/${MAX_TITLE}`} />
              <TextInput
                style={styles.input}
                placeholder="Ice Cream Trip"
                placeholderTextColor="#A9BFD6"
                value={title}
                onChangeText={setTitle}
                maxLength={MAX_TITLE}
                autoCapitalize="words"
              />
              <View onLayout={(e) => { descriptionY.current = e.nativeEvent.layout.y; }}>
                <Text style={styles.subLabel}>Any rules? (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Weekends only, after homework"
                  placeholderTextColor="#A9BFD6"
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

          {/* Step 3: price */}
          <AnimatedEntry index={4} skip={reduceMotion}>
            <View style={[styles.card, { borderColor: '#F2C75C' }]}>
              <StepHeader n={3} color="#D9A116" text="How many coins? 🪙" />
              <View style={styles.coinsRow}>
                <PressableScale style={styles.coinBtn} onPress={() => changeCoins(-5)} pressedScale={0.85} accessibilityRole="button" accessibilityLabel="Minus 5 coins">
                  <Text style={styles.coinBtnText}>−5</Text>
                </PressableScale>
                <View style={styles.coinsBox}>
                  <Text style={styles.coinsBoxEmoji}>🪙</Text>
                  <TextInput
                    style={styles.coinsInput}
                    placeholder="0"
                    placeholderTextColor="#E6CF95"
                    value={coins}
                    onChangeText={handleCoinsChange}
                    keyboardType="number-pad"
                    maxLength={String(MAX_COINS).length}
                    textAlign="center"
                    accessibilityLabel="Coin cost"
                  />
                </View>
                <PressableScale style={styles.coinBtn} onPress={() => changeCoins(5)} pressedScale={0.85} accessibilityRole="button" accessibilityLabel="Plus 5 coins">
                  <Text style={styles.coinBtnText}>+5</Text>
                </PressableScale>
              </View>
              <View style={styles.presetRow}>
                {COIN_PRESETS.map(p => (
                  <PressableScale
                    key={p}
                    style={[styles.presetChip, coinsNum === p && styles.presetChipActive]}
                    onPress={() => setCoins(String(p))}
                    accessibilityRole="button"
                    accessibilityLabel={`${p} coins`}>
                    <Text style={[styles.presetText, coinsNum === p && styles.presetTextActive]}>{p}</Text>
                  </PressableScale>
                ))}
              </View>
              <Text style={styles.helper}>Up to {MAX_COINS} coins</Text>
            </View>
          </AnimatedEntry>

          {/* Step 4: who */}
          <AnimatedEntry index={5} skip={reduceMotion}>
            <View style={[styles.card, { borderColor: '#A994F2' }]}>
              <StepHeader n={4} color="#7B61FF" text="Who gets it? 🙌" />
              <View style={styles.toggleRow}>
                <PressableScale
                  style={[styles.toggleBtn, assignTo === 'all' && styles.toggleActive]}
                  onPress={() => setAssignTo('all')}
                  accessibilityRole="button">
                  <Text style={[styles.toggleText, assignTo === 'all' && styles.toggleTextActive]}>👨‍👩‍👧 Everyone</Text>
                </PressableScale>
                <PressableScale
                  style={[styles.toggleBtn, assignTo === 'specific' && styles.toggleActive]}
                  onPress={() => setAssignTo('specific')}
                  accessibilityRole="button">
                  <Text style={[styles.toggleText, assignTo === 'specific' && styles.toggleTextActive]}>🙋 Pick kids</Text>
                </PressableScale>
              </View>

              {assignTo === 'specific' && (
                <View style={styles.childSelector}>
                  {children.length === 0 ? (
                    <Text style={styles.helper}>No children added yet!</Text>
                  ) : (
                    children.map(child => {
                      const on = selectedChildren.includes(child.id);
                      return (
                        <PressableScale
                          key={child.id}
                          style={[styles.childChip, on && styles.childChipSelected]}
                          onPress={() => toggleChild(child.id)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}>
                          <View style={[styles.childAvatar, on && styles.childAvatarOn]}>
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
            accessibilityRole="button">
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>{isEdit ? 'Save Changes ✅' : 'Create Reward 🎉'}</Text>
            )}
          </PressableScale>
        </View>
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
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Choose an icon</Text>
                  <PressableScale onPress={() => setEmojiModalVisible(false)} accessibilityRole="button" accessibilityLabel="Close">
                    <Text style={styles.closeText}>✕</Text>
                  </PressableScale>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {EMOJI_GROUPS.map(group => (
                    <View key={group.label} style={styles.emojiGroup}>
                      <Text style={styles.emojiGroupLabel}>{group.label}</Text>
                      <View style={styles.emojiGrid}>
                        {group.emojis.map(emoji => (
                          <PressableScale
                            key={emoji}
                            style={[styles.emojiOption, selectedEmoji === emoji && styles.emojiSelected]}
                            onPress={() => {
                              pickEmoji(emoji);
                              setEmojiModalVisible(false);
                            }}>
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

      {celebrate && <Celebration source={require('../assets/images/confetti.json')} onDone={() => setCelebrate(false)} />}
    </SafeAreaView>
  );
}

// Numbered, colorful step header used at the top of each card.
function StepHeader({ n, color, text, right }: { n: number; color: string; text: string; right?: string }) {
  return (
    <View style={styles.stepHeader}>
      <View style={[styles.stepBadge, { backgroundColor: color }]}>
        <Text style={styles.stepBadgeText}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
      {right ? <Text style={styles.counter}>{right}</Text> : null}
    </View>
  );
}

const TEAL = '#0F7F76';
const TEAL_DARK = '#0A5F58';
const MINT_BG = '#F3FBF9';
const GOLD = '#F4B942';
const GOLD_DARK = '#C98F1A';
const INK = '#2D2D2D';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MINT_BG },
  inner: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 140 },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  backBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#D5EEE9',
  },
  backText: { fontSize: 14, color: TEAL, fontWeight: '800' },
  pageTitle: { fontSize: 22, fontWeight: '900', color: INK },

  // Hero
  hero: {
    backgroundColor: TEAL,
    borderRadius: 32,
    padding: 18,
    marginBottom: 22,
    borderBottomWidth: 6,
    borderBottomColor: TEAL_DARK,
  },
  palRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  bubble: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bubbleTail: {
    position: 'absolute',
    left: -7,
    top: '50%',
    marginTop: -7,
    width: 14,
    height: 14,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
  bubbleText: { fontSize: 14, fontWeight: '800', color: INK, lineHeight: 20 },
  heroCaption: { fontSize: 13, fontWeight: '800', color: '#D7F3EE', marginBottom: 8 },

  // Ticket preview (mirrors the child's reward card)
  ticket: { backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden' },
  ticketTop: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  ticketEmojiCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFF8E1',
    borderWidth: 3,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketEmoji: { fontSize: 36 },
  sparkle: { position: 'absolute', top: -6, right: -8, fontSize: 18 },
  ticketInfo: { flex: 1 },
  ticketTitle: { fontSize: 19, fontWeight: '900', color: INK, marginBottom: 4 },
  ticketFor: { fontSize: 13, fontWeight: '700', color: '#7A9A94' },
  tearRow: { flexDirection: 'row', alignItems: 'center', height: 16 },
  notch: { width: 16, height: 16, borderRadius: 8, backgroundColor: TEAL },
  notchLeft: { marginLeft: -8 },
  notchRight: { marginRight: -8 },
  tearLine: { flex: 1, borderTopWidth: 2, borderColor: '#E3EEEC', borderStyle: 'dashed', marginHorizontal: 6 },
  ticketBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingTop: 10 },
  coinBadge: { backgroundColor: '#FFF3CD', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  coinBadgeText: { fontSize: 16, fontWeight: '900', color: '#9A6A10' },
  buyBtn: {
    backgroundColor: GOLD,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 4,
    borderBottomColor: GOLD_DARK,
  },
  buyBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  heroPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tierPill: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  tierText: { fontSize: 12, fontWeight: '800' },
  choresPill: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.18)' },
  choresText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },

  // Quick ideas
  sectionLabel: { fontSize: 17, fontWeight: '900', color: INK, marginBottom: 10 },
  templateScroll: { marginHorizontal: -18, marginBottom: 18 },
  templateRow: { paddingHorizontal: 18, gap: 10, paddingBottom: 4 },
  templateChip: {
    width: 124,
    borderRadius: 22,
    padding: 12,
    borderWidth: 2,
    borderBottomWidth: 5,
    gap: 6,
  },
  templateChipActive: { transform: [{ rotate: '-2deg' }] },
  templateEmoji: { fontSize: 34 },
  templateTitle: { fontSize: 14, fontWeight: '800', minHeight: 38 },
  templateCoins: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  templateCoinsText: { fontSize: 12, fontWeight: '900', color: '#9A6A10' },
  templateCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderBottomWidth: 5,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  stepBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  stepText: { flex: 1, fontSize: 17, fontWeight: '900', color: INK },
  counter: { fontSize: 12, fontWeight: '700', color: '#9AB0C6' },
  subLabel: { fontSize: 13, fontWeight: '800', color: '#5E7389', marginBottom: 6 },
  helper: { fontSize: 12, fontWeight: '600', color: '#8A9A97' },
  input: {
    borderWidth: 2,
    borderColor: '#D6E8F8',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    fontWeight: '700',
    color: INK,
    backgroundColor: '#F4F9FE',
    marginBottom: 14,
  },
  textArea: { minHeight: 80, fontSize: 15, fontWeight: '600', marginBottom: 0 },

  // Picture picker
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiQuick: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF0F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  emojiQuickActive: { borderColor: '#E85A93', backgroundColor: '#FFE3EF', transform: [{ scale: 1.08 }] },
  emojiQuickText: { fontSize: 26 },
  emojiMore: {
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E85A93',
    borderStyle: 'dashed',
  },
  emojiMoreText: { fontSize: 14, fontWeight: '900', color: '#E85A93' },

  // Coins
  coinsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  coinBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFE08A',
    borderBottomWidth: 5,
    borderBottomColor: GOLD_DARK,
  },
  coinBtnText: { fontSize: 17, color: '#FFFFFF', fontWeight: '900' },
  coinsBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: GOLD,
    borderRadius: 22,
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 10,
  },
  coinsBoxEmoji: { fontSize: 24 },
  coinsInput: { minWidth: 60, paddingVertical: 8, fontSize: 32, fontWeight: '900', color: INK },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#FFF8E1',
    borderWidth: 2,
    borderColor: '#F7E2A8',
  },
  presetChipActive: { backgroundColor: GOLD, borderColor: GOLD_DARK },
  presetText: { fontSize: 14, fontWeight: '900', color: '#9A6A10' },
  presetTextActive: { color: '#FFFFFF' },

  // Who gets it
  toggleRow: { flexDirection: 'row', backgroundColor: '#F2EEFF', borderRadius: 20, padding: 4, gap: 4 },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center' },
  toggleActive: { backgroundColor: '#7B61FF' },
  toggleText: { fontSize: 15, fontWeight: '800', color: '#8A7CC2' },
  toggleTextActive: { color: '#FFFFFF' },
  childSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    borderRadius: 24,
    backgroundColor: '#F7F5FF',
    borderWidth: 2,
    borderColor: '#E4DDFF',
  },
  childChipSelected: { backgroundColor: '#EFEAFF', borderColor: '#7B61FF' },
  childAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  childAvatarOn: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#7B61FF' },
  childChipEmoji: { fontSize: 20 },
  childChipText: { fontSize: 15, fontWeight: '800', color: '#8A7CC2' },
  childChipTextSelected: { color: '#5A43B8' },
  childCheck: { fontSize: 15, fontWeight: '900', color: '#7B61FF' },

  // Delete
  deleteBtn: {
    borderWidth: 2,
    borderColor: '#E63946',
    borderRadius: 20,
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 4,
  },
  deleteBtnText: { color: '#E63946', fontSize: 16, fontWeight: '800' },

  // Sticky bottom bar
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: 'rgba(243,251,249,0.96)',
    borderTopWidth: 1,
    borderTopColor: '#E3F1EE',
  },
  saveBtn: {
    backgroundColor: TEAL,
    borderRadius: 24,
    paddingVertical: 17,
    alignItems: 'center',
    borderBottomWidth: 6,
    borderBottomColor: TEAL_DARK,
  },
  saveBtnDisabled: { backgroundColor: '#7FBDB7', borderBottomColor: '#6AA8A2' },
  saveBtnText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', letterSpacing: 0.3 },

  // Emoji modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 22,
    paddingBottom: 36,
    maxHeight: '75%',
  },
  modalHandle: { alignSelf: 'center', width: 48, height: 6, borderRadius: 3, backgroundColor: '#F4C9DA', marginBottom: 14 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: INK },
  closeText: { fontSize: 20, color: '#B0A6C9', padding: 4 },
  emojiGroup: { marginBottom: 16 },
  emojiGroupLabel: { fontSize: 14, fontWeight: '900', color: '#E85A93', marginBottom: 8 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emojiOption: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFF0F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  emojiSelected: { borderColor: '#E85A93', backgroundColor: '#FFE3EF' },
  emojiOptionText: { fontSize: 30 },
});
