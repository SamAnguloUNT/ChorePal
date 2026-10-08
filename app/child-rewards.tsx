import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView, ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import TextToSpeech from '../components/TextToSpeech';
import { db } from '../config/firebase';

export default function ChildRewardsScreen() {
  const router = useRouter();
  const [childData, setChildData] = useState<any>(null);
  const [rewards, setRewards] = useState<any[]>([]);
  const [coinBalance, setCoinBalance] = useState(0);
  const [purchasedRewards, setPurchasedRewards] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Reward popup state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [confirming, setConfirming] = useState(false);
  const [buying, setBuying] = useState(false);
  const [justBought, setJustBought] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load child session
        const session = await AsyncStorage.getItem('childSession');
        if (session) {
          const child = JSON.parse(session);
          setChildData(child);
          setCoinBalance(child.coinBalance || 0);

          // FIX: Without a parentId we can't tell which family this child belongs to,
          // and querying with `undefined` would throw. Show no rewards instead of
          // risking rewards from other families.
          if (!child.parentId) {
            console.log('Child session is missing parentId — cannot load rewards.');
            setRewards([]);
            return;
          }

          // FIX: Scope rewards to this child's parent. Previously, 'all' matched every
          // parent's "all children" rewards in the whole database.
          // NOTE: This query needs a composite index on parentId + availableTo.
          // Firestore will log a link to create it the first time this runs.
          const rewardsQuery = query(
            collection(db, 'rewards'),
            where('parentId', '==', child.parentId),
            where('availableTo', 'in', ['all', child.id])
          );
          const rewardsSnap = await getDocs(rewardsQuery);
          const rewardsData = rewardsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setRewards(rewardsData);

          // Load already purchased rewards
          const purchasedQuery = query(
            collection(db, 'purchases'),
            where('childId', '==', child.id)
          );
          const purchasedSnap = await getDocs(purchasedQuery);
          const purchasedIds = purchasedSnap.docs.map(doc => doc.data().rewardId);
          setPurchasedRewards(purchasedIds);
        }
      } catch (error) {
        console.error('Error loading rewards:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('childSession');
          router.replace('/');
        }
      }
    ]);
  };

  const openReward = (reward: any) => {
    setSelectedReward(reward);
    setConfirming(false);
    setBuying(false);
    setJustBought(false);
    setErrorText('');
    setModalVisible(true);
  };

  const closeReward = () => {
    if (buying) return;
    setModalVisible(false);
    setConfirming(false);
    setJustBought(false);
    setErrorText('');
  };

  // Same purchase logic as before, now run from inside the popup so we don't
  // have to show an Alert on top of a Modal (which is unreliable on iOS).
  const purchaseReward = async (reward: any) => {
    const cost = Number(reward.coinCost ?? 0);
    try {
      setBuying(true);
      setErrorText('');
      const newBalance = coinBalance - cost;

      // Update coin balance in Firestore
      await updateDoc(doc(db, 'children', childData.id), {
        coinBalance: newBalance,
      });

      // Save purchase to Firestore
      await addDoc(collection(db, 'purchases'), {
        childId: childData.id,
        rewardId: reward.id,
        rewardTitle: reward.title,
        coinCost: cost,
        parentId: childData.parentId,
        purchasedAt: new Date(),
        fulfilled: false,
      });

      // Update AsyncStorage with new balance
      const updatedChild = { ...childData, coinBalance: newBalance };
      await AsyncStorage.setItem('childSession', JSON.stringify(updatedChild));

      // Update local state
      setChildData(updatedChild);
      setCoinBalance(newBalance);
      setPurchasedRewards(prev => [...prev, reward.id]);
      setConfirming(false);
      setJustBought(true);
    } catch (error: any) {
      setConfirming(false);
      setErrorText(error?.message || 'Something went wrong. Please try again.');
    } finally {
      setBuying(false);
    }
  };

  const canBuyCount = rewards.filter(
    r => !purchasedRewards.includes(r.id) && coinBalance >= Number(r.coinCost ?? 0)
  ).length;
  const boughtCount = rewards.filter(r => purchasedRewards.includes(r.id)).length;

  // Popup values for the selected reward
  const selCost = Number(selectedReward?.coinCost ?? 0);
  const selPurchased = !!selectedReward && purchasedRewards.includes(selectedReward.id);
  const selCanAfford = coinBalance >= selCost;
  const selDescription = selectedReward?.description || 'No description yet.';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero: greeting, log out, and coin balance */}
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.profileSection}>
              <View style={styles.profileCircle}>
                <Text style={styles.profileEmoji}>{childData?.avatar || '👧'}</Text>
              </View>
              <View style={styles.heroNameBlock}>
                <Text style={styles.heroGreeting} numberOfLines={1}>
                  Hi, {childData?.name || 'there'}!
                </Text>
                <Text style={styles.heroSub}>Spend your coins on awesome rewards!</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Log out">
              <Text style={styles.logoutBtnEmoji}>🚪</Text>
              <Text style={styles.logoutBtnText}>Log out</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroCoinRow}>
            <Text style={styles.heroCoinEmoji}>🪙</Text>
            <View>
              <Text style={styles.heroCoinAmount}>{coinBalance}</Text>
              <Text style={styles.heroCoinLabel}>coins to spend</Text>
            </View>
          </View>
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statEmoji}>🛍️</Text>
            <Text style={styles.statValue}>{canBuyCount}</Text>
            <Text style={styles.statLabel}>You can buy</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statEmoji}>🎁</Text>
            <Text style={styles.statValue}>{boughtCount}</Text>
            <Text style={styles.statLabel}>Bought</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Rewards store</Text>

        {/* Loading or Empty State */}
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#4ECDC4" />
            <Text style={styles.emptyText}>Loading rewards...</Text>
          </View>
        ) : rewards.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>⭐</Text>
            <Text style={styles.emptyText}>No rewards yet</Text>
            <Text style={styles.emptySubtext}>Ask your parent to add some rewards.</Text>
          </View>
        ) : (
          <View style={styles.rewardsList}>
            {rewards.map((reward) => {
              const cost = Number(reward.coinCost ?? 0);
              const canAfford = coinBalance >= cost;
              const isPurchased = purchasedRewards.includes(reward.id);
              const stripeColor = isPurchased ? '#4ECDC4' : canAfford ? '#F4B942' : '#C9D6D4';
              return (
                <TouchableOpacity
                  key={reward.id}
                  activeOpacity={0.85}
                  onPress={() => openReward(reward)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open reward: ${reward.title}`}
                  style={[styles.rewardCard, isPurchased && styles.rewardCardPurchased]}>
                  <View style={[styles.stripe, { backgroundColor: stripeColor }]} />
                  <View style={styles.rewardBody}>
                    <View style={[styles.rewardEmojiBox, isPurchased && styles.rewardEmojiBoxPurchased]}>
                      <Text style={styles.rewardEmoji}>{reward.emoji || '🎁'}</Text>
                    </View>

                    <View style={styles.rewardInfo}>
                      <Text style={styles.rewardTitle} numberOfLines={2}>{reward.title}</Text>
                      <View style={styles.chipRow}>
                        <View style={[styles.chip, { backgroundColor: '#FFF3CD' }]}>
                          <Text style={[styles.chipText, { color: '#B7791F' }]}>🪙 {cost}</Text>
                        </View>
                        {isPurchased && (
                          <View style={[styles.chip, { backgroundColor: '#E0FFF4' }]}>
                            <Text style={[styles.chipText, { color: '#2A9D8F' }]}>Bought</Text>
                          </View>
                        )}
                        {!canAfford && !isPurchased && (
                          <View style={[styles.chip, { backgroundColor: '#FFE5E5' }]}>
                            <Text style={[styles.chipText, { color: '#E63946' }]}>
                              Need {cost - coinBalance} more
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Text-to-speech: read the reward aloud */}
                    <TextToSpeech
                      text={`${reward.title}. It costs ${cost} coins.`}
                      size={24}
                    />

                    {/* Visual hint only: the whole card is tappable. */}
                    <View style={[
                      styles.pill,
                      isPurchased && styles.pillBought,
                      !canAfford && !isPurchased && styles.pillLocked,
                    ]}>
                      <Text style={[
                        styles.pillText,
                        isPurchased && styles.pillTextBought,
                        !canAfford && !isPurchased && styles.pillTextLocked,
                      ]}>
                        {isPurchased ? '✓' : canAfford ? 'Buy' : '🔒'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.replace('/child-dashboard')}>
          <Text style={styles.navEmoji}>📋</Text>
          <Text style={styles.navText}>Chores</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.replace('/child-calendar')}>
          <Text style={styles.navEmoji}>📅</Text>
          <Text style={styles.navText}>Calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navItem, styles.navActive]}>
          <Text style={styles.navEmoji}>⭐</Text>
          <Text style={[styles.navText, styles.navTextActive]}>Rewards</Text>
        </TouchableOpacity>
      </View>

      {/* Reward popup */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeReward}>
        <TouchableWithoutFeedback onPress={closeReward}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                {!buying && (
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={closeReward}
                    accessibilityRole="button"
                    accessibilityLabel="Close">
                    <Text style={styles.closeText}>✕</Text>
                  </TouchableOpacity>
                )}

                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.modalEmojiBox}>
                    <Text style={styles.modalEmoji}>{selectedReward?.emoji || '🎁'}</Text>
                  </View>
                  <Text style={styles.modalTitle}>
                    {justBought ? 'Reward bought! 🎉' : selectedReward?.title || 'Reward'}
                  </Text>

                  {justBought ? (
                    <Text style={styles.modalSubtitle}>
                      You bought "{selectedReward?.title}". Your parent will see it in their app.
                    </Text>
                  ) : (
                    <>
                      <View style={styles.detailBadges}>
                        <View style={[styles.chip, styles.chipLarge, { backgroundColor: '#FFF3CD' }]}>
                          <Text style={[styles.chipTextLarge, { color: '#B7791F' }]}>🪙 {selCost} coins</Text>
                        </View>
                        {selPurchased && (
                          <View style={[styles.chip, styles.chipLarge, { backgroundColor: '#E0FFF4' }]}>
                            <Text style={[styles.chipTextLarge, { color: '#2A9D8F' }]}>✓ Already bought</Text>
                          </View>
                        )}
                        {!selPurchased && !selCanAfford && (
                          <View style={[styles.chip, styles.chipLarge, { backgroundColor: '#FFE5E5' }]}>
                            <Text style={[styles.chipTextLarge, { color: '#E63946' }]}>
                              Need {selCost - coinBalance} more
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.descriptionBox}>
                        <View style={styles.descriptionHeader}>
                          <Text style={styles.descriptionLabel}>About this reward</Text>
                          <TextToSpeech
                            text={`${selectedReward?.title || 'Reward'}. ${selDescription} It costs ${selCost} coins.`}
                            size={28}
                          />
                        </View>
                        <Text style={styles.descriptionText}>{selDescription}</Text>
                      </View>

                      {!!errorText && (
                        <Text style={styles.errorText}>Could not buy this reward: {errorText}</Text>
                      )}
                    </>
                  )}

                  {/* Action area */}
                  {buying ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#4ECDC4" />
                      <Text style={styles.loadingText}>Buying your reward...</Text>
                    </View>
                  ) : justBought ? (
                    <TouchableOpacity style={styles.primaryBtn} onPress={closeReward}>
                      <Text style={styles.primaryBtnText}>Awesome!</Text>
                    </TouchableOpacity>
                  ) : selPurchased ? (
                    <TouchableOpacity style={styles.primaryBtn} onPress={closeReward}>
                      <Text style={styles.primaryBtnText}>Close</Text>
                    </TouchableOpacity>
                  ) : !selCanAfford ? (
                    <View style={[styles.primaryBtn, styles.primaryBtnDisabled]}>
                      <Text style={[styles.primaryBtnText, styles.primaryBtnTextDisabled]}>
                        Need {selCost - coinBalance} more coins
                      </Text>
                    </View>
                  ) : confirming ? (
                    <View>
                      <Text style={styles.confirmText}>
                        Buy "{selectedReward?.title}" for {selCost} coins?
                      </Text>
                      <View style={styles.confirmRow}>
                        <TouchableOpacity
                          style={[styles.confirmBtn, styles.confirmBtnCancel]}
                          onPress={() => setConfirming(false)}>
                          <Text style={styles.confirmBtnCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.confirmBtn, styles.confirmBtnYes]}
                          onPress={() => purchaseReward(selectedReward)}>
                          <Text style={styles.confirmBtnYesText}>Yes, buy it! 🎉</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={() => {
                        setErrorText('');
                        setConfirming(true);
                      }}>
                      <Text style={styles.primaryBtnText}>Buy for {selCost} 🪙</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3FBF9' },
  scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 130 },

  // Hero
  hero: {
    backgroundColor: '#0F7F76',
    borderRadius: 28,
    padding: 20,
    gap: 20,
    marginBottom: 14,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  profileSection: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  profileCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileEmoji: { fontSize: 32 },
  heroNameBlock: { flexShrink: 1 },
  heroGreeting: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  heroSub: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.88)', marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
  },
  logoutBtnEmoji: { fontSize: 15 },
  logoutBtnText: { fontSize: 13, fontWeight: '800', color: '#C62828' },
  heroCoinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  heroCoinEmoji: { fontSize: 40 },
  heroCoinAmount: { fontSize: 34, fontWeight: '900', color: '#FFD479', lineHeight: 38 },
  heroCoinLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.88)' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DDF1EE',
  },
  statEmoji: { fontSize: 22 },
  statValue: { fontSize: 24, fontWeight: '900', color: '#12756D', marginTop: 2 },
  statLabel: { fontSize: 12, fontWeight: '600', color: '#6B7C79' },

  sectionTitle: { fontSize: 22, fontWeight: '900', color: '#1F2D2B', marginBottom: 12 },

  // Empty / loading
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#DDF1EE',
  },
  emptyEmoji: { fontSize: 52 },
  emptyText: { fontSize: 18, fontWeight: '800', color: '#1F2D2B' },
  emptySubtext: { fontSize: 14, color: '#6B7C79', textAlign: 'center' },

  // Reward cards
  rewardsList: { gap: 12 },
  rewardCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  rewardCardPurchased: { backgroundColor: '#F4FFFB' },
  stripe: { width: 8 },
  rewardBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rewardEmojiBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#FFF8E1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F4B942',
  },
  rewardEmojiBoxPurchased: { backgroundColor: '#E0FFF4', borderColor: '#4ECDC4' },
  rewardEmoji: { fontSize: 30 },
  rewardInfo: { flex: 1 },
  rewardTitle: { fontSize: 18, fontWeight: '800', color: '#1F2D2B' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: '700' },
  chipLarge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  chipTextLarge: { fontSize: 13, fontWeight: '800' },
  pill: {
    minWidth: 48,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 12,
    backgroundColor: '#F4B942',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBought: { backgroundColor: '#4ECDC4' },
  pillLocked: { backgroundColor: '#EEF2F1' },
  pillText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  pillTextBought: { fontSize: 20, color: '#FFFFFF' },
  pillTextLocked: { fontSize: 18 },

  // Bottom nav
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

  // Reward popup
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 22,
    width: '100%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  closeBtn: { alignSelf: 'flex-end', padding: 4, marginBottom: 2 },
  closeText: { fontSize: 20, color: '#999' },
  modalEmojiBox: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: '#FFF8E1',
    borderWidth: 2,
    borderColor: '#F4B942',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalEmoji: { fontSize: 48 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#1F2D2B', textAlign: 'center', marginBottom: 12 },
  modalSubtitle: { fontSize: 15, color: '#6B7C79', textAlign: 'center', lineHeight: 22, marginBottom: 18 },
  detailBadges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 14 },
  descriptionBox: {
    backgroundColor: '#F0FFFE',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
  },
  descriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  descriptionLabel: { fontSize: 14, fontWeight: '800', color: '#12756D' },
  descriptionText: { fontSize: 16, color: '#2D2D2D', lineHeight: 23, fontWeight: '500' },
  errorText: { fontSize: 14, color: '#E63946', fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  loadingContainer: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  loadingText: { fontSize: 14, color: '#888', fontWeight: '600', textAlign: 'center' },
  primaryBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryBtnDisabled: { backgroundColor: '#EEF2F1', shadowOpacity: 0, elevation: 0 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  primaryBtnTextDisabled: { color: '#8A9996' },
  confirmText: { fontSize: 16, fontWeight: '700', color: '#1F2D2B', textAlign: 'center', marginBottom: 12 },
  confirmRow: { flexDirection: 'row', gap: 12 },
  confirmBtn: { flex: 1, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  confirmBtnCancel: { backgroundColor: '#EEF2F1' },
  confirmBtnCancelText: { fontSize: 16, fontWeight: '800', color: '#6B7C79' },
  confirmBtnYes: { backgroundColor: '#F4B942' },
  confirmBtnYesText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});