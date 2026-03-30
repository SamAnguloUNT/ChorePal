import { Stack } from 'expo-router';

export default function RootLayout() {
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
    </Stack>
  );
}