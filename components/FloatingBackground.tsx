import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import type { ThemeKey } from '../utils/childTheme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type Floater = {
  kind: 'orb' | 'dot' | 'emoji';
  left: number;       // 0..1 of screen width
  size: number;
  duration: number;   // ms for one trip from bottom to top
  delay: number;
  color?: string;     // orbs and dots
  emoji?: string;     // emoji floaters
  alpha?: number;     // peak opacity for emoji floaters
  spin?: number;      // degrees it rocks left and right while floating
};

// The original soft orbs and dots. Every theme without its own set uses these.
const ORBS: Floater[] = [
  // Large soft orbs (atmosphere)
  { kind: 'orb', left: 0.05, size: 70, color: 'rgba(78, 205, 196, 0.18)', duration: 18000, delay: 0 },
  { kind: 'orb', left: 0.55, size: 90, color: 'rgba(244, 185, 66, 0.14)', duration: 22000, delay: 4000 },
  { kind: 'orb', left: 0.75, size: 55, color: 'rgba(15, 127, 118, 0.12)', duration: 16000, delay: 2000 },
  { kind: 'orb', left: 0.25, size: 48, color: 'rgba(123, 97, 255, 0.10)', duration: 20000, delay: 7000 },

  // Smaller accent shapes
  { kind: 'dot', left: 0.18, size: 10, color: 'rgba(244, 185, 66, 0.55)', duration: 14000, delay: 1500 },
  { kind: 'dot', left: 0.42, size: 8,  color: 'rgba(78, 205, 196, 0.5)',  duration: 12000, delay: 5000 },
  { kind: 'dot', left: 0.68, size: 12, color: 'rgba(15, 127, 118, 0.4)',  duration: 15000, delay: 3000 },
  { kind: 'dot', left: 0.88, size: 9,  color: 'rgba(244, 185, 66, 0.45)', duration: 13000, delay: 8000 },
  { kind: 'dot', left: 0.32, size: 7,  color: 'rgba(123, 97, 255, 0.35)', duration: 11000, delay: 9500 },
];

// Cleaning supplies drifting up like bubbles. Kept faint so chore text stays easy to read.
const CLEANING: Floater[] = [
  { kind: 'emoji', emoji: '🧹', left: 0.04, size: 38, alpha: 0.45, spin: 16, duration: 21000, delay: 0 },
  { kind: 'emoji', emoji: '🫧', left: 0.22, size: 30, alpha: 0.55, spin: 6,  duration: 15000, delay: 3000 },
  { kind: 'emoji', emoji: '🧽', left: 0.40, size: 34, alpha: 0.45, spin: 14, duration: 19000, delay: 7000 },
  { kind: 'emoji', emoji: '🧴', left: 0.58, size: 36, alpha: 0.45, spin: 12, duration: 23000, delay: 1500 },
  { kind: 'emoji', emoji: '🪣', left: 0.76, size: 38, alpha: 0.45, spin: 10, duration: 20000, delay: 5000 },
  { kind: 'emoji', emoji: '🧼', left: 0.88, size: 30, alpha: 0.45, spin: 14, duration: 17000, delay: 9000 },
  { kind: 'emoji', emoji: '🫧', left: 0.12, size: 22, alpha: 0.55, spin: 6,  duration: 13000, delay: 8500 },
  { kind: 'emoji', emoji: '✨', left: 0.50, size: 20, alpha: 0.6,  spin: 20, duration: 12000, delay: 4000 },
  { kind: 'emoji', emoji: '🫧', left: 0.68, size: 26, alpha: 0.55, spin: 6,  duration: 16000, delay: 11000 },
  { kind: 'emoji', emoji: '🧺', left: 0.30, size: 36, alpha: 0.4,  spin: 10, duration: 24000, delay: 10000 },
];

// Which floaters each theme shows. Add a theme here to give it its own background.
// Themes not listed fall back to the original orbs.
const BACKGROUNDS: Partial<Record<ThemeKey, Floater[]>> = {
  sunlight: CLEANING,
};

function FloaterView({ kind, left, size, color, emoji, alpha = 1, spin = 0, duration, delay }: Floater) {
  const rise = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const riseLoop = Animated.loop(
      Animated.timing(rise, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const swayLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    riseLoop.start();
    swayLoop.start();
    return () => {
      riseLoop.stop();
      swayLoop.stop();
    };
  }, [rise, sway, duration, delay]);

  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_H + 60, -100] });
  const translateX = sway.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] });
  const scale = sway.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] });
  const opacity = rise.interpolate({ inputRange: [0, 0.12, 0.82, 1], outputRange: [0, alpha, alpha, 0] });

  if (kind === 'emoji') {
    const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: [`-${spin}deg`, `${spin}deg`] });
    return (
      <Animated.Text
        style={{
          position: 'absolute',
          left: SCREEN_W * left,
          fontSize: size,
          opacity,
          transform: [{ translateY }, { translateX }, { rotate }, { scale }],
        }}>
        {emoji}
      </Animated.Text>
    );
  }

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: SCREEN_W * left,
        width: size,
        height: size,
        borderRadius: kind === 'orb' ? size / 2 : size * 0.3,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }, { translateX }, { scale }],
      }}
    />
  );
}

export default function FloatingBackground({ themeKey = 'light' }: { themeKey?: ThemeKey }) {
  const floaters = BACKGROUNDS[themeKey] ?? ORBS;
  return (
    // key restarts the animations cleanly when the theme changes
    <View key={themeKey} style={StyleSheet.absoluteFill} pointerEvents="none">
      {floaters.map((f, i) => (
        <FloaterView key={i} {...f} />
      ))}
    </View>
  );
}