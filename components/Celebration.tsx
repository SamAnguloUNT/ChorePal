import LottieView from 'lottie-react-native';
import { StyleSheet } from 'react-native';

type Props = {
  // A Lottie JSON file, e.g. require('../assets/confetti.json')
  source: any;
  // Called when the animation finishes (useful if you want to hide it)
  onDone?: () => void;
  // true = repeat forever (good for mascots/backgrounds), false = play once (confetti)
  loop?: boolean;
};

// Full-screen Lottie overlay. It ignores touches, so it never blocks buttons.
// Mount it to start playing; unmount it to stop.
export default function Celebration({ source, onDone, loop = false }: Props) {
  return (
    <LottieView
      source={source}
      autoPlay
      loop={loop}
      onAnimationFinish={onDone}
      resizeMode="cover"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />
  );
}