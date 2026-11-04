import { useFocusEffect, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView, ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import PressableScale from '../components/PressableScale';
import { auth, db } from '../config/firebase';
import { clearChoreHistory, deleteChoreEverywhere, deleteChoreGroup, deleteOverdueChores, migrateLegacyAllChores } from '../utils/choreModel';
import { describeRepeat, isDueOn, isPastDue, isRecurring, statusFor, todayStr } from '../utils/choreSchedule';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  // todo = nothing submitted yet. submitted = a photo is waiting for the parent to review.
  todo: { label: 'To do', color: '#6B7C79', bg: '#EEF2F1' },
  submitted: { label: 'Waiting for review', color: '#B7791F', bg: '#FFF8E1' },
  approved: { label: 'Approved', color: '#66BB6A', bg: '#E8F5E9' },
  rejected: { label: 'Rejected', color: '#E63946', bg: '#FFEBEE' },
  overdue: { label: 'Overdue', color: '#FFFFFF', bg: '#E63946' },
  // recurring chore that isn't scheduled today
  off: { label: 'Not today', color: '#6B7C79', bg: '#F4F7F6' },
};

const PRIORITY_CONFIG: Record<string, { color: string }> = {
  low: { color: '#66BB6A' },
  medium: { color: '#F4B942' },
  high: { color: '#E63946' },
};

