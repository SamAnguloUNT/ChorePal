import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    SafeAreaView, Share,
    StyleSheet,
    Text, TouchableOpacity,
    View
} from 'react-native';

export default function FamilyCodeScreen() {
  const router = useRouter();
  const { name, age, avatar, code } = useLocalSearchParams();

  const handleShare = async () => {
    await Share.share({
      message: `Hey ${name}! Your ChorePal family code is: ${code}\n\nDownload ChorePal and enter this code to join our family! 🎉`,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Success Header */}
        <View style={styles.successHeader}>
          <Text style={styles.successEmoji}>{avatar}</Text>
          <Text style={styles.successTitle}>Profile Created! 🎉</Text>
          <Text style={styles.successSubtitle}>{name}'s account is ready</Text>
        </View>

        {/* Code Card */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Family Code for {name}</Text>
          <Text style={styles.codeText}>{code}</Text>
          <Text style={styles.codeHint}>
            Share this code with {name} so they can join ChorePal!
          </Text>
        </View>

        {/* Child Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{name}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Age</Text>
            <Text style={styles.infoValue}>{age} years old</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Avatar</Text>
            <Text style={styles.infoValue}>{avatar}</Text>
          </View>
        </View>

        {/* Buttons */}
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>Share Code with {name} 📤</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => router.replace('/parent-dashboard')}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: 'center',
    gap: 20,
  },
  successHeader: { alignItems: 'center' },
  successEmoji: { fontSize: 72, marginBottom: 12 },
  successTitle: { fontSize: 28, fontWeight: '800', color: '#2D2D2D', marginBottom: 6 },
  successSubtitle: { fontSize: 16, color: '#888' },
  codeCard: {
    backgroundColor: '#F0FFFE',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4ECDC4',
  },
  codeLabel: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 10 },
  codeText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#4ECDC4',
    letterSpacing: 4,
    marginBottom: 10,
  },
  codeHint: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 18 },
  infoCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: { fontSize: 14, color: '#888', fontWeight: '600' },
  infoValue: { fontSize: 14, color: '#2D2D2D', fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#EEE' },
  shareBtn: {
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
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  doneBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4ECDC4',
  },
  doneBtnText: { color: '#4ECDC4', fontSize: 16, fontWeight: '700' },
});
