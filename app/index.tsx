import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/src/components/Chip';
import { LocationBanner } from '@/src/components/LocationBanner';
import { SearchBar } from '@/src/components/SearchBar';
import { useSearchHistory } from '@/src/features/history/useSearchHistory';
import { colors, font, spacing, TOUCH_TARGET } from '@/src/theme';

const SUGGESTIONS = ['Resto japonais', 'Afterwork', 'Boîte de nuit', 'Brunch', 'Bar à cocktails'];

export default function HomeScreen() {
  const { history, add, clear } = useSearchHistory();

  const search = (query: string) => {
    add(query);
    router.push({ pathname: '/results', params: { q: query } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.hero}>Qu’est-ce qu’on fait ce soir à Lille ?</Text>

          <SearchBar onSubmit={search} />

          <View style={styles.chips}>
            {SUGGESTIONS.map((s) => (
              <Chip key={s} label={s} onPress={() => search(s)} />
            ))}
          </View>

          <LocationBanner />

          {history.length > 0 && (
            <View style={styles.history}>
              <View style={styles.historyHeader}>
                <Text style={styles.sectionTitle}>Recherches récentes</Text>
                <Pressable onPress={clear} hitSlop={12} accessibilityRole="button">
                  <Text style={styles.clear}>Effacer</Text>
                </Pressable>
              </View>
              {history.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => search(q)}
                  style={({ pressed }) => [styles.historyItem, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Relancer la recherche ${q}`}
                >
                  <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                  <Text style={styles.historyText} numberOfLines={1}>
                    {q}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.textFaint} />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Emplacement réservé à la bannière AdMob (étape 5). */}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingTop: spacing.xxl * 2, gap: spacing.xl },
  hero: {
    color: colors.text,
    fontSize: font.hero,
    fontWeight: '800',
    lineHeight: font.hero * 1.2,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  history: { gap: spacing.xs },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionTitle: { color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  clear: { color: colors.accent, fontSize: font.small, fontWeight: '600' },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: TOUCH_TARGET,
  },
  historyText: { flex: 1, color: colors.text, fontSize: font.body },
});
