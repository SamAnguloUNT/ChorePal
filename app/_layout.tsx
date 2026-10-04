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
        router.replace('/parent-dashboard');
      } else {
        const childSession = await AsyncStorage.getItem('childSession');
        if (childSession) {
          router.replace('/child-dashboard');
        } else {
          router.replace('/');
        }
      }
    };

    checkSession();
  }, [user, loading]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#fff',
        }}
      >
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 250,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        contentStyle: { backgroundColor: '#F7F9FA' },
      }}
    >
      {/* ========== Auth Screens ========== */}
      <Stack.Screen name="index" />
      <Stack.Screen name="parent-login" />
      <Stack.Screen name="child-login" />
      <Stack.Screen name="sign-up" />

      {/* ========== Dashboards (NO swipe back) ========== */}
      <Stack.Screen
        name="parent-dashboard"
        options={{
          gestureEnabled: false,
          headerBackVisible: false,
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="child-dashboard"
        options={{
          gestureEnabled: false,
          headerBackVisible: false,
          animation: 'fade',
        }}
      />

      {/* ========== Create Screens (nice bottom slide) ========== */}
      <Stack.Screen
        name="create-chore"
        options={{
          animation: 'fade_from_bottom',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="create-reward"
        options={{
          animation: 'fade_from_bottom',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="add-child"
        options={{
          animation: 'fade_from_bottom',
          presentation: 'card',
        }}
      />

      {/* ========== Other Screens ========== */}
      <Stack.Screen
        name="family-code"
        options={{ animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="approvals"
        options={{ animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="approval-detail"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="child-rewards"
        options={{ animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="chore-list"
        options={{ animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="rewards-list"
        options={{ animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="settings"
        options={{ animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="discipline"
        options={{ animation: 'fade_from_bottom' }}
      />
    </Stack>
  );
}