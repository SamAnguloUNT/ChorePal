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
  { id: '1', emoji: '🧸', title: 'New Toys', coinCost: 30 },
  { id: '2', emoji: '💰', title: '5 Dollars', coinCost: 30 },
  { id: '3', emoji: '🍦', title: 'Ice Cream', coinCost: 50 },
  { id: '4', emoji: '🍫', title: 'Candy Store', coinCost: 40 },
  { id: '5', emoji: '🎬', title: 'Movie Theaters', coinCost: 60 },
  { id: '6', emoji: '🎮', title: 'PlayStation 5', coinCost: 600 },
];

export default function ChildRewardsScreen() {
  const router = useRouter();
  const [coinBalance, setCoinBalance] = useState(110);
  const [purchasedRewards, setPurchasedRewards] = useState<string[]>([]);

  const handleBuyReward = (reward: any) => {
    if (purchasedRewards.includes(reward.id)) {
      Alert.alert('Already Purchased!', `You already bought "${reward.title}"!`);
      return;
    }
    if (coinBalance < reward.coinCost) {
      Alert.alert(
        'Not Enough Coins! 🪙',
        `You need ${reward.coinCost - coinBalance} more coins to buy "${reward.title}". Keep completing chores!`,
        [{ text: 'OK' }]
      );
      return;
    }
    Alert.alert(
      'Buy Reward? 🎁',
      `Are you sure you want to buy "${reward.title}" for ${reward.coinCost} coins?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy it! 🎉',
          onPress: () => {
            setCoinBalance(prev => prev - reward.coinCost);
            setPurchasedRewards(prev => [...prev, reward.id]);
            Alert.alert(
              'Reward Purchased! 🎉',
              `You bought "${reward.title}"! Your parent has been notified.`,
              [{ text: 'Awesome!' }]
            );
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.profileSection}>
            <View style={styles.profileCircle}>
              <Text style={styles.profileEmoji}>👧</Text>
            </View>
            <View>
              <Text style={styles.childName}>Sarah ⭐</Text>
              <Text style={styles.childLabel}>CHILD'S LOGIN</Text>
            </View>
          </View>
          <View style={styles.coinsBadge}>
            <Text style={styles.coinsEmoji}>🪙</Text>
            <View>
              <Text style={styles.coinsAmount}>{coinBalance}</Text>
              <Text style={styles.coinsLabel}>TOTAL COINS</Text>
            </View>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.pageTitle}>Rewards Store 🏆</Text>
        <Text style={styles.pageSubtitle}>Spend your coins on awesome rewards!</Text>

        {/* Rewards List */}
        <View style={styles.rewardsList}>
          {MOCK_REWARDS.map((reward) => {
            const canAfford = coinBalance >= reward.coinCost;
            const isPurchased = purchasedRewards.includes(reward.id);
            return (
              <View
                key={reward.id}
                style={[
                  styles.rewardCard,
                  isPurchased && styles.rewardCardPurchased,
                  !canAfford && !isPurchased && styles.rewardCardCantAfford,
                ]}>

                {/* Emoji */}
                <View style={[styles.rewardEmojiBox, isPurchased && styles.rewardEmojiBoxPurchased]}>
                  <Text style={styles.rewardEmoji}>{reward.emoji}</Text>
                </View>

                {/* Info */}
                <View style={styles.rewardInfo}>
                  <Text style={styles.rewardTitle}>{reward.title}</Text>
                  <View style={styles.rewardCoinsRow}>
                    <Text style={styles.rewardCoinsText}>🪙 {reward.coinCost}</Text>
                    {!canAfford && !isPurchased && (
                      <Text style={styles.needMoreText}>
                        Need {reward.coinCost - coinBalance} more
                      </Text>
                    )}
                  </View>
                </View>

                {/* Buy Button */}
                <TouchableOpacity
                  style={[
                    styles.buyBtn,
                    isPurchased && styles.buyBtnPurchased,
                    !canAfford && !isPurchased && styles.buyBtnCantAfford,
                  ]}
                  onPress={() => handleBuyReward(reward)}>
                  <Text style={[
                    styles.buyBtnText,
                    isPurchased && styles.buyBtnTextPurchased,
                    !canAfford && !isPurchased && styles.buyBtnTextCantAfford,
                  ]}>
                    {isPurchased ? '✓ Bought' : 'BUY'}
                  </Text>
                </TouchableOpacity>

              </View>
            );
          })}
        </View>

      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.replace('/child-dashboard')}>
          <Text style={styles.navEmoji}>📋</Text>
          <Text style={styles.navText}>Chores</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navItem, styles.navActive]}>
          <Text style={styles.navEmoji}>⭐</Text>
          <Text style={[styles.navText, styles.navTextActive]}>Rewards</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#F0FFFE',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
  },
  profileSection: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileEmoji: { fontSize: 28 },
  childName: { fontSize: 18, fontWeight: '800', color: '#2D2D2D' },
  childLabel: { fontSize: 10, color: '#888', fontWeight: '600' },
  coinsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4B942',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  coinsEmoji: { fontSize: 20 },
  coinsAmount: { fontSize: 18, fontWeight: '800', color: '#fff' },
  coinsLabel: { fontSize: 9, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },

  // Title
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#2D2D2D', marginBottom: 4 },
  pageSubtitle: { fontSize: 14, color: '#888', marginBottom: 20 },

  // Rewards List
  rewardsList: { gap: 14 },
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
  rewardCardPurchased: {
    backgroundColor: '#F0FFF4',
    borderColor: '#4ECDC4',
  },
  rewardCardCantAfford: {
    opacity: 0.6,
  },

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
  rewardEmojiBoxPurchased: {
    backgroundColor: '#E0FFF4',
    borderColor: '#4ECDC4',
  },
  rewardEmoji: { fontSize: 28 },

  // Info
  rewardInfo: { flex: 1 },
  rewardTitle: { fontSize: 15, fontWeight: '700', color: '#2D2D2D', marginBottom: 4 },
  rewardCoinsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rewardCoinsText: { fontSize: 13, fontWeight: '700', color: '#F4B942' },
  needMoreText: { fontSize: 11, color: '#E63946', fontWeight: '600' },

  // Buy Button
  buyBtn: {
    backgroundColor: '#F4B942',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 70,
  },
  buyBtnPurchased: {
    backgroundColor: '#4ECDC4',
  },
  buyBtnCantAfford: {
    backgroundColor: '#EEE',
  },
  buyBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  buyBtnTextPurchased: { color: '#fff' },
  buyBtnTextCantAfford: { color: '#999' },

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