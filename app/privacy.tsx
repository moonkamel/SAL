import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { font, fonts, spacing } from '@/src/theme';
import { themedStyles } from '@/src/theme/tone';

// Adresse de contact publiée (EAS : EXPO_PUBLIC_CONTACT_EMAIL).
const CONTACT = process.env.EXPO_PUBLIC_CONTACT_EMAIL;
const UPDATED = '6 octobre 2026';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'En bref',
    body: [
      'Sortir à Lille ne demande ni compte ni inscription. Nous ne vendons aucune donnée.',
      'Vos favoris, vos recherches récentes et votre langue restent sur votre téléphone.',
    ],
  },
  {
    title: 'Votre position',
    body: [
      'Avec votre accord, l’application utilise votre position pour proposer les lieux les plus proches, calculer les distances et les itinéraires. Elle n’est utilisée que lorsque l’application est ouverte.',
      'La position est envoyée à notre serveur au moment de chaque recherche, puis transmise à Google (Places, Routes) et, selon la fonction, aux services de transport lillois (V’Lille, Ilévia). Notre serveur ne l’enregistre pas.',
      'Sans autorisation, les résultats sont calculés autour de la Grand-Place de Lille.',
    ],
  },
  {
    title: 'Recherches et contenus',
    body: [
      'Le texte de vos recherches est envoyé à Google Places pour trouver des lieux. Il peut aussi être envoyé à Anthropic (Claude) pour être reformulé, sans aucune information sur vous.',
      'Les événements viennent d’OpenAgenda (agenda de la Ville de Lille) et des partenaires ; ils peuvent être traduits automatiquement par Anthropic. La météo vient d’Open-Meteo.',
      'Les données Google (photos, avis, horaires) ne sont gardées que quelques minutes en mémoire sur notre serveur, jamais enregistrées.',
    ],
  },
  {
    title: 'Publicité',
    body: [
      'L’application affiche des publicités Google AdMob. Au premier lancement, un formulaire vous permet d’accepter ou de refuser les publicités personnalisées ; vous pouvez changer d’avis à tout moment depuis « Confidentialité et publicité » sur l’accueil.',
      'Si vous acceptez, Google peut utiliser l’identifiant publicitaire de votre appareil. Vous pouvez aussi le réinitialiser ou le désactiver dans les réglages du téléphone.',
    ],
  },
  {
    title: 'Statistiques d’utilisation',
    body: [
      'Pour améliorer l’application, nous mesurons de façon anonyme son utilisation : écrans consultés, recherches tapées (texte seul), tri choisi, itinéraires et billetteries ouverts.',
      'Ces mesures sont rattachées à un numéro tiré au hasard à chaque ouverture de l’application, jamais à votre identité, à votre appareil ni à votre position. Elles sont conservées au plus 13 mois et ne sont ni vendues ni partagées.',
    ],
  },
  {
    title: 'Liens partenaires',
    body: [
      'Certains liens (réservation, billetterie, VTC) sont des liens partenaires : nous comptons le nombre de clics par lieu, sans aucune donnée personnelle, et pouvons recevoir une commission.',
      'Sur le site web uniquement, le script de notre plateforme d’affiliation (impact.com) mesure les visites et les clics vers les partenaires, afin d’attribuer ces commissions.',
    ],
  },
  {
    title: 'Hébergement et sécurité',
    body: [
      'Le serveur est hébergé par Expo (EAS Hosting, réseau Cloudflare). Les adresses IP servent seulement, quelques minutes et en mémoire, à limiter les abus. Les échanges sont chiffrés (HTTPS).',
    ],
  },
  {
    title: 'Vos droits',
    body: [
      'Aucune donnée permettant de vous identifier n’est conservée sur nos serveurs (les statistiques sont anonymes) : désinstaller l’application efface tout ce qu’elle a enregistré sur votre téléphone.',
      'Pour toute question sur vos données (RGPD), contactez-nous' +
        (CONTACT ? ` : ${CONTACT}.` : ' via l’adresse indiquée sur la fiche Google Play.') +
        ' Vous pouvez aussi saisir la CNIL (cnil.fr).',
    ],
  },
];

/** Politique de confidentialité, publiée sur le web (lien demandé par Google Play). */
export default function PrivacyScreen() {
  const styles = useStyles();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Confidentialité' }} />
      <Text style={styles.title}>Politique de confidentialité</Text>
      <Text style={styles.muted}>Sortir à Lille · mise à jour le {UPDATED}</Text>
      {SECTIONS.map((s) => (
        <View key={s.title} style={styles.section}>
          <Text style={styles.heading}>{s.title}</Text>
          {s.body.map((p) => (
            <Text key={p} style={styles.body}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const useStyles = themedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.lg, maxWidth: 760, width: '100%', alignSelf: 'center' },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: font.hero - 6 },
  muted: { color: colors.textMuted, fontSize: font.small },
  section: { gap: spacing.sm },
  heading: { color: colors.gold, fontFamily: fonts.displayMedium, fontSize: font.title - 2 },
  body: { color: colors.text, fontSize: font.body, lineHeight: 24 },
}));
