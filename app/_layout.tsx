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
      <Stack.Screen name="create-chore" />
      <Stack.Screen name="approvals" />
      <Stack.Screen name="approval-detail" />
      <Stack.Screen name="create-reward" />
      <Stack.Screen name="child-rewards" />
      <Stack.Screen name="chore-list" />
      <Stack.Screen name="rewards-list" />
    </Stack>
  );
}