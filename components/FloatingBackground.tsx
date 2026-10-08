import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Soft orbs + tiny geometric accents. Colors pull from your existing palette.
const FLOATERS = [
  // Large soft orbs (atmosphere)
  { type: 'orb', left: 0.05, size: 70, color: 'rgba(78, 205, 196, 0.18)', duration: 18000, delay: 0 },
  { type: 'orb', left: 0.55, size: 90, color: 'rgba(244, 185, 66, 0.14)', duration: 22000, delay: 4000 },
  { type: 'orb', left: 0.75, size: 55, color: 'rgba(15, 127, 118, 0.12)', duration: 16000, delay: 2000 },
  { type: 'orb', left: 0.25, size: 48, color: 'rgba(123, 97, 255, 0.10)', duration: 20000, delay: 7000 },

  // Smaller accent shapes (stars / diamonds made from Views)
  { type: 'dot', left: 0.18, size: 10, color: 'rgba(244, 185, 66, 0.55)', duration: 14000, delay: 1500 },
  { type: 'dot', left: 0.42, size: 8,  color: 'rgba(78, 205, 196, 0.5)',  duration: 12000, delay: 5000 },
  { type: 'dot', left: 0.68, size: 12, color: 'rgba(15, 127, 118, 0.4)',  duration: 15000, delay: 3000 },
  { type: 'dot', left: 0.88, size: 9,  color: 'rgba(244, 185, 66, 0.45)', duration: 13000, delay: 8000 },
  { type: 'dot', left: 0.32, size: 7,  color: 'rgba(123, 97, 255, 0.35)', duration: 11000, delay: 9500 },
];

function Floater({ type, left, size, color, duration, delay }: (typeof FLOATERS)[number]) {
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
  const opacity = rise.interpolate({ inputRange: [0, 0.12, 0.82, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: SCREEN_W * left,
        width: size,
        height: size,
        borderRadius: type === 'orb' ? size / 2 : size * 0.3,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }, { translateX }, { scale }],
      }}
    />
  );
}

export default function FloatingBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {FLOATERS.map((f, i) => (
        <Floater key={i} {...f} />
      ))}
    </View>
  );
}