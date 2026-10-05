import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/src/i18n';
import { font, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import { decimal } from '@/shared/i18n';
import { formatDistance } from '@/shared/format';
import { AMBIANCE_LABELS, type Ambiance, type PriceLevel, type SearchFilters } from '@/shared/types';

import { Chip } from './Chip';
import { themedStyles } from '@/src/theme/tone';

export const DISTANCE_OPTIONS = [500, 1000, 2000, 5000];
export const RATING_OPTIONS = [3.5, 4, 4.5];
const PRICE_OPTIONS: PriceLevel[] = [1, 2, 3, 4];
const AMBIANCE_OPTIONS = Object.keys(AMBIANCE_LABELS) as Ambiance[];

/** Filtres de la feuille (« Ouvert maintenant » est un interrupteur à part). */
export function countActiveFilters(f: SearchFilters): number {
  return (
    (f.maxDistanceMeters ? 1 : 0) +
    (f.priceLevels?.length ? 1 : 0) +
    (f.minRating ? 1 : 0) +
    (f.ambiance?.length ?? 0)
  );
}

interface Props {
  visible: boolean;
  filters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
  onClose: () => void;
}

export function FilterSheet({ visible, filters, onApply, onClose }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<SearchFilters>(filters);
  const { t, lang } = useI18n();

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const toggleAmbiance = (a: Ambiance) => {
    const current = draft.ambiance ?? [];
    const next = current.includes(a) ? current.filter((x) => x !== a) : [...current, a];
    setDraft({ ...draft, ambiance: next.length ? next : undefined });
  };

  const togglePrice = (p: PriceLevel) => {
    const current = draft.priceLevels ?? [];
    const next = current.includes(p) ? current.filter((x) => x !== p) : [...current, p].sort();
    setDraft({ ...draft, priceLevels: next.length ? next : undefined });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('Fermer les filtres')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.title}>{t('Filtres')}</Text>
        <ScrollView contentContainerStyle={{ gap: spacing.xl }}>
          <View style={styles.section}>
            <Text style={styles.label}>{t('Ambiance')}</Text>
            <View style={styles.chips}>
              {AMBIANCE_OPTIONS.map((a) => (
                <Chip
                  key={a}
                  label={t(AMBIANCE_LABELS[a])}
                  selected={draft.ambiance?.includes(a) ?? false}
                  onPress={() => toggleAmbiance(a)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{t('Distance maximale')}</Text>
            <View style={styles.chips}>
              {DISTANCE_OPTIONS.map((d) => (
                <Chip
                  key={d}
                  label={formatDistance(d, lang)}
                  selected={draft.maxDistanceMeters === d}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      maxDistanceMeters: draft.maxDistanceMeters === d ? undefined : d,
                    })
                  }
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{t('Prix')}</Text>
            <View style={styles.chips}>
              {PRICE_OPTIONS.map((p) => (
                <Chip
                  key={p}
                  label={'€'.repeat(p)}
                  selected={draft.priceLevels?.includes(p) ?? false}
                  onPress={() => togglePrice(p)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{t('Note minimum')}</Text>
            <View style={styles.chips}>
              {RATING_OPTIONS.map((r) => (
                <Chip
                  key={r}
                  label={t('{rating} ★ et +', { rating: decimal(lang, String(r)) })}
                  selected={draft.minRating === r}
                  onPress={() =>
                    setDraft({ ...draft, minRating: draft.minRating === r ? undefined : r })
                  }
                />
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            style={[styles.button, styles.secondary]}
            onPress={() => setDraft({ openNow: draft.openNow })}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>{t('Réinitialiser')}</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.primary]}
            onPress={() => onApply(draft)}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{t('Appliquer')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = themedStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.xl,
    maxHeight: '80%',
  },
  title: { color: colors.text, fontSize: font.title, fontWeight: '700' },
  section: { gap: spacing.md },
  label: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md },
  button: {
    flex: 1,
    minHeight: TOUCH_TARGET + 8,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.accent },
  primaryText: { color: colors.accentText, fontSize: font.body, fontWeight: '700' },
  secondary: { backgroundColor: colors.surfaceRaised },
  secondaryText: { color: colors.text, fontSize: font.body, fontWeight: '600' },
}));
