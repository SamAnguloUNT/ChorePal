import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { db } from '../config/firebase';

// Deadlines are saved by the parent app as "YYYY-MM-DD" strings (local dates).
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const toLocalDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseLocalDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatLong = (s: string) =>
  parseLocalDate(s).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const isChoreOptional = (chore: any) =>
  chore?.optional === true ||
  chore?.isOptional === true ||
  chore?.required === false ||
  String(chore?.type ?? '').toLowerCase() === 'optional' ||
  String(chore?.choreType ?? '').toLowerCase() === 'optional';

const PRIORITY_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  high: { label: '🔴 High', bg: '#FFE5E5', color: '#E63946' },
  medium: { label: '🟡 Medium', bg: '#FFF3CD', color: '#B7791F' },
  low: { label: '🟢 Low', bg: '#E0FFF4', color: '#2A9D8F' },
};

type ChoreStatus = 'approved' | 'pending' | 'todo';

const COLORS = {
  todo: '#4ECDC4',
  pending: '#F4B942',
  approved: '#66BB6A',
  overdue: '#E63946',
};

export default function ChildCalendarScreen() {
  const router = useRouter();
  const today = toLocalDateString(new Date());

  const [childName, setChildName] = useState('');
  const [chores, setChores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(today);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          setLoading(true);
          const session = await AsyncStorage.getItem('childSession');
          if (!session) { setChores([]); return; }
          const child = JSON.parse(session);
          setChildName(child.name || '');
          if (!child.parentId) { setChores([]); return; }

          // Same query the dashboard uses: this child's chores plus the "all children" ones
          const choresSnap = await getDocs(query(
            collection(db, 'chores'),
            where('parentId', '==', child.parentId),
            where('assignedTo', 'in', ['all', child.id])
          ));

          const approvedSnap = await getDocs(query(
            collection(db, 'submissions'),
            where('childId', '==', child.id),
            where('status', '==', 'approved')
          ));
          const pendingSnap = await getDocs(query(
            collection(db, 'submissions'),
            where('childId', '==', child.id),
            where('status', '==', 'pending')
          ));
          const approvedIds = approvedSnap.docs.map(d => d.data().choreId);
          const pendingIds = pendingSnap.docs.map(d => d.data().choreId);

          setChores(choresSnap.docs.map(d => {
            const data: any = d.data();
            const status: ChoreStatus = approvedIds.includes(d.id)
              ? 'approved'
              : pendingIds.includes(d.id)
                ? 'pending'
                : 'todo';
            return { id: d.id, ...data, status };
          }));
        } catch (error) {
          console.error('Error loading calendar:', error);
        } finally {
          setLoading(false);
        }
      };
      load();
    }, [])
  );

  // Group chores by the day they are due (chores with no valid deadline can't go on a calendar)
  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    chores.forEach(c => {
      if (typeof c.deadline === 'string' && DATE_RE.test(c.deadline)) {
        (map[c.deadline] = map[c.deadline] || []).push(c);
      }
    });
    return map;
  }, [chores]);

  const dotColor = (c: any, date: string) => {
    if (c.status === 'approved') return COLORS.approved;
    if (c.status === 'pending') return COLORS.pending;
    return date < today ? COLORS.overdue : COLORS.todo;
  };

  const markedDates = useMemo(() => {
    const marked: Record<string, any> = {};
    Object.entries(byDate).forEach(([date, list]) => {
      marked[date] = {
        dots: list.slice(0, 3).map((c, i) => ({ key: `${c.id}-${i}`, color: dotColor(c, date) })),
      };
    });
    marked[selectedDate] = { ...(marked[selectedDate] || {}), selected: true, selectedColor: '#0F7F76' };
    return marked;
  }, [byDate, selectedDate]);

  // Required chores first, then optional ones
  const dayChores = [...(byDate[selectedDate] || [])].sort(
    (a, b) => Number(isChoreOptional(a)) - Number(isChoreOptional(b))
  );

  const statusInfo = (c: any) => {
    if (c.status === 'approved') return { label: 'Done ✓', bg: '#E0FFF4', color: '#2A9D8F', stripe: COLORS.approved };
    if (c.status === 'pending') return { label: 'Waiting for approval', bg: '#FFF3CD', color: '#B7791F', stripe: COLORS.pending };
    if (selectedDate < today) return { label: 'Overdue', bg: '#FFE5E5', color: '#E63946', stripe: COLORS.overdue };
    return { label: 'To do', bg: '#E6F8F6', color: '#0F7F76', stripe: COLORS.todo };
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.title}>Chore Calendar 📅</Text>
          {!!childName && <Text style={styles.subtitle}>See what is due each day, {childName}!</Text>}
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#4ECDC4" />
            <Text style={styles.loadingText}>Loading your calendar...</Text>
          </View>
        ) : (
          <>
            <View style={styles.calendarCard}>
              <Calendar
                current={selectedDate}
                markingType="multi-dot"
                markedDates={markedDates}
                onDayPress={(day: any) => setSelectedDate(day.dateString)}
                enableSwipeMonths
                theme={{
                  selectedDayBackgroundColor: '#0F7F76',
                  selectedDayTextColor: '#fff',
                  todayTextColor: '#0F7F76',
                  arrowColor: '#0F7F76',
                  textDayFontWeight: '600',
                  textMonthFontWeight: '800',
                  textDayHeaderFontWeight: '700',
                }}
              />
              <View style={styles.legendRow}>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.todo }]} /><Text style={styles.legendText}>To do</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.pending }]} /><Text style={styles.legendText}>Waiting</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.approved }]} /><Text style={styles.legendText}>Done</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.overdue }]} /><Text style={styles.legendText}>Overdue</Text></View>
              </View>
            </View>

            <Text style={styles.dayTitle}>
              {selectedDate === today ? 'Today' : formatLong(selectedDate)}
            </Text>
            {selectedDate === today && <Text style={styles.daySub}>{formatLong(selectedDate)}</Text>}

            <View style={styles.list}>
              {dayChores.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyEmoji}>🎉</Text>
                  <Text style={styles.emptyText}>Nothing due on this day</Text>
                </View>
              ) : (
                dayChores.map(chore => {
                  const info = statusInfo(chore);
                  const pr = PRIORITY_LABEL[String(chore.priority ?? '').toLowerCase()];
                  return (
                    <View key={chore.id} style={styles.choreCard}>
                      <View style={[styles.stripe, { backgroundColor: info.stripe }]} />
                      <View style={styles.choreBody}>
                        <Text style={[styles.choreTitle, chore.status === 'approved' && styles.choreTitleDone]} numberOfLines={2}>
                          {chore.title}
                        </Text>
                        <View style={styles.chipRow}>
                          <View style={[styles.chip, { backgroundColor: '#FFF3CD' }]}>
                            <Text style={[styles.chipText, { color: '#B7791F' }]}>🪙 {chore.coins ?? 0}</Text>
                          </View>
                          {pr && (
                            <View style={[styles.chip, { backgroundColor: pr.bg }]}>
                              <Text style={[styles.chipText, { color: pr.color }]}>{pr.label}</Text>
                            </View>
                          )}
                          {isChoreOptional(chore) && (
                            <View style={[styles.chip, { backgroundColor: '#EFEAFF' }]}>
                              <Text style={[styles.chipText, { color: '#7B61FF' }]}>Optional</Text>
                            </View>
                          )}
                          <View style={[styles.chip, { backgroundColor: info.bg }]}>
                            <Text style={[styles.chipText, { color: info.color }]}>{info.label}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {selectedDate === today && dayChores.length > 0 && (
              <Text style={styles.hint}>Go to the Chores tab to turn in today's chores.</Text>
            )}
          </>
        )}

      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/child-dashboard')}>
          <Text style={styles.navEmoji}>📋</Text>
          <Text style={styles.navText}>Chores</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navItem, styles.navActive]}>
          <Text style={styles.navEmoji}>📅</Text>
          <Text style={[styles.navText, styles.navTextActive]}>Calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/child-rewards')}>
          <Text style={styles.navEmoji}>⭐</Text>
          <Text style={styles.navText}>Rewards</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3FBF9' },
  scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 130 },
  header: { marginBottom: 14 },
  title: { fontSize: 26, fontWeight: '900', color: '#1F2D2B' },
  subtitle: { fontSize: 14, fontWeight: '600', color: '#6B7C79', marginTop: 2 },
  loadingBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 14, color: '#6B7C79', fontWeight: '600' },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 8,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    marginBottom: 18,
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF5F4',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, fontWeight: '600', color: '#6B7C79' },
  dayTitle: { fontSize: 22, fontWeight: '900', color: '#1F2D2B' },
  daySub: { fontSize: 13, color: '#6B7C79', fontWeight: '600', marginTop: 2 },
  list: { gap: 12, marginTop: 12 },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#DDF1EE',
  },
  emptyEmoji: { fontSize: 44 },
  emptyText: { fontSize: 16, fontWeight: '800', color: '#1F2D2B' },
  choreCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
  },
  stripe: { width: 8 },
  choreBody: { flex: 1, padding: 14 },
  choreTitle: { fontSize: 17, fontWeight: '800', color: '#1F2D2B' },
  choreTitleDone: { textDecorationLine: 'line-through', color: '#8A9996' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: '700' },
  hint: { fontSize: 13, color: '#6B7C79', textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
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
});
