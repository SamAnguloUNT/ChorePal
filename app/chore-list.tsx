import { useFocusEffect, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView, ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import PressableScale from '../components/PressableScale';
import { auth, db } from '../config/firebase';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#F4B942', bg: '#FFF8E1' },
  submitted: { label: 'Submitted', color: '#4ECDC4', bg: '#F0FFFE' },
  approved: { label: 'Approved', color: '#66BB6A', bg: '#E8F5E9' },
  rejected: { label: 'Rejected', color: '#E63946', bg: '#FFEBEE' },
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
  const [expandedChild, setExpandedChild] = useState<string | null>(null);
  const [childrenWithChores, setChildrenWithChores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          setLoading(true);
          const user = auth.currentUser;
          if (!user) return;

          // Load all children for this parent
          const childrenQuery = query(
            collection(db, 'children'),
            where('parentId', '==', user.uid)
          );
          const childrenSnap = await getDocs(childrenQuery);
          const children: any[] = childrenSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

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
            // Get chores assigned to this child or all children
            const childChores = allChores.filter(chore =>
              chore.assignedTo === 'all' || chore.assignedTo === child.id
            );

            // Map chore status from submissions
            const choresWithStatus = childChores.map(chore => {
              const submission = submissions.find(
                s => s.choreId === chore.id && s.childId === child.id
              );
              return {
                ...chore,
                status: submission?.status || 'pending',
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
          // Auto expand first child
          if (grouped.length > 0) {
            setExpandedChild(prev => prev ?? grouped[0].childId);
          }
        } catch (error) {
          console.error('Error loading chores:', error);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }, [])
  );

  const handleDeleteChore = async (choreId: string, choreTitle: string, childName: string) => {
    try {
      await deleteDoc(doc(db, 'chores', choreId));
      // Update local state
      setChildrenWithChores(prev => prev.map(child => ({
        ...child,
        chores: child.chores.filter((c: any) => c.id !== choreId)
      })));
      Alert.alert('Deleted!', `"${choreTitle}" has been deleted.`);
    } catch (error: any) {
      Alert.alert('Error!', error.message);
    }
  };

  const handleEditChore = (chore: any, childName: string) => {
    Alert.alert(
      'Edit Chore',
      chore.assignedTo === 'all'
        ? `What would you like to do with "${chore.title}"? It is assigned to all children.`
        : `What would you like to do with "${chore.title}" for ${childName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '✏️ Edit',
          onPress: () => router.push({ pathname: '/create-chore', params: { id: chore.id } })
        },
        {
          text: '🗑️ Delete',
          style: 'destructive',
          onPress: () => handleDeleteChore(chore.id, chore.title, childName)
        }
      ]
    );
  };

  const totalChores = childrenWithChores.reduce((sum, child) => sum + child.chores.length, 0);
  const approvedChores = childrenWithChores.reduce((sum, child) =>
    sum + child.chores.filter((c: any) => c.status === 'approved').length, 0);
  const pendingReview = childrenWithChores.reduce((sum, child) =>
    sum + child.chores.filter((c: any) => c.status === 'submitted').length, 0);

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
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

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
                  onPress={() => setExpandedChild(
                    expandedChild === child.childId ? null : child.childId
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
                    {expandedChild === child.childId ? '▼' : '›'}
                  </Text>
                </PressableScale>

                {/* Chores List */}
                {expandedChild === child.childId && (
                  <View style={styles.choresList}>
                    {child.chores.length === 0 ? (
                      <Text style={styles.noChoresText}>No chores assigned yet!</Text>
                    ) : (
                      child.chores.map((chore: any) => {
                        const status = STATUS_CONFIG[chore.status] || STATUS_CONFIG['pending'];
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
                                <Text style={styles.choreDeadline}>📅 {formatDeadline(chore.deadline)}</Text>
                                {chore.repeatable && (
                                  <Text style={styles.choreRepeatable}>🔄 Recurring</Text>
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
    backgroundColor: '#FFFFFF', overflow: 'hidden', shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10,
    elevation: 2,
  },
  childHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#E6F8F6',
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
