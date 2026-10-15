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
};

const G_DARK = '#0e7f66';

// The ChorePal logo clipboard, redrawn so its face, arms and checklist can change with progress.
export default function PalMascot({ mood, checked, size = 230, reduceMotion = false }: Props) {
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
        <Ellipse cx={218} cy={232} rx={17} ry={21} fill="#0b4f3e" />
        <Ellipse cx={382} cy={232} rx={17} ry={21} fill="#0b4f3e" />
        <Circle cx={224} cy={224} r={6} fill="#fff" />
        <Circle cx={388} cy={224} r={6} fill="#fff" />
      </>
    );
  }

  let mouth;
  if (sleepy) mouth = <Ellipse cx={300} cy={300} rx={13} ry={10} fill="#0b5a47" />;
  else if (party) mouth = <Path d="M244 280 H356 A56 56 0 0 1 244 280 Z" fill="#0b5a47" />;
  else mouth = <Path d="M262 288 Q300 326 338 288" fill="none" stroke="#0b5a47" strokeWidth={11} strokeLinecap="round" />;

  const lineEnds = [450, 440, 430];
  const rows = [0, 1, 2].map((i) => {
    const y = 352 + i * 80;
    return (
      <G key={i}>
        <Rect x={146} y={y} width={58} height={58} rx={12} fill="#fff" stroke="#14a07c" strokeWidth={7} />
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
        <Path d={`M236 ${y + 29} H${lineEnds[i]}`} stroke="#19b98c" strokeWidth={15} strokeLinecap="round" />
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
        <Path d="M-6 150 L24 205" stroke="#19b98c" strokeWidth={13} strokeLinecap="round" />
        <Path d="M-34 222 L18 250" stroke="#19b98c" strokeWidth={13} strokeLinecap="round" />
        <Path d="M628 218 L598 268" stroke="#19b98c" strokeWidth={13} strokeLinecap="round" />
        <Path d="M650 296 L598 306" stroke="#19b98c" strokeWidth={13} strokeLinecap="round" />
      </>
    );
  } else if (!sleepy) {
    extras = (
      <>
        <Path d="M628 240 L602 282" stroke="#19b98c" strokeWidth={12} strokeLinecap="round" />
        <Path d="M648 312 L604 320" stroke="#19b98c" strokeWidth={12} strokeLinecap="round" />
      </>
    );
  } else {
    extras = (
      <>
        <SvgText x={548} y={96} fontSize={52} fontWeight="900" fill="#7fb9ae">z</SvgText>
        <SvgText x={604} y={48} fontSize={38} fontWeight="900" fill="#a6d2c8">z</SvgText>
      </>
    );
  }

  const cheek = sleepy ? '#7fd6b4' : '#17b97a';

  return (
    <Animated.View
      accessible
      accessibilityLabel={
        party ? 'Pal the clipboard is celebrating' : sleepy ? 'Pal the clipboard is sleepy' : 'Pal the clipboard is cheering you on'
      }
      style={{ width: size, height: size, transform: [{ translateY }, { scale }] }}>
      <Svg width={size} height={size} viewBox="-70 -10 740 740">
        <Defs>
          <LinearGradient id="palBody" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0fb3a3" />
            <Stop offset="1" stopColor="#25d77f" />
          </LinearGradient>
          <LinearGradient id="palPanel" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#f6fdfa" />
            <Stop offset="1" stopColor="#c5f6dc" />
          </LinearGradient>
        </Defs>
        {extras}
        <G rotation={sleepy ? 2 : 4} origin="300, 380">
          {arms}
          <Rect x={86} y={96} width={428} height={566} rx={62} fill="url(#palBody)" />
          <Rect x={116} y={126} width={368} height={506} rx={40} fill="url(#palPanel)" />
          <Circle cx={300} cy={72} r={54} fill="#0fb3a3" />
          <Circle cx={300} cy={62} r={16} fill="#fff" />
          <Rect x={182} y={64} width={236} height={92} rx={28} fill="#0aa598" />
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