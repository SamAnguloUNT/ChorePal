import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import FloatingBackground from '../components/FloatingBackground';
import PressableScale from '../components/PressableScale';
import { db } from '../config/firebase';
import { ChildTheme, useChildTheme } from '../utils/childTheme';

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

// Slides up and fades in, staggered by index. Skips the motion when Reduce Motion is on.
function AnimatedEntry({
  index,
  skip,
  children,
}: {
  index: number;
  skip: boolean;
  children: React.ReactNode;
}) {
  const anim = useRef(new Animated.Value(skip ? 1 : 0)).current;
  useEffect(() => {
    if (skip) {
      anim.setValue(1);
      return;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 80,
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

// An emoji that gently floats up and down.
function FloatingEmoji({ emoji, skip }: { emoji: string; skip: boolean }) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (skip) {
      float.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float, skip]);
  return (
    <Animated.Text
      style={[
        { fontSize: 44 },
        { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] },
      ]}>
      {emoji}
    </Animated.Text>
  );
}

export default function ChildCalendarScreen() {
  const router = useRouter();
  const { theme, themeKey } = useChildTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const today = toLocalDateString(new Date());

  const [childName, setChildName] = useState('');
  const [chores, setChores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

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
    return date < today ? COLORS.overdue : theme.primary;
  };

  const markedDates = useMemo(() => {
    const marked: Record<string, any> = {};
    Object.entries(byDate).forEach(([date, list]) => {
      marked[date] = {
        dots: list.slice(0, 3).map((c, i) => ({ key: `${c.id}-${i}`, color: dotColor(c, date) })),
      };
    });
    marked[selectedDate] = { ...(marked[selectedDate] || {}), selected: true, selectedColor: theme.hero };
    return marked;
  }, [byDate, selectedDate, theme]);

  // Required chores first, then optional ones
  const dayChores = [...(byDate[selectedDate] || [])].sort(
    (a, b) => Number(isChoreOptional(a)) - Number(isChoreOptional(b))
  );
  const doneCount = dayChores.filter(c => c.status === 'approved').length;

  const statusInfo = (c: any) => {
    if (c.status === 'approved') return { label: 'Done ✓', bg: '#E0FFF4', color: '#2A9D8F', stripe: COLORS.approved };
    if (c.status === 'pending') return { label: 'Waiting for approval', bg: '#FFF3CD', color: '#B7791F', stripe: COLORS.pending };
    if (selectedDate < today) return { label: 'Overdue', bg: '#FFE5E5', color: '#E63946', stripe: COLORS.overdue };
    return { label: 'To do', bg: theme.tint, color: theme.primaryDark, stripe: theme.primary };
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Same floating orbs as the dashboard (behind everything) */}
      {!reduceMotion && <FloatingBackground themeKey={themeKey} />}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primaryDark}
            colors={[theme.primaryDark]}
          />
        }>

        <AnimatedEntry index={0} skip={reduceMotion}>
          <View style={styles.header}>
            <Text style={styles.title}>Chore Calendar 📅</Text>
            {!!childName && <Text style={styles.subtitle}>See what is due each day, {childName}!</Text>}
          </View>
        </AnimatedEntry>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Loading your calendar...</Text>
          </View>
        ) : (
          <>
            <AnimatedEntry index={1} skip={reduceMotion}>
              <View style={styles.calendarCard}>
                <Calendar
                  key={themeKey}
                  current={selectedDate}
                  markingType="multi-dot"
                  markedDates={markedDates}
                  onDayPress={(day: any) => setSelectedDate(day.dateString)}
                  enableSwipeMonths
                  theme={{
                    calendarBackground: theme.card,
                    dayTextColor: theme.text,
                    textDisabledColor: theme.border,
                    monthTextColor: theme.text,
                    textSectionTitleColor: theme.muted,
                    selectedDayBackgroundColor: theme.hero,
                    selectedDayTextColor: theme.onHero,
                    todayTextColor: theme.primaryDark,
                    arrowColor: theme.primaryDark,
                    textDayFontWeight: '600',
                    textMonthFontWeight: '800',
                    textDayHeaderFontWeight: '700',
                  }}
                />
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: theme.primary }]} /><Text style={styles.legendText}>To do</Text></View>
                  <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.pending }]} /><Text style={styles.legendText}>Waiting</Text></View>
                  <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.approved }]} /><Text style={styles.legendText}>Done</Text></View>
                  <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.overdue }]} /><Text style={styles.legendText}>Overdue</Text></View>
                </View>
              </View>
            </AnimatedEntry>

            {/* Re-animates every time a new day is picked */}
            <AnimatedEntry key={`title-${selectedDate}`} index={0} skip={reduceMotion}>
              <View style={styles.dayHeaderRow}>
                <View style={styles.dayHeaderText}>
                  <Text style={styles.dayTitle}>
                    {selectedDate === today ? 'Today' : formatLong(selectedDate)}
                  </Text>
                  {selectedDate === today && <Text style={styles.daySub}>{formatLong(selectedDate)}</Text>}
                  {dayChores.length > 0 && (
                    <Text style={styles.summaryText}>
                      {doneCount} of {dayChores.length} done
                    </Text>
                  )}
                </View>
                {selectedDate !== today && (
                  <PressableScale
                    style={styles.todayBtn}
                    onPress={() => setSelectedDate(today)}
                    accessibilityRole="button"
                    accessibilityLabel="Jump to today">
                    <Text style={styles.todayBtnText}>Today</Text>
                  </PressableScale>
                )}
              </View>
            </AnimatedEntry>

            <View style={styles.list}>
              {dayChores.length === 0 ? (
                <AnimatedEntry key={`empty-${selectedDate}`} index={1} skip={reduceMotion}>
                  <View style={styles.emptyBox}>
                    <FloatingEmoji emoji="🎉" skip={reduceMotion} />
                    <Text style={styles.emptyText}>Nothing due on this day</Text>
                  </View>
                </AnimatedEntry>
              ) : (
                dayChores.map((chore, index) => {
                  const info = statusInfo(chore);
                  const pr = PRIORITY_LABEL[String(chore.priority ?? '').toLowerCase()];
                  return (
                    <AnimatedEntry key={`${selectedDate}-${chore.id}`} index={index + 1} skip={reduceMotion}>
                      <View style={styles.choreCard}>
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
                    </AnimatedEntry>
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
        <PressableScale style={styles.navItem} onPress={() => router.replace('/child-dashboard')}>
          <Text style={styles.navEmoji}>📋</Text>
          <Text style={styles.navText}>Chores</Text>
        </PressableScale>
        <PressableScale style={[styles.navItem, styles.navActive]}>
          <Text style={styles.navEmoji}>📅</Text>
          <Text style={[styles.navText, styles.navTextActive]}>Calendar</Text>
        </PressableScale>
        <PressableScale style={styles.navItem} onPress={() => router.replace('/child-rewards')}>
          <Text style={styles.navEmoji}>⭐</Text>
          <Text style={styles.navText}>Rewards</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (t: ChildTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 130 },
  header: { marginBottom: 14 },
  title: { fontSize: 26, fontWeight: '900', color: t.text },
  subtitle: { fontSize: 14, fontWeight: '600', color: t.muted, marginTop: 2 },
  loadingBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 14, color: t.muted, fontWeight: '600' },
  calendarCard: {
    backgroundColor: t.card,
    borderRadius: 24,
    padding: 8,
    borderWidth: 1.5,
    borderColor: t.border,
    marginBottom: 18,
    overflow: 'hidden',
    shadowColor: t.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: t.divider,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, fontWeight: '600', color: t.muted },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  dayHeaderText: { flex: 1 },
  dayTitle: { fontSize: 22, fontWeight: '900', color: t.text },
  daySub: { fontSize: 13, color: t.muted, fontWeight: '600', marginTop: 2 },
  summaryText: { fontSize: 13, color: t.primaryDark, fontWeight: '800', marginTop: 4 },
  todayBtn: {
    backgroundColor: t.tint,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#BFE8E3',
  },
  todayBtnText: { fontSize: 13, fontWeight: '800', color: t.primaryDark },
  list: { gap: 12, marginTop: 12 },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 6,
    backgroundColor: t.card,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: t.border,
  },
  emptyEmoji: { fontSize: 44 },
  emptyText: { fontSize: 16, fontWeight: '800', color: t.text },
  choreCard: {
    flexDirection: 'row',
    backgroundColor: t.card,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: t.border,
    shadowColor: t.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  stripe: { width: 8 },
  choreBody: { flex: 1, padding: 14 },
  choreTitle: { fontSize: 17, fontWeight: '800', color: t.text },
  choreTitleDone: { textDecorationLine: 'line-through', color: t.muted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: '700' },
  hint: { fontSize: 13, color: t.muted, textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
  bottomNav: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    gap: 12,
    backgroundColor: t.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 26,
    shadowColor: t.primaryDark,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: 18 },
  navActive: { backgroundColor: t.tint },
  navEmoji: { fontSize: 24 },
  navText: { fontSize: 12, color: t.muted, fontWeight: '700' },
  navTextActive: { color: t.primaryDark },
});