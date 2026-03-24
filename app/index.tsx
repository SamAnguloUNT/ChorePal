import { useRouter } from 'expo-router';
import { Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>Making chores fun & rewarding!</Text>
        </View>

        {/* Who are you */}
        <View style={styles.bottomSection}>
          <Text style={styles.question}>Who are you?</Text>

          <TouchableOpacity
            style={[styles.btn, styles.parentBtn]}
            onPress={() => router.push('/parent-login')}>
            <Text style={styles.btnEmoji}>🧑‍👧</Text>
            <Text style={styles.btnText}>I'm a Parent</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.childBtn]}
            onPress={() => router.push('/child-login')}>
            <Text style={styles.btnEmoji}>👦</Text>
            <Text style={styles.btnText}>I'm a Child</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  logoContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoImage: { width: 220, height: 220 },
  tagline: { fontSize: 16, color: '#4ECDC4', marginTop: 12, fontWeight: '600' },
  bottomSection: { gap: 12 },
  question: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2D2D2D',
    textAlign: 'center',
    marginBottom: 8,
  },
  btn: {
    width: '100%',
    padding: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  parentBtn: {
    backgroundColor: '#4ECDC4',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  childBtn: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#4ECDC4',
  },
  btnEmoji: { fontSize: 26 },
  btnText: { fontSize: 18, fontWeight: '700', color: '#2D9E98' },
});