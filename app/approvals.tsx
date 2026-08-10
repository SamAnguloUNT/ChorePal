import { useFocusEffect, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView, ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../config/firebase';

const PRIORITY_COLORS: Record<string, string> = {
  low: '#66BB6A',
  medium: '#F4B942',
  high: '#E63946',
};

export default function ApprovalsScreen() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  // useFocusEffect reloads every time screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const loadSubmissions = async () => {
        try {
          setLoading(true);
          const user = auth.currentUser;
          if (user) {
            const submissionsQuery = query(
              collection(db, 'submissions'),
              where('parentId', '==', user.uid),
              where('status', '==', 'pending')
            );
            const submissionsSnap = await getDocs(submissionsQuery);
            const submissionsData = submissionsSnap.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              submittedAt: doc.data().submittedAt?.toDate
                ? formatTimeAgo(doc.data().submittedAt.toDate())
                : 'Just now',
            }));
            setSubmissions(submissionsData);
          }
        } catch (error) {
          console.error('Error loading submissions:', error);
        } finally {
          setLoading(false);
        }
      };
      loadSubmissions();
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>         Pending Approvals</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{submissions.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={styles.loadingText}>Loading submissions...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {submissions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎉</Text>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySubtitle}>No pending approvals right now.</Text>
            </View>
          ) : (
            submissions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
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

                {/* Photo Thumbnail */}
                <Image
                  source={{ uri: item.photoURL }}
                  style={styles.thumbnail}
                />

                {/* Info */}
                <View style={styles.cardInfo}>
                  <View style={styles.cardTop}>
                    <View style={styles.childInfo}>
                      <Text style={styles.childAvatar}>{item.childAvatar}</Text>
                      <Text style={styles.childName}>{item.childName}</Text>
                    </View>
                    <View style={[
                      styles.aiBadge,
                      item.aiApproved ? styles.aiBadgeApproved : styles.aiBadgePending
                    ]}>
                      <Text style={styles.aiBadgeText}>
                        {item.aiApproved ? '🤖✅' : '🤖⚠️'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.choreTitle}>{item.choreTitle}</Text>
                  <View style={styles.cardBottom}>
                    <Text style={styles.coinsText}>🪙 {item.choreCoins} coins</Text>
                    <Text style={styles.timeText}>⏰ {item.submittedAt}</Text>
                  </View>
                </View>

              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    gap: 12,
  },
  backText: { fontSize: 16, color: '#4ECDC4', fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#2D2D2D' },
  badge: {
    backgroundColor: '#E63946',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#888', fontWeight: '600' },
  scroll: { padding: 24, gap: 16 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  thumbnail: { width: 100, height: 110, backgroundColor: '#EEE' },
  cardInfo: { flex: 1, padding: 12, justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  childInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  childAvatar: { fontSize: 18 },
  childName: { fontSize: 14, fontWeight: '700', color: '#2D2D2D' },
  aiBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
  },
  aiBadgeApproved: { backgroundColor: '#F0FFF4', borderColor: '#4ECDC4' },
  aiBadgePending: { backgroundColor: '#FFF8E1', borderColor: '#F4B942' },
  aiBadgeText: { fontSize: 12 },
  choreTitle: { fontSize: 15, fontWeight: '700', color: '#2D2D2D', marginVertical: 4 },
  cardBottom: { flexDirection: 'row', gap: 12 },
  coinsText: { fontSize: 12, color: '#888', fontWeight: '600' },
  timeText: { fontSize: 12, color: '#888', fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#2D2D2D' },
  emptySubtitle: { fontSize: 15, color: '#888' },
});