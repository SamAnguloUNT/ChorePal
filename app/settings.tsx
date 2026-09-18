import { useRouter } from 'expo-router';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../config/firebase';

import {
  registerForPushNotifications,
  requestNotificationPermissions,
} from '../utils/notifications';

const FAQ_ITEMS = [
  {
    question: 'How do I add a child to my account?',
    answer: 'Go to your Parent Dashboard and tap "Add Kid". Fill in your child\'s name, age, avatar and PIN. A unique family code will be generated for them to join.',
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

export default function SettingsScreen() {
  const router = useRouter();
  const [faqVisible, setFaqVisible] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);

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

        setNotificationsEnabled(data.notificationsEnabled ?? false);
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

      // This will save the push token to the parent's Firestore account
      // when running in a build that supports remote push notifications.
      await registerForPushNotifications(user.uid, 'parent');
    }

    if (enabled) {
        await updateDoc(doc(db, 'users', user.uid), {
        notificationsEnabled: true,
    });
    } else {
      await updateDoc(doc(db, 'users', user.uid), {
      notificationsEnabled: false,
      pushToken: null,
    });
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

  const handleContact = () => {
    Linking.openURL('mailto:support@chorepal.com?subject=ChorePal Support');
  };

  const handlePrivacy = () => {
    Alert.alert(
      'Privacy Policy',
      'ChorePal takes your privacy seriously. We only collect data necessary to provide our service. We never sell your data to third parties. All photos are stored securely and only accessible to your family.',
      [{ text: 'OK' }]
    );
  };

  const handleTerms = () => {
    Alert.alert(
      'Terms of Service',
      'By using ChorePal you agree to use the app responsibly. ChorePal is designed for family use. Parents are responsible for supervising their children\'s use of the app.',
      [{ text: 'OK' }]
    );
  };

  const SETTINGS_SECTIONS = [
    {
      title: 'Account',
      items: [
        { icon: '👤', label: 'Edit Profile', onPress: () => setEditProfileVisible(true) },
        { icon: '🔒', label: 'Change Password', onPress: handleChangePassword},
        { icon: '🔔', label: 'Notifications', onPress: () => setNotificationsVisible(true) },
      ]
    },
    {
      title: 'Support',
      items: [
        { icon: '❓', label: 'FAQ', onPress: () => setFaqVisible(true) },
        { icon: '📧', label: 'Contact Us', onPress: handleContact },
        { icon: '🔒', label: 'Privacy Policy', onPress: handlePrivacy },
        { icon: '📄', label: 'Terms of Service', onPress: handleTerms },
      ]
    },
    {
      title: 'App',
      items: [
        { icon: '⭐', label: 'Rate ChorePal', onPress: () => Alert.alert('Thank you!', 'Rating will be available when the app is published.') },
        { icon: 'ℹ️', label: 'App Version', onPress: () => Alert.alert('Version', 'ChorePal v1.0.0') },
      ]
    },
  ];

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {auth.currentUser?.email?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <View>
            <Text style={styles.profileEmail}>{auth.currentUser?.email || 'Parent'}</Text>
            <Text style={styles.profileRole}>Parent Account</Text>
          </View>
        </View>

        {/* Settings Sections */}
        {SETTINGS_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, index) => (
                <View key={item.label}>
                  <TouchableOpacity
                    style={styles.settingsItem}
                    onPress={item.onPress}>
                    <View style={styles.itemLeft}>
                      <Text style={styles.itemIcon}>{item.icon}</Text>
                      <Text style={styles.itemLabel}>{item.label}</Text>
                    </View>
                    <Text style={styles.itemArrow}>›</Text>
                  </TouchableOpacity>
                  {index < section.items.length - 1 && (
                    <View style={styles.divider} />
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>🚪 Log Out</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>ChorePal v1.0.0</Text>

      </ScrollView>

{/* Edit Profile Modal */}
<Modal
  visible={editProfileVisible}
  animationType="slide"
  onRequestClose={() => setEditProfileVisible(false)}
>
  <SafeAreaView style={styles.editProfileContainer}>

    <View style={styles.editProfileHeader}>
      <TouchableOpacity onPress={() => setEditProfileVisible(false)}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.headerTitle}>Edit Profile</Text>

      <View style={{ width: 40 }} />
    </View>

    <View style={styles.editProfileContent}>
      <Text style={styles.inputLabel}>Name</Text>

      <TextInput
        style={styles.profileInput}
        value={profileName}
        onChangeText={setProfileName}
        placeholder="Enter your name"
        autoCapitalize="words"
      />

      <Text style={styles.inputLabel}>Email</Text>

      <TextInput
        style={[styles.profileInput, styles.disabledInput]}
        value={auth.currentUser?.email || ''}
        editable={false}
      />

      <TouchableOpacity
        style={styles.saveProfileBtn}
        onPress={handleSaveProfile}
        disabled={savingProfile}
      >
        <Text style={styles.saveProfileBtnText}>
          {savingProfile ? 'Saving...' : 'Save Changes'}
        </Text>
      </TouchableOpacity>
    </View>

  </SafeAreaView>
</Modal>

{/* Notifications Modal */}
<Modal
  visible={notificationsVisible}
  animationType="slide"
  onRequestClose={() => setNotificationsVisible(false)}
>
  <SafeAreaView style={styles.notificationsContainer}>

    <View style={styles.notificationsHeader}>
      <TouchableOpacity onPress={() => setNotificationsVisible(false)}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.headerTitle}>Notifications</Text>

      <View style={{ width: 40 }} />
    </View>

    <View style={styles.notificationsContent}>

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
        />
      </View>

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
        <SafeAreaView style={styles.faqContainer}>

          {/* FAQ Header */}
          <View style={styles.faqHeader}>
            <TouchableOpacity onPress={() => setFaqVisible(false)}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>FAQ</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.faqScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.faqSubtitle}>Frequently Asked Questions</Text>

            {FAQ_ITEMS.map((item, index) => (
              <TouchableOpacity
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
              </TouchableOpacity>
            ))}

            {/* Contact Support */}
            <View style={styles.contactCard}>
              <Text style={styles.contactTitle}>Still have questions?</Text>
              <Text style={styles.contactSubtitle}>We are here to help!</Text>
              <TouchableOpacity style={styles.contactBtn} onPress={handleContact}>
                <Text style={styles.contactBtnText}>📧 Contact Support</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    backgroundColor: '#fff',
  },
  backText: { fontSize: 16, color: '#4ECDC4', fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#2D2D2D' },
  scroll: { padding: 24, paddingBottom: 40 },

  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EEE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { fontSize: 24, fontWeight: '800', color: '#fff' },
  profileEmail: { fontSize: 16, fontWeight: '700', color: '#2D2D2D' },
  profileRole: { fontSize: 13, color: '#888', marginTop: 2 },

  // Sections
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEE',
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemIcon: { fontSize: 20 },
  itemLabel: { fontSize: 15, fontWeight: '600', color: '#2D2D2D' },
  itemArrow: { fontSize: 20, color: '#CCC' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 16 },

  // Logout
  logoutBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E63946',
  },
  logoutBtnText: { color: '#E63946', fontSize: 16, fontWeight: '700' },
  versionText: { textAlign: 'center', color: '#CCC', fontSize: 13 },

  // FAQ
  faqContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  faqScroll: { padding: 24, paddingBottom: 40 },
  faqSubtitle: { fontSize: 15, color: '#888', marginBottom: 20 },
  faqItem: {
    backgroundColor: '#F9F9F9',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  faqQuestionText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#2D2D2D' },
  faqArrow: { fontSize: 18, color: '#4ECDC4', fontWeight: '700' },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    lineHeight: 22,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingTop: 12,
  },
  contactCard: {
    backgroundColor: '#F0FFFE',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
    gap: 8,
  },
  contactTitle: { fontSize: 18, fontWeight: '800', color: '#2D2D2D' },
  contactSubtitle: { fontSize: 14, color: '#888' },
  contactBtn: {
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  contactBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Edit Profile
editProfileContainer: {
  flex: 1,
  backgroundColor: '#FFFFFF',
},
editProfileHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 24,
  paddingTop: 16,
  paddingBottom: 12,
  borderBottomWidth: 1,
  borderBottomColor: '#EEE',
},
editProfileContent: {
  padding: 24,
},
inputLabel: {
  fontSize: 14,
  fontWeight: '700',
  color: '#2D2D2D',
  marginBottom: 8,
  marginTop: 16,
},
profileInput: {
  backgroundColor: '#F9F9F9',
  borderWidth: 1,
  borderColor: '#DDD',
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingVertical: 14,
  fontSize: 16,
  color: '#2D2D2D',
},
disabledInput: {
  backgroundColor: '#F1F1F1',
  color: '#888',
},
saveProfileBtn: {
  backgroundColor: '#4ECDC4',
  borderRadius: 12,
  paddingVertical: 16,
  alignItems: 'center',
  marginTop: 28,
},
saveProfileBtnText: {
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: '700',
},

// Notifications
notificationsContainer: {
  flex: 1,
  backgroundColor: '#FFFFFF',
},
notificationsHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 24,
  paddingTop: 16,
  paddingBottom: 12,
  borderBottomWidth: 1,
  borderBottomColor: '#EEE',
},
notificationsContent: {
  padding: 24,
},
notificationSetting: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: '#F9F9F9',
  borderRadius: 14,
  padding: 18,
},
notificationTextContainer: {
  flex: 1,
  paddingRight: 16,
},
notificationTitle: {
  fontSize: 16,
  fontWeight: '700',
  color: '#2D2D2D',
},
notificationDescription: {
  fontSize: 13,
  color: '#777',
  marginTop: 5,
  lineHeight: 18,
},
notificationNote: {
  fontSize: 12,
  color: '#999',
  marginTop: 16,
  lineHeight: 18,
},

});
