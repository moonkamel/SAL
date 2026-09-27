import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientButton } from '@/src/components/GradientButton';
import { LilleSkyline } from '@/src/components/LilleSkyline';
import { getRatings, saveRating } from '@/src/features/ratings/ratings';
import { colors, font, fonts, radius, spacing, TOUCH_TARGET } from '@/src/theme';

export default function ArrivedScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const [rating, setRating] = useState(0);

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void getRatings().then((r) => setRating(r[id] ?? 0));
  }, [id]);

  const rate = (value: number) => {
    void Haptics.selectionAsync();
    setRating(value);
    void saveRating(id, value);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      <View style={styles.content}>
        <LilleSkyline style={styles.skyline} />
        <Ionicons name="flag" size={72} color={colors.gold} />
        <Text style={styles.title}>Vous êtes arrivé !</Text>
        {name && <Text style={styles.place}>{name}</Text>}

        <View style={styles.rateCard}>
          <Text style={styles.rateLabel}>Qu’en avez-vous pensé ?</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => rate(value)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${value} étoile${value > 1 ? 's' : ''}`}
                accessibilityState={{ selected: rating >= value }}
              >
                <Ionicons
                  name={rating >= value ? 'star' : 'star-outline'}
                  size={44}
                  color={colors.star}
                />
              </Pressable>
            ))}
          </View>
          {rating > 0 && (
            <Pressable
              onPress={() =>
                void WebBrowser.openBrowserAsync(
                  `https://search.google.com/local/writereview?placeid=${encodeURIComponent(id)}`,
                )
              }
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.link}>Publier un avis sur Google</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <GradientButton
          title="Nouvelle recherche"
          icon="search"
          onPress={() => router.dismissTo('/')}
        />
        <Pressable
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.85 }]}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Retour</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: font.hero, textAlign: 'center' },
  skyline: { position: 'absolute', left: 0, right: 0, top: 0, height: 180, opacity: 0.9 },
  place: { color: colors.textMuted, fontSize: font.title - 2, textAlign: 'center' },
  rateCard: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  rateLabel: { color: colors.text, fontSize: font.body + 1, fontWeight: '600' },
  stars: { flexDirection: 'row', gap: spacing.sm },
  link: { color: colors.accent, fontSize: font.body, fontWeight: '600' },
  actions: { padding: spacing.xl, gap: spacing.md },
  secondary: {
    minHeight: TOUCH_TARGET + 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: colors.text, fontSize: font.body, fontWeight: '700' },
});
