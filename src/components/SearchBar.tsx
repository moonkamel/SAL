import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { font, gradients, radius, shadows, spacing, TOUCH_TARGET } from '@/src/theme';
import { useT } from '@/src/i18n';
import { useTone, themedStyles, useColors } from '@/src/theme/tone';

interface Props {
  initialValue?: string;
  autoFocus?: boolean;
  onSubmit: (query: string) => void;
}

export function SearchBar({ initialValue = '', autoFocus, onSubmit }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const [value, setValue] = useState(initialValue);
  const [focused, setFocused] = useState(false);
  const { tone, c } = useTone();
  const t = useT();
  const submit = () => {
    const q = value.trim();
    if (q) onSubmit(q);
  };

  return (
    <View
      style={[
        styles.container,
        tone === 'day' && { backgroundColor: c.surface, borderColor: c.border, boxShadow: c.cardShadow },
        focused && { borderColor: c.gold },
      ]}
    >
      <Ionicons name="search" size={22} color={c.textMuted} />
      <TextInput
        style={[styles.input, { color: c.text }]}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={c.gold}
        placeholder={t('Manger japonais, aller danser…')}
        placeholderTextColor={c.textFaint}
        returnKeyType="search"
        autoFocus={autoFocus}
        autoCorrect={false}
        accessibilityLabel={t('Rechercher un lieu')}
        maxLength={120}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => setValue('')}
          hitSlop={12}
          accessibilityLabel={t('Effacer la recherche')}
        >
          <Ionicons name="close-circle" size={22} color={c.textFaint} />
        </Pressable>
      )}
      <Pressable
        onPress={submit}
        style={({ pressed }) => [styles.goWrap, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel={t('Lancer la recherche')}
      >
        <LinearGradient colors={gradients.brick} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.go}>
          <Ionicons name="arrow-forward" size={24} color={colors.accentText} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderColor: 'rgba(245, 238, 226, 0.10)',
    borderWidth: 1,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs + 2,
    minHeight: 68,
    boxShadow: colors.raisedShadow,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: font.body + 2,
    paddingVertical: spacing.md,
  },
  goWrap: { borderRadius: radius.md, boxShadow: shadows.glow },
  go: {
    width: TOUCH_TARGET + 6,
    height: TOUCH_TARGET + 6,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
