import { StyleSheet, Text, View } from 'react-native';

import { colors, font } from '@/src/theme';

import type { PlacesMapProps } from './PlacesMap';

// Le Navigation SDK est natif uniquement. La cible web ne sert qu'à exporter les
// routes API (EAS Hosting) : on affiche simplement un encart à la place de la carte.
export function PlacesMap({ style }: PlacesMapProps) {
  return (
    <View style={[styles.box, style]}>
      <Text style={styles.text}>Carte disponible dans l’application mobile</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.textMuted, fontSize: font.small },
});
