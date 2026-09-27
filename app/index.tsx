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
import { AdBanner } from '@/src/features/ads/AdBanner';
import { useAds } from '@/src/features/ads/AdsProvider';
import { useSearchHistory } from '@/src/features/history/useSearchHistory';
import { colors, font, spacing, TOUCH_TARGET } from '@/src/theme';

const SUGGESTIONS = ['Resto japonais', 'Afterwork', 'Boîte de nuit', 'Brunch', 'Bar à cocktails'];

export default function HomeScreen() {
  const { history, add, clear } = useSearchHistory();
  const { onSearch, privacyOptionsRequired, showPrivacyOptions } = useAds();

  const search = (query: string) => {
    add(query);
    router.push({ pathname: '/results', params: { q: query } });
    // Peut afficher l'interstitiel (au plus une fois par session, jamais à la 1re recherche).
    onSearch();
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
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.push('/favorites')}
              style={({ pressed }) => [styles.favButton, pressed && { opacity: 0.75 }]}
              accessibilityRole="button"
              accessibilityLabel="Mes favoris"
            >
              <Ionicons name="heart" size={20} color={colors.accent} />
              <Text style={styles.favText}>Favoris</Text>
            </Pressable>
          </View>

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

        {privacyOptionsRequired && (
          <Pressable
            onPress={() => void showPrivacyOptions()}
            style={styles.privacy}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.privacyText}>Confidentialité et publicité</Text>
          </Pressable>
        )}
        <AdBanner />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingTop: spacing.lg, gap: spacing.xl },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end' },
  favButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  favText: { color: colors.text, fontSize: font.small + 1, fontWeight: '600' },
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
  privacy: { alignItems: 'center', paddingVertical: spacing.sm },
  privacyText: { color: colors.textFaint, fontSize: font.tiny, textDecorationLine: 'underline' },
  historyText: { flex: 1, color: colors.text, fontSize: font.body },
});
