import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import { formatDistance } from '@/shared/format';
import type { PriceLevel, SearchFilters } from '@/shared/types';

import { Chip } from './Chip';

export const DISTANCE_OPTIONS = [500, 1000, 2000, 5000];
export const RATING_OPTIONS = [3.5, 4, 4.5];
const PRICE_OPTIONS: PriceLevel[] = [1, 2, 3, 4];

export function countActiveFilters(f: SearchFilters): number {
  return (
    (f.openNow ? 1 : 0) +
    (f.maxDistanceMeters ? 1 : 0) +
    (f.priceLevels?.length ? 1 : 0) +
    (f.minRating ? 1 : 0)
  );
}

interface Props {
  visible: boolean;
  filters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
  onClose: () => void;
}

export function FilterSheet({ visible, filters, onApply, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<SearchFilters>(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const togglePrice = (p: PriceLevel) => {
    const current = draft.priceLevels ?? [];
    const next = current.includes(p) ? current.filter((x) => x !== p) : [...current, p].sort();
    setDraft({ ...draft, priceLevels: next.length ? next : undefined });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer les filtres" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.title}>Filtres</Text>
        <ScrollView contentContainerStyle={{ gap: spacing.xl }}>
          <View style={styles.switchRow}>
            <Text style={styles.label}>Ouvert maintenant</Text>
            <Switch
              value={draft.openNow ?? false}
              onValueChange={(v) => setDraft({ ...draft, openNow: v || undefined })}
              trackColor={{ true: colors.accent, false: colors.border }}
              accessibilityLabel="Ouvert maintenant"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Distance maximale</Text>
            <View style={styles.chips}>
              {DISTANCE_OPTIONS.map((d) => (
                <Chip
                  key={d}
                  label={formatDistance(d)}
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
            <Text style={styles.label}>Prix</Text>
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
            <Text style={styles.label}>Note minimum</Text>
            <View style={styles.chips}>
              {RATING_OPTIONS.map((r) => (
                <Chip
                  key={r}
                  label={`${String(r).replace('.', ',')} ★ et +`}
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
            onPress={() => setDraft({})}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>Réinitialiser</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.primary]}
            onPress={() => onApply(draft)}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Appliquer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
});
