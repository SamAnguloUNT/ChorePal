import { useFocusEffect, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  RefreshControl,
  SafeAreaView, ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import PressableScale from '../components/PressableScale';
import { auth, db } from '../config/firebase';

const formatTimeAgo = (date: Date) => {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
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
        styles.emptyEmoji,
        { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] },
      ]}>
      {emoji}
    </Animated.Text>
  );
}

export default function ApprovalsScreen() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const loadSubmissions = useCallback(async (showSpinner: boolean) => {
    try {
      if (showSpinner) setLoading(true);
      const user = auth.currentUser;
      if (user) {
        const submissionsQuery = query(
          collection(db, 'submissions'),
          where('parentId', '==', user.uid),
          where('status', '==', 'pending')
        );
        const submissionsSnap = await getDocs(submissionsQuery);
        const submissionsData = submissionsSnap.docs
          .map(d => {
            const data: any = d.data();
            const date = data.submittedAt?.toDate ? data.submittedAt.toDate() : null;
            return {
              id: d.id,
              ...data,
              submittedMs: date ? date.getTime() : 0,
              submittedAt: date ? formatTimeAgo(date) : 'Just now',
            };
          })
          // Newest submissions first
          .sort((a, b) => b.submittedMs - a.submittedMs);
        setSubmissions(submissionsData);
      }
    } catch (error) {
      console.error('Error loading submissions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // useFocusEffect reloads every time screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadSubmissions(true);
    }, [loadSubmissions])
  );

  // Used by both pull-to-refresh and the Refresh button
  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    await loadSubmissions(false);
    setRefreshing(false);
  }, [loadSubmissions, refreshing]);

  const aiOkCount = submissions.filter(s => s.aiApproved).length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0F7F76"
            colors={['#0F7F76']}
          />
        }>

        {/* Top bar */}
        <View style={styles.topBar}>
          <PressableScale
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Text style={styles.backText}>← Back</Text>
          </PressableScale>
        </View>

        {/* Hero */}
        <AnimatedEntry index={0} skip={reduceMotion}>
          <View style={styles.hero}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroNameBlock}>
                <Text style={styles.heroGreeting}>Review time ✅</Text>
                <Text style={styles.heroTitle}>Pending Approvals</Text>
                <Text style={styles.heroSub}>
                  {loading
                    ? 'Checking for submissions...'
                    : submissions.length === 0
                      ? 'Nothing waiting for you'
                      : `${submissions.length} chore${submissions.length === 1 ? '' : 's'} waiting`}
                </Text>
              </View>

              <PressableScale
                style={styles.refreshBtn}
                onPress={onRefresh}
                accessibilityRole="button"
                accessibilityLabel="Refresh approvals">
                {refreshing ? (
                  <ActivityIndicator size="small" color="#0F7F76" />
                ) : (
                  <Text style={styles.refreshBtnEmoji}>🔄</Text>
                )}
                <Text style={styles.refreshBtnText}>{refreshing ? 'Refreshing' : 'Refresh'}</Text>
              </PressableScale>
            </View>

            <View style={styles.heroCountRow}>
              <View style={styles.heroCountBubble}>
                <Text style={styles.heroCountValue}>{submissions.length}</Text>
              </View>
              <Text style={styles.heroCountLabel}>
                {submissions.length === 1 ? 'submission to review' : 'submissions to review'}
              </Text>
            </View>
          </View>
        </AnimatedEntry>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4ECDC4" />
            <Text style={styles.loadingText}>Loading submissions...</Text>
          </View>
        ) : submissions.length === 0 ? (
          <AnimatedEntry index={1} skip={reduceMotion}>
            <View style={styles.emptyState}>
              <FloatingEmoji emoji="🎉" skip={reduceMotion} />
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySubtitle}>No pending approvals right now.</Text>
              <Text style={styles.emptyHint}>Pull down or tap Refresh to check again.</Text>
            </View>
          </AnimatedEntry>
        ) : (
          <View style={styles.list}>
            {submissions.map((item, index) => (
              <AnimatedEntry key={item.id} index={index + 1} skip={reduceMotion}>
                <PressableScale
                  style={styles.card}
                  accessibilityRole="button"
                  accessibilityLabel={`Review ${item.choreTitle} from ${item.childName}`}
                  onPress={() => router.push({
                    pathname: '/approval-detail',
                    params: {
                      id: item.id,
                      childName: item.childName,
                      childAvatar: item.childAvatar,
                      choreTitle: item.choreTitle,
                      choreCoins: item.choreCoins,
                      submittedAt: item.submittedAt,
                      photoURL: item.photoURL,
                      priority: item.priority || 'medium',
                      aiApproved: item.aiApproved ? 'true' : 'false',
                      aiConfidence: item.aiConfidence?.toString() || '0',
                      aiDescription: item.aiDescription || '',
                    }
                  })}>

                  <View style={[styles.stripe, { backgroundColor: item.aiApproved ? '#4ECDC4' : '#F4B942' }]} />

                  {/* Photo Thumbnail */}
                  <View style={styles.thumbWrap}>
                    {item.photoURL ? (
                      <Image source={{ uri: item.photoURL }} style={styles.thumbnail} />
                    ) : (
                      <View style={[styles.thumbnail, styles.thumbPlaceholder]}>
                        <Text style={styles.thumbPlaceholderEmoji}>📷</Text>
                      </View>
                    )}
                  </View>

                  {/* Info */}
                  <View style={styles.cardInfo}>
                    <View style={styles.childRow}>
                      <View style={styles.childAvatarCircle}>
                        <Text style={styles.childAvatar}>{item.childAvatar || '👧'}</Text>
                      </View>
                      <Text style={styles.childName} numberOfLines={1}>{item.childName}</Text>
                    </View>

                    <Text style={styles.choreTitle} numberOfLines={2}>{item.choreTitle}</Text>

                    <View style={styles.chipRow}>
                      <View style={[styles.chip, { backgroundColor: '#FFF3CD' }]}>
                        <Text style={[styles.chipText, { color: '#B7791F' }]}>🪙 {item.choreCoins ?? 0}</Text>
                      </View>
                      <View style={[styles.chip, { backgroundColor: '#EEF2F1' }]}>
                        <Text style={[styles.chipText, { color: '#6B7C79' }]}>⏰ {item.submittedAt}</Text>
                      </View>
                      <View style={[
                        styles.chip,
                        item.aiApproved ? { backgroundColor: '#E0FFF4' } : { backgroundColor: '#FFF8E1' },
                      ]}>
                        <Text style={[styles.chipText, { color: item.aiApproved ? '#2A9D8F' : '#B7791F' }]}>
                          {item.aiApproved ? '🤖 ✅ ChorePal verified' : '🤖 ⚠️ Check it'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.chevronWrap}>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </PressableScale>
              </AnimatedEntry>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3FBF9' },
  scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 60 },

  // Top bar
  topBar: { flexDirection: 'row', marginBottom: 12 },
  backBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
  },
  backText: { fontSize: 14, color: '#0F7F76', fontWeight: '800' },

  // Hero
  hero: {
    backgroundColor: '#0F7F76',
    borderRadius: 28,
    padding: 20,
    gap: 18,
    marginBottom: 22,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  heroNameBlock: { flexShrink: 1 },
  heroGreeting: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.88)', marginBottom: 2 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#FFFFFF' },
  heroSub: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
  },
  refreshBtnEmoji: { fontSize: 15 },
  refreshBtnText: { fontSize: 13, fontWeight: '800', color: '#0F7F76' },
  heroCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  heroCountBubble: {
    minWidth: 52,
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 10,
    backgroundColor: '#FFD479',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCountValue: { fontSize: 26, fontWeight: '900', color: '#7A4F0B' },
  heroCountLabel: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', flexShrink: 1 },

  // Loading / empty
  loadingContainer: { alignItems: 'center', paddingVertical: 50, gap: 12 },
  loadingText: { fontSize: 14, color: '#6B7C79', fontWeight: '600' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#DDF1EE',
  },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#1F2D2B' },
  emptySubtitle: { fontSize: 15, color: '#6B7C79', fontWeight: '600' },
  emptyHint: { fontSize: 13, color: '#8A9996', marginTop: 4, fontStyle: 'italic' },

  // Cards
  list: { gap: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
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
  stripe: { width: 8, alignSelf: 'stretch' },
  thumbWrap: { marginLeft: 12 },
  thumbnail: { width: 84, height: 84, borderRadius: 16, backgroundColor: '#EEF2F1' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderEmoji: { fontSize: 28 },
  cardInfo: { flex: 1, paddingVertical: 14, paddingHorizontal: 12 },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  childAvatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E0F7F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  childAvatar: { fontSize: 14 },
  childName: { fontSize: 13, fontWeight: '800', color: '#6B7C79', flexShrink: 1 },
  choreTitle: { fontSize: 17, fontWeight: '800', color: '#1F2D2B', marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: '700' },
  chevronWrap: { paddingRight: 14 },
  chevron: { fontSize: 28, color: '#9FD6CD', fontWeight: '700' },
});