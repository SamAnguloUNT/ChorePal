import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  SafeAreaView, ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View
} from 'react-native';

const MOCK_CHILDREN = [
  { id: '1', name: 'Sarah', age: 10, avatar: '🐶', code: 'SARAH-4X9K' },
  { id: '2', name: 'Jacob', age: 8, avatar: '🐱', code: 'JACOB-7M2P' },
];

export default function ParentDashboard() {
  const router = useRouter();
  const [children, setChildren] = useState(MOCK_CHILDREN);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back! 👋</Text>
            <Text style={styles.name}>Jane Doe</Text>
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>J</Text>
          </View>
        </View>

        {/* Kids Section */}
        <Text style={styles.sectionTitle}>Kids Accounts</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.kidsRow}
          contentContainerStyle={styles.kidsRowContent}>
          {children.map((child) => (
            <TouchableOpacity key={child.id} style={styles.kidCard}>
              <View style={styles.kidAvatar}>
                <Text style={styles.kidAvatarEmoji}>{child.avatar}</Text>
              </View>
              <Text style={styles.kidName}>{child.name}</Text>
              <View style={styles.childBadge}>
                <Text style={styles.childBadgeText}>CHILD</Text>
              </View>
              <Text style={styles.kidCode}>{child.code}</Text>
            </TouchableOpacity>
          ))}

          {/* Add New Kid */}
          <TouchableOpacity
            style={styles.addKidCard}
            onPress={() => router.push('/add-child')}>
            <View style={styles.addKidCircle}>
              <Text style={styles.addKidPlus}>+</Text>
            </View>
            <Text style={styles.addKidText}>Add Kid</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Parent Accounts */}
        <Text style={styles.sectionTitle}>Parent Accounts</Text>
        <View style={styles.parentCard}>
          <View style={styles.parentInfo}>
            <View style={styles.parentInitial}>
              <Text style={styles.parentInitialText}>J</Text>
            </View>
            <View>
              <Text style={styles.parentName}>Jane Doe</Text>
              <Text style={styles.parentRole}>MOM</Text>
            </View>
          </View>
          <Text style={styles.parentArrow}>›</Text>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/chore-list')}>
          <Text style={styles.actionEmoji}>📋</Text>
          <Text style={styles.actionText}>Chores</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/rewards-list')}>
          <Text style={styles.actionEmoji}>⭐</Text>
         <Text style={styles.actionText}>Rewards</Text>
         </TouchableOpacity>
         <TouchableOpacity 
           style={styles.actionBtn}
           onPress={() => router.push('/approvals')}>
           <Text style={styles.actionEmoji}>✅</Text>
          <Text style={styles.actionText}>Approvals</Text>
         </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionEmoji}>⚙️</Text>
            <Text style={styles.actionText}>Settings</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/chore-list')}>
           <Text style={styles.navEmoji}>📋</Text>
           <Text style={styles.navText}>Chores</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navItem, styles.navActive]}>
          <Text style={styles.navEmoji}>👨‍👩‍👧</Text>
          <Text style={[styles.navText, styles.navTextActive]}>Kids</Text>
        </TouchableOpacity>
       <TouchableOpacity style={styles.navItem} onPress={() => router.push('/rewards-list')}>
             <Text style={styles.navEmoji}>⭐</Text>
             <Text style={styles.navText}>Rewards</Text>
      </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navEmoji}>⚙️</Text>
          <Text style={styles.navText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 100 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  greeting: { fontSize: 14, color: '#888', fontWeight: '500' },
  name: { fontSize: 22, fontWeight: '800', color: '#2D2D2D' },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },

  // Section Title
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D2D2D',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Kids Row
  kidsRow: { marginBottom: 28 },
  kidsRowContent: { gap: 12, paddingRight: 24 },
  kidCard: {
    backgroundColor: '#F0FFFE',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    width: 110,
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
  },
  kidAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kidAvatarEmoji: { fontSize: 28 },
  kidName: { fontSize: 14, fontWeight: '700', color: '#2D2D2D', marginBottom: 4 },
  childBadge: {
    backgroundColor: '#E63946',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6,
  },
  childBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  kidCode: { fontSize: 9, color: '#888', fontWeight: '600' },

  // Add Kid Card
  addKidCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    width: 110,
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderStyle: 'dashed',
  },
  addKidCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  addKidPlus: { fontSize: 28, color: '#888', fontWeight: '300' },
  addKidText: { fontSize: 14, fontWeight: '600', color: '#888' },

  // Parent Card
  parentCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  parentInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  parentInitial: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentInitialText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  parentName: { fontSize: 15, fontWeight: '700', color: '#2D2D2D' },
  parentRole: { fontSize: 11, color: '#888', fontWeight: '600' },
  parentArrow: { fontSize: 22, color: '#CCC' },

  // Quick Actions
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#F0FFFE',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4ECDC4',
  },
  actionEmoji: { fontSize: 22, marginBottom: 4 },
  actionText: { fontSize: 11, fontWeight: '600', color: '#2D9E98' },

  // Bottom Nav
  bottomNav: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingVertical: 10,
    paddingBottom: 24,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 2 },
  navActive: {},
  navEmoji: { fontSize: 22 },
  navText: { fontSize: 11, color: '#888', fontWeight: '600' },
  navTextActive: { color: '#4ECDC4' },
});