import { useRouter } from 'expo-router';
import {
    Image,
    SafeAreaView, ScrollView,
    StyleSheet,
    Text, TouchableOpacity,
    View
} from 'react-native';

const MOCK_PENDING = [
  {
    id: '1',
    childName: 'Sarah',
    childAvatar: '👧',
    choreTitle: 'Make your bed',
    choreCoins: 5,
    submittedAt: '2 mins ago',
    photo: 'https://picsum.photos/400/300?random=1',
    priority: 'medium',
  },
  {
    id: '2',
    childName: 'Jacob',
    childAvatar: '🧒',
    choreTitle: 'Take out trash',
    choreCoins: 10,
    submittedAt: '15 mins ago',
    photo: 'https://picsum.photos/400/300?random=2',
    priority: 'high',
  },
  {
    id: '3',
    childName: 'Sarah',
    childAvatar: '👧',
    choreTitle: 'Clean your room',
    choreCoins: 12,
    submittedAt: '1 hour ago',
    photo: 'https://picsum.photos/400/300?random=3',
    priority: 'low',
  },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: '#66BB6A',
  medium: '#F4B942',
  high: '#E63946',
};

export default function ApprovalsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pending Approvals</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{MOCK_PENDING.length}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {MOCK_PENDING.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🎉</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>No pending approvals right now.</Text>
          </View>
        ) : (
          MOCK_PENDING.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => router.push({
                pathname: '/approval-detail',
                params: { ...item }
              })}>

              {/* Photo Thumbnail */}
              <Image source={{ uri: item.photo }} style={styles.thumbnail} />

              {/* Info */}
              <View style={styles.cardInfo}>
                <View style={styles.cardTop}>
                  <View style={styles.childInfo}>
                    <Text style={styles.childAvatar}>{item.childAvatar}</Text>
                    <Text style={styles.childName}>{item.childName}</Text>
                  </View>
                  <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[item.priority] + '20', borderColor: PRIORITY_COLORS[item.priority] }]}>
                    <Text style={[styles.priorityText, { color: PRIORITY_COLORS[item.priority] }]}>
                      {item.priority.toUpperCase()}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  // Header
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

  // Scroll
  scroll: { padding: 24, gap: 16 },

  // Card
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
  thumbnail: { width: 100, height: 110 },
  cardInfo: { flex: 1, padding: 12, justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  childInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  childAvatar: { fontSize: 18 },
  childName: { fontSize: 14, fontWeight: '700', color: '#2D2D2D' },
  priorityBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  priorityText: { fontSize: 10, fontWeight: '700' },
  choreTitle: { fontSize: 15, fontWeight: '700', color: '#2D2D2D', marginVertical: 4 },
  cardBottom: { flexDirection: 'row', gap: 12 },
  coinsText: { fontSize: 12, color: '#888', fontWeight: '600' },
  timeText: { fontSize: 12, color: '#888', fontWeight: '600' },

  // Empty State
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#2D2D2D' },
  emptySubtitle: { fontSize: 15, color: '#888' },
});