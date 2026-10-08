import { useFocusEffect, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import PressableScale from '../components/PressableScale';
import { auth, db } from '../config/firebase';

export default function RewardsListScreen() {
  const router = useRouter();
  const [rewards, setRewards] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'available' | 'redeemed'>('all');
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          setLoading(true);
          const user = auth.currentUser;
          if (!user) return;

          // Load children to map IDs to names
          const childrenQuery = query(
            collection(db, 'children'),
            where('parentId', '==', user.uid)
          );
          const childrenSnap = await getDocs(childrenQuery);
          const childrenData = childrenSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setChildren(childrenData);

          // Load rewards
          const rewardsQuery = query(
            collection(db, 'rewards'),
            where('parentId', '==', user.uid)
          );
          const rewardsSnap = await getDocs(rewardsQuery);

          // Load purchases to check redeemed status
          const purchasesQuery = query(
            collection(db, 'purchases'),
            where('parentId', '==', user.uid)
          );
          const purchasesSnap = await getDocs(purchasesQuery);
          const purchasedRewardIds = purchasesSnap.docs.map((d) => d.data().rewardId);

          const rewardsData = rewardsSnap.docs.map((doc) => {
            const data = doc.data();
            // Resolve availableTo name
            let availableToLabel = 'All Children';
            if (data.availableTo !== 'all') {
              const child = childrenData.find((c) => c.id === data.availableTo);
              availableToLabel = child ? child.name : 'Specific Child';
            }
            return {
              id: doc.id,
              ...data,
              redeemed: purchasedRewardIds.includes(doc.id),
              availableToLabel,
            };
          });

          setRewards(rewardsData);
        } catch (error) {
          console.error('Error loading rewards:', error);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }, [])
  );

  const filteredRewards = rewards.filter((r) => {
    if (filter === 'available') return !r.redeemed;
    if (filter === 'redeemed') return r.redeemed;
    return true;
  });

  const totalRewards = rewards.length;
  const availableRewards = rewards.filter((r) => !r.redeemed).length;
  const redeemedRewards = rewards.filter((r) => r.redeemed).length;

  const handleDeleteReward = async (rewardId: string, rewardTitle: string) => {
    try {
      await deleteDoc(doc(db, 'rewards', rewardId));
      setRewards((prev) => prev.filter((r) => r.id !== rewardId));
      Alert.alert('Deleted!', `"${rewardTitle}" has been deleted.`);
    } catch (error: any) {
      Alert.alert('Error!', error.message);
    }
  };

  const handleEditReward = (reward: any) => {
    Alert.alert(
      'Manage Reward',
      `What would you like to do with "${reward.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '✏️ Edit',
          onPress: () =>
            router.push({ pathname: '/create-reward', params: { id: reward.id } }),
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
                  onPress: () => handleDeleteReward(reward.id, reward.title),
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>← Back</Text>
        </PressableScale>
        <Text style={styles.headerTitle}>Rewards</Text>
        <PressableScale
          style={styles.addBtn}
          onPress={() => router.push('/create-reward')}
          accessibilityRole="button"
          accessibilityLabel="Add reward"
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </PressableScale>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={styles.loadingText}>Loading rewards...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{totalRewards}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={[styles.statCard, styles.statCardTeal]}>
              <Text style={[styles.statNumber, { color: '#0F7F76' }]}>
                {availableRewards}
              </Text>
              <Text style={styles.statLabel}>Available</Text>
            </View>
            <View style={[styles.statCard, styles.statCardGold]}>
              <Text style={[styles.statNumber, { color: '#B7791F' }]}>
                {redeemedRewards}
              </Text>
              <Text style={styles.statLabel}>Redeemed</Text>
            </View>
          </View>

          {/* Filter Tabs */}
          <View style={styles.filterRow}>
            {(['all', 'available', 'redeemed'] as const).map((f) => (
              <PressableScale
                key={f}
                style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                onPress={() => setFilter(f)}
              >
                <Text
                  style={[
                    styles.filterText,
                    filter === f && styles.filterTextActive,
                  ]}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </PressableScale>
            ))}
          </View>

          {/* Rewards List */}
          {filteredRewards.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>⭐</Text>
              <Text style={styles.emptyTitle}>No rewards found</Text>
              <Text style={styles.emptySubtitle}>
                Tap “+ Add” to create a new reward.
              </Text>
            </View>
          ) : (
            <View style={styles.rewardsList}>
              {filteredRewards.map((reward) => (
                <PressableScale
                  key={reward.id}
                  style={[
                    styles.rewardCard,
                    reward.redeemed && styles.rewardCardRedeemed,
                  ]}
                  onPress={() => handleEditReward(reward)}
                >
                  {/* Emoji */}
                  <View
                    style={[
                      styles.rewardEmojiBox,
                      reward.redeemed && styles.rewardEmojiBoxRedeemed,
                    ]}
                  >
                    <Text style={styles.rewardEmoji}>{reward.emoji || '🎁'}</Text>
                  </View>

                  {/* Info */}
                  <View style={styles.rewardInfo}>
                    <View style={styles.rewardTop}>
                      <Text style={styles.rewardTitle} numberOfLines={1}>
                        {reward.title}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          reward.redeemed
                            ? styles.statusBadgeRedeemed
                            : styles.statusBadgeAvailable,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            reward.redeemed
                              ? styles.statusTextRedeemed
                              : styles.statusTextAvailable,
                          ]}
                        >
                          {reward.redeemed ? 'Redeemed' : 'Available'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.rewardBottom}>
                      <View style={styles.coinsBadge}>
                        <Text style={styles.coinsText}>
                          🪙 {reward.coinCost ?? 0} coins
                        </Text>
                      </View>
                      <Text style={styles.availableTo} numberOfLines={1}>
                        👥 {reward.availableToLabel}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.editArrow}>›</Text>
                </PressableScale>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Bottom Nav — matches parent dashboard */}
      <View style={styles.bottomNav}>
        <PressableScale
          style={styles.navItem}
          onPress={() => router.push('/chore-list')}
        >
          <Text style={styles.navEmoji}>📋</Text>
          <Text style={styles.navText}>Chores</Text>
        </PressableScale>
        <PressableScale
          style={styles.navItem}
          onPress={() => router.push('/parent-dashboard')}
        >
          <Text style={styles.navEmoji}>👨‍👩‍👧</Text>
          <Text style={styles.navText}>Kids</Text>
        </PressableScale>
        <PressableScale style={[styles.navItem, styles.navActive]}>
          <Text style={styles.navEmoji}>⭐</Text>
          <Text style={[styles.navText, styles.navTextActive]}>Rewards</Text>
        </PressableScale>
        <PressableScale
          style={styles.navItem}
          onPress={() => router.push('/approvals')}
        >
          <Text style={styles.navEmoji}>✅</Text>
          <Text style={styles.navText}>Approvals</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3FBF9',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 8,
  },
  backText: {
    fontSize: 16,
    color: '#0F7F76',
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1F2D2B',
  },
  addBtn: {
    backgroundColor: '#0F7F76',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7C79',
    fontWeight: '600',
  },

  scroll: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 130,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DDF1EE',
  },
  statCardTeal: {
    backgroundColor: '#F0FFFE',
    borderColor: '#4ECDC4',
  },
  statCardGold: {
    backgroundColor: '#FFF4D6',
    borderColor: '#F4B942',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1F2D2B',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7C79',
    marginTop: 2,
  },

  // Filter tabs
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    gap: 4,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: '#0F7F76',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7C79',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },

  // Reward cards
  rewardsList: {
    gap: 12,
  },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    gap: 12,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  rewardCardRedeemed: {
    backgroundColor: '#FFFDF7',
    borderColor: '#F4B942',
  },
  rewardEmojiBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFF4D6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F4B942',
  },
  rewardEmojiBoxRedeemed: {
    backgroundColor: '#F0FFFE',
    borderColor: '#4ECDC4',
  },
  rewardEmoji: {
    fontSize: 28,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2D2B',
    flex: 1,
  },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusBadgeAvailable: {
    backgroundColor: '#E0FFF4',
  },
  statusBadgeRedeemed: {
    backgroundColor: '#FFF3CD',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusTextAvailable: {
    color: '#2A9D8F',
  },
  statusTextRedeemed: {
    color: '#B7791F',
  },
  rewardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  coinsBadge: {
    backgroundColor: '#FFF3CD',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  coinsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B7791F',
  },
  availableTo: {
    fontSize: 12,
    color: '#6B7C79',
    fontWeight: '600',
    flexShrink: 1,
  },
  editArrow: {
    fontSize: 22,
    color: '#C9D6D4',
    fontWeight: '300',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#DDF1EE',
  },
  emptyEmoji: {
    fontSize: 56,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1F2D2B',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7C79',
    textAlign: 'center',
  },

  // Bottom Nav (matches parent dashboard)
  bottomNav: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 26,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: 18,
  },
  navActive: {
    backgroundColor: '#E6F8F6',
  },
  navEmoji: {
    fontSize: 24,
  },
  navText: {
    fontSize: 12,
    color: '#7C8B88',
    fontWeight: '700',
  },
  navTextActive: {
    color: '#0F7F76',
  },
});