import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    SafeAreaView, ScrollView,
    StyleSheet,
    Text, TouchableOpacity,
    View
} from 'react-native';

const MOCK_CHORES = [
  {
    childId: '1',
    childName: 'Sarah',
    childAvatar: '🐶',
    chores: [
      { id: '1', title: 'Make your bed', coins: 5, priority: 'low', status: 'pending', repeatable: true, deadline: 'Today' },
      { id: '2', title: 'Wash the dishes', coins: 8, priority: 'medium', status: 'approved', repeatable: true, deadline: 'Today' },
      { id: '3', title: 'Clean your room', coins: 12, priority: 'high', status: 'submitted', repeatable: false, deadline: 'Tomorrow' },
    ]
  },
  {
    childId: '2',
    childName: 'Jacob',
    childAvatar: '🐱',
    chores: [
      { id: '4', title: 'Take out trash', coins: 10, priority: 'high', status: 'pending', repeatable: true, deadline: 'Today' },
      { id: '5', title: 'Vacuum living room', coins: 15, priority: 'medium', status: 'rejected', repeatable: false, deadline: 'Friday' },
    ]
  }
];

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
  const [expandedChild, setExpandedChild] = useState<string | null>('1');

  const handleEditChore = (chore: any, childName: string) => {
    Alert.alert(
      `Edit Chore`,
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
          onPress: () => Alert.alert('Deleted!', `"${chore.title}" has been deleted.`)
        }
      ]
    );
  };

  const totalChores = MOCK_CHORES.reduce((sum, child) => sum + child.chores.length, 0);
  const approvedChores = MOCK_CHORES.reduce((sum, child) =>
    sum + child.chores.filter(c => c.status === 'approved').length, 0);
  const pendingChores = MOCK_CHORES.reduce((sum, child) =>
    sum + child.chores.filter(c => c.status === 'submitted').length, 0);

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
            <Text style={[styles.statNumber, { color: '#4ECDC4' }]}>{pendingChores}</Text>
            <Text style={styles.statLabel}>Pending Review</Text>
          </View>
        </View>

        {/* Chores Grouped by Child */}
        {MOCK_CHORES.map((child) => (
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
                {child.chores.map((chore) => {
                  const status = STATUS_CONFIG[chore.status];
                  const priority = PRIORITY_CONFIG[chore.priority];
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
                })}

                {/* Add Chore for this child */}
                <TouchableOpacity
                  style={styles.addChoreBtn}
                  onPress={() => router.push('/create-chore')}>
                  <Text style={styles.addChoreBtnText}>+ Add Chore for {child.childName}</Text>
                </TouchableOpacity>

              </View>
            )}

          </View>
        ))}

      </ScrollView>

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
          onPress={() => router.push('/create-reward')}>
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

  // Header
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

  // Scroll
  scroll: { padding: 24, paddingBottom: 100 },

  // Stats
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

  // Child Section
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

  // Chores List
  choresList: { padding: 12, gap: 10, backgroundColor: '#fff' },
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

  // Add Chore Button
  addChoreBtn: {
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  addChoreBtnText: { color: '#4ECDC4', fontWeight: '700', fontSize: 14 },

  // Bottom Nav
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