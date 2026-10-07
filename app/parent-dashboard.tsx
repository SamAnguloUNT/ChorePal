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
  TouchableOpacity,
  View,
} from 'react-native';

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
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back 👋</Text>
            <Text style={styles.name}>{parentName || 'Loading...'}</Text>
          </View>

          <TouchableOpacity style={styles.avatarCircle} onPress={handleLogout}>
            <Text style={styles.avatarText}>
              {parentName ? parentName.charAt(0).toUpperCase() : '?'}
            </Text>
          </TouchableOpacity>
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
            <Text style={styles.noKidsText}>No kids added yet!</Text>
          ) : (
            children.map((child) => (
              <TouchableOpacity
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
                  <Text style={styles.kidAvatarEmoji}>{child.avatar}</Text>
                </View>
                <Text style={styles.kidName} numberOfLines={1}>
                  {child.name}
                </Text>
                <View style={styles.childBadge}>
                  <Text style={styles.childBadgeText}>CHILD</Text>
                </View>
                <Text style={styles.kidCode}>{child.code}</Text>
              </TouchableOpacity>
            ))
          )}

          {/* Add New Kid */}
          <TouchableOpacity
            style={styles.addKidCard}
            onPress={() => router.push('/add-child')}
          >
            <View style={styles.addKidCircle}>
              <Text style={styles.addKidPlus}>+</Text>
            </View>
            <Text style={styles.addKidText}>Add Kid</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/create-chore')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E0F7F5' }]}>
              <Text style={styles.actionEmoji}>📝</Text>
            </View>
            <Text style={styles.actionText}>Create Chore</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/create-reward')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
              <Text style={styles.actionEmoji}>🎁</Text>
            </View>
            <Text style={styles.actionText}>Create Reward</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/approvals')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#D1FAE5' }]}>
              <Text style={styles.actionEmoji}>✅</Text>
            </View>
            <Text style={styles.actionText}>Approvals</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/discipline')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FEE2E2' }]}>
              <Text style={styles.actionEmoji}>⚖️</Text>
            </View>
            <Text style={styles.actionText}>Discipline</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/chore-list')}
        >
          <Text style={styles.navEmoji}>📋</Text>
          <Text style={styles.navText}>Chores</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.navItem, styles.navActive]}>
          <Text style={styles.navEmoji}>👨‍👩‍👧</Text>
          <Text style={[styles.navText, styles.navTextActive]}>Kids</Text>
          <View style={styles.activeIndicator} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/rewards-list')}
        >
          <Text style={styles.navEmoji}>⭐</Text>
          <Text style={styles.navText}>Rewards</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/settings')}
        >
          <Text style={styles.navEmoji}>⚙️</Text>
          <Text style={styles.navText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F8',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 120,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
    backgroundColor: '#E8F8F7',
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  greeting: {
    fontSize: 14,
    color: '#0D9488',
    fontWeight: '600',
    marginBottom: 2,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: '#134E4A',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },

  // Section titles
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // Kids row
  kidsRow: {
    marginBottom: 32,
  },
  kidsRowContent: {
    gap: 14,
    paddingRight: 8,
  },
  noKidsText: {
    fontSize: 14,
    color: '#94A3B8',
    alignSelf: 'center',
    marginRight: 12,
  },
  kidCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    width: 124,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  kidAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  kidAvatarEmoji: {
    fontSize: 30,
  },
  kidName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  childBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  childBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
    letterSpacing: 0.4,
  },
  kidCode: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Add Kid card
  addKidCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    width: 124,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
  },
  addKidCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  addKidPlus: {
    fontSize: 32,
    color: '#94A3B8',
    fontWeight: '300',
  },
  addKidText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
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
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionEmoji: {
    fontSize: 24,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },

  // Bottom Nav
  bottomNav: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    paddingBottom: 28,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  navActive: {},
  navEmoji: {
    fontSize: 22,
    marginBottom: 3,
  },
  navText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  navTextActive: {
    color: '#0D9488',
    fontWeight: '700',
  },
  activeIndicator: {
    marginTop: 5,
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#4ECDC4',
  },
});