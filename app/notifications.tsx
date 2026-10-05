import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { useNotifications } from '@/src/features/notifications/NotificationsProvider';
import { useT } from '@/src/i18n';
import { track } from '@/src/lib/analytics';
import { font, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import { themedStyles, useColors } from '@/src/theme/tone';

/** Réglages des notifications et rappels programmés. */
export default function NotificationsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const t = useT();
  const { prefs, granted, setPref, reminders, toggleReminder } = useNotifications();

  const toggle = (key: 'weekend' | 'afterwork') => async (on: boolean) => {
    track('notifications', { [key]: on });
    await setPref(key, on);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {granted === false && (
        <View style={styles.warning}>
          <Ionicons name="notifications-off-outline" size={20} color={colors.closed} />
          <Text style={styles.warningText}>
            {t('Les notifications sont bloquées pour Sortir à Lille. Autorisez-les dans les réglages du téléphone.')}
          </Text>
          <Pressable onPress={() => void Linking.openSettings()} style={styles.link} accessibilityRole="button">
            <Text style={styles.linkText}>{t('Ouvrir les réglages')}</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.card}>
        <Row
          icon="calendar-outline"
          title={t('Le programme du week-end')}
          detail={t('Le vendredi à 17 h 45 : concerts, expos et soirées près de chez vous.')}
          value={prefs.weekend}
          onChange={toggle('weekend')}
        />
        <View style={styles.separator} />
        <Row
          icon="beer-outline"
          title={t('Les bons plans de l’afterwork')}
          detail={t('Le mardi et le jeudi à 17 h : les offres du jour autour de vous.')}
          value={prefs.afterwork}
          onChange={toggle('afterwork')}
        />
      </View>

      <Text style={styles.heading}>{t('Mes rappels')}</Text>
      {reminders.length === 0 ? (
        <Text style={styles.muted}>
          {t('Aucun rappel. Sur la fiche d’un événement, touchez « Me le rappeler » pour être prévenu 2 h avant.')}
        </Text>
      ) : (
        <View style={styles.card}>
          {reminders.map((e, i) => (
            <View key={e.id}>
              {i > 0 && <View style={styles.separator} />}
              <View style={styles.reminder}>
                <Pressable
                  style={{ flex: 1, gap: 2 }}
                  onPress={() => router.push({ pathname: '/event/[id]', params: { id: e.id } })}
                  accessibilityRole="button"
                >
                  <Text style={styles.title} numberOfLines={2}>
                    {e.title}
                  </Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {e.dateLabel} · {e.venueName}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void toggleReminder(e)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('Supprimer le rappel')}
                >
                  <Ionicons name="close-circle" size={24} color={colors.textFaint} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Row({
  icon,
  title,
  detail,
  value,
  onChange,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  detail: string;
  value: boolean;
  onChange: (on: boolean) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={22} color={colors.gold} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.muted}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.open, false: colors.border }}
        thumbColor="#FFFFFF"
        accessibilityLabel={title}
      />
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  separator: { height: 1, backgroundColor: colors.border },
  heading: { color: colors.text, fontSize: font.body, fontWeight: '800', marginTop: spacing.sm },
  title: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: font.small, lineHeight: 20 },
  warning: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.closed,
    backgroundColor: colors.surface,
  },
  warningText: { color: colors.text, fontSize: font.small, lineHeight: 20 },
  link: { alignSelf: 'flex-start', minHeight: TOUCH_TARGET - 8, justifyContent: 'center' },
  linkText: { color: colors.accent, fontSize: font.small, fontWeight: '800' },
}));
