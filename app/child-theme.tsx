import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import AnimatedEntry from '../components/AnimatedEntry';
import PressableScale from '../components/PressableScale';
import {
  ChildTheme,
  loadChildThemeKey,
  saveChildThemeKey,
  THEME_ORDER,
  ThemeKey,
  THEMES,
} from '../utils/childTheme';

// Tiny landscape thumbnail painted in the theme's own colors
function ThemePreview({ t }: { t: ChildTheme }) {
  return (
    <View style={[previewStyles.box, { backgroundColor: t.bg, borderColor: t.primaryDark }]}>
      <Text style={previewStyles.deco}>{t.icon}</Text>
      <View style={[previewStyles.hill, { backgroundColor: t.primary, left: -14, bottom: -38 }]} />
      <View style={[previewStyles.hill, { backgroundColor: t.primaryDark, left: 34, bottom: -44, opacity: 0.85 }]} />
    </View>
  );
}

export default function ChildThemeScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<ThemeKey>('light');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadChildThemeKey().then((k) => {
      setSelected(k);
      setReady(true);
    });
  }, []);

  // The whole screen previews whichever theme is picked
  const t = THEMES[selected];
  const styles = useMemo(() => makeStyles(t), [t]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveChildThemeKey(selected);
      Alert.alert('Theme saved! 🎨', `${THEMES[selected].name} is on.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error!', error?.message || 'Could not save your theme.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.topBar}>
          <PressableScale
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back to settings">
            <Text style={styles.backArrow}>←</Text>
          </PressableScale>
        </View>
        <Text style={styles.title}>App Theme</Text>

        {!ready ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={t.primary} />
          </View>
        ) : (
          <>
            <View style={styles.list}>
              {THEME_ORDER.map((key, index) => {
                const item = THEMES[key];
                const isSelected = key === selected;
                return (
                  <AnimatedEntry key={key} index={index}>
                    <PressableScale
                      style={[styles.row, isSelected && styles.rowSelected]}
                      onPress={() => setSelected(key)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={item.name}>
                      <ThemePreview t={item} />
                      <View style={styles.nameBlock}>
                        <Text style={styles.nameIcon}>{item.icon}</Text>
                        <Text style={styles.name}>{item.name}</Text>
                      </View>
                      <View style={[styles.radio, isSelected && styles.radioOn]}>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                    </PressableScale>
                  </AnimatedEntry>
                );
              })}
            </View>

            <PressableScale
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saving ? undefined : handleSave}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save theme">
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Theme'}</Text>
            </PressableScale>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const previewStyles = StyleSheet.create({
  box: {
    width: 92,
    height: 62,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
  },
  deco: { position: 'absolute', top: 4, right: 6, fontSize: 14 },
  hill: { position: 'absolute', width: 76, height: 76, borderRadius: 38 },
});

const makeStyles = (t: ChildTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 50 },

    topBar: { flexDirection: 'row', marginBottom: 6 },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.card,
      borderWidth: 1.5,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backArrow: { fontSize: 22, color: t.primaryDark, fontWeight: '800' },
    title: { fontSize: 34, fontWeight: '900', color: t.text, textAlign: 'center', marginBottom: 20 },
    loading: { paddingVertical: 60, alignItems: 'center' },

    list: { gap: 12, marginBottom: 24 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: t.card,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: t.border,
      padding: 12,
    },
    rowSelected: { borderColor: t.primary, borderWidth: 2.5, backgroundColor: t.tint },
    nameBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    nameIcon: { fontSize: 22 },
    name: { fontSize: 18, fontWeight: '800', color: t.text, flexShrink: 1 },

    radio: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2.5,
      borderColor: t.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { borderColor: t.primaryDark },
    radioDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: t.primaryDark },

    saveBtn: {
      backgroundColor: t.primary,
      borderRadius: 20,
      paddingVertical: 18,
      alignItems: 'center',
      shadowColor: t.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    saveBtnText: { color: t.onPrimary, fontSize: 20, fontWeight: '900' },
  });