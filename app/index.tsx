import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import PressableScale from '../components/PressableScale';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCard}>
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.taglinePill}>
            <Text style={styles.tagline}>Making chores fun & rewarding!</Text>
          </View>
        </View>

        {/* Who are you */}
        <View style={styles.bottomSection}>
          <Text style={styles.question}>Who are you?</Text>

          <PressableScale
            style={[styles.roleCard, styles.parentCard]}
            onPress={() => router.push('/parent-login')}
            accessibilityRole="button"
            accessibilityLabel="I'm a Parent"
          >
            <View style={[styles.roleIcon, styles.parentIcon]}>
              <Ionicons name="people" size={32} color="#0F7F76" />
            </View>
            <View style={styles.roleTextBlock}>
              <Text style={[styles.roleTitle, styles.parentTitle]}>I'm a Parent</Text>
              <Text style={[styles.roleSub, styles.parentSub]}>
                Set up your family, chores, and rewards
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
          </PressableScale>

          <PressableScale
            style={[styles.roleCard, styles.childCard]}
            onPress={() => router.push('/child-login')}
            accessibilityRole="button"
            accessibilityLabel="I'm a Child"
          >
            <View style={[styles.roleIcon, styles.childIcon]}>
              <Ionicons name="happy" size={32} color="#0F7F76" />
            </View>
            <View style={styles.roleTextBlock}>
              <Text style={[styles.roleTitle, styles.childTitle]}>I'm a Child</Text>
              <Text style={[styles.roleSub, styles.childSub]}>
                Join with your Family Code and PIN
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#4ECDC4" />
          </PressableScale>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3FBF9' },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 36,
    justifyContent: 'space-between',
  },

  // Logo
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  logoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  logoImage: { width: 190, height: 190 },
  taglinePill: {
    backgroundColor: '#E0F7F5',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 22,
  },
  tagline: { fontSize: 15, color: '#0F7F76', fontWeight: '800' },

  // Role cards
  bottomSection: { gap: 14 },
  question: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1F2D2B',
    textAlign: 'center',
    marginBottom: 4,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  parentCard: {
    backgroundColor: '#0F7F76',
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  childCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  roleIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentIcon: { backgroundColor: '#FFFFFF' },
  childIcon: { backgroundColor: '#E0F7F5' },
  roleTextBlock: { flex: 1 },
  roleTitle: { fontSize: 19, fontWeight: '900' },
  parentTitle: { color: '#FFFFFF' },
  childTitle: { color: '#1F2D2B' },
  roleSub: { fontSize: 13, fontWeight: '600', marginTop: 3, lineHeight: 18 },
  parentSub: { color: 'rgba(255,255,255,0.85)' },
  childSub: { color: '#6B7C79' },
});