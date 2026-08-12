import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { auth } from '../config/firebase';

export default function RootLayout() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (loading) return;

    const checkSession = async () => {
      if (user) {
        // Parent is logged in
        router.replace('/parent-dashboard');
      } else {
        // Check if child session exists
        const childSession = await AsyncStorage.getItem('childSession');
        if (childSession) {
          // Child is logged in
          router.replace('/child-dashboard');
        } else {
          // Nobody logged in
          router.replace('/');
        }
      }
    };

    checkSession();
  }, [user, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="parent-login" />
      <Stack.Screen name="child-login" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="parent-dashboard" />
      <Stack.Screen name="add-child" />
      <Stack.Screen name="family-code" />
      <Stack.Screen name="child-dashboard" />
      <Stack.Screen name="create-chore" />
      <Stack.Screen name="approvals" />
      <Stack.Screen name="approval-detail" />
      <Stack.Screen name="create-reward" />
      <Stack.Screen name="child-rewards" />
      <Stack.Screen name="chore-list" />
      <Stack.Screen name="rewards-list" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}