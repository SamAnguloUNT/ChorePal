import { useRouter } from 'expo-router';
import { Linking, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import PressableScale from '../components/PressableScale';
import { PHOTO_MAX_DAYS, RECORD_MAX_DAYS } from '../utils/dataRetention';

// Keep this in sync with POLICY_VERSION in add-child.tsx whenever the policy changes.
const EFFECTIVE_DATE = 'October 16, 2026';
const CONTACT_EMAIL = 'support@chorepal.com';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'The short version',
    body: [
      'ChorePal helps families manage chores. A parent creates the family and adds each child, so a parent always agrees before any information about a child is collected.',
      'We collect only what the app needs, we never sell information, and we do not show ads. Chore photos are deleted as soon as a parent approves or rejects them.',
    ],
  },
  {
    title: 'Who this is for',
    body: [
      'This policy explains how ChorePal handles information about parents and about children under 13, as described in the Children\'s Online Privacy Protection Act (COPPA).',
      'Children do not create their own accounts. A parent or guardian adds the child, gives consent, and shares the Family Code and PIN.',
    ],
  },
  {
    title: 'What we collect from parents',
    body: [
      'Your name, email address and password (the password is handled by Firebase Authentication), the chores and rewards you create, and a notification token for your phone so ChorePal can tell you when a chore is submitted.',
      'If you choose to set a home location for reminders, we save that location with your account.',
    ],
  },
  {
    title: 'What we collect about children',
    body: [
      'Name or nickname, chosen avatar, a 4-digit PIN, a Family Code, coin balance, chore and reward history, and a notification token for the child\'s phone.',
      'Photos your child submits as proof that a chore is done.',
      'Home reminders (optional): if the parent sets a home location, the child\'s phone checks whether it is near home while the app is open. The child\'s own location is not saved or sent to us.',
      'We do not ask for a child\'s email address, phone number, age, school or full address.',
    ],
  },
  {
    title: 'How chore photos are handled',
    body: [
      'When your child submits a photo, it is first checked on the phone by sending it to Google\'s Gemini AI service, which looks at whether the chore appears to be done. We use Google\'s paid API service, whose terms say content sent through it is not used to train Google\'s models. Google may keep it briefly for abuse monitoring as described in its terms.',
      'If ChorePal does not verify the photo, it is never saved to our storage.',
      `If it is verified, the photo is stored so you can review it, then deleted as soon as you approve or reject the chore. A photo nobody reviews is deleted after ${PHOTO_MAX_DAYS} days.`,
    ],
  },
  {
    title: 'How long we keep information',
    body: [
      `Chore history stays on your account, but ${RECORD_MAX_DAYS} days after a chore is reviewed we erase the child's name, avatar, ChorePal's photo description and your comment from that record.`,
      'When you delete a child, we delete their profile, chore history, photos, rewards purchases, notification token and chores made only for them.',
      'When you delete your parent account, we delete all of the above for every child, plus your account.',
    ],
  },
  {
    title: 'Who we share information with',
    body: [
      'We do not sell or rent information, and we do not use it for advertising.',
      'We use these service providers only to run the app: Google Firebase (account sign-in, database and photo storage), Google Gemini (the photo check described above) and Expo\'s notification service (to deliver notifications).',
    ],
  },
  {
    title: 'Your choices as a parent',
    body: [
      'You can review everything saved about a child on their Child Account screen, and edit it there.',
      'You can delete a child, and everything saved about them, with Delete Child Account on that screen. You can also delete your own account in Settings.',
      'You can agree to our collecting a child\'s information and later change your mind by deleting the child. You can turn notifications off in Settings, and turn home reminders off by not setting a home location.',
      `Questions, or want us to delete information for you? Email ${CONTACT_EMAIL}.`,
    ],
  },
  {
    title: 'Security',
    body: [
      'Information is stored with Google Firebase. We take reasonable steps to protect it, but no system is perfectly secure. Please keep your Family Code and PIN private.',
    ],
  },
  {
    title: 'Changes',
    body: [
      'If we change this policy in a way that affects children\'s information, we will ask parents to agree again before we collect more.',
    ],
  },
];

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroTitle}>Privacy Policy 🔒</Text>
              <Text style={styles.heroSub}>Effective {EFFECTIVE_DATE}</Text>
            </View>
            <PressableScale
              style={styles.backBtn}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.backBtnText}>← Back</Text>
            </PressableScale>
          </View>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.cardTitle}>{section.title}</Text>
            {section.body.map((paragraph, i) => (
              <Text key={i} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}

        <PressableScale
          style={styles.contactBtn}
          onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=ChorePal privacy question`)}
          accessibilityRole="button"
          accessibilityLabel="Email us about privacy"
        >
          <Text style={styles.contactBtnText}>📧 Email us about privacy</Text>
        </PressableScale>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3FBF9' },
  scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 50 },

  hero: {
    backgroundColor: '#0F7F76',
    borderRadius: 28,
    padding: 20,
    marginBottom: 18,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  heroTextBlock: { flexShrink: 1 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  heroSub: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  backBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 13, fontWeight: '800', color: '#0F7F76' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: '900', color: '#1F2D2B', marginBottom: 8 },
  paragraph: { fontSize: 14, lineHeight: 21, color: '#42514F', marginBottom: 8 },

  contactBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  contactBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});