import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// Child-side themes only. "light" is the standard ChorePal look that the child
// screens already use today, so nothing changes unless a child picks another theme.

export type ThemeKey = 'light' | 'sunlight' | 'dark' | 'ocean' | 'earth' | 'galaxy' | 'pink';

export interface ChildTheme {
  key: ThemeKey;
  name: string;
  icon: string;
  bg: string;          // screen background
  card: string;        // cards / rows
  border: string;      // card borders
  divider: string;     // lines between rows
  text: string;        // main text
  muted: string;       // secondary text
  primary: string;     // buttons, active accents
  primaryDark: string; // headings accents, links, active text
  tint: string;        // soft highlight background (active nav, icon boxes)
  onPrimary: string;   // text on top of primary
  hero: string;        // big header card background
  onHero: string;      // text on top of the hero card
  warnTint: string;    // soft amber note boxes
  coinBg: string;      // coin counter pill background
  danger: string;
  dangerTint: string;
}

export const THEMES: Record<ThemeKey, ChildTheme> = {
  light: {
    key: 'light', name: 'Light Mode', icon: '☀️',
    bg: '#EAF9F6', card: '#FFFFFF', border: '#E3F1EE', divider: '#EEF5F4',
    text: '#1F2D2B', muted: '#6B7C79',
    primary: '#4ECDC4', primaryDark: '#0F7F76', tint: '#E6F8F6', onPrimary: '#FFFFFF',
    hero: '#0F7F76', onHero: '#FFFFFF', warnTint: '#FFF8E1', coinBg: '#FFF4D6',
    danger: '#E63946', dangerTint: '#FFE5E5',
  },
  sunlight: {
    key: 'sunlight', name: 'Sunlight', icon: '🌞',
    bg: '#FFF3CD', card: '#FFFBEA', border: '#F3DFA2', divider: '#F8E9B8',
    text: '#4A3B12', muted: '#8A7440',
    primary: '#F4B942', primaryDark: '#B7791F', tint: '#FFE8A3', onPrimary: '#4A3B12',
    hero: '#F4B942', onHero: '#4A3B12', warnTint: '#FFF8E1', coinBg: '#FFE08A',
    danger: '#E63946', dangerTint: '#FFE5E5',
  },
  dark: {
    key: 'dark', name: 'Dark Mode', icon: '🌙',
    bg: '#121C1B', card: '#1C2B29', border: '#2A3F3C', divider: '#263836',
    text: '#EAF6F4', muted: '#9FB5B1',
    primary: '#4ECDC4', primaryDark: '#7FE3DA', tint: '#22403C', onPrimary: '#0B1514',
    hero: '#1F5F58', onHero: '#EAF6F4', warnTint: '#3A3320', coinBg: '#3A3320',
    danger: '#FF6B76', dangerTint: '#3A2226',
  },
  ocean: {
    key: 'ocean', name: 'Ocean', icon: '🌊',
    bg: '#E3EFF9', card: '#FFFFFF', border: '#C9DDEE', divider: '#E1ECF6',
    text: '#13314D', muted: '#5D7B94',
    primary: '#3D8FD1', primaryDark: '#1F5F96', tint: '#DCEBF8', onPrimary: '#FFFFFF',
    hero: '#1F5F96', onHero: '#FFFFFF', warnTint: '#FFF8E1', coinBg: '#FFF4D6',
    danger: '#E63946', dangerTint: '#FFE5E5',
  },
  earth: {
    key: 'earth', name: 'Earth', icon: '🌳',
    bg: '#EAF6E1', card: '#FFFFFF', border: '#D3E5C4', divider: '#E6F0DC',
    text: '#24391C', muted: '#667D58',
    primary: '#6BBF59', primaryDark: '#3E8E2F', tint: '#DFF1D3', onPrimary: '#FFFFFF',
    hero: '#3E8E2F', onHero: '#FFFFFF', warnTint: '#FFF8E1', coinBg: '#FFF4D6',
    danger: '#E63946', dangerTint: '#FFE5E5',
  },
  galaxy: {
    key: 'galaxy', name: 'Galaxy', icon: '✨',
    bg: '#F0E7FB', card: '#FFFFFF', border: '#DCCBF2', divider: '#EDE3F9',
    text: '#2D1B4E', muted: '#7A6A99',
    primary: '#B06CF0', primaryDark: '#6E3BB8', tint: '#EBDDFB', onPrimary: '#FFFFFF',
    hero: '#6E3BB8', onHero: '#FFFFFF', warnTint: '#FFF8E1', coinBg: '#FFF4D6',
    danger: '#E63946', dangerTint: '#FFE5E5',
  },
  pink: {
    key: 'pink', name: 'Pink', icon: '💖',
    bg: '#FDEBF2', card: '#FFFFFF', border: '#F6D3E0', divider: '#FBE4ED',
    text: '#4A1F32', muted: '#9A6B80',
    primary: '#F27BA6', primaryDark: '#C2457A', tint: '#FCDDE9', onPrimary: '#FFFFFF',
    hero: '#C2457A', onHero: '#FFFFFF', warnTint: '#FFF8E1', coinBg: '#FFF4D6',
    danger: '#E63946', dangerTint: '#FFE5E5',
  },
};

let cachedKey: ThemeKey = 'light';

export const THEME_ORDER: ThemeKey[] = ['light', 'sunlight', 'dark', 'ocean', 'earth', 'galaxy', 'pink'];

// Each child gets their own saved theme on this phone.
const storageKey = async () => {
  try {
    const session = await AsyncStorage.getItem('childSession');
    const id = session ? JSON.parse(session).id : null;
    return `childTheme_${id || 'default'}`;
  } catch {
    return 'childTheme_default';
  }
};

export async function loadChildThemeKey(): Promise<ThemeKey> {
  try {
    const saved = await AsyncStorage.getItem(await storageKey());
    if (saved && saved in THEMES) {
      cachedKey = saved as ThemeKey;
      return cachedKey;
    }
  } catch (error) {
    console.log('Could not load theme:', error);
  }
  return 'light';
}

export async function saveChildThemeKey(key: ThemeKey) {
  await AsyncStorage.setItem(await storageKey(), key);
  cachedKey = key;
}

// Reloads the saved theme every time the screen comes into focus,
// so a theme saved on the theme screen shows up as soon as you go back.
export function useChildTheme() {
  const [themeKey, setThemeKey] = useState<ThemeKey>(cachedKey);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadChildThemeKey().then((k) => {
        if (active) setThemeKey(k);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  return { theme: THEMES[themeKey], themeKey };
}