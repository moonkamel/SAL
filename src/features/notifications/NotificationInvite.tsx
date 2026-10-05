import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useT } from '@/src/i18n';
import { track } from '@/src/lib/analytics';
import { font, fonts, motion, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import { themedStyles, useColors } from '@/src/theme/tone';

import { useNotifications } from './NotificationsProvider';

/** Invitation de l'accueil : « le programme du week-end, chaque vendredi ». Une seule fois. */
export function NotificationInvite() {
  const colors = useColors();
  const styles = useStyles();
  const t = useT();
  const { prefs, answerInvite } = useNotifications();
  const [busy, setBusy] = useState(false);
  if (Platform.OS === 'web' || prefs.asked) return null;

  const answer = async (accept: boolean) => {
    setBusy(true);
    track('notifications', { invite: accept });
    await answerInvite(accept);
    setBusy(false);
  };

  return (
    <Animated.View entering={FadeIn.duration(motion.base)} exiting={FadeOut.duration(motion.fast)} style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name="notifications" size={22} color={colors.gold} />
      </View>
      <View style={styles.texts}>
        <Text style={styles.title}>{t('Le programme du week-end, chaque vendredi')}</Text>
        <Text style={styles.body}>
          {t('Une notification le vendredi à 17 h 45 avec les meilleures sorties près de chez vous. Rien d’autre.')}
        </Text>
        <View style={styles.actions}>
          <Pressable
            onPress={() => void answer(true)}
            disabled={busy}
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{t('Activer')}</Text>
          </Pressable>
          <Pressable
            onPress={() => void answer(false)}
            disabled={busy}
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>{t('Non merci')}</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const useStyles = themedStyles((colors) => ({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: colors.cardShadow,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldTint,
  },
  texts: { flex: 1, gap: spacing.xs },
  title: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: font.body + 1 },
  body: { color: colors.textMuted, fontSize: font.small, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  primary: {
    minHeight: TOUCH_TARGET - 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    justifyContent: 'center',
  },
  primaryText: { color: colors.accentText, fontSize: font.small, fontWeight: '800' },
  secondary: { minHeight: TOUCH_TARGET - 8, paddingHorizontal: spacing.md, justifyContent: 'center' },
  secondaryText: { color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
}));
