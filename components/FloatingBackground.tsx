import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
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

// Pink: bunnies, hearts and flowers.
const BUNNIES: Floater[] = [
  { kind: 'emoji', emoji: '🐰', left: 0.04, size: 38, alpha: 0.45, spin: 12, duration: 21000, delay: 0 },
  { kind: 'emoji', emoji: '💗', left: 0.22, size: 26, alpha: 0.5, spin: 10, duration: 15000, delay: 3000 },
  { kind: 'emoji', emoji: '🌸', left: 0.4, size: 30, alpha: 0.45, spin: 12, duration: 19000, delay: 7000 },
  { kind: 'emoji', emoji: '🐇', left: 0.58, size: 36, alpha: 0.45, spin: 12, duration: 23000, delay: 1500 },
  { kind: 'emoji', emoji: '🥕', left: 0.76, size: 32, alpha: 0.45, spin: 16, duration: 20000, delay: 5000 },
  { kind: 'emoji', emoji: '💕', left: 0.88, size: 26, alpha: 0.5, spin: 12, duration: 17000, delay: 9000 },
  { kind: 'emoji', emoji: '🎀', left: 0.12, size: 28, alpha: 0.45, spin: 12, duration: 16000, delay: 8500 },
  { kind: 'emoji', emoji: '🐰', left: 0.5, size: 30, alpha: 0.45, spin: 12, duration: 24000, delay: 11000 },
  { kind: 'emoji', emoji: '🌸', left: 0.68, size: 24, alpha: 0.5, spin: 12, duration: 14000, delay: 4000 },
  { kind: 'emoji', emoji: '💗', left: 0.3, size: 20, alpha: 0.5, spin: 12, duration: 13000, delay: 10000 },
];

// Ocean: fish and bubbles rising from the waves.
const SEA: Floater[] = [
  { kind: 'emoji', emoji: '🐠', left: 0.04, size: 36, alpha: 0.45, spin: 8, duration: 22000, delay: 0 },
  { kind: 'emoji', emoji: '🫧', left: 0.2, size: 28, alpha: 0.55, spin: 6, duration: 14000, delay: 2500 },
  { kind: 'emoji', emoji: '🐟', left: 0.38, size: 32, alpha: 0.45, spin: 8, duration: 19000, delay: 6000 },
  { kind: 'emoji', emoji: '🐙', left: 0.56, size: 36, alpha: 0.4, spin: 10, duration: 24000, delay: 1500 },
  { kind: 'emoji', emoji: '🫧', left: 0.72, size: 22, alpha: 0.55, spin: 6, duration: 12000, delay: 4500 },
  { kind: 'emoji', emoji: '🐡', left: 0.86, size: 32, alpha: 0.45, spin: 8, duration: 20000, delay: 9000 },
  { kind: 'emoji', emoji: '🐚', left: 0.14, size: 28, alpha: 0.4, spin: 14, duration: 23000, delay: 10000 },
  { kind: 'emoji', emoji: '🫧', left: 0.48, size: 18, alpha: 0.55, spin: 6, duration: 11000, delay: 7500 },
  { kind: 'emoji', emoji: '🐳', left: 0.64, size: 40, alpha: 0.35, spin: 6, duration: 26000, delay: 12000 },
  { kind: 'emoji', emoji: '🫧', left: 0.92, size: 24, alpha: 0.55, spin: 6, duration: 13000, delay: 3500 },
];

// Earth: leaves, flowers and butterflies.
const NATURE: Floater[] = [
  { kind: 'emoji', emoji: '🍃', left: 0.04, size: 32, alpha: 0.5, spin: 24, duration: 19000, delay: 0 },
  { kind: 'emoji', emoji: '🌼', left: 0.22, size: 28, alpha: 0.45, spin: 12, duration: 17000, delay: 3000 },
  { kind: 'emoji', emoji: '🦋', left: 0.4, size: 32, alpha: 0.45, spin: 18, duration: 21000, delay: 6500 },
  { kind: 'emoji', emoji: '🍂', left: 0.58, size: 30, alpha: 0.45, spin: 26, duration: 20000, delay: 1500 },
  { kind: 'emoji', emoji: '🌿', left: 0.76, size: 32, alpha: 0.45, spin: 12, duration: 22000, delay: 5000 },
  { kind: 'emoji', emoji: '🐞', left: 0.88, size: 24, alpha: 0.45, spin: 12, duration: 16000, delay: 9000 },
  { kind: 'emoji', emoji: '🍃', left: 0.14, size: 24, alpha: 0.5, spin: 24, duration: 15000, delay: 8500 },
  { kind: 'emoji', emoji: '🌱', left: 0.5, size: 26, alpha: 0.45, spin: 12, duration: 23000, delay: 11000 },
  { kind: 'emoji', emoji: '🦋', left: 0.68, size: 26, alpha: 0.45, spin: 18, duration: 18000, delay: 12500 },
  { kind: 'emoji', emoji: '🌼', left: 0.32, size: 22, alpha: 0.45, spin: 12, duration: 14000, delay: 10500 },
];

// Galaxy: planets, rockets and stars.
const SPACE: Floater[] = [
  { kind: 'emoji', emoji: '🪐', left: 0.04, size: 38, alpha: 0.45, spin: 8, duration: 24000, delay: 0 },
  { kind: 'emoji', emoji: '⭐', left: 0.22, size: 24, alpha: 0.55, spin: 20, duration: 15000, delay: 3000 },
  { kind: 'emoji', emoji: '🚀', left: 0.4, size: 34, alpha: 0.45, spin: 10, duration: 19000, delay: 6000 },
  { kind: 'emoji', emoji: '✨', left: 0.58, size: 22, alpha: 0.6, spin: 20, duration: 13000, delay: 1500 },
  { kind: 'emoji', emoji: '🌟', left: 0.74, size: 28, alpha: 0.5, spin: 16, duration: 17000, delay: 5000 },
  { kind: 'emoji', emoji: '☄️', left: 0.88, size: 30, alpha: 0.45, spin: 10, duration: 20000, delay: 9000 },
  { kind: 'emoji', emoji: '🛸', left: 0.14, size: 32, alpha: 0.4, spin: 10, duration: 23000, delay: 10000 },
  { kind: 'emoji', emoji: '⭐', left: 0.5, size: 18, alpha: 0.55, spin: 20, duration: 12000, delay: 8000 },
  { kind: 'emoji', emoji: '🌙', left: 0.66, size: 30, alpha: 0.4, spin: 8, duration: 22000, delay: 12000 },
  { kind: 'emoji', emoji: '✨', left: 0.32, size: 18, alpha: 0.6, spin: 20, duration: 11000, delay: 4500 },
];

// Dark mode: a calm night sky.
const NIGHT: Floater[] = [
  { kind: 'emoji', emoji: '🌙', left: 0.08, size: 34, alpha: 0.35, spin: 8, duration: 26000, delay: 0 },
  { kind: 'emoji', emoji: '⭐', left: 0.3, size: 18, alpha: 0.45, spin: 20, duration: 16000, delay: 3000 },
  { kind: 'emoji', emoji: '✨', left: 0.52, size: 20, alpha: 0.45, spin: 20, duration: 14000, delay: 6000 },
  { kind: 'emoji', emoji: '⭐', left: 0.74, size: 22, alpha: 0.4, spin: 20, duration: 18000, delay: 1500 },
  { kind: 'emoji', emoji: '✨', left: 0.9, size: 16, alpha: 0.45, spin: 20, duration: 13000, delay: 8000 },
  { kind: 'emoji', emoji: '⭐', left: 0.18, size: 14, alpha: 0.4, spin: 20, duration: 15000, delay: 10000 },
  { kind: 'emoji', emoji: '🌟', left: 0.62, size: 22, alpha: 0.35, spin: 14, duration: 21000, delay: 11000 },
];

// Which floaters each theme shows. Add a theme here to give it its own background.
// Themes not listed fall back to the original orbs.
const BACKGROUNDS: Partial<Record<ThemeKey, Floater[]>> = {
  sunlight: CLEANING,
  pink: BUNNIES,
  ocean: SEA,
  earth: NATURE,
  galaxy: SPACE,
  dark: NIGHT,
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


// A still picture behind the floaters: waves, hills or a star field. Faint on purpose so cards
// and text stay easy to read. It also shows when Reduce Motion is on (nothing moves).
const W = SCREEN_W;
const H = SCREEN_H;

// Same "random" stars every time (no flicker between renders)
function seededStars(count: number, seed: number) {
  let x = seed;
  const rnd = () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
  return Array.from({ length: count }, () => ({ cx: rnd() * W, cy: rnd() * H, r: 0.8 + rnd() * 2 }));
}
const STARS = seededStars(46, 7);

function Scenery({ themeKey }: { themeKey: ThemeKey }) {
  if (themeKey === 'ocean') {
    return (
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        {/* Light rays from the surface */}
        <Path d={`M${W * 0.15} 0 L${W * 0.3} 0 L${W * 0.12} ${H * 0.55} Z`} fill="rgba(255,255,255,0.35)" />
        <Path d={`M${W * 0.55} 0 L${W * 0.66} 0 L${W * 0.6} ${H * 0.45} Z`} fill="rgba(255,255,255,0.3)" />
        {/* Waves along the bottom */}
        <Path
          d={`M0 ${H * 0.72} Q${W * 0.25} ${H * 0.68} ${W * 0.5} ${H * 0.72} T${W} ${H * 0.72} V${H} H0 Z`}
          fill="rgba(61,143,209,0.12)"
        />
        <Path
          d={`M0 ${H * 0.8} Q${W * 0.25} ${H * 0.76} ${W * 0.5} ${H * 0.8} T${W} ${H * 0.8} V${H} H0 Z`}
          fill="rgba(31,95,150,0.12)"
        />
      </Svg>
    );
  }
  if (themeKey === 'earth') {
    return (
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Circle cx={W * 0.85} cy={H * 0.1} r={46} fill="rgba(244,185,66,0.18)" />
        <Ellipse cx={W * 0.2} cy={H * 0.86} rx={W * 0.75} ry={H * 0.16} fill="rgba(107,191,89,0.14)" />
        <Ellipse cx={W * 0.9} cy={H * 0.9} rx={W * 0.7} ry={H * 0.15} fill="rgba(62,142,47,0.12)" />
      </Svg>
    );
  }
  if (themeKey === 'galaxy' || themeKey === 'dark') {
    const star = themeKey === 'dark' ? 'rgba(234,246,244,0.35)' : 'rgba(110,59,184,0.25)';
    return (
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        {themeKey === 'galaxy' && (
          <>
            <Ellipse cx={W * 0.2} cy={H * 0.3} rx={W * 0.6} ry={H * 0.12} fill="rgba(176,108,240,0.08)" />
            <Ellipse cx={W * 0.85} cy={H * 0.65} rx={W * 0.5} ry={H * 0.1} fill="rgba(242,123,166,0.07)" />
          </>
        )}
        {STARS.map((st, i) => (
          <Circle key={i} cx={st.cx} cy={st.cy} r={st.r} fill={star} />
        ))}
      </Svg>
    );
  }
  if (themeKey === 'pink') {
    return (
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Ellipse cx={W * 0.1} cy={H * 0.15} rx={110} ry={90} fill="rgba(242,123,166,0.10)" />
        <Ellipse cx={W * 0.95} cy={H * 0.5} rx={120} ry={100} fill="rgba(194,69,122,0.07)" />
        <Ellipse cx={W * 0.5} cy={H * 0.92} rx={W * 0.8} ry={H * 0.1} fill="rgba(242,123,166,0.12)" />
      </Svg>
    );
  }
  if (themeKey === 'sunlight') {
    return (
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        {/* Soft sun glow on the lower left, away from the header buttons */}
        <Circle cx={-30} cy={H * 0.62} r={80} fill="rgba(244,185,66,0.12)" />
        <Circle cx={-30} cy={H * 0.62} r={140} fill="rgba(244,185,66,0.06)" />
      </Svg>
    );
  }
  return null;
}

// `still`: pass the phone's Reduce Motion setting. The picture stays, nothing floats.
export default function FloatingBackground({ themeKey = 'light', still = false }: { themeKey?: ThemeKey; still?: boolean }) {
  const floaters = BACKGROUNDS[themeKey] ?? ORBS;
  return (
    // key restarts the animations cleanly when the theme changes
    <View key={themeKey} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Scenery themeKey={themeKey} />
      {!still && floaters.map((f, i) => (
        <FloaterView key={i} {...f} />
      ))}
    </View>
  );
}