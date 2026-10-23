import { useRouter } from 'expo-router';
import { deleteUser, sendPasswordResetEmail, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import PressableScale from '../components/PressableScale';
import { auth, db } from '../config/firebase';

import { deleteAllFamilyData } from '../utils/deleteFamilyData';
import {
  registerForPushNotifications,
  requestNotificationPermissions,
} from '../utils/notifications';

const FAQ_ITEMS = [
  {
    question: 'How do I add a child to my account?',
    answer: 'Go to your Parent Dashboard and tap "Add Kid". Fill in your child\'s name, avatar and PIN, and confirm your consent. A unique family code will be generated for them to join.',
  },
  {
    question: 'How does my child log in?',
    answer: 'Your child opens ChorePal and taps "I\'m a Child". They enter the family code you shared with them along with their 4-digit PIN.',
  },
  {
    question: 'How does the AI verification work?',
    answer: 'When your child completes a chore they take a photo as proof. Our AI analyzes the photo to verify the chore was completed. If the AI approves it, you will receive a notification for your final approval.',
  },
  {
    question: 'What happens after I approve a chore?',
    answer: 'Once you approve a chore, coins are automatically added to your child\'s balance. They can then use those coins to redeem rewards you\'ve created.',
  },
  {
    question: 'How do I create rewards?',
    answer: 'Go to the Rewards section from your Parent Dashboard and tap "+ Add". Set a title, emoji icon, and coin cost. Your child will see the reward in their Rewards Store.',
  },
  {
    question: 'Can I assign chores to specific children?',
    answer: 'Yes! When creating a chore, toggle "Specific Child" and select which child the chore is for. You can also assign it to all children at once.',
  },
  {
    question: 'What if the AI incorrectly rejects a photo?',
    answer: 'The AI may sometimes be unable to verify certain chores. If your child\'s photo is rejected, they can retake it. You as the parent always have final say on approvals.',
  },
  {
    question: 'How do I reset my password?',
    answer: 'On the login screen tap "Forgot Password?" and enter your email. You will receive a password reset link.',
  },
  {
    question: 'Can I have multiple parent accounts?',
    answer: 'Yes! Multiple parents can sign up and add children using the same family codes. Each parent has their own login.',
  },
  {
    question: 'How do coins work?',
    answer: 'Parents set the coin value for each chore. When a chore is approved, coins are added to the child\'s balance. Children spend coins in the Rewards Store to redeem rewards parents have set up.',
  },
];

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
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
      }}>
      {children}
    </Animated.View>
  );
}

type RowProps = {
  icon: string;
  label: string;
  onPress: () => void;
  tall?: boolean;
  danger?: boolean;
  last?: boolean;
  tint?: string;
};

