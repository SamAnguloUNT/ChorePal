import { ReactNode, useRef } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  // How small it gets while held down (1 = no change). Default feels like a soft button push.
  pressedScale?: number;
  // Accepted so this can replace <TouchableOpacity activeOpacity={...}> without edits. Not used.
  activeOpacity?: number;
};

// Style keys that decide where the button sits in its parent. These go on the outer wrapper;
// everything else (colors, borders, shadows, padding, inner layout) goes on the part that shrinks.
const LAYOUT_KEYS = new Set([
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf',
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
  'position', 'top', 'left', 'right', 'bottom', 'zIndex', 'aspectRatio',
]);

// Drop-in replacement for TouchableOpacity that squishes down with a springy bounce when pressed.
export default function PressableScale({
  style,
  children,
  pressedScale = 0.95,
  activeOpacity: _ignored,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const canPress = !!rest.onPress || !!rest.onLongPress;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      speed: 40,
      bounciness: value === 1 ? 12 : 0, // bounce back a little when released
      useNativeDriver: true,
    }).start();
  };

  // Split the style so layout (width, flex, margin...) stays on the outside.
  const flat = StyleSheet.flatten(style) || {};
  const outer: Record<string, any> = {};
  const inner: Record<string, any> = {};
  Object.keys(flat).forEach((key) => {
    (LAYOUT_KEYS.has(key) ? outer : inner)[key] = (flat as any)[key];
  });
  // The inner box must always fill the outer one. Otherwise, when a row stretches buttons to
  // the same height (like the kid cards), the visible card stays short and the sizes look uneven.
  inner.flexGrow = inner.flexGrow ?? 1;

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={outer}
      onPressIn={(e) => {
        if (canPress && !disabled) animateTo(pressedScale);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1);
        onPressOut?.(e);
      }}>
      <Animated.View style={[inner, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}