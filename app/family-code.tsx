import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import PressableScale from '../components/PressableScale';

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
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Success hero — same language as the dashboards */}
        <View style={styles.hero}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarEmoji}>{avatar}</Text>
          </View>
          <Text style={styles.heroTitle}>Profile Created! 🎉</Text>
          <Text style={styles.heroSub}>{name}'s account is ready</Text>
        </View>

        {/* Family code */}
        <Text style={styles.sectionTitle}>Family code</Text>
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Family Code for {name}</Text>
          <View style={styles.codePill}>
            <Text style={styles.codeText} selectable>
              {code}
            </Text>
          </View>
          <Text style={styles.codeHint}>
            Share this code with {name} so they can join ChorePal. They will also need the PIN you set.
          </Text>
        </View>

        {/* Child info */}
        <Text style={styles.sectionTitle}>Profile</Text>
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
            <View style={styles.infoAvatar}>
              <Text style={styles.infoAvatarEmoji}>{avatar}</Text>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <PressableScale
          style={styles.shareBtn}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel={`Share code with ${name}`}
        >
          <Text style={styles.shareBtnText}>Share Code with {name} 📤</Text>
        </PressableScale>

        <PressableScale
          style={styles.doneBtn}
          onPress={() => router.replace('/parent-dashboard')}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </PressableScale>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3FBF9' },
  scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 40 },

  // Hero
  hero: {
    backgroundColor: '#0F7F76',
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarEmoji: { fontSize: 52 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#FFFFFF' },
  heroSub: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },

  // Sections
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1F2D2B',
    marginBottom: 14,
  },

  // Code card
  codeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
    borderStyle: 'dashed',
    marginBottom: 26,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  codeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7C79',
    marginBottom: 12,
  },
  codePill: {
    backgroundColor: '#E6F8F6',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 22,
    marginBottom: 14,
    maxWidth: '100%',
  },
  codeText: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0F7F76',
    letterSpacing: 3,
    textAlign: 'center',
  },
  codeHint: {
    fontSize: 13,
    color: '#6B7C79',
    textAlign: 'center',
    lineHeight: 19,
  },

  // Info card
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    marginBottom: 26,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: { fontSize: 14, color: '#6B7C79', fontWeight: '700' },
  infoValue: { fontSize: 15, color: '#1F2D2B', fontWeight: '800' },
  infoAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F7F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoAvatarEmoji: { fontSize: 20 },
  divider: { height: 1, backgroundColor: '#EEF5F4' },

  // Buttons
  shareBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  shareBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  doneBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4ECDC4',
  },
  doneBtnText: { color: '#0F7F76', fontSize: 16, fontWeight: '800' },
});