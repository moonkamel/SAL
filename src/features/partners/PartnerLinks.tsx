import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/src/components/PressableScale';
import { partnerLinkUrl } from '@/src/lib/api';
import { colors, font, fonts, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import type { PartnerKind, PartnerLink } from '@/shared/types';

const ICONS: Record<PartnerKind, ComponentProps<typeof Ionicons>['name']> = {
  booking: 'calendar',
  tickets: 'ticket',
  ride: 'car',
  delivery: 'bag-handle',
};

/** Réserver, prendre des billets, commander un VTC : liens d'affiliation signalés. */
export function PartnerLinks({ links }: { links?: PartnerLink[] }) {
  if (!links?.length) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Réserver et y aller</Text>
      {links.map((link) => (
        <PressableScale
          key={link.id}
          onPress={() => void Linking.openURL(partnerLinkUrl(link.path))}
          style={styles.row}
          accessibilityRole="link"
          accessibilityLabel={`${link.label} avec ${link.partner}, lien partenaire`}
        >
          <View style={styles.icon}>
            <Ionicons name={ICONS[link.kind]} size={20} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{link.label}</Text>
            <Text style={styles.partner}>avec {link.partner}</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={colors.textMuted} />
        </PressableScale>
      ))}
      <Text style={styles.disclosure}>
        Liens partenaires : Sortir à Lille peut toucher une commission, sans surcoût pour vous.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: font.body + 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: TOUCH_TARGET + 8,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(230, 180, 90, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  partner: { color: colors.textMuted, fontSize: font.small },
  disclosure: { color: colors.textFaint, fontSize: font.tiny, marginTop: spacing.xs },
});
