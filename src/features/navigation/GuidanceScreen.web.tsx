import { StyleSheet, Text, View } from 'react-native';

import { colors, font } from '@/src/theme';

// Le guidage n'existe que dans l'application mobile (Navigation SDK natif).
export function GuidanceScreen(_props: { placeId: string; name: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>Le guidage est disponible dans l’application mobile.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  text: { color: colors.textMuted, fontSize: font.body },
});
