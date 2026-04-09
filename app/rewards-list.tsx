import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    SafeAreaView, ScrollView,
    StyleSheet,
    Text, TouchableOpacity,
    View
} from 'react-native';

const MOCK_REWARDS = [
  { id: '1', emoji: '📚', title: 'New Books', coinCost: 20, availableTo: 'All Children', redeemed: false },
  { id: '2', emoji: '🖥️', title: '1 Hour Screen Time', coinCost: 30, availableTo: 'All Children', redeemed: true },
  { id: '3', emoji: '🍦', title: 'Ice Cream', coinCost: 50, availableTo: 'Sarah', redeemed: false },
  { id: '4', emoji: '🍫', title: 'Candy Store', coinCost: 40, availableTo: 'Sarah', redeemed: false },
  { id: '5', emoji: '🎮', title: 'Extra Game Time', coinCost: 40, availableTo: 'Jacob', redeemed: false },
  { id: '6', emoji: '🎬', title: 'Movie Theaters', coinCost: 60, availableTo: 'All Children', redeemed: true },
  { id: '7', emoji: '🎮', title: 'PlayStation 5', coinCost: 600, availableTo: 'All Children', redeemed: false },
];

export default function RewardsListScreen() {
  const router = useRouter();
  const [rewards, setRewards] = useState(MOCK_REWARDS);
  const [filter, setFilter] = useState<'all' | 'available' | 'redeemed'>('all');

  const filteredRewards = rewards.filter(r => {
    if (filter === 'available') return !r.redeemed;
    if (filter === 'redeemed') return r.redeemed;
    return true;
  });

  const totalRewards = rewards.length;
  const availableRewards = rewards.filter(r => !r.redeemed).length;
  const redeemedRewards = rewards.filter(r => r.redeemed).length;

  const handleEditReward = (reward: any) => {
    Alert.alert(
      'Manage Reward',
      `What would you like to do with "${reward.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '✏️ Edit',
          onPress: () => router.push('/create-reward')
        },
        {
          text: '🗑️ Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Reward?',
              `Are you sure you want to delete "${reward.title}"?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    setRewards(prev => prev.filter(r => r.id !== reward.id));
                    Alert.alert('Deleted!', `"${reward.title}" has been deleted.`);
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rewards</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/create-reward')}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalRewards}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, styles.statCardTeal]}>
            <Text style={[styles.statNumber, { color: '#4ECDC4' }]}>{availableRewards}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
          <View style={[styles.statCard, styles.statCardGold]}>
            <Text style={[styles.statNumber, { color: '#F4B942' }]}>{redeemedRewards}</Text>
            <Text style={styles.statLabel}>Redeemed</Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {(['all', 'available', 'redeemed'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}>
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Rewards List */}
        {filteredRewards.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>⭐</Text>
            <Text style={styles.emptyTitle}>No rewards found!</Text>
            <Text style={styles.emptySubtitle}>Tap "+ Add" to create a new reward.</Text>
          </View>
        ) : (
          <View style={styles.rewardsList}>
            {filteredRewards.map((reward) => (
              <TouchableOpacity
                key={reward.id}
                style={[styles.rewardCard, reward.redeemed && styles.rewardCardRedeemed]}
                onPress={() => handleEditReward(reward)}>

                {/* Emoji */}
                <View style={[styles.rewardEmojiBox, reward.redeemed && styles.rewardEmojiBoxRedeemed]}>
                  <Text style={styles.rewardEmoji}>{reward.emoji}</Text>
                </View>

                {/* Info */}
                <View style={styles.rewardInfo}>
                  <View style={styles.rewardTop}>
                    <Text style={styles.rewardTitle}>{reward.title}</Text>
                    <View style={[
                      styles.statusBadge,
                      reward.redeemed ? styles.statusBadgeRedeemed : styles.statusBadgeAvailable
                    ]}>
                      <Text style={[
                        styles.statusText,
                        reward.redeemed ? styles.statusTextRedeemed : styles.statusTextAvailable
                      ]}>
                        {reward.redeemed ? 'Redeemed' : 'Available'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rewardBottom}>
                    <View style={styles.coinsBadge}>
                      <Text style={styles.coinsText}>🪙 {reward.coinCost} coins</Text>
                    </View>
                    <Text style={styles.availableTo}>👥 {reward.availableTo}</Text>
                  </View>
                </View>

                <Text style={styles.editArrow}>›</Text>

              </TouchableOpacity>
            ))}
          </View>
        )}

      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/chore-list')}>
          <Text style={styles.navEmoji}>📋</Text>
          <Text style={styles.navText}>Chores</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/parent-dashboard')}>
          <Text style={styles.navEmoji}>👨‍👩‍👧</Text>
          <Text style={styles.navText}>Kids</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navItem, styles.navActive]}>
          <Text style={styles.navEmoji}>⭐</Text>
          <Text style={[styles.navText, styles.navTextActive]}>Rewards</Text>
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
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  statCardTeal: { backgroundColor: '#F0FFFE', borderColor: '#4ECDC4' },
  statCardGold: { backgroundColor: '#FFF8E1', borderColor: '#F4B942' },
  statNumber: { fontSize: 24, fontWeight: '800', color: '#2D2D2D' },
  statLabel: { fontSize: 11, color: '#888', fontWeight: '600', textAlign: 'center', marginTop: 2 },

  // Filter
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  filterBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  filterBtnActive: { backgroundColor: '#4ECDC4' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#888' },
  filterTextActive: { color: '#fff' },

  // Rewards List
  rewardsList: { gap: 12 },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#EEE',
    gap: 12,
  },
  rewardCardRedeemed: { backgroundColor: '#FFFDF7', borderColor: '#F4B942' },

  // Emoji Box
  rewardEmojiBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FFF8E1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F4B942',
  },
  rewardEmojiBoxRedeemed: { backgroundColor: '#F0FFFE', borderColor: '#4ECDC4' },
  rewardEmoji: { fontSize: 28 },

  // Info
  rewardInfo: { flex: 1 },
  rewardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rewardTitle: { fontSize: 15, fontWeight: '700', color: '#2D2D2D', flex: 1, marginRight: 8 },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  statusBadgeAvailable: { backgroundColor: '#F0FFFE', borderColor: '#4ECDC4' },
  statusBadgeRedeemed: { backgroundColor: '#FFF8E1', borderColor: '#F4B942' },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusTextAvailable: { color: '#4ECDC4' },
  statusTextRedeemed: { color: '#F4B942' },
  rewardBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coinsBadge: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  coinsText: { fontSize: 12, fontWeight: '700', color: '#F4B942' },
  availableTo: { fontSize: 12, color: '#888', fontWeight: '600' },
  editArrow: { fontSize: 20, color: '#CCC' },

  // Empty State
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#2D2D2D' },
  emptySubtitle: { fontSize: 15, color: '#888' },

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