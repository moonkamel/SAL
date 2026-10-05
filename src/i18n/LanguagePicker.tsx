import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LilleSkyline } from '@/src/components/LilleSkyline';
import { PressableScale } from '@/src/components/PressableScale';
import { font, fonts, motion, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import { type Lang, LANG_INFO, LANGS } from '@/shared/i18n';

import { deviceLang, useI18n } from './index';
import { themedStyles, useColors, useTone } from '@/src/theme/tone';

// Le titre s'affiche dans toutes les langues : on ne sait pas encore laquelle lire.
const TITLES: Record<Lang, string> = {
  fr: 'Choisissez votre langue',
  en: 'Choose your language',
  nl: 'Kies je taal',
  de: 'Sprache wählen',
  es: 'Elige tu idioma',
};

/** Choix de la langue, avec drapeaux : au premier lancement, puis depuis l'accueil. */
export function LanguagePicker({ onDone }: { onDone?: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { lang, chosen, setLang } = useI18n();
  const { tone } = useTone();
  // Déjà choisie : on met en avant la langue actuelle ; sinon celle du téléphone.
  const highlighted = chosen ? lang : deviceLang();

  const pick = (l: Lang) => {
    void Haptics.selectionAsync();
    setLang(l);
    onDone?.();
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={colors.sky} style={[styles.sky, { paddingTop: insets.top + spacing.xl }]}>
        <LilleSkyline style={styles.skyline} tone={tone} />
        <Ionicons name="language" size={34} color={colors.gold} />
        <Text style={styles.title} accessibilityRole="header">
          {TITLES[highlighted]}
        </Text>
        <Text style={styles.subtitle}>
          {LANGS.filter((l) => l !== highlighted)
            .map((l) => TITLES[l])
            .join(' · ')}
        </Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}>
        {LANGS.map((l, i) => {
          const info = LANG_INFO[l];
          const active = l === highlighted;
          return (
            <Animated.View key={l} entering={FadeInDown.delay(motion.stagger * i).duration(motion.slow)}>
              <PressableScale
                onPress={() => pick(l)}
                style={[styles.row, active && styles.rowActive]}
                accessibilityRole="button"
                accessibilityLabel={`${info.name}, ${info.countries}`}
                accessibilityState={{ selected: active }}
              >
                <View style={styles.flags} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  {info.flags.map((f) => (
                    <Text key={f} style={[styles.flag, info.flags.length > 1 && styles.flagSmall]}>
                      {f}
                    </Text>
                  ))}
                </View>
                <View style={styles.names}>
                  <Text style={styles.name}>{info.name}</Text>
                  <Text style={styles.countries}>{info.countries}</Text>
                </View>
                <Ionicons
                  name={active ? 'checkmark-circle' : 'chevron-forward'}
                  size={22}
                  color={active ? colors.gold : colors.textFaint}
                />
              </PressableScale>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const SKYLINE = 96;

const useStyles = themedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  sky: {
    paddingHorizontal: spacing.xl,
    // Le texte reste au-dessus de la silhouette de la ville.
    paddingBottom: SKYLINE + spacing.md,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  skyline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: SKYLINE },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: font.hero - 4, marginTop: spacing.sm },
  subtitle: { color: colors.textMuted, fontSize: font.small, lineHeight: 20 },
  list: { padding: spacing.lg, gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: TOUCH_TARGET + 16,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowActive: { borderColor: colors.gold, backgroundColor: colors.surfaceRaised },
  // Colonne fixe : les noms des langues sont alignés, avec un ou deux drapeaux.
  flags: { width: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  flag: { fontSize: 30 },
  flagSmall: { fontSize: 24 },
  names: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: font.body + 1, fontWeight: '800' },
  countries: { color: colors.textMuted, fontSize: font.small },
}));
