import { Text, View } from 'react-native';

import { useT } from '@/src/i18n';
import { font, spacing } from '@/src/theme';
import { themedStyles } from '@/src/theme/tone';

/**
 * Attribution exigée par Google quand des données Places sont affichées
 * ailleurs que sur une carte Google (liste de résultats, fiche lieu).
 */
export function GoogleAttribution() {
  const styles = useStyles();
  const t = useT();
  return (
    <View style={styles.container} accessibilityLabel={t('Données fournies par Google Maps')}>
      <Text style={styles.text}>
        {t('Données')} <Text style={styles.brand}>Google Maps</Text>
      </Text>
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  container: { alignItems: 'center', paddingVertical: spacing.lg },
  text: { color: colors.textFaint, fontSize: font.tiny },
  brand: { color: colors.textMuted, fontWeight: '600' },
}));