// One tappable settings row: icon, label, chevron
function SettingsRow({ icon, label, onPress, tall, danger, last, tint }: RowProps) {
  return (
    <>
      <PressableScale
        style={[styles.row, tall && styles.rowTall]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}>
        <View style={styles.rowLeft}>
          <View style={[styles.rowIconBox, { backgroundColor: danger ? '#FFE5E5' : tint || '#E6F8F6' }]}>
            <Text style={styles.rowIcon}>{icon}</Text>
          </View>
          <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        </View>
        <Text style={[styles.rowChevron, danger && { color: '#F2A3A9' }]}>›</Text>
      </PressableScale>
      {!last && <View style={styles.divider} />}
    </>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const [faqVisible, setFaqVisible] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;

      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (userDoc.exists()) {
          const data = userDoc.data();

          const name = data.name || '';
          setProfileName(name);
          setDisplayName(name);

          // Default to ON so the switch matches the parent dashboard, which registers
          // for push notifications unless this is explicitly false.
          setNotificationsEnabled(data.notificationsEnabled ?? true);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };

    loadProfile();
  }, []);

  const handleSaveProfile = async () => {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert('Error', 'No user is currently signed in.');
      return;
    }

    if (!profileName.trim()) {
      Alert.alert('Error', 'Please enter a name.');
      return;
    }

    try {
      setSavingProfile(true);

      await updateDoc(doc(db, 'users', user.uid), {
        name: profileName.trim(),
      });

      setDisplayName(profileName.trim());
      setEditProfileVisible(false);

      Alert.alert('Success', 'Your profile has been updated.');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Unable to update your profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = () => {
    const email = auth.currentUser?.email;

    if (!email) {
      Alert.alert('Error', 'No email address is associated with this account.');
      return;
    }

    Alert.alert(
      'Change Password',
      `Send a password reset link to ${email}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Send Email',
          onPress: async () => {
            try {
              await sendPasswordResetEmail(auth, email);

              Alert.alert(
                'Email Sent',
                'Check your inbox for a password reset link.'
              );
            } catch (error) {
              console.error('Password reset error:', error);
              Alert.alert(
                'Error',
                'Unable to send the password reset email. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  // Children can't read the parent's `users` doc, so each child doc holds a copy of the
  // parent's push token (`parentPushToken`). Pass null to remove it.
  const syncTokenToChildren = async (uid: string, token: string | null) => {
    const kids = await getDocs(
      query(collection(db, 'children'), where('parentId', '==', uid))
    );
    await Promise.all(
      kids.docs.map((d) => updateDoc(d.ref, { parentPushToken: token }))
    );
  };

  const handleNotificationsToggle = async (enabled: boolean) => {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert('Error', 'No user is currently signed in.');
      return;
    }

    try {
      setSavingNotifications(true);

      if (enabled) {
        const permissionGranted = await requestNotificationPermissions();

        if (!permissionGranted) {
          setNotificationsEnabled(false);

          Alert.alert(
            'Notifications Disabled',
            'ChorePal needs notification permission before notifications can be enabled.'
          );

          return;
        }

        // Saves the push token to the parent's Firestore account when running in a
        // build that supports remote push notifications.
        const token = await registerForPushNotifications(user.uid, 'parent');

        await updateDoc(doc(db, 'users', user.uid), {
          notificationsEnabled: true,
        });

        // Share the token with the children so their app can notify this parent
        if (token) await syncTokenToChildren(user.uid, token);
      } else {
        await updateDoc(doc(db, 'users', user.uid), {
          notificationsEnabled: false,
          pushToken: null,
        });

        // Remove the token from the children so submissions stop notifying this parent
        await syncTokenToChildren(user.uid, null);
      }

      setNotificationsEnabled(enabled);
    } catch (error) {
      console.error('Notification settings error:', error);

      Alert.alert(
        'Error',
        'Unable to update notification settings. Please try again.'
      );
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await signOut(auth);
          router.replace('/');
        }
      }
    ]);
  };

  const handleDeleteAccount = () => {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert('Error', 'No user is currently signed in.');
      return;
    }

    Alert.alert(
      'Delete Account',
      'This permanently deletes your ChorePal account, all of your children\'s profiles, and every chore, reward, purchase and photo saved with them. This cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove every child's data and everything else this family saved first
              await deleteAllFamilyData(user.uid);
              await deleteDoc(doc(db, 'users', user.uid));
              await deleteUser(user);

              Alert.alert(
                'Account Deleted',
                'Your ChorePal account has been permanently deleted.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/'),
                  },
                ]
              );
            } catch (error: any) {
              console.error('Delete account error:', error);

              if (error?.code === 'auth/requires-recent-login') {
                Alert.alert(
                  'Sign In Again',
                  'Your family data has been removed. For security, please log out, sign back in, and tap Delete Account again to finish deleting your login.'
                );
                return;
              }

              Alert.alert(
                'Error',
                'Unable to finish deleting your account. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  const handleContact = () => {
    Linking.openURL('mailto:support@chorepal.com?subject=ChorePal Support');
  };

  const handlePrivacy = () => {
    router.push('/privacy-policy');
  };

  const handleTerms = () => {
    Alert.alert(
      'Terms of Service',
      'By using ChorePal you agree to use the app responsibly. ChorePal is designed for family use. Parents are responsible for supervising their children\'s use of the app.',
      [{ text: 'OK' }]
    );
  };

  const SETTINGS_SECTIONS: {
    title: string;
    tall?: boolean;
    items: { icon: string; label: string; onPress: () => void; tint?: string }[];
  }[] = [
    {
      title: 'Account',
      items: [
        { icon: '👤', label: 'Edit Profile', onPress: () => setEditProfileVisible(true) },
        { icon: '🔒', label: 'Change Password', onPress: handleChangePassword },
        { icon: '🔔', label: 'Notifications', onPress: () => setNotificationsVisible(true), tint: '#FFF4D6' },
      ],
    },
    {
      title: 'Support',
      tall: true,
      items: [
        { icon: '❓', label: 'Help & FAQ', onPress: () => setFaqVisible(true) },
        { icon: '✉️', label: 'Contact Us', onPress: handleContact },
        { icon: '🛡️', label: 'Privacy Policy', onPress: handlePrivacy },
        { icon: '📄', label: 'Terms of Service', onPress: handleTerms },
      ],
    },
    {
      title: 'App',
      items: [
        { icon: '⭐', label: 'Rate ChorePal', onPress: () => Alert.alert('Thank you!', 'Rating will be available when the app is published.'), tint: '#FFF4D6' },
        { icon: 'ℹ️', label: 'App Version', onPress: () => Alert.alert('Version', 'ChorePal v1.0.0') },
      ],
    },
  ];

  const email = auth.currentUser?.email || '';
  const initial = (displayName || email || '?').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Top bar: back arrow + centered title */}
        <View style={styles.topBar}>
          <PressableScale
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Text style={styles.backArrow}>←</Text>
          </PressableScale>
          <Text style={styles.topTitle}>Settings</Text>
          <View style={styles.backBtnSpacer} />
        </View>

        {/* Parent info */}
        <AnimatedEntry index={0} skip={reduceMotion}>
          <View style={styles.profileRow}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{initial}</Text>
            </View>
            <View style={styles.profileText}>
              <Text style={styles.profileName} numberOfLines={1}>
                {displayName || 'Parent'}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {email || 'Parent Account'}
              </Text>
            </View>
          </View>
        </AnimatedEntry>

        {/* Account / Support / App sections */}
        {SETTINGS_SECTIONS.map((section, sIndex) => (
          <AnimatedEntry key={section.title} index={sIndex + 1} skip={reduceMotion}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionCard}>
                {section.items.map((item, index) => (
                  <SettingsRow
                    key={item.label}
                    icon={item.icon}
                    label={item.label}
                    onPress={item.onPress}
                    tall={section.tall}
                    tint={item.tint}
                    last={index === section.items.length - 1}
                  />
                ))}
              </View>
            </View>
          </AnimatedEntry>
        ))}

        {/* Log out + Delete account, kept together at the very bottom */}
        <AnimatedEntry index={SETTINGS_SECTIONS.length + 1} skip={reduceMotion}>
          <View style={[styles.sectionCard, styles.bottomCard]}>
            <SettingsRow icon="🚪" label="Log Out" onPress={handleLogout} />
            <SettingsRow icon="🗑️" label="Delete Account" onPress={handleDeleteAccount} danger last />
          </View>
        </AnimatedEntry>

      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editProfileVisible}
        animationType="slide"
        onRequestClose={() => setEditProfileVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <PressableScale style={styles.backBtn} onPress={() => setEditProfileVisible(false)}>
              <Text style={styles.backArrow}>←</Text>
            </PressableScale>
            <Text style={styles.topTitle}>Edit Profile</Text>
            <View style={styles.backBtnSpacer} />
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Name</Text>

            <TextInput
              style={styles.profileInput}
              value={profileName}
              onChangeText={setProfileName}
              placeholder="Enter your name"
              placeholderTextColor="#9AA9A6"
              autoCapitalize="words"
            />

            <Text style={styles.inputLabel}>Email</Text>

            <TextInput
              style={[styles.profileInput, styles.disabledInput]}
              value={email}
              editable={false}
            />

            <PressableScale
              style={[styles.saveProfileBtn, savingProfile && { opacity: 0.6 }]}
              onPress={savingProfile ? undefined : handleSaveProfile}
              disabled={savingProfile}
            >
              <Text style={styles.saveProfileBtnText}>
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </Text>
            </PressableScale>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Notifications Modal */}
      <Modal
        visible={notificationsVisible}
        animationType="slide"
        onRequestClose={() => setNotificationsVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <PressableScale style={styles.backBtn} onPress={() => setNotificationsVisible(false)}>
              <Text style={styles.backArrow}>←</Text>
            </PressableScale>
            <Text style={styles.topTitle}>Notifications</Text>
            <View style={styles.backBtnSpacer} />
          </View>

          <View style={styles.modalContent}>

            <View style={styles.notificationSetting}>
              <View style={styles.notificationTextContainer}>
                <Text style={styles.notificationTitle}>
                  Push Notifications
                </Text>

                <Text style={styles.notificationDescription}>
                  Receive alerts when chores are completed and need your attention.
                </Text>
              </View>

              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                disabled={savingNotifications}
                trackColor={{ false: '#D5DEDC', true: '#4ECDC4' }}
              />
            </View>

            {/* Home reminders — opens the set-home screen */}
            <PressableScale
              style={styles.homeReminderSetting}
              onPress={() => {
                setNotificationsVisible(false);
                router.push('/set-home');
              }}
            >
              <Text style={styles.homeReminderIcon}>🏠</Text>
              <View style={styles.notificationTextContainer}>
                <Text style={styles.notificationTitle}>Home Reminders</Text>

                <Text style={styles.notificationDescription}>
                  Remind your children about their chores when they arrive home and when they
                  leave. Set your home location here.
                </Text>
              </View>
              <Text style={styles.rowChevron}>›</Text>
            </PressableScale>

            <Text style={styles.notificationNote}>
              You can also change notification permissions later in your phones settings.
            </Text>

          </View>
        </SafeAreaView>
      </Modal>

      {/* FAQ Modal */}
      <Modal
        visible={faqVisible}
        animationType="slide"
        onRequestClose={() => setFaqVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <PressableScale style={styles.backBtn} onPress={() => setFaqVisible(false)}>
              <Text style={styles.backArrow}>←</Text>
            </PressableScale>
            <Text style={styles.topTitle}>Help & FAQ</Text>
            <View style={styles.backBtnSpacer} />
          </View>

          <ScrollView contentContainerStyle={styles.faqScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.faqSubtitle}>Frequently Asked Questions</Text>

            {FAQ_ITEMS.map((item, index) => (
              <PressableScale
                key={index}
                style={styles.faqItem}
                onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}>
                <View style={styles.faqQuestion}>
                  <Text style={styles.faqQuestionText}>{item.question}</Text>
                  <Text style={styles.faqArrow}>
                    {expandedFaq === index ? '▼' : '›'}
                  </Text>
                </View>
                {expandedFaq === index && (
                  <Text style={styles.faqAnswer}>{item.answer}</Text>
                )}
              </PressableScale>
            ))}

            {/* Contact Support */}
            <View style={styles.contactCard}>
              <Text style={styles.contactTitle}>Still have questions?</Text>
              <Text style={styles.contactSubtitle}>We are here to help!</Text>
              <PressableScale style={styles.contactBtn} onPress={handleContact}>
                <Text style={styles.contactBtnText}>✉️ Contact Support</Text>
              </PressableScale>
            </View>

          </ScrollView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3FBF9' },
  scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 50 },

  // Top bar (back arrow left, title centered)
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnSpacer: { width: 42 },
  backArrow: { fontSize: 20, color: '#0F7F76', fontWeight: '800' },
  topTitle: { fontSize: 24, fontWeight: '900', color: '#1F2D2B' },

  // Parent info
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { fontSize: 26, fontWeight: '900', color: '#0F7F76' },
  profileText: { flex: 1 },
  profileName: { fontSize: 22, fontWeight: '900', color: '#1F2D2B' },
  profileEmail: { fontSize: 14, fontWeight: '600', color: '#6B7C79', marginTop: 2 },

  // Sections
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7C8B88',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 6,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    overflow: 'hidden',
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  bottomCard: { marginTop: 6 },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowTall: { paddingVertical: 22 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 1 },
  rowIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIcon: { fontSize: 20 },
  rowLabel: { fontSize: 16, fontWeight: '800', color: '#1F2D2B' },
  rowLabelDanger: { color: '#E63946' },
  rowChevron: { fontSize: 26, color: '#9FD6CD', fontWeight: '700' },
  divider: { height: 1.5, backgroundColor: '#EEF5F4', marginHorizontal: 16 },

  // Shared modal layout
  modalContainer: { flex: 1, backgroundColor: '#F3FBF9' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
  },
  modalContent: { paddingHorizontal: 18, paddingTop: 8 },

  // Edit Profile
  inputLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2D2B',
    marginBottom: 8,
    marginTop: 16,
  },
  profileInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DDF1EE',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2D2B',
  },
  disabledInput: {
    backgroundColor: '#EEF2F1',
    color: '#8A9996',
  },
  saveProfileBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  saveProfileBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  // Notifications
  notificationSetting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    padding: 18,
  },
  homeReminderSetting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    padding: 18,
    marginTop: 14,
  },
  homeReminderIcon: { fontSize: 24 },
  notificationTextContainer: { flex: 1, paddingRight: 16 },
  notificationTitle: { fontSize: 16, fontWeight: '800', color: '#1F2D2B' },
  notificationDescription: {
    fontSize: 13,
    color: '#6B7C79',
    marginTop: 5,
    lineHeight: 18,
  },
  notificationNote: {
    fontSize: 12,
    color: '#8A9996',
    marginTop: 16,
    lineHeight: 18,
  },

  // FAQ
  faqScroll: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 40 },
  faqSubtitle: { fontSize: 15, color: '#6B7C79', fontWeight: '600', marginBottom: 16 },
  faqItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  faqQuestionText: { flex: 1, fontSize: 15, fontWeight: '800', color: '#1F2D2B' },
  faqArrow: { fontSize: 18, color: '#4ECDC4', fontWeight: '700' },
  faqAnswer: {
    fontSize: 14,
    color: '#5B6B68',
    marginTop: 12,
    lineHeight: 22,
    borderTopWidth: 1.5,
    borderTopColor: '#EEF5F4',
    paddingTop: 12,
  },
  contactCard: {
    backgroundColor: '#F0FFFE',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
    gap: 8,
  },
  contactTitle: { fontSize: 18, fontWeight: '900', color: '#1F2D2B' },
  contactSubtitle: { fontSize: 14, color: '#6B7C79', fontWeight: '600' },
  contactBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  contactBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});