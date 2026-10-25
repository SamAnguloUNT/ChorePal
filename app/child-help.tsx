import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import AnimatedEntry from '../components/AnimatedEntry';
import PressableScale from '../components/PressableScale';
import { ChildTheme, useChildTheme } from '../utils/childTheme';

const HELP_ITEMS = [
  {
    icon: '📋',
    question: 'How do I finish a chore?',
    answer: 'Tap a chore on the Chores tab. Do the chore, then take a photo that shows it is done and tap Submit. ChorePal checks your photo, then your parent says yes!',
  },
  {
    icon: '🪙',
    question: 'What are coins?',
    answer: 'You earn coins when your parent approves a chore. The number on each chore shows how many coins it is worth.',
  },
  {
    icon: '🎁',
    question: 'How do I spend my coins?',
    answer: 'Go to the Rewards tab and tap a reward you like. If you have enough coins you can buy it. If not, you will see how many more you need.',
  },
  {
    icon: '🔁',
    question: 'Why did my chore come back?',
    answer: 'Your parent may ask you to redo it. Tap the chore to read their message, fix it up, and send a new photo.',
  },
  {
    icon: '📸',
    question: 'ChorePal said "Not quite". What now?',
    answer: 'Make sure the chore is really finished and the photo is bright and clear, then tap Try Again and take a new photo.',
  },
  {
    icon: '📅',
    question: 'What is the Calendar for?',
    answer: 'It shows which day each chore is due. Tap a day to see its chores. Green dots mean done, yellow means waiting, and red means overdue.',
  },
  {
    icon: '🔊',
    question: 'Can I hear a chore read out loud?',
    answer: 'Yes! Tap the little speaker button on a chore or reward and it will be read to you.',
  },
  {
    icon: '🔔',
    question: 'How do I turn reminders on or off?',
    answer: 'Open Settings, then Notifications. You can turn alerts on or off there, and set your home so ChorePal can remind you when you get home.',
  },
];

export default function ChildHelpScreen() {
  const router = useRouter();
  const { theme } = useChildTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [open, setOpen] = useState<number | null>(0);

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
        <Text style={styles.title}>Need Help?</Text>
        <Text style={styles.subtitle}>Tap a question to see the answer</Text>

        <View style={styles.list}>
          {HELP_ITEMS.map((item, index) => {
            const isOpen = open === index;
            return (
              <AnimatedEntry key={item.question} index={index}>
                <PressableScale
                  style={[styles.item, isOpen && styles.itemOpen]}
                  onPress={() => setOpen(isOpen ? null : index)}
                  accessibilityRole="button"
                  accessibilityLabel={item.question}>
                  <View style={styles.itemTop}>
                    <View style={styles.iconBox}>
                      <Text style={styles.icon}>{item.icon}</Text>
                    </View>
                    <Text style={styles.question}>{item.question}</Text>
                    <Text style={styles.arrow}>{isOpen ? '▼' : '›'}</Text>
                  </View>
                  {isOpen && <Text style={styles.answer}>{item.answer}</Text>}
                </PressableScale>
              </AnimatedEntry>
            );
          })}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

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
    title: { fontSize: 34, fontWeight: '900', color: t.text, textAlign: 'center' },
    subtitle: { fontSize: 14, fontWeight: '600', color: t.muted, textAlign: 'center', marginTop: 4, marginBottom: 20 },

    list: { gap: 12 },
    item: {
      backgroundColor: t.card,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: t.border,
      padding: 14,
    },
    itemOpen: { borderColor: t.primary },
    itemTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 15,
      backgroundColor: t.tint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: { fontSize: 22 },
    question: { flex: 1, fontSize: 16, fontWeight: '800', color: t.text },
    arrow: { fontSize: 20, color: t.primary, fontWeight: '800' },
    answer: {
      fontSize: 15,
      color: t.muted,
      lineHeight: 23,
      fontWeight: '500',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1.5,
      borderTopColor: t.divider,
    },
  });
