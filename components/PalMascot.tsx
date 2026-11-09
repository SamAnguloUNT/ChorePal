import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

export type PalMood = 'sleepy' | 'working' | 'party';

type Props = {
  mood: PalMood;
  // How many of the clipboard's 3 checklist boxes are ticked (0-3).
  checked: number;
  size?: number;
  // Pass the phone's "Reduce Motion" setting: Pal then stays still.
  reduceMotion?: boolean;
  // The child's theme: Pal is recolored to match it.
  themeKey?: ThemeKey;
};

import type { ThemeKey } from '../utils/childTheme';

// Pal's colors for each child theme. Add a theme here to recolor Pal for it.
type PalPalette = {
  bodyTop: string; bodyBottom: string;   // clipboard gradient
  panelTop: string; panelBottom: string; // paper gradient
  dark: string;                          // arms, closed eyes, check marks
  eye: string; mouth: string;
  box: string;                           // checkbox outline
  line: string;                          // checklist lines + motion marks
  clip: string; clipBar: string;         // the clip at the top
  cheek: string; cheekSleepy: string;
  zz1: string; zz2: string;              // sleepy "z z"
};

const PAL_PALETTES: Record<ThemeKey, PalPalette> = {
  light: {
    bodyTop: '#0fb3a3', bodyBottom: '#25d77f', panelTop: '#f6fdfa', panelBottom: '#c5f6dc',
    dark: '#0e7f66', eye: '#0b4f3e', mouth: '#0b5a47', box: '#14a07c', line: '#19b98c',
    clip: '#0fb3a3', clipBar: '#0aa598', cheek: '#17b97a', cheekSleepy: '#7fd6b4', zz1: '#7fb9ae', zz2: '#a6d2c8',
  },
  sunlight: {
    bodyTop: '#F4B942', bodyBottom: '#FFD66B', panelTop: '#FFFDF5', panelBottom: '#FFEFC2',
    dark: '#A86B12', eye: '#5C3D07', mouth: '#6E4A0B', box: '#D9962A', line: '#F0B23E',
    clip: '#E9A332', clipBar: '#DB9420', cheek: '#F59E7B', cheekSleepy: '#F8C9A8', zz1: '#C9A45C', zz2: '#E2C78C',
  },
  dark: {
    bodyTop: '#2A9D8F', bodyBottom: '#4ECDC4', panelTop: '#E9F7F5', panelBottom: '#B8E8E1',
    dark: '#3DBDB2', eye: '#0B2E2A', mouth: '#0B3B36', box: '#1F7F74', line: '#7FE3DA',
    clip: '#2A9D8F', clipBar: '#23887C', cheek: '#4ECDC4', cheekSleepy: '#8ADBD3', zz1: '#7FE3DA', zz2: '#4E8F88',
  },
  ocean: {
    bodyTop: '#1F6FB2', bodyBottom: '#4FB3E8', panelTop: '#F5FAFF', panelBottom: '#CBE6FA',
    dark: '#134B7A', eye: '#0D2F4D', mouth: '#123A5E', box: '#2C7CC0', line: '#4AA3E0',
    clip: '#1F6FB2', clipBar: '#195F9A', cheek: '#6FC3F0', cheekSleepy: '#A9DAF5', zz1: '#7FA9C9', zz2: '#AFCBE0',
  },
  earth: {
    bodyTop: '#3E8E2F', bodyBottom: '#8BCB5A', panelTop: '#FBFDF5', panelBottom: '#DDEFC8',
    dark: '#2E5E1F', eye: '#1E3A14', mouth: '#29481B', box: '#4C9A39', line: '#6BBF59',
    clip: '#8A5A2B', clipBar: '#74481F', cheek: '#E8A27C', cheekSleepy: '#F0C4A6', zz1: '#8FAE7A', zz2: '#B9CFA8',
  },
  galaxy: {
    bodyTop: '#6E3BB8', bodyBottom: '#B06CF0', panelTop: '#FBF7FF', panelBottom: '#E6D5FA',
    dark: '#4B2385', eye: '#2D1B4E', mouth: '#3A1F66', box: '#8A4FD6', line: '#B07CF0',
    clip: '#6E3BB8', clipBar: '#5E30A0', cheek: '#F27BA6', cheekSleepy: '#F5B3CC', zz1: '#9C86C4', zz2: '#C4B4E0',
  },
  pink: {
    bodyTop: '#E05A92', bodyBottom: '#F9A8C9', panelTop: '#FFF8FB', panelBottom: '#FCD9E7',
    dark: '#A3305F', eye: '#5A1A35', mouth: '#7A2448', box: '#D9568C', line: '#F27BA6',
    clip: '#E05A92', clipBar: '#C9497F', cheek: '#FF8FB1', cheekSleepy: '#FBC0D3', zz1: '#C99AAE', zz2: '#E2C2CF',
  },
};

// The ChorePal logo clipboard, redrawn so its face, arms and checklist can change with progress.
export default function PalMascot({ mood, checked, size = 230, reduceMotion = false, themeKey = 'light' }: Props) {
  const c = PAL_PALETTES[themeKey] ?? PAL_PALETTES.light;
  const G_DARK = c.dark;
  const sleepy = mood === 'sleepy';
  const party = mood === 'party';
  const lift = useRef(new Animated.Value(0)).current;
  const [blink, setBlink] = useState(false);

  // Bounce (working), big bounce (party), slow breathing (sleepy).
  useEffect(() => {
    lift.setValue(0);
    if (reduceMotion) return;
    const duration = party ? 380 : sleepy ? 2400 : 900;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lift, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(lift, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [lift, mood, party, sleepy, reduceMotion]);

  // Blink every few seconds while working.
  useEffect(() => {
    if (reduceMotion || mood !== 'working') {
      setBlink(false);
      return;
    }
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      setBlink(true);
      closeTimer = setTimeout(() => setBlink(false), 150);
    }, 3200);
    return () => {
      clearInterval(id);
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, [mood, reduceMotion]);

  const translateY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, party ? -16 : sleepy ? 0 : -9] });
  const scale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, sleepy ? 1.035 : 1] });

  const closedLines = (
    <>
      <Path d="M188 236 H248" stroke={G_DARK} strokeWidth={11} strokeLinecap="round" />
      <Path d="M352 236 H412" stroke={G_DARK} strokeWidth={11} strokeLinecap="round" />
    </>
  );

  let eyes;
  if (sleepy || (!party && blink)) {
    eyes = closedLines;
  } else if (party) {
    eyes = (
      <>
        <Path d="M182 254 Q218 186 254 254" fill="none" stroke={G_DARK} strokeWidth={15} strokeLinecap="round" />
        <Path d="M346 254 Q382 186 418 254" fill="none" stroke={G_DARK} strokeWidth={15} strokeLinecap="round" />
      </>
    );
  } else {
    eyes = (
      <>
        <Ellipse cx={218} cy={232} rx={17} ry={21} fill={c.eye} />
        <Ellipse cx={382} cy={232} rx={17} ry={21} fill={c.eye} />
        <Circle cx={224} cy={224} r={6} fill="#fff" />
        <Circle cx={388} cy={224} r={6} fill="#fff" />
      </>
    );
  }

  let mouth;
  if (sleepy) mouth = <Ellipse cx={300} cy={300} rx={13} ry={10} fill={c.mouth} />;
  else if (party) mouth = <Path d="M244 280 H356 A56 56 0 0 1 244 280 Z" fill={c.mouth} />;
  else mouth = <Path d="M262 288 Q300 326 338 288" fill="none" stroke={c.mouth} strokeWidth={11} strokeLinecap="round" />;

  const lineEnds = [450, 440, 430];
  const rows = [0, 1, 2].map((i) => {
    const y = 352 + i * 80;
    return (
      <G key={i}>
        <Rect x={146} y={y} width={58} height={58} rx={12} fill="#fff" stroke={c.box} strokeWidth={7} />
        {i < checked && (
          <Path
            d={`M160 ${y + 30} L174 ${y + 43} L194 ${y + 16}`}
            fill="none"
            stroke={G_DARK}
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        <Path d={`M236 ${y + 29} H${lineEnds[i]}`} stroke={c.line} strokeWidth={15} strokeLinecap="round" />
      </G>
    );
  });

  const armUpL = (
    <>
      <Path d="M92 430 C46 420 30 385 40 345" fill="none" stroke={G_DARK} strokeWidth={19} strokeLinecap="round" />
      <Circle cx={40} cy={322} r={34} fill={G_DARK} />
    </>
  );
  const armUpR = (
    <>
      <Path d="M508 480 C556 470 572 430 560 392" fill="none" stroke={G_DARK} strokeWidth={19} strokeLinecap="round" />
      <Circle cx={560} cy={368} r={34} fill={G_DARK} />
    </>
  );
  const armDownL = (
    <>
      <Path d="M92 430 C56 450 44 490 52 530" fill="none" stroke={G_DARK} strokeWidth={19} strokeLinecap="round" />
      <Circle cx={54} cy={553} r={30} fill={G_DARK} />
    </>
  );
  const armDownR = (
    <>
      <Path d="M508 480 C548 500 556 530 548 560" fill="none" stroke={G_DARK} strokeWidth={19} strokeLinecap="round" />
      <Circle cx={548} cy={582} r={30} fill={G_DARK} />
    </>
  );
  const arms = sleepy ? (
    <>
      {armDownL}
      {armDownR}
    </>
  ) : party ? (
    <>
      {armUpL}
      {armUpR}
    </>
  ) : (
    <>
      {armDownL}
      {armUpR}
    </>
  );

  let extras;
  if (party) {
    extras = (
      <>
        <Path d="M-6 150 L24 205" stroke={c.line} strokeWidth={13} strokeLinecap="round" />
        <Path d="M-34 222 L18 250" stroke={c.line} strokeWidth={13} strokeLinecap="round" />
        <Path d="M628 218 L598 268" stroke={c.line} strokeWidth={13} strokeLinecap="round" />
        <Path d="M650 296 L598 306" stroke={c.line} strokeWidth={13} strokeLinecap="round" />
      </>
    );
  } else if (!sleepy) {
    extras = (
      <>
        <Path d="M628 240 L602 282" stroke={c.line} strokeWidth={12} strokeLinecap="round" />
        <Path d="M648 312 L604 320" stroke={c.line} strokeWidth={12} strokeLinecap="round" />
      </>
    );
  } else {
    extras = (
      <>
        <SvgText x={548} y={96} fontSize={52} fontWeight="900" fill={c.zz1}>z</SvgText>
        <SvgText x={604} y={48} fontSize={38} fontWeight="900" fill={c.zz2}>z</SvgText>
      </>
    );
  }

  const cheek = sleepy ? c.cheekSleepy : c.cheek;

  return (
    <Animated.View
      accessible
      accessibilityLabel={
        party ? 'Pal the clipboard is celebrating' : sleepy ? 'Pal the clipboard is sleepy' : 'Pal the clipboard is cheering you on'
      }
      style={{ width: size, height: size, transform: [{ translateY }, { scale }] }}>
      <Svg width={size} height={size} viewBox="-70 -10 740 740">
        <Defs>
          <LinearGradient id={`palBody-${themeKey}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.bodyTop} />
            <Stop offset="1" stopColor={c.bodyBottom} />
          </LinearGradient>
          <LinearGradient id={`palPanel-${themeKey}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.panelTop} />
            <Stop offset="1" stopColor={c.panelBottom} />
          </LinearGradient>
        </Defs>
        {extras}
        <G rotation={sleepy ? 2 : 4} origin="300, 380">
          {arms}
          <Rect x={86} y={96} width={428} height={566} rx={62} fill={`url(#palBody-${themeKey})`} />
          <Rect x={116} y={126} width={368} height={506} rx={40} fill={`url(#palPanel-${themeKey})`} />
          <Circle cx={300} cy={72} r={54} fill={c.clip} />
          <Circle cx={300} cy={62} r={16} fill="#fff" />
          <Rect x={182} y={64} width={236} height={92} rx={28} fill={c.clipBar} />
          {eyes}
          <Ellipse cx={182} cy={290} rx={27} ry={12} fill={cheek} />
          <Ellipse cx={418} cy={290} rx={27} ry={12} fill={cheek} />
          {mouth}
          {rows}
        </G>
      </Svg>
    </Animated.View>
  );
}