import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

import AnimatedEntry from '../components/AnimatedEntry';
import FloatingBackground from '../components/FloatingBackground';
import PressableScale from '../components/PressableScale';

// Chevron that nudges to the right every few seconds to invite a tap
function NudgeChevron({ color, skip }: { color: string; skip: boolean }) {
  const nudge = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (skip) {
      nudge.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1800),
        Animated.timing(nudge, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(nudge, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(nudge, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(nudge, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [nudge, skip]);
  return (
    <Animated.View
      style={{ transform: [{ translateX: nudge.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) }] }}>
      <Ionicons name="chevron-forward" size={24} color={color} />
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const [reduceMotion, setReduceMotion] = useState(false);

  // Logo bob + glowing halo behind it
  const bob = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      bob.setValue(0);
      halo.setValue(0);
      return;
    }
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const haloLoop = Animated.loop(
      Animated.timing(halo, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    bobLoop.start();
    haloLoop.start();
    return () => {
      bobLoop.stop();
      haloLoop.stop();
    };
  }, [bob, halo, reduceMotion]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Decorative circles + floating cleaning emojis, all behind the content */}
      <View style={styles.circleTop} pointerEvents="none" />
      <View style={styles.circleBottom} pointerEvents="none" />
      {!reduceMotion && <FloatingBackground themeKey="sunlight" />}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoStage}>
            {/* Pulsing halo rings */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.halo,
                {
                  opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                  transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.logoCard,
                { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] },
              ]}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </Animated.View>
          </View>

          <AnimatedEntry index={1}>
            <View style={styles.taglinePill}>
              <Text style={styles.tagline}>Making chores fun & rewarding!</Text>
            </View>
          </AnimatedEntry>

        </View>

        {/* Who are you */}
        <View style={styles.bottomSection}>
          <AnimatedEntry index={3}>
            <Text style={styles.question}>Who are you?</Text>
          </AnimatedEntry>

          <AnimatedEntry index={4}>
            <PressableScale
              style={[styles.roleCard, styles.parentCard]}
              onPress={() => router.push('/parent-login')}
              accessibilityRole="button"
              accessibilityLabel="I'm a Parent"
            >
              <View style={[styles.roleIcon, styles.parentIcon]}>
                <Ionicons name="people" size={32} color="#0F7F76" />
              </View>
              <View style={styles.roleTextBlock}>
                <Text style={[styles.roleTitle, styles.parentTitle]}>I'm a Parent</Text>
                <Text style={[styles.roleSub, styles.parentSub]}>
                  Set up your family, chores, and rewards
                </Text>
              </View>
              <NudgeChevron color="#FFFFFF" skip={reduceMotion} />
            </PressableScale>
          </AnimatedEntry>

          <AnimatedEntry index={5}>
            <PressableScale
              style={[styles.roleCard, styles.childCard]}
              onPress={() => router.push('/child-login')}
              accessibilityRole="button"
              accessibilityLabel="I'm a Child"
            >
              <View style={[styles.roleIcon, styles.childIcon]}>
                <Ionicons name="happy" size={32} color="#0F7F76" />
              </View>
              <View style={styles.roleTextBlock}>
                <Text style={[styles.roleTitle, styles.childTitle]}>I'm a Child</Text>
                <Text style={[styles.roleSub, styles.childSub]}>
                  Join with your Family Code and PIN
                </Text>
              </View>
              <NudgeChevron color="#4ECDC4" skip={reduceMotion} />
            </PressableScale>
          </AnimatedEntry>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3FBF9' },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 36,
    justifyContent: 'space-between',
  },

  // Decorative background circles
  circleTop: {
    position: 'absolute',
    top: -110,
    right: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(78, 205, 196, 0.16)',
  },
  circleBottom: {
    position: 'absolute',
    bottom: -90,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(244, 185, 66, 0.14)',
  },

  // Logo
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  logoStage: { alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: 232,
    height: 232,
    borderRadius: 116,
    backgroundColor: '#4ECDC4',
  },
  logoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#E3F1EE',
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 5,
  },
  logoImage: { width: 170, height: 170 },
  taglinePill: {
    backgroundColor: '#E0F7F5',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 22,
  },
  tagline: { fontSize: 15, color: '#0F7F76', fontWeight: '800' },

  // Role cards
  bottomSection: { gap: 14, marginTop: 8 },
  question: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1F2D2B',
    textAlign: 'center',
    marginBottom: 4,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  parentCard: {
    backgroundColor: '#0F7F76',
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  childCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
    shadowColor: '#0F7F76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  roleIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentIcon: { backgroundColor: '#FFFFFF' },
  childIcon: { backgroundColor: '#E0F7F5' },
  roleTextBlock: { flex: 1 },
  roleTitle: { fontSize: 19, fontWeight: '900' },
  parentTitle: { color: '#FFFFFF' },
  childTitle: { color: '#1F2D2B' },
  roleSub: { fontSize: 13, fontWeight: '600', marginTop: 3, lineHeight: 18 },
  parentSub: { color: 'rgba(255,255,255,0.85)' },
  childSub: { color: '#6B7C79' },
});