import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, font, radius, spacing, TOUCH_TARGET } from '@/src/theme';

interface Props {
  initialValue?: string;
  autoFocus?: boolean;
  onSubmit: (query: string) => void;
}

export function SearchBar({ initialValue = '', autoFocus, onSubmit }: Props) {
  const [value, setValue] = useState(initialValue);
  const submit = () => {
    const q = value.trim();
    if (q) onSubmit(q);
  };

  return (
    <View style={styles.container}>
      <Ionicons name="search" size={22} color={colors.textMuted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
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
        style={({ pressed }) => [styles.go, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel="Lancer la recherche"
      >
        <Ionicons name="arrow-forward" size={24} color={colors.accentText} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    minHeight: 64,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: font.body + 2,
    paddingVertical: spacing.md,
  },
  go: {
    width: TOUCH_TARGET + 4,
    height: TOUCH_TARGET + 4,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