// Deadlines are saved as "YYYY-MM-DD". Show them as a local date (not shifted a day by time zones).
const formatDeadline = (deadline?: string) => {
  if (!deadline || deadline === 'No deadline') return 'No deadline';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deadline);
  if (!m) return deadline;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function ChoreListScreen() {
  const router = useRouter();
  // Every child starts open. Tap a child's header to collapse or reopen their chores.
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [childrenWithChores, setChildrenWithChores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const user = auth.currentUser;
          if (!user) return;

          // Load all children for this parent
          const childrenQuery = query(
            collection(db, 'children'),
            where('parentId', '==', user.uid)
          );
          const childrenSnap = await getDocs(childrenQuery);
          const children: any[] = childrenSnap.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            }))
            .filter((c: any) => c.isDeleted !== true);

          // Old shared "all children" chores become one chore per child
          try {
            await migrateLegacyAllChores(user.uid, children);
          } catch (e) {
            console.log('Chore migration skipped:', e);
          }

          // Load all chores for this parent
          const choresQuery = query(
            collection(db, 'chores'),
            where('parentId', '==', user.uid)
          );
          const choresSnap = await getDocs(choresQuery);
          const allChores: any[] = choresSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // Load submissions to get chore statuses
          const submissionsQuery = query(
            collection(db, 'submissions'),
            where('parentId', '==', user.uid)
          );
          const submissionsSnap = await getDocs(submissionsQuery);
          const submissions: any[] = submissionsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // Group chores by child
          const grouped = children.map(child => {
            // Only this child's own chores
            const childChores = allChores.filter(chore => chore.assignedTo === child.id);

            // Status from this child's submissions. Recurring chores: today's only.
            const today = todayStr();
            const childSubs = submissions.filter(s => s.childId === child.id);
            const choresWithStatus = childChores.map(chore => {
              let status: string = statusFor(chore, childSubs, today);
              if (isRecurring(chore) && status === 'todo' && !isDueOn(chore, today)) status = 'off';
              if (isPastDue(chore, today) && (status === 'todo' || status === 'rejected')) status = 'overdue';
              return {
                ...chore,
                status,
                deadline: chore.deadline || 'No deadline',
              };
            });

            return {
              childId: child.id,
              childName: child.name,
              childAvatar: child.avatar,
              chores: choresWithStatus,
            };
          });

          setChildrenWithChores(grouped);
        } catch (error) {
          console.error('Error loading chores:', error);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }, [reloadKey])
  );

  const removeLocally = (ids: string[]) =>
    setChildrenWithChores(prev => prev.map(child => ({
      ...child,
      chores: child.chores.filter((c: any) => !ids.includes(c.id))
    })));

  const handleDeleteChore = async (chore: any, scope: 'one' | 'group') => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      if (scope === 'group' && chore.groupId) {
        const ids = childrenWithChores.flatMap(c => c.chores).filter((c: any) => c.groupId === chore.groupId).map((c: any) => c.id);
        await deleteChoreGroup(chore.groupId, user.uid);
        removeLocally(ids);
      } else {
        await deleteChoreEverywhere(chore.id, user.uid);
        removeLocally([chore.id]);
      }
      Alert.alert('Deleted!', `"${chore.title}" has been deleted.`);
    } catch (error: any) {
      Alert.alert('Error!', error.message);
    }
  };

  const handleEditChore = (chore: any, childName: string) => {
    const groupCount = chore.groupId
      ? childrenWithChores.flatMap(c => c.chores).filter((c: any) => c.groupId === chore.groupId).length
      : 1;
    const askDelete = () => {
      if (groupCount > 1) {
        // Android shows at most 3 buttons, so the delete choice gets its own prompt
        Alert.alert('Delete chore', `"${chore.title}" was given to ${groupCount} children.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: `Only ${childName}`, style: 'destructive', onPress: () => handleDeleteChore(chore, 'one') },
          { text: 'All children', style: 'destructive', onPress: () => handleDeleteChore(chore, 'group') },
        ]);
      } else {
        handleDeleteChore(chore, 'one');
      }
    };
    Alert.alert('Edit Chore', `What would you like to do with "${chore.title}" for ${childName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: '✏️ Edit',
        onPress: () => router.push({ pathname: '/create-chore', params: { id: chore.id } })
      },
      { text: '🗑️ Delete', style: 'destructive', onPress: askDelete },
    ]);
  };

  const handleDeleteOverdue = () => {
    Alert.alert(
      'Delete overdue chores?',
      `This permanently deletes ${overdueCount} one-time chore${overdueCount === 1 ? '' : 's'} whose day has passed without being done. Recurring chores are never deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete overdue',
          style: 'destructive',
          onPress: async () => {
            const user = auth.currentUser;
            if (!user) return;
            try {
              const n = await deleteOverdueChores(user.uid);
              setReloadKey(k => k + 1);
              Alert.alert('Done', n === 0 ? 'There were no overdue chores.' : `Deleted ${n} overdue chore${n === 1 ? '' : 's'}.`);
            } catch (error: any) {
              Alert.alert('Error!', error.message);
            }
          },
        },
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Delete chore history?',
      'This permanently deletes chores that were already approved, along with their photos and records. Chores still to do or waiting for review are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete history',
          style: 'destructive',
          onPress: async () => {
            const user = auth.currentUser;
            if (!user) return;
            try {
              const n = await clearChoreHistory(user.uid);
              setReloadKey(k => k + 1);
              Alert.alert('Done', n === 0 ? 'There was no history to delete.' : `Deleted ${n} finished chore${n === 1 ? '' : 's'}.`);
            } catch (error: any) {
              Alert.alert('Error!', error.message);
            }
          },
        },
      ]
    );
  };

  const totalChores = childrenWithChores.reduce((sum, child) => sum + child.chores.length, 0);
  const approvedChores = childrenWithChores.reduce((sum, child) =>
    sum + child.chores.filter((c: any) => c.status === 'approved').length, 0);
  const pendingReview = childrenWithChores.reduce((sum, child) =>
    sum + child.chores.filter((c: any) => c.status === 'submitted').length, 0);
  const overdueCount = childrenWithChores.reduce((sum, child) =>
    sum + child.chores.filter((c: any) => c.status === 'overdue').length, 0);

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <PressableScale style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backText}>← Back</Text>
        </PressableScale>
        <Text style={styles.headerTitle}>Chore List</Text>
        <PressableScale
          style={styles.addBtn}
          onPress={() => router.push('/create-chore')}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </PressableScale>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={styles.loadingText}>Loading chores...</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{totalChores}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={[styles.statCard, styles.statCardGreen]}>
              <Text style={[styles.statNumber, { color: '#66BB6A' }]}>{approvedChores}</Text>
              <Text style={styles.statLabel}>Approved</Text>
            </View>
            <View style={[styles.statCard, styles.statCardTeal]}>
              <Text style={[styles.statNumber, { color: '#4ECDC4' }]}>{pendingReview}</Text>
              <Text style={styles.statLabel}>Pending Review</Text>
            </View>
          </View>

          {/* Empty State */}
          {childrenWithChores.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>No chores yet!</Text>
              <Text style={styles.emptySubtitle}>Tap "+ Add" to create your first chore.</Text>
            </View>
          ) : (
            childrenWithChores.map((child) => (
              <View key={child.childId} style={styles.childSection}>

                {/* Child Header */}
                <PressableScale
                  style={styles.childHeader}
                  accessibilityRole="button"
                  accessibilityLabel={`Toggle chores for ${child.childName}`}
                  onPress={() => setCollapsed(prev =>
                    prev.includes(child.childId)
                      ? prev.filter(id => id !== child.childId)
                      : [...prev, child.childId]
                  )}>
                  <View style={styles.childLeft}>
                    <View style={styles.childAvatarCircle}>
                      <Text style={styles.childAvatarEmoji}>{child.childAvatar || '👧'}</Text>
                    </View>
                    <View>
                      <Text style={styles.childName}>{child.childName}</Text>
                      <Text style={styles.childChoreCount}>{child.chores.length} {child.chores.length === 1 ? 'chore' : 'chores'}</Text>
                    </View>
                  </View>
                  <Text style={styles.expandArrow}>
                    {collapsed.includes(child.childId) ? '›' : '▼'}
                  </Text>
                </PressableScale>

                {/* Chores List */}
                {!collapsed.includes(child.childId) && (
                  <View style={styles.choresList}>
                    {child.chores.length === 0 ? (
                      <Text style={styles.noChoresText}>No chores assigned yet!</Text>
                    ) : (
                      child.chores.map((chore: any) => {
                        const status = STATUS_CONFIG[chore.status] || STATUS_CONFIG['todo'];
                        const priority = PRIORITY_CONFIG[chore.priority] || PRIORITY_CONFIG['medium'];
                        return (
                          <PressableScale
                            key={chore.id}
                            style={styles.choreCard}
                             accessibilityRole="button"
                             accessibilityLabel={`Manage ${chore.title}`}
                            onPress={() => handleEditChore(chore, child.childName)}>

                            {/* Priority Bar */}
                            <View style={[styles.priorityBar, { backgroundColor: priority.color }]} />

                            <View style={styles.choreContent}>
                              <View style={styles.choreTop}>
                                <Text style={styles.choreTitle}>{chore.title}</Text>
                                <View style={[styles.statusBadge, { backgroundColor: status.bg, borderColor: status.color }]}>
                                  <Text style={[styles.statusText, { color: status.color }]}>
                                    {status.label}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.choreBottom}>
                                <Text style={styles.choreCoins}>🪙 {chore.coins} coins</Text>
                                {isRecurring(chore) ? (
                                  <Text style={styles.choreRepeatable}>🔄 {describeRepeat(chore)}</Text>
                                ) : (
                                  <Text style={[styles.choreDeadline, chore.status === 'overdue' && { color: '#E63946' }]}>
                                    📅 {formatDeadline(chore.deadline)}
                                  </Text>
                                )}
                              </View>
                            </View>

                            <Text style={styles.editArrow}>›</Text>

                          </PressableScale>
                        );
                      })
                    )}

                    {/* Add Chore Button */}
                    <PressableScale
                      style={styles.addChoreBtn}
                      onPress={() => router.push('/create-chore')}>
                      <Text style={styles.addChoreBtnText}>+ Add Chore for {child.childName}</Text>
                    </PressableScale>
                  </View>
                )}

              </View>
            ))
          )}

          {/* Plain Pressable on purpose: PressableScale wraps its content in a view that
              grows (flexGrow: 1), which inside a ScrollView can swallow the space below it. */}
          {overdueCount > 0 && (
            <Pressable
              style={styles.clearHistoryBtn}
              onPress={handleDeleteOverdue}
              accessibilityRole="button"
              accessibilityLabel="Delete overdue chores">
              <Text style={styles.clearHistoryText}>⏰ Delete {overdueCount} overdue chore{overdueCount === 1 ? '' : 's'}</Text>
            </Pressable>
          )}

          {approvedChores > 0 && (
            <Pressable
              style={styles.clearHistoryBtn}
              onPress={handleClearHistory}
              accessibilityRole="button"
              accessibilityLabel="Delete chore history">
              <Text style={styles.clearHistoryText}>🗑️ Delete finished chores</Text>
            </Pressable>
          )}

        </ScrollView>
      )}

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <View style={[styles.navItem, styles.navActive]}>
          <Text style={styles.navEmoji}>📋</Text>
          <Text style={[styles.navText, styles.navTextActive]}>Chores</Text>
        </View>
        <PressableScale
          style={styles.navItem}
          onPress={() => router.push('/parent-dashboard')}>
          <Text style={styles.navEmoji}>👨‍👩‍👧</Text>
          <Text style={styles.navText}>Kids</Text>
        </PressableScale>
        <PressableScale
          style={styles.navItem}
          onPress={() => router.push('/rewards-list')}>
          <Text style={styles.navEmoji}>⭐</Text>
          <Text style={styles.navText}>Rewards</Text>
        </PressableScale>
        <PressableScale
          style={styles.navItem}
          onPress={() => router.push('/approvals')}>
          <Text style={styles.navEmoji}>✅</Text>
          <Text style={styles.navText}>Approvals</Text>
        </PressableScale>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3FBF9' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14,
  },
  backBtn: { paddingVertical: 6, paddingRight: 8 },
  backText: { fontSize: 16, color: '#0F7F76', fontWeight: '700' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1F2D2B' },
  addBtn: {
    backgroundColor: '#0F7F76', borderRadius: 14, paddingHorizontal: 14,
    paddingVertical: 9, shadowColor: '#0F7F76', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#6B7C79', fontWeight: '600' },
  scroll: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 130 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  statCard: {
    flex: 1, minHeight: 84, backgroundColor: '#FFFFFF', borderRadius: 20,
    paddingVertical: 14, paddingHorizontal: 4, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1.5, borderColor: '#DDF1EE',
  },
  statCardGreen: { backgroundColor: '#E8F5E9', borderColor: '#66BB6A' },
  statCardTeal: { backgroundColor: '#F0FFFE', borderColor: '#4ECDC4' },
  statNumber: { fontSize: 24, fontWeight: '900', color: '#1F2D2B' },
  statLabel: {
    fontSize: 12, color: '#6B7C79', fontWeight: '600', textAlign: 'center', marginTop: 2,
  },
  emptyState: {
    alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1.5, borderColor: '#DDF1EE',
  },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#1F2D2B' },
  emptySubtitle: { fontSize: 14, color: '#6B7C79', textAlign: 'center' },
  childSection: {
    marginBottom: 16, borderRadius: 22, borderWidth: 1.5, borderColor: '#DDF1EE',
    backgroundColor: '#FFFFFF',
  },
  childHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#E6F8F6', borderRadius: 20,
  },
  childLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  childAvatarCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#4ECDC4',
    alignItems: 'center', justifyContent: 'center',
  },
  childAvatarEmoji: { fontSize: 26 },
  childName: { fontSize: 17, fontWeight: '800', color: '#1F2D2B' },
  childChoreCount: { fontSize: 12, color: '#6B7C79', marginTop: 2 },
  expandArrow: { fontSize: 20, color: '#0F7F76', fontWeight: '700' },
  choresList: { padding: 12, gap: 12, backgroundColor: '#FFFFFF' },
  noChoresText: {
    fontSize: 14, color: '#6B7C79', textAlign: 'center', padding: 12, fontStyle: 'italic',
  },
  choreCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: '#E3F1EE',
  },
  priorityBar: { width: 5, alignSelf: 'stretch' },
  choreContent: { flex: 1, padding: 12 },
  choreTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8, gap: 6,
  },
  choreTitle: { fontSize: 15, fontWeight: '800', color: '#1F2D2B', flex: 1 },
  statusBadge: {
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '800' },
  choreBottom: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  choreCoins: { fontSize: 12, color: '#B7791F', fontWeight: '700' },
  choreDeadline: { fontSize: 12, color: '#6B7C79', fontWeight: '600' },
  choreRepeatable: { fontSize: 12, color: '#0F7F76', fontWeight: '700' },
  editArrow: { fontSize: 22, color: '#C9D6D4', paddingHorizontal: 10 },
  addChoreBtn: {
    borderWidth: 1.5, borderColor: '#4ECDC4', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center',
    borderStyle: 'dashed', backgroundColor: '#F0FFFE',
  },
  clearHistoryBtn: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16, marginTop: 4 },
  clearHistoryText: { color: '#E63946', fontWeight: '700', fontSize: 13 },
  addChoreBtnText: { color: '#0F7F76', fontWeight: '800', fontSize: 14 },
  bottomNav: {
    flexDirection: 'row', position: 'absolute', bottom: 0, left: 0, right: 0,
    gap: 8, backgroundColor: '#FFFFFF', borderTopLeftRadius: 26,
    borderTopRightRadius: 26, paddingTop: 12, paddingHorizontal: 16,
    paddingBottom: 26, shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1,
    shadowRadius: 12, elevation: 10,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 8, borderRadius: 18 },
  navActive: { backgroundColor: '#E6F8F6' },
  navEmoji: { fontSize: 22 },
  navText: { fontSize: 11, color: '#6B7C79', fontWeight: '700' },
  navTextActive: { color: '#0F7F76', fontWeight: '800' },
});