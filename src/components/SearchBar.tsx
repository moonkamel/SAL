import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, font, gradients, radius, shadows, spacing, TOUCH_TARGET } from '@/src/theme';

interface Props {
  initialValue?: string;
  autoFocus?: boolean;
  onSubmit: (query: string) => void;
}

export function SearchBar({ initialValue = '', autoFocus, onSubmit }: Props) {
  const [value, setValue] = useState(initialValue);
  const [focused, setFocused] = useState(false);
  const submit = () => {
    const q = value.trim();
    if (q) onSubmit(q);
  };

  return (
    <View style={[styles.container, focused && styles.focused]}>
      <Ionicons name="search" size={22} color={colors.textMuted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={colors.gold}
        placeholder="Manger japonais, aller danser…"
        placeholderTextColor={colors.textFaint}
        returnKeyType="search"
        autoFocus={autoFocus}
        autoCorrect={false}
        accessibilityLabel="Rechercher un lieu"
        maxLength={120}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => setValue('')}
          hitSlop={12}
          accessibilityLabel="Effacer la recherche"
        >
          <Ionicons name="close-circle" size={22} color={colors.textFaint} />
        </Pressable>
      )}
      <Pressable
        onPress={submit}
        style={({ pressed }) => [styles.goWrap, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel="Lancer la recherche"
      >
        <LinearGradient colors={gradients.brick} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.go}>
          <Ionicons name="arrow-forward" size={24} color={colors.accentText} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
    boxShadow: shadows.raised,
  },
  focused: { borderColor: colors.gold },
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
});
