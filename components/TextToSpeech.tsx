import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

// ===== Voice settings: change these to change how the app sounds =====
// Voices to try, in order of preference. The first one found on the phone is used.
const PREFERRED_VOICE_NAMES = ['Ava', 'Zoe', 'Samantha', 'Evan', 'Nathan'];
const SPEECH_RATE = 0.9;   // 1.0 = normal speed, lower = slower
const SPEECH_PITCH = 1.0;  // 1.0 = natural, higher = squeakier
// =====================================================================

let cachedVoiceId: string | undefined;
let voiceLookedUp = false;

// Find the best-sounding English voice installed on this phone
async function getBestVoice() {
  if (voiceLookedUp) return cachedVoiceId;
  voiceLookedUp = true;

  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const english = voices.filter(v => v.language?.startsWith('en-US'));

    // Shows every available voice in the Expo terminal, so you can pick favorites
    if (__DEV__) {
      console.log('Available voices:', english.map(v => `${v.name} (${v.quality})`).join(', '));
    }

    // 1. Try the preferred voices in order, favoring Enhanced quality
    for (const name of PREFERRED_VOICE_NAMES) {
      const matches = english.filter(v => v.name?.includes(name));
      const best = matches.find(v => v.quality === Speech.VoiceQuality.Enhanced) || matches[0];
      if (best) {
        cachedVoiceId = best.identifier;
        return cachedVoiceId;
      }
    }

    // 2. Otherwise use any Enhanced English voice
    cachedVoiceId = english.find(v => v.quality === Speech.VoiceQuality.Enhanced)?.identifier;
  } catch (e) {
    console.log('Voice lookup error:', e);
  }

  // 3. If nothing is found, cachedVoiceId stays undefined and the phone's default voice is used
  return cachedVoiceId;
}

// Shared speak function, used by the button AND by other screens
export async function speak(
  text: string,
  callbacks: { onDone?: () => void; onStopped?: () => void; onError?: () => void } = {}
) {
  // Let speech play even when the iPhone is on silent
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch (e) {
    console.log('Audio mode error:', e);
  }

  const voice = await getBestVoice();
  await Speech.stop();

  Speech.speak(text, {
    language: 'en-US',
    voice,
    rate: SPEECH_RATE,
    pitch: SPEECH_PITCH,
    onDone: callbacks.onDone,
    onStopped: callbacks.onStopped,
    onError: callbacks.onError,
  });
}

type TextToSpeechProps = {
  text: string;      // the text to read aloud
  size?: number;     // icon size
  color?: string;    // icon color
};

export default function TextToSpeech({
  text,
  size = 28,
  color = '#4ECDC4',
}: TextToSpeechProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false);

  const updateSpeaking = (value: boolean) => {
    isSpeakingRef.current = value;
    setIsSpeaking(value);
  };

  // Stop speaking if the user leaves the screen mid-sentence
  useEffect(() => {
    return () => {
      if (isSpeakingRef.current) {
        Speech.stop();
      }
    };
  }, []);

  const handlePress = async () => {
    // Second tap stops the speech
    if (isSpeaking) {
      await Speech.stop();
      updateSpeaking(false);
      return;
    }

    updateSpeaking(true);
    await speak(text, {
      onDone: () => updateSpeaking(false),
      onStopped: () => updateSpeaking(false),
      onError: () => updateSpeaking(false),
    });
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={12} // bigger tap area for small fingers
      accessibilityRole="button"
      accessibilityLabel={isSpeaking ? 'Stop reading' : 'Read aloud'}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons
        name={isSpeaking ? 'stop-circle' : 'volume-high'}
        size={size}
        color={color}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 6,
    borderRadius: 999,
  },
  pressed: {
    opacity: 0.6,
  },
});