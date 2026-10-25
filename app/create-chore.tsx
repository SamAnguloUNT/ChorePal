import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text, TextInput,
  View
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { auth, db } from '../config/firebase';

// Highest number of coins a single chore can be worth. Change this one number to adjust the limit.
const MAX_COINS = 100;

// Dates are stored as "YYYY-MM-DD" strings. Always build/parse them in LOCAL time.
// (new Date('2026-10-07') is read as UTC midnight, which shows as Oct 6 in US time zones,
// and toISOString() flips to "tomorrow" in the evening.)
const toLocalDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseLocalDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export default function CreateChoreScreen() {
  const router = useRouter();

  // When opened from the chore list with an id, this screen edits that chore instead of creating one
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const editId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isEdit = !!editId;

  const scrollRef = useRef<ScrollView>(null);
  const descriptionY = useRef(0);

  // Form state
  const [title, setTitle] = useState('');
  const [coins, setCoins] = useState('');
  const [description, setDescription] = useState('');
  const [choreType, setChoreType] = useState<'required' | 'optional'>('required');
  const [repeatable, setRepeatable] = useState(false);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [assignTo, setAssignTo] = useState<'all' | 'specific'>('all');
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);
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

  // Edit mode: load the existing chore into the form
  useEffect(() => {
    if (!editId) return;
    const loadChore = async () => {
      try {
        const snap = await getDoc(doc(db, 'chores', editId));
        if (!snap.exists()) {
          Alert.alert('Error!', 'This chore could not be found.', [
            { text: 'OK', onPress: () => router.back() }
          ]);
          return;
        }
        const d: any = snap.data();
        setTitle(d.title ?? '');
        setCoins(d.coins !== undefined && d.coins !== null ? String(d.coins) : '');
        setDescription(d.description ?? '');
        setChoreType(d.choreType === 'optional' ? 'optional' : 'required');
        setRepeatable(!!d.repeatable);
        setPriority(d.priority === 'low' || d.priority === 'high' ? d.priority : 'medium');
        if (d.assignedTo && d.assignedTo !== 'all') {
          setAssignTo('specific');
          setSelectedChildren([d.assignedTo]);
        } else {
          setAssignTo('all');
        }
        setSelectedDate(typeof d.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.deadline) ? d.deadline : '');
      } catch (error: any) {
        Alert.alert('Error!', error.message);
      } finally {
        setInitialLoading(false);
      }
    };
    loadChore();
  }, [editId]);

  const toggleChild = (id: string) => {
    if (isEdit) {
      // An existing chore belongs to exactly one child (or all), so only allow one selection
      setSelectedChildren([id]);
      return;
    }
    setSelectedChildren(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
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

  // Scroll the description box above the keyboard when it is focused
  const scrollToDescription = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, descriptionY.current - 100), animated: true });
    }, 300);
  };

  const openCalendar = () => {
    Keyboard.dismiss();
    setCalendarVisible(true);
  };

  const handleSave = async () => {
    const coinsNum = parseInt(coins, 10);
    if (!title.trim()) { Alert.alert('Missing!', 'Please enter a chore title!'); return; }
    if (!coinsNum || coinsNum < 1) { Alert.alert('Missing!', 'Please enter coin amount!'); return; }
    if (coinsNum > MAX_COINS) { Alert.alert('Too many coins!', `A chore can be worth at most ${MAX_COINS} coins.`); return; }
    if (!selectedDate) { Alert.alert('Missing!', 'Please set a deadline!'); return; }
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

      const choreData = {
        title: title.trim(),
        coins: coinsNum,
        description,
        choreType,
        repeatable,
        priority,
        deadline: selectedDate,
      };

      if (isEdit && editId) {
        // Update the existing chore (keeps its status, owner and created date)
        await updateDoc(doc(db, 'chores', editId), {
          ...choreData,
          assignedTo: assignTo === 'all' ? 'all' : selectedChildren[0],
          updatedAt: new Date(),
        });

        Alert.alert('Chore Updated! ✅', `"${title.trim()}" has been saved.`, [
          { text: 'OK', onPress: () => router.back() }
        ]);
        return;
      }

      // If assigning to specific children create a chore for each
      if (assignTo === 'specific') {
        for (const childId of selectedChildren) {
          await addDoc(collection(db, 'chores'), {
            ...choreData,
            assignedTo: childId,
            status: 'pending',
            parentId: user.uid,
            createdAt: new Date(),
          });
        }
      } else {
        // Assign to all children
        await addDoc(collection(db, 'chores'), {
          ...choreData,
          assignedTo: 'all',
          status: 'pending',
          parentId: user.uid,
          createdAt: new Date(),
        });
      }

      Alert.alert('Chore Created! 🎉', `"${title.trim()}" has been assigned successfully!`, [
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
    Alert.alert('Delete Chore?', `Are you sure you want to delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await deleteDoc(doc(db, 'chores', editId));
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Set Deadline';
    return parseLocalDate(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const today = toLocalDateString(new Date());

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
          <Pressable style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          {/* Matching ChorePal header */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}><Text style={styles.heroEmoji}>{isEdit ? '✏️' : '📋'}</Text></View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{isEdit ? 'Edit Chore' : 'Create Chore'}</Text>
              <Text style={styles.heroSubtitle}>{isEdit ? 'Update the details of this chore.' : 'Make a new task and reward your child.'}</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Chore Details</Text>
          <View style={styles.formCard}>

          {/* Chore Title */}
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Take out the trash"
            placeholderTextColor="#aaa"
            value={title}
            onChangeText={setTitle}
            autoCapitalize="words"
          />

          {/* Coins */}
          <Text style={styles.label}>Total Coins 🪙</Text>
          <View style={styles.coinsContainer}>
            <Pressable style={styles.coinBtn} onPress={() => changeCoins(-1)}>
              <Text style={styles.coinBtnText}>−</Text>
            </Pressable>
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
            <Pressable style={styles.coinBtn} onPress={() => changeCoins(1)}>
              <Text style={styles.coinBtnText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.hintText}>Maximum {MAX_COINS} coins per chore</Text>

          {/* Description */}
          <View onLayout={(e) => { descriptionY.current = e.nativeEvent.layout.y; }}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe what needs to be done..."
              placeholderTextColor="#aaa"
              value={description}
              onChangeText={setDescription}
              onFocus={scrollToDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          </View>
          <Text style={styles.sectionTitle}>Assignment</Text>
          <View style={styles.formCard}>
          {/* Assign To */}
          <Text style={styles.label}>Assign To</Text>
          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleBtn, assignTo === 'all' && styles.toggleActive]}
              onPress={() => setAssignTo('all')}>
              <Text style={[styles.toggleText, assignTo === 'all' && styles.toggleTextActive]}>
                All Children
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, assignTo === 'specific' && styles.toggleActive]}
              onPress={() => setAssignTo('specific')}>
              <Text style={[styles.toggleText, assignTo === 'specific' && styles.toggleTextActive]}>
                Specific Child
              </Text>
            </Pressable>
          </View>

          {/* Child Selector — now loads real children */}
          {assignTo === 'specific' && (
            <View style={styles.childSelector}>
              {children.length === 0 ? (
                <Text style={styles.noChildrenText}>No children added yet!</Text>
              ) : (
                children.map(child => (
                  <Pressable
                    key={child.id}
                    style={[styles.childChip, selectedChildren.includes(child.id) && styles.childChipSelected]}
                    onPress={() => toggleChild(child.id)}>
                    <Text style={styles.childChipEmoji}>{child.avatar}</Text>
                    <Text style={[styles.childChipText, selectedChildren.includes(child.id) && styles.childChipTextSelected]}>
                      {child.name}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          )}

          </View>
          <Text style={styles.sectionTitle}>Schedule & Priority</Text>
          <View style={styles.formCard}>
          {/* Chore Type */}
          <Text style={styles.label}>Chore Type</Text>
          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleBtn, choreType === 'required' && styles.toggleActive]}
              onPress={() => setChoreType('required')}>
              <Text style={[styles.toggleText, choreType === 'required' && styles.toggleTextActive]}>
                Required
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, choreType === 'optional' && styles.toggleActive]}
              onPress={() => setChoreType('optional')}>
              <Text style={[styles.toggleText, choreType === 'optional' && styles.toggleTextActive]}>
                Optional
              </Text>
            </Pressable>
          </View>
          {choreType === 'optional' && (
            <Text style={styles.hintText}>Optional chores do not have a set schedule</Text>
          )}

          {/* Set Deadline */}
          <Text style={styles.label}>Deadline</Text>
          <Pressable style={styles.deadlineBtn} onPress={openCalendar}>
            <Text style={styles.deadlineBtnText}>📅 {formatDate(selectedDate)}</Text>
            <Text style={styles.deadlineArrow}>›</Text>
          </Pressable>

          {/* Repeatable */}
          <Text style={styles.label}>Task can be done repeatedly</Text>
          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleBtn, !repeatable && styles.toggleActive]}
              onPress={() => setRepeatable(false)}>
              <Text style={[styles.toggleText, !repeatable && styles.toggleTextActive]}>No</Text>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, repeatable && styles.toggleActive]}
              onPress={() => setRepeatable(true)}>
              <Text style={[styles.toggleText, repeatable && styles.toggleTextActive]}>Yes</Text>
            </Pressable>
          </View>

          {/* Priority */}
          <Text style={styles.label}>Set Priority</Text>
          <View style={styles.priorityRow}>
            {(['low', 'medium', 'high'] as const).map((p) => (
              <Pressable
                key={p}
                style={[styles.priorityBtn, priority === p && styles[`priority${p.charAt(0).toUpperCase() + p.slice(1)}Active` as keyof typeof styles]]}
                onPress={() => setPriority(p)}>
                <Text style={[styles.priorityText, priority === p && styles.priorityTextActive]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          </View>
          {/* Save Button */}
          <Pressable
            style={[styles.createBtn, loading && styles.createBtnDisabled]}
            onPress={handleSave}
            disabled={loading}>
            <Text style={styles.createBtnText}>
              {loading
                ? (isEdit ? 'Saving...' : 'Creating...')
                : (isEdit ? 'Save Changes ✅' : 'Create Chore 🎉')}
            </Text>
          </Pressable>

          {/* Delete Button (only when editing an existing chore) */}
          {isEdit && (
            <Pressable style={styles.deleteBtn} onPress={handleDelete} disabled={loading}>
              <Text style={styles.deleteBtnText}>Delete Task</Text>
            </Pressable>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Calendar Modal */}
      <Modal
        visible={calendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}>
        <View style={styles.calendarOverlay}>
          {/* Tapping outside the card closes the calendar */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCalendarVisible(false)} />
          <View style={styles.calendarCard}>
            <Text style={styles.calendarTitle}>Choose Due Date 📅</Text>
            <Calendar
              current={selectedDate || today}
              onDayPress={(day: any) => setSelectedDate(day.dateString)}
              markedDates={selectedDate ? {
                [selectedDate]: {
                  selected: true,
                  selectedColor: '#11847D',
                },
              } : {}}
              minDate={today}
              theme={{
                selectedDayBackgroundColor: '#11847D',
                selectedDayTextColor: '#fff',
                todayTextColor: '#11847D',
                arrowColor: '#11847D',
                dotColor: '#11847D',
                textDayFontWeight: '600',
                textMonthFontWeight: '800',
              }}
            />
            <View style={styles.calendarFooter}>
              <Text style={styles.calendarSelected}>
                {selectedDate ? formatDate(selectedDate) : 'Pick a day'}
              </Text>
              <Pressable
                style={[styles.confirmBtn, !selectedDate && { opacity: 0.4 }]}
                disabled={!selectedDate}
                onPress={() => setCalendarVisible(false)}>
                <Text style={styles.confirmBtnText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1FAF8' },
  inner: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120 },
  back: { paddingVertical: 12, alignSelf: 'flex-start', marginBottom: 8 },
  backText: { fontSize: 15, color: '#127E78', fontWeight: '700' },
  hero: { backgroundColor: '#11847D', borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 26, marginTop: 8, shadowColor: '#0C665F', shadowOffset: {width: 0,height: 6}, shadowOpacity: 0.12, shadowRadius: 12, elevation: 3 },
  heroIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#E4F8F4', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  heroEmoji: { fontSize: 29 },
  heroCopy: { flex: 1 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  heroSubtitle: { fontSize: 12, lineHeight: 18, color: '#E4F8F4', marginTop: 5 },
  sectionTitle: { fontSize: 21, fontWeight: '800', color: '#203532', marginBottom: 12 },
  formCard: { padding: 20, backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#E3F0ED', marginBottom: 25 },
  label: { fontSize: 14, fontWeight: '700', color: '#263A36', marginTop: 10, marginBottom: 9 },
  hintText: { fontSize: 12, color: '#718683', marginTop: -4, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#DCEBE8', borderRadius: 13, padding: 14, fontSize: 16, color: '#263A36', backgroundColor: '#F7FBFA', marginBottom: 16 },
  textArea: { borderWidth: 1, borderColor: '#DCEBE8', borderRadius: 13, padding: 14, fontSize: 16, color: '#263A36', backgroundColor: '#F7FBFA', marginBottom: 16, minHeight: 105, textAlignVertical: 'top' },
  coinsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  coinBtn: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#11847D', alignItems: 'center', justifyContent: 'center' },
  coinBtnText: { fontSize: 23, color: '#FFFFFF', fontWeight: '700' },
  coinsInput: { flex: 1, borderWidth: 1, borderColor: '#DCEBE8', borderRadius: 13, padding: 12, fontSize: 20, fontWeight: '800', color: '#263A36', backgroundColor: '#F7FBFA' },
  toggleRow: { flexDirection: 'row', backgroundColor: '#EFF7F5', borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 },
  toggleBtn: { flex: 1, paddingVertical: 13, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  toggleActive: { backgroundColor: '#11847D' },
  toggleText: { fontSize: 13, fontWeight: '700', color: '#718683', textAlign: 'center' },
  toggleTextActive: { color: '#FFFFFF' },
  childSelector: { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  noChildrenText: { fontSize: 14, color: '#718683' },
  childChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16, backgroundColor: '#F7FBFA', borderWidth: 1.5, borderColor: '#E3F0ED' },
  childChipSelected: { backgroundColor: '#E6F8F5', borderColor: '#11A79B' },
  childChipEmoji: { fontSize: 20 },
  childChipText: { fontSize: 14, fontWeight: '700', color: '#718683' },
  childChipTextSelected: { color: '#126F67' },
  deadlineBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#DCEBE8', borderRadius: 13, padding: 15, backgroundColor: '#F7FBFA', marginBottom: 16 },
  deadlineBtnText: { fontSize: 15, color: '#263A36', fontWeight: '700' },
  deadlineArrow: { fontSize: 22, color: '#11847D' },
  priorityRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  priorityBtn: { flex: 1, paddingVertical: 13, borderRadius: 13, alignItems: 'center', backgroundColor: '#EFF7F5', borderWidth: 1.5, borderColor: 'transparent' },
  priorityLowActive: { backgroundColor: '#E8F5E9', borderColor: '#66BB6A' },
  priorityMediumActive: { backgroundColor: '#FFF8E1', borderColor: '#F4B942' },
  priorityHighActive: { backgroundColor: '#FFEBEE', borderColor: '#E63946' },
  priorityText: { fontSize: 13, fontWeight: '700', color: '#718683' },
  priorityTextActive: { color: '#263A36', fontWeight: '800' },
  createBtn: { backgroundColor: '#11847D', borderRadius: 15, padding: 17, alignItems: 'center', marginBottom: 12 },
  createBtnDisabled: { opacity: 0.45 },
  createBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  deleteBtn: { borderWidth: 1.5, borderColor: '#E65A62', backgroundColor: '#FFF5F5', borderRadius: 15, padding: 16, alignItems: 'center' },
  deleteBtnText: { color: '#D73E4B', fontSize: 16, fontWeight: '800' },
  calendarOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  calendarCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  calendarTitle: { fontSize: 20, fontWeight: '800', color: '#263A36', marginBottom: 12, textAlign: 'center' },
  calendarFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E3F0ED' },
  calendarSelected: { fontSize: 14, fontWeight: '700', color: '#126F67', flex: 1 },
  confirmBtn: { backgroundColor: '#11847D', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  confirmBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
