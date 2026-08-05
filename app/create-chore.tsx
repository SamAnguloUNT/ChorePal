import { useRouter } from 'expo-router';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
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
import { Calendar } from 'react-native-calendars';
import { auth, db } from '../config/firebase';

export default function CreateChoreScreen() {
  const router = useRouter();

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

  const toggleChild = (id: string) => {
    setSelectedChildren(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!title) { Alert.alert('Missing!', 'Please enter a chore title!'); return; }
    if (!coins) { Alert.alert('Missing!', 'Please enter coin amount!'); return; }
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

      // If assigning to specific children create a chore for each
      if (assignTo === 'specific') {
        for (const childId of selectedChildren) {
          await addDoc(collection(db, 'chores'), {
            title,
            coins: parseInt(coins),
            description,
            choreType,
            repeatable,
            priority,
            assignedTo: childId,
            deadline: selectedDate,
            status: 'pending',
            parentId: user.uid,
            createdAt: new Date(),
          });
        }
      } else {
        // Assign to all children
        await addDoc(collection(db, 'chores'), {
          title,
          coins: parseInt(coins),
          description,
          choreType,
          repeatable,
          priority,
          assignedTo: 'all',
          deadline: selectedDate,
          status: 'pending',
          parentId: user.uid,
          createdAt: new Date(),
        });
      }

      Alert.alert('Chore Created! 🎉', `"${title}" has been assigned successfully!`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Error!', error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Set Deadline';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const today = new Date().toISOString().split('T')[0];

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
            <Text style={styles.pageTitle}>Create Chore 📋</Text>

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
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe what needs to be done..."
              placeholderTextColor="#aaa"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Assign To */}
            <Text style={styles.label}>Assign To</Text>
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

            {/* Child Selector — now loads real children */}
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

            {/* Chore Type */}
            <Text style={styles.label}>Chore Type</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, choreType === 'required' && styles.toggleActive]}
                onPress={() => setChoreType('required')}>
                <Text style={[styles.toggleText, choreType === 'required' && styles.toggleTextActive]}>
                  Required
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, choreType === 'optional' && styles.toggleActive]}
                onPress={() => setChoreType('optional')}>
                <Text style={[styles.toggleText, choreType === 'optional' && styles.toggleTextActive]}>
                  Optional
                </Text>
              </TouchableOpacity>
            </View>
            {choreType === 'optional' && (
              <Text style={styles.hintText}>Optional chores do not have a set schedule</Text>
            )}

            {/* Set Deadline */}
            <Text style={styles.label}>Deadline</Text>
            <TouchableOpacity
              style={styles.deadlineBtn}
              onPress={() => setCalendarVisible(true)}>
              <Text style={styles.deadlineBtnText}>📅 {formatDate(selectedDate)}</Text>
              <Text style={styles.deadlineArrow}>›</Text>
            </TouchableOpacity>

            {/* Repeatable */}
            <Text style={styles.label}>Task can be done repeatedly</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, !repeatable && styles.toggleActive]}
                onPress={() => setRepeatable(false)}>
                <Text style={[styles.toggleText, !repeatable && styles.toggleTextActive]}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, repeatable && styles.toggleActive]}
                onPress={() => setRepeatable(true)}>
                <Text style={[styles.toggleText, repeatable && styles.toggleTextActive]}>Yes</Text>
              </TouchableOpacity>
            </View>

            {/* Priority */}
            <Text style={styles.label}>Set Priority</Text>
            <View style={styles.priorityRow}>
              {(['low', 'medium', 'high'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityBtn, priority === p && styles[`priority${p.charAt(0).toUpperCase() + p.slice(1)}Active` as keyof typeof styles]]}
                  onPress={() => setPriority(p)}>
                  <Text style={[styles.priorityText, priority === p && styles.priorityTextActive]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Create Button */}
            <TouchableOpacity
              style={[styles.createBtn, loading && styles.createBtnDisabled]}
              onPress={handleCreate}
              disabled={loading}>
              <Text style={styles.createBtnText}>
                {loading ? 'Creating...' : 'Create Chore 🎉'}
              </Text>
            </TouchableOpacity>

            {/* Delete Button */}
            <TouchableOpacity style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>Delete Task</Text>
            </TouchableOpacity>

          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Calendar Modal */}
      <Modal
        visible={calendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setCalendarVisible(false)}>
          <View style={styles.calendarOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.calendarCard}>
                <Text style={styles.calendarTitle}>Choose Due Date 📅</Text>
                <Calendar
                  onDayPress={(day: any) => setSelectedDate(day.dateString)}
                  markedDates={{
                    [selectedDate]: {
                      selected: true,
                      selectedColor: '#4ECDC4',
                    },
                  }}
                  minDate={today}
                  theme={{
                    selectedDayBackgroundColor: '#4ECDC4',
                    selectedDayTextColor: '#fff',
                    todayTextColor: '#4ECDC4',
                    arrowColor: '#4ECDC4',
                    dotColor: '#4ECDC4',
                    textDayFontWeight: '600',
                    textMonthFontWeight: '800',
                  }}
                />
                {selectedDate ? (
                  <View style={styles.calendarFooter}>
                    <Text style={styles.calendarSelected}>{formatDate(selectedDate)}</Text>
                    <TouchableOpacity
                      style={styles.confirmBtn}
                      onPress={() => setCalendarVisible(false)}>
                      <Text style={styles.confirmBtnText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
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
  hintText: { fontSize: 12, color: '#aaa', marginTop: -4, marginBottom: 12, fontStyle: 'italic' },
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
  deadlineBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#F9F9F9',
    marginBottom: 20,
  },
  deadlineBtnText: { fontSize: 15, color: '#333', fontWeight: '600' },
  deadlineArrow: { fontSize: 22, color: '#CCC' },
  priorityRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  priorityBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  priorityLowActive: { backgroundColor: '#E8F5E9', borderColor: '#66BB6A' },
  priorityMediumActive: { backgroundColor: '#FFF8E1', borderColor: '#F4B942' },
  priorityHighActive: { backgroundColor: '#FFEBEE', borderColor: '#E63946' },
  priorityText: { fontSize: 14, fontWeight: '600', color: '#888' },
  priorityTextActive: { color: '#2D2D2D', fontWeight: '700' },
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
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  calendarTitle: { fontSize: 20, fontWeight: '800', color: '#2D2D2D', marginBottom: 12, textAlign: 'center' },
  calendarFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  calendarSelected: { fontSize: 15, fontWeight: '600', color: '#4ECDC4' },
  confirmBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});