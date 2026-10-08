import { useFocusEffect, useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useCallback, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import PressableScale from '../components/PressableScale';
import { auth, db } from '../config/firebase';
import { registerForPushNotifications } from '../utils/notifications';

export default function ParentDashboard() {
  const router = useRouter();

  const [parentName, setParentName] = useState('');
  const [children, setChildren] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      const refreshParentName = async () => {
        const user = auth.currentUser;
        if (!user) return;

        try {
          const docSnap = await getDoc(doc(db, 'users', user.uid));
          if (docSnap.exists()) {
            setParentName(docSnap.data().name || '');
          }
        } catch (error) {
          console.error('Error refreshing parent name:', error);
        }
      };

      refreshParentName();
    }, [])
  );

  // Runs every time the dashboard comes into focus (not just on first mount), so a
  // newly added child shows up in the list AND gets the parent's push token.
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        const user = auth.currentUser;
        if (!user) return;

        let parentPushToken: string | null = null;
        let homeLocation: any = null;
        let notificationsOff = false;

        const docSnap = await getDoc(doc(db, 'users', user.uid));
        if (docSnap.exists()) {
          const parentData = docSnap.data();
          setParentName(parentData.name || '');
          homeLocation = parentData.homeLocation || null;

          // FIX: This used to require `notificationsEnabled` to be exactly true, so if
          // the field was missing the parent never registered a token. Notifications are
          // now on unless the parent explicitly turned them off in Settings.
          if (parentData.notificationsEnabled !== false) {
            parentPushToken = await registerForPushNotifications(user.uid, 'parent');
          } else {
            notificationsOff = true;
          }
        }

        const childrenQuery = query(
          collection(db, 'children'),
          where('parentId', '==', user.uid)
        );
        const childrenSnap = await getDocs(childrenQuery);
        const childrenData = childrenSnap.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((child: any) => child.isDeleted !== true);
        setChildren(childrenData);

        // FIX: Child sessions can't read the parent's `users` doc (security rules), so
        // copy the parent's push token onto each child doc. The child app reads
        // `parentPushToken` from its own record when it submits a chore.
        // Also copy the saved home location onto each child doc, so a child added later
        // gets home reminders without the parent re-saving the location.
        if (parentPushToken || homeLocation || notificationsOff) {
          try {
            await Promise.all(
              childrenSnap.docs.map((d) => {
                const data = d.data();
                const updates: any = {};

                if (parentPushToken && data.parentPushToken !== parentPushToken) {
                  updates.parentPushToken = parentPushToken;
                }

                // Notifications are switched off: remove any leftover token copy so the
                // child app can't notify this parent (covers tokens saved before the
                // switch was turned off).
                if (notificationsOff && data.parentPushToken) {
                  updates.parentPushToken = null;
                }

                const h = data.homeLocation;
                const homeDiffers =
                  !h ||
                  h.latitude !== homeLocation?.latitude ||
                  h.longitude !== homeLocation?.longitude ||
                  h.radius !== homeLocation?.radius;
                if (homeLocation && homeDiffers) {
                  updates.homeLocation = homeLocation;
                }

                return Object.keys(updates).length > 0
                  ? updateDoc(d.ref, updates)
                  : null;
              })
            );
          } catch (error) {
            console.log('Could not sync push token / home location to children:', error);
          }
        }
      };

      loadData();
    }, [])
  );

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await signOut(auth);
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero header — same language as child dashboard */}
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroNameBlock}>
              <Text style={styles.heroGreeting}>Welcome back 👋</Text>
              <Text style={styles.heroName} numberOfLines={1}>
                {parentName || 'Loading...'}
              </Text>
              <Text style={styles.heroSub}>
                {children.length === 0
                  ? 'Add your first kid to get started'
                  : children.length === 1
                    ? '1 kid connected'
                    : `${children.length} kids connected`}
              </Text>
            </View>

            <PressableScale
              style={styles.logoutBtn}
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Log out"
            >
              <Text style={styles.logoutBtnEmoji}>🚪</Text>
              <Text style={styles.logoutBtnText}>Log out</Text>
            </PressableScale>
          </View>
        </View>

        {/* Kids Accounts */}
        <Text style={styles.sectionTitle}>Kids Accounts</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.kidsRow}
          contentContainerStyle={styles.kidsRowContent}
        >
          {children.length === 0 ? (
            <View style={styles.noKidsCard}>
              <Text style={styles.noKidsEmoji}>👨‍👩‍👧</Text>
              <Text style={styles.noKidsText}>No kids added yet</Text>
              <Text style={styles.noKidsHint}>Tap “Add Kid” to create an account</Text>
            </View>
          ) : (
            children.map((child) => (
              <PressableScale
                key={child.id}
                style={styles.kidCard}
                onPress={() =>
                  router.push({
                    pathname: '/child-details',
                    params: { childId: child.id },
                  })
                }
              >
                <View style={styles.kidAvatar}>
                  <Text style={styles.kidAvatarEmoji}>{child.avatar || '👧'}</Text>
                </View>
                <Text style={styles.kidName} numberOfLines={1}>
                  {child.name}
                </Text>
                <View style={styles.childBadge}>
                  <Text style={styles.childBadgeText}>CHILD</Text>
                </View>
                <Text style={styles.kidCode}>{child.code}</Text>
              </PressableScale>
            ))
          )}

          {/* Add New Kid */}
          <PressableScale
            style={styles.addKidCard}
            onPress={() => router.push('/add-child')}
          >
            <View style={styles.addKidCircle}>
              <Text style={styles.addKidPlus}>+</Text>
            </View>
            <Text style={styles.addKidText}>Add Kid</Text>
          </PressableScale>
        </ScrollView>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <View style={styles.actionsGrid}>
          <PressableScale
            style={styles.actionBtn}
            onPress={() => router.push('/create-chore')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E0F7F5' }]}>
              <Text style={styles.actionEmoji}>📝</Text>
            </View>
            <Text style={styles.actionText}>Create Chore</Text>
          </PressableScale>

          <PressableScale
            style={styles.actionBtn}
            onPress={() => router.push('/create-reward')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FFF4D6' }]}>
              <Text style={styles.actionEmoji}>🎁</Text>
            </View>
            <Text style={styles.actionText}>Create Reward</Text>
          </PressableScale>

          <PressableScale
            style={styles.actionBtn}
            onPress={() => router.push('/approvals')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E0FFF4' }]}>
              <Text style={styles.actionEmoji}>✅</Text>
            </View>
            <Text style={styles.actionText}>Approvals</Text>
          </PressableScale>

          <PressableScale
            style={styles.actionBtn}
            onPress={() => router.push('/discipline')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FFE5E5' }]}>
              <Text style={styles.actionEmoji}>⚖️</Text>
            </View>
            <Text style={styles.actionText}>Discipline</Text>
          </PressableScale>
        </View>
      </ScrollView>

      {/* Bottom Navigation — matches child dashboard shape */}
      <View style={styles.bottomNav}>
        <PressableScale
          style={styles.navItem}
          onPress={() => router.push('/chore-list')}
        >
          <Text style={styles.navEmoji}>📋</Text>
          <Text style={styles.navText}>Chores</Text>
        </PressableScale>

        <PressableScale style={[styles.navItem, styles.navActive]}>
          <Text style={styles.navEmoji}>👨‍👩‍👧</Text>
          <Text style={[styles.navText, styles.navTextActive]}>Kids</Text>
        </PressableScale>

        <PressableScale
          style={styles.navItem}
          onPress={() => router.push('/rewards-list')}
        >
          <Text style={styles.navEmoji}>⭐</Text>
          <Text style={styles.navText}>Rewards</Text>
        </PressableScale>

        <PressableScale
          style={styles.navItem}
          onPress={() => router.push('/settings')}
        >
          <Text style={styles.navEmoji}>⚙️</Text>
          <Text style={styles.navText}>Settings</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3FBF9',
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 130,
  },

  // Hero (aligned with child dashboard)
  hero: {
    backgroundColor: '#0F7F76',
    borderRadius: 28,
    padding: 20,
    marginBottom: 22,
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
    gap: 12,
  },
  heroNameBlock: {
    flexShrink: 1,
  },
  heroGreeting: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    marginBottom: 2,
  },
  heroName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heroSub: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
  },
  logoutBtnEmoji: {
    fontSize: 15,
  },
  logoutBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C62828',
  },

  // Section titles
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1F2D2B',
    marginBottom: 14,
  },

  // Kids row
  kidsRow: {
    marginBottom: 28,
  },
  kidsRowContent: {
    gap: 14,
    paddingRight: 8,
  },
  noKidsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#DDF1EE',
    paddingVertical: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  noKidsEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  noKidsText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2D2B',
  },
  noKidsHint: {
    fontSize: 13,
    color: '#6B7C79',
    marginTop: 4,
    textAlign: 'center',
  },
  kidCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    width: 130,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  kidAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E0F7F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  kidAvatarEmoji: {
    fontSize: 32,
  },
  kidName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2D2B',
    marginBottom: 6,
    textAlign: 'center',
  },
  childBadge: {
    backgroundColor: '#FFE5E5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  childBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E63946',
    letterSpacing: 0.4,
  },
  kidCode: {
    fontSize: 12,
    color: '#6B7C79',
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Add Kid card
  addKidCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    width: 130,
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
    borderStyle: 'dashed',
    justifyContent: 'center',
  },
  addKidCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0FFFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  addKidPlus: {
    fontSize: 34,
    color: '#4ECDC4',
    fontWeight: '300',
  },
  addKidText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F7F76',
  },

  // Quick Actions
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 14,
  },
  actionBtn: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  actionIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionEmoji: {
    fontSize: 26,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2D2B',
  },

  // Bottom Nav (matches child shape & active style)
  bottomNav: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 26,
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: 18,
  },
  navActive: {
    backgroundColor: '#E6F8F6',
  },
  navEmoji: {
    fontSize: 24,
  },
  navText: {
    fontSize: 12,
    color: '#7C8B88',
    fontWeight: '700',
  },
  navTextActive: {
    color: '#0F7F76',
  },
});