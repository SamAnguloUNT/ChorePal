import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView, Platform,
  SafeAreaView, ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

const DETAIL_PHOTO = require('../assets/images/bed.jpg');


export default function ApprovalDetailScreen() {
  const router = useRouter();
  const { childName, childAvatar, choreTitle, choreCoins, submittedAt, photo, priority } = useLocalSearchParams();
  const [comment, setComment] = useState('');

  const handleApprove = () => {
    Alert.alert(
      'Approve Chore? ✅',
      `Approve "${choreTitle}" for ${childName}? They will earn ${choreCoins} coins!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: () => {
            Alert.alert('Approved! 🎉', `${childName} earned ${choreCoins} coins!`, [
              { text: 'OK', onPress: () => router.back() }
            ]);
          }
        }
      ]
    );
  };

  const handleReject = () => {
    Alert.alert(
      'Reject Chore? ❌',
      `Reject "${choreTitle}" for ${childName}? They will need to redo it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Rejected', `${childName} has been notified to redo the chore.`, [
              { text: 'OK', onPress: () => router.back() }
            ]);
          }
        }
      ]
    );
  };

  const PRIORITY_COLORS: Record<string, string> = {
    low: '#66BB6A',
    medium: '#F4B942',
    high: '#E63946',
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.backText}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Review Chore</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Child Info */}
            <View style={styles.childCard}>
              <View style={styles.childLeft}>
                <View style={styles.childAvatarCircle}>
                  <Text style={styles.childAvatarEmoji}>{childAvatar}</Text>
                </View>
                <View>
                  <Text style={styles.childName}>{childName}</Text>
                  <Text style={styles.submittedAt}>Submitted {submittedAt}</Text>
                </View>
              </View>
              <View style={[styles.priorityBadge, {
                backgroundColor: PRIORITY_COLORS[priority as string] + '20',
                borderColor: PRIORITY_COLORS[priority as string]
              }]}>
                <Text style={[styles.priorityText, { color: PRIORITY_COLORS[priority as string] }]}>
                  {(priority as string).toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Chore Details */}
            <View style={styles.choreCard}>
              <Text style={styles.choreTitle}>{choreTitle}</Text>
              <View style={styles.coinsRow}>
                <Text style={styles.coinsLabel}>Reward</Text>
                <View style={styles.coinsBadge}>
                  <Text style={styles.coinsText}>🪙 {choreCoins} coins</Text>
                </View>
              </View>
            </View>

            {/* Photo */}
            <Text style={styles.sectionLabel}>Submitted Photo</Text>
           <Image
             source={DETAIL_PHOTO}
             style={styles.photo}
              resizeMode="cover"
              />

            {/* Comment */}
            <Text style={styles.sectionLabel}>Leave a Comment (optional)</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="e.g. You did an amazing job! I need more than one picture next time😊"
              placeholderTextColor="#aaa"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
                <Text style={styles.rejectBtnText}>❌ Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.approveBtn} onPress={handleApprove}>
                <Text style={styles.approveBtnText}>✅ Approve</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  inner: { flex: 1 },
  scroll: { paddingBottom: 40 },

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

  // Child Card
  childCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    marginTop: 20,
    backgroundColor: '#F0FFFE',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
    marginBottom: 16,
  },
  childLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  childAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  childAvatarEmoji: { fontSize: 26 },
  childName: { fontSize: 16, fontWeight: '800', color: '#2D2D2D' },
  submittedAt: { fontSize: 12, color: '#888', marginTop: 2 },
  priorityBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1.5,
  },
  priorityText: { fontSize: 12, fontWeight: '700' },

  // Chore Card
  choreCard: {
    marginHorizontal: 24,
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  choreTitle: { fontSize: 18, fontWeight: '800', color: '#2D2D2D', marginBottom: 10 },
  coinsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  coinsLabel: { fontSize: 14, color: '#888', fontWeight: '600' },
  coinsBadge: {
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F4B942',
  },
  coinsText: { fontSize: 14, fontWeight: '700', color: '#F4B942' },

  // Photo
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444',
    marginBottom: 10,
    paddingHorizontal: 24,
  },
  photo: {
    width: '100%',
    height: 240,
    marginBottom: 20,
  },

  // Comment
  commentInput: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 13,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#F9F9F9',
    marginBottom: 24,
    minHeight: 90,
    marginHorizontal: 24,
  },

  // Action Buttons
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E63946',
  },
  rejectBtnText: { color: '#E63946', fontSize: 16, fontWeight: '700' },
  approveBtn: {
    flex: 1,
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  approveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});