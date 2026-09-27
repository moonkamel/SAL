import { StyleSheet, Text, View } from 'react-native';

import { colors, font, spacing } from '@/src/theme';

/**
 * Attribution exigée par Google quand des données Places sont affichées
 * ailleurs que sur une carte Google (liste de résultats, fiche lieu).
 */
export function GoogleAttribution() {
  return (
    <View style={styles.container} accessibilityLabel="Données fournies par Google Maps">
      <Text style={styles.text}>
        Données <Text style={styles.brand}>Google Maps</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: spacing.lg },
  text: { color: colors.textFaint, fontSize: font.tiny },
  brand: { color: colors.textMuted, fontWeight: '600' },
});
