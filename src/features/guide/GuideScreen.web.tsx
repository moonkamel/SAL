import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from '@/src/theme';

// Mapbox (carte native) n'existe pas sur le web : la cible web ne sert qu'aux routes API.
export function GuideScreen(_: { placeId: string; name: string; destination: unknown; mode: string; returnOnArrival?: boolean }) {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>Le guidage est disponible dans l’application mobile.</Text>
      <Pressable style={styles.button} onPress={() => router.back()}>
        <Text style={styles.buttonText}>Retour</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  text: { color: colors.textMuted, fontSize: font.body },
  button: { backgroundColor: colors.surfaceRaised, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  buttonText: { color: colors.text, fontWeight: '700' },
});
