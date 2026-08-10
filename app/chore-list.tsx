import { useFocusEffect, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView, ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View
} from 'react-native';
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
          const children = childrenSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // Load all chores for this parent
          const choresQuery = query(
            collection(db, 'chores'),
            where('parentId', '==', user.uid)
          );
          const choresSnap = await getDocs(choresQuery);
          const allChores = choresSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // Load submissions to get chore statuses
          const submissionsQuery = query(
            collection(db, 'submissions'),
            where('parentId', '==', user.uid)
          );
          const submissionsSnap = await getDocs(submissionsQuery);
          const submissions = submissionsSnap.docs.map(doc => ({
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
            setExpandedChild(grouped[0].childId);
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
      `What would you like to do with "${chore.title}" for ${childName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '✏️ Edit',
          onPress: () => router.push('/create-chore')
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
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chore List</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/create-chore')}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
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
                <TouchableOpacity
                  style={styles.childHeader}
                  onPress={() => setExpandedChild(
                    expandedChild === child.childId ? null : child.childId
                  )}>
                  <View style={styles.childLeft}>
                    <View style={styles.childAvatarCircle}>
                      <Text style={styles.childAvatarEmoji}>{child.childAvatar}</Text>
                    </View>
                    <View>
                      <Text style={styles.childName}>{child.childName}</Text>
                      <Text style={styles.childChoreCount}>{child.chores.length} chores</Text>
                    </View>
                  </View>
                  <Text style={styles.expandArrow}>
                    {expandedChild === child.childId ? '▼' : '›'}
                  </Text>
                </TouchableOpacity>

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
                          <TouchableOpacity
                            key={chore.id}
                            style={styles.choreCard}
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
                                <Text style={styles.choreDeadline}>📅 {chore.deadline}</Text>
                                {chore.repeatable && (
                                  <Text style={styles.choreRepeatable}>🔄 Recurring</Text>
                                )}
                              </View>
                            </View>

                            <Text style={styles.editArrow}>›</Text>

                          </TouchableOpacity>
                        );
                      })
                    )}

                    {/* Add Chore Button */}
                    <TouchableOpacity
                      style={styles.addChoreBtn}
                      onPress={() => router.push('/create-chore')}>
                      <Text style={styles.addChoreBtnText}>+ Add Chore for {child.childName}</Text>
                    </TouchableOpacity>
                  </View>
                )}

              </View>
            ))
          )}

        </ScrollView>
      )}

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={[styles.navItem, styles.navActive]}>
          <Text style={styles.navEmoji}>📋</Text>
          <Text style={[styles.navText, styles.navTextActive]}>Chores</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/parent-dashboard')}>
          <Text style={styles.navEmoji}>👨‍👩‍👧</Text>
          <Text style={styles.navText}>Kids</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/rewards-list')}>
          <Text style={styles.navEmoji}>⭐</Text>
          <Text style={styles.navText}>Rewards</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/approvals')}>
          <Text style={styles.navEmoji}>✅</Text>
          <Text style={styles.navText}>Approvals</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backText: { fontSize: 16, color: '#4ECDC4', fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#2D2D2D' },
  addBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#888', fontWeight: '600' },
  scroll: { padding: 24, paddingBottom: 100 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  statCardGreen: { backgroundColor: '#E8F5E9', borderColor: '#66BB6A' },
  statCardTeal: { backgroundColor: '#F0FFFE', borderColor: '#4ECDC4' },
  statNumber: { fontSize: 24, fontWeight: '800', color: '#2D2D2D' },
  statLabel: { fontSize: 11, color: '#888', fontWeight: '600', textAlign: 'center', marginTop: 2 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#2D2D2D' },
  emptySubtitle: { fontSize: 15, color: '#888' },
  childSection: {
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EEE',
    overflow: 'hidden',
  },
  childHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F0FFFE',
  },
  childLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  childAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  childAvatarEmoji: { fontSize: 24 },
  childName: { fontSize: 16, fontWeight: '800', color: '#2D2D2D' },
  childChoreCount: { fontSize: 12, color: '#888', marginTop: 2 },
  expandArrow: { fontSize: 20, color: '#4ECDC4', fontWeight: '700' },
  choresList: { padding: 12, gap: 10, backgroundColor: '#fff' },
  noChoresText: { fontSize: 14, color: '#888', textAlign: 'center', padding: 12, fontStyle: 'italic' },
  choreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  priorityBar: { width: 5, alignSelf: 'stretch' },
  choreContent: { flex: 1, padding: 12 },
  choreTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  choreTitle: { fontSize: 14, fontWeight: '700', color: '#2D2D2D', flex: 1, marginRight: 8 },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  choreBottom: { flexDirection: 'row', gap: 12 },
  choreCoins: { fontSize: 12, color: '#888', fontWeight: '600' },
  choreDeadline: { fontSize: 12, color: '#888', fontWeight: '600' },
  choreRepeatable: { fontSize: 12, color: '#4ECDC4', fontWeight: '600' },
  editArrow: { fontSize: 20, color: '#CCC', paddingHorizontal: 12 },
  addChoreBtn: {
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  addChoreBtnText: { color: '#4ECDC4', fontWeight: '700', fontSize: 14 },
  bottomNav: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingVertical: 10,
    paddingBottom: 24,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 2 },
  navActive: {},
  navEmoji: { fontSize: 22 },
  navText: { fontSize: 11, color: '#888', fontWeight: '600' },
  navTextActive: { color: '#4ECDC4' },
});