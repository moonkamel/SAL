# Sortir à Lille

Application mobile (iOS + Android) : on tape ce qu'on veut faire ce soir
(« manger japonais », « aller danser »…) et l'app affiche les lieux les plus
proches et les plus pertinents de la métropole lilloise, puis guide l'utilisateur
jusqu'au lieu **sans quitter l'app**.

Stack : Expo SDK 57 (React Native 0.86, New Architecture) · TypeScript · Expo Router
(écrans + routes API) · Google Places API (New) · Routes API · Google Navigation SDK ·
AdMob (react-native-google-mobile-ads) · Claude (reformulation optionnelle).

## État d'avancement

| Étape | Contenu | État |
| --- | --- | --- |
| 0 | Socle : Expo Router, thème sombre, localisation, EAS | ✅ à tester sur téléphone |
| 1 | Recherche + liste de résultats + filtres + historique | ✅ testé avec les vraies données Google, à tester sur téléphone |
| 2 | Fiche lieu + carte (MapView du Navigation SDK) + favoris | ✅ à tester sur téléphone (nouveau build nécessaire) |
| 3 | Aperçu d'itinéraire (Routes API) | ✅ testé avec les vraies données Google, à tester sur téléphone |
| 4 | Navigation guidée intégrée (Google Navigation SDK) | ✅ à tester sur téléphone (nouveau build nécessaire) |
| 5 | Publicité AdMob + consentement + lieux sponsorisés | ✅ à tester sur téléphone (nouveau build nécessaire) |

### Design « Lille la nuit »

- Palette : bleu nuit, **brique flamande** (actions), **or de la Vieille Bourse**
  (accents), pierre crème (textes) — tokens dans `src/theme/index.ts`.
- Titres en **Fraunces** (serif), silhouette de Lille dessinée en SVG sur l'accueil
  (Porte de Paris, pignons à redents, Beffroi, Vieille Bourse, Déesse, Opéra, Treille).
- Animations Reanimated : cartes qui apparaissent en cascade, boutons qui s'enfoncent,
  squelettes de chargement ; carte Google au style nocturne assorti (`src/theme/mapStyle.ts`).

### Fonctionnalités lilloises

- **V'Lille en direct** (mode vélo de l'aperçu d'itinéraire) : station la plus proche avec
  des vélos au départ, station avec des places libres près du lieu. Données GBFS ouvertes
  d'Ilévia (`VLILLE_GBFS_URL`, par défaut `https://media.ilevia.fr/opendata/gbfs.json`),
  rafraîchies chaque minute.
- **Prochains passages Ilévia** (métro, tram, bus) : « Départs près de vous » en mode
  transports, et « Pour rentrer en transports » sur la fiche d'un lieu. Données temps réel
  de l'open data de la MEL (`ILEVIA_PASSAGES_URL`), rafraîchies toutes les 30 s. Si l'API
  exige une clé, créez un compte sur <https://data.lillemetropole.fr> et renseignez
  `MEL_API_KEY` côté serveur.
- **Filtres d'ambiance** : terrasse, musique live, en groupe, avec enfants, cocktails,
  végétarien (panneau « Filtres », ou déduits de la phrase par Claude). Seuls les lieux
  pour lesquels Google confirme l'ambiance sont gardés. Ces champs Google ne sont demandés
  **que** lorsqu'un filtre d'ambiance est actif (tranche Places plus chère).

### Choix techniques validés

- **Navigation SDK** : `@googlemaps/react-native-navigation-sdk` **0.16.3**. La 0.17+ exige
  React Native 0.87, que l'Expo stable (SDK 57) n'embarque pas encore. On passera à la 0.17+
  avec Expo SDK 58.
- **Carte** : le composant `MapView` du Navigation SDK remplace `react-native-maps`. Les deux
  embarquent le Maps SDK Google et ne peuvent pas cohabiter dans la même app (symboles
  dupliqués sur iOS, classes dupliquées sur Android).
- **Modes de guidage** : marche (par défaut), vélo, voiture. Le Navigation SDK ne guide pas
  en transports en commun : ce mode sera proposé en aperçu uniquement.
- **Avis Google** : chargés seulement dans la fiche lieu (Place Details). Les demander dans
  chaque recherche ferait passer toutes les recherches dans la tranche Places la plus chère.
- **Temps à pied dans la liste** : estimation (distance × 1,3 à 4,8 km/h), affichée « ~12 min ».
  Aucun appel d'API facturé.

## Structure

```
app/                 écrans (Expo Router) + routes API (*+api.ts)
  index.tsx          accueil : accroche, recherche, suggestions, historique
  results.tsx        résultats : liste / carte, filtres
  place/[id].tsx     fiche lieu : photos, infos, horaires, avis, favori, « Y aller »
  favorites.tsx      favoris (seuls les place_id sont stockés)
  api/search+api.ts  POST /api/search → reformulation + Places Text Search + classement
  api/place/[id]+api.ts GET /api/place/:id → Place Details (avis) ou résumé (?fields=summary)
  api/photo+api.ts   GET  /api/photo  → photo Google sans exposer la clé
  api/route+api.ts   GET  /api/route?from=lat,lng&to=lat,lng → marche, vélo, voiture, transports
  api/vlille+api.ts  GET  /api/vlille?near=lat,lng → stations V'Lille proches (temps réel)
  api/transit+api.ts GET  /api/transit?near=lat,lng → prochains passages Ilévia
  route/[id].tsx     aperçu d'itinéraire : tracé, choix du mode, durée, « Démarrer »
  navigate/[id].tsx  guidage plein écran (Navigation SDK), « Arrêter », aucune publicité
  arrived/[id].tsx   « Vous êtes arrivé » : noter le lieu, nouvelle recherche
plugins/withGoogleNavigation.js  plugin Expo : clés Maps, désugarage Android, Jetifier,
                     modes d'arrière-plan iOS (location, audio)
server/              logique backend (testable seule)
  places.ts          client Places API (New)
  rewrite.ts         reformulation par Claude (optionnelle)
  ranking.ts         score note / nombre d'avis / distance / pertinence : tous les réglages ici
  cache.ts           cache mémoire court (5 min)
  routes.ts          client Routes API (aperçu d'itinéraire)
  sponsored.ts       sélection des lieux sponsorisés (dates, zone, mots-clés)
  sponsored.json     campagnes actives (voir « Lieux sponsorisés »)
  search.ts          orchestration
shared/              types, géo et formatage communs à l'app et au serveur
src/                 composants, localisation, historique, favoris, thème
  features/ads/      consentement UMP + ATT, bannière, pub native, interstitiel, règles
  features/navigation/  guidage (Navigation SDK), état « guidage actif »
tests/               tests unitaires (vitest)
```

## 1. Obtenir les clés

### Google Cloud (Places, Maps, Navigation, Routes)

1. Créez un projet sur <https://console.cloud.google.com/> et **activez la facturation**
   (obligatoire, même dans les quotas gratuits).
2. *API et services → Bibliothèque* : activez
   - **Places API (New)** (étape 1) ;
   - **Routes API** (étape 3) ;
   - **Navigation SDK** (étape 4). Il inclut le Maps SDK : la carte de l'app passe par lui.
3. *API et services → Identifiants → Créer une clé API* : créez **deux clés** :
   - **Clé serveur** (`GOOGLE_PLACES_API_KEY`) : restriction d'API sur *Places API (New)* et
     *Routes API*. Elle ne quitte jamais le serveur.
   - **Clé mobile** (étape 2+) : restriction d'application *Android* (package
     `fr.sortiralille.app` + empreinte SHA-1 donnée par `eas credentials`) et *iOS*
     (bundle ID `fr.sortiralille.app`), restriction d'API sur *Navigation SDK* et *Maps SDK*.
     Google recommande une clé par plateforme.
4. Conditions : le compte de facturation étant en France, les
   [conditions EEE de Google Maps Platform](https://cloud.google.com/terms/maps-platform/eea)
   s'appliquent. Le Navigation SDK est facturé à la destination, avec 1 000 destinations
   gratuites par mois.

### Anthropic (optionnel)

Sans clé, la requête de l'utilisateur est envoyée telle quelle à Google Places, ce qui
fonctionne déjà bien. Avec une clé, Claude transforme « un bar calme pour discuter » en
requête Places plus des filtres (type, ouvert maintenant, prix).

1. Créez une clé sur <https://console.anthropic.com/> → *API Keys*.
2. Renseignez `ANTHROPIC_API_KEY`. `ENABLE_LLM_REWRITE=false` coupe la reformulation sans
   retirer la clé.
3. Le modèle est réglé par `ANTHROPIC_MODEL` (par défaut `claude-opus-5`, effort `low`).
   Pour une latence et un coût plus bas, vous pouvez essayer `claude-haiku-4-5`.
   Si Claude ne répond pas en 6 s ou échoue, l'app utilise la requête brute.

### AdMob (publicité)

**En développement, rien à faire** : l'app utilise automatiquement les IDs de test de
Google (annonces marquées « Test Ad »). Ne cliquez jamais sur vos propres annonces réelles :
AdMob peut suspendre le compte.

Pour la production :

1. Créez un compte sur <https://admob.google.com/> et ajoutez **deux applications**
   (Android et iOS) « Sortir à Lille ». Notez leurs **IDs d'application**
   (`ca-app-pub-XXXX~YYYY`).
2. Pour chaque application, créez trois **blocs d'annonces** : *Bannière adaptative*,
   *Native avancée* et *Interstitiel*. Notez leurs IDs (`ca-app-pub-XXXX/ZZZZ`).
3. **Consentement RGPD** : *Confidentialité et messages → RGPD → Créer un message*,
   sélectionnez les deux applications, langue **français**, puis **Publier**. C'est ce
   formulaire (Google UMP) que l'app affiche avant toute publicité. Sur iOS, activez
   aussi le message *IDFA / ATT* dans la même section.
4. Publiez un fichier **app-ads.txt** sur le site web déclaré dans les fiches des stores
   (AdMob vous donne son contenu).
5. Déclarez les IDs dans EAS (environnement `production`) :
   ```bash
   eas env:create --environment production --name ADMOB_ANDROID_APP_ID --value "ca-app-pub-XXXX~YYYY" --visibility plaintext
   eas env:create --environment production --name ADMOB_IOS_APP_ID --value "ca-app-pub-XXXX~YYYY" --visibility plaintext
   eas env:create --environment production --name EXPO_PUBLIC_ADMOB_ANDROID_BANNER --value "ca-app-pub-XXXX/ZZZZ" --visibility plaintext
   # … idem pour EXPO_PUBLIC_ADMOB_ANDROID_NATIVE, EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL
   # et EXPO_PUBLIC_ADMOB_IOS_BANNER / _NATIVE / _INTERSTITIAL
   ```
   Même avec ces variables, un build de développement garde les IDs de test.

**Règles appliquées par l'app** (`src/features/ads/policy.ts`) :

| Format | Où | Règle |
| --- | --- | --- |
| Bannière | bas de l'accueil | seulement après consentement |
| Native | liste des résultats | une tous les 5 lieux, badge « Annonce » |
| Interstitiel | entre deux recherches | au plus 1 par session, jamais au lancement (pas avant la 2e recherche) |
| — | guidage | **aucune publicité** pendant la navigation active |

Le lien « Confidentialité et publicité » de l'accueil permet de modifier ses choix
(obligatoire dans l'UE).

### Clés Maps de l'application (étape 2+)

La carte utilise le Navigation SDK : il faut une clé **embarquée dans l'app**, distincte de
la clé serveur.

1. Dans Google Cloud, activez aussi **Navigation SDK**, **Maps SDK for Android** et
   **Maps SDK for iOS**.
2. Créez une clé **Android** : restriction d'application « Applications Android », package
   `fr.sortiralille.app` + empreinte SHA-1 (affichée par `eas credentials` → Android →
   development → Keystore). Restriction d'API : Navigation SDK + Maps SDK for Android.
3. (iPhone) Créez une clé **iOS** : restriction « Applications iOS », bundle ID
   `fr.sortiralille.app`. Restriction d'API : Navigation SDK + Maps SDK for iOS.
4. Déclarez-les dans EAS (elles sont lues au moment du build, dans le cloud) :
   ```bash
   eas env:create --environment development --name GOOGLE_MAPS_ANDROID_API_KEY --value "AIza..." --visibility sensitive
   eas env:create --environment development --name GOOGLE_MAPS_IOS_API_KEY --value "AIza..." --visibility sensitive
   ```
   Refaites la même chose pour `preview` et `production` le moment venu.

### Lieux sponsorisés

Les campagnes sont dans `server/sponsored.json` (vide par défaut ; modèle dans
`server/sponsored.example.json`). Chaque campagne (commentaires à retirer dans le vrai fichier) :

```jsonc
{
  "id": "wood-food-2026-10",
  "placeId": "ChIJ…",                         // place_id Google du lieu
  "label": "Wood Food & Coffee, octobre",    // pour vous, jamais affiché
  "startDate": "2026-10-01",                 // inclus, heure de Lille
  "endDate": "2026-10-31",                   // inclus
  "zone": { "lat": 50.6366, "lng": 3.0635, "radiusMeters": 3000 },
  "keywords": ["brunch", "cafe", "coffee"]   // mots entiers, accents ignorés
}
```

Une campagne s'affiche si la date est dans la période, si l'utilisateur est dans la zone
et si un mot-clé apparaît dans sa recherche (ou dans la requête reformulée par Claude).
Le lieu passe alors **en tête**, avec le badge **« Sponsorisé »** bien visible, dans la
limite de **2 par recherche** et **seulement s'il respecte les filtres** choisis
(ouvert maintenant, distance, prix, note). Pour trouver le `place_id` d'un lieu, utilisez le
[Place ID Finder de Google](https://developers.google.com/maps/documentation/places/web-service/place-id).

Modifier le fichier demande un redéploiement du backend ; une base de données
(ex. Supabase) sera plus pratique quand il y aura plusieurs annonceurs.

## 2. Configuration locale

```bash
npm install
cp .env.example .env.local   # puis remplissez GOOGLE_PLACES_API_KEY (et ANTHROPIC_API_KEY)
npm test                     # tests unitaires
npm run typecheck
```

Les variables sans préfixe `EXPO_PUBLIC_` ne sont lues que par les routes API (serveur)
et ne sont jamais incluses dans l'application.

## 3. Build de développement avec EAS (sur un vrai téléphone)

L'app utilise des modules natifs : **Expo Go ne suffit pas**, il faut un *development build*.

```bash
npm install -g eas-cli
eas login
eas init                              # déjà fait : projet @farouk12/sortir-a-lille

npm run build:dev:android             # APK de développement
npm run build:dev:ios                 # nécessite un compte Apple Developer ;
                                      # enregistrez l'iPhone avec : eas device:create
```

Installez le build sur le téléphone (QR code / lien fourni par EAS), puis lancez le
serveur de développement **sur le même réseau Wi-Fi** :

```bash
npm start
```

Ouvrez l'app sur le téléphone : elle se connecte au serveur Metro, qui sert aussi les
routes API (`/api/search`). La clé Google reste donc sur votre ordinateur.

> Un nouveau build EAS n'est nécessaire que si on ajoute ou modifie un module natif
> (ce sera le cas aux étapes 2, 4 et 5). Le reste se met à jour à chaud.

### Mise en ligne du backend (plus tard)

```bash
npx expo export --platform web
eas deploy                   # EAS Hosting, puis définissez les variables d'environnement serveur
```

Renseignez ensuite `EXPO_PUBLIC_API_URL` avec l'URL obtenue pour les builds preview et
production.

## 4. Checklist de test : étape 1

- [ ] Au premier lancement, la demande de localisation s'affiche avec le texte en français.
- [ ] L'accueil affiche l'accroche, la grande barre de recherche et les 5 suggestions.
- [ ] « manger japonais » → une liste de restaurants japonais proches, triés, avec photo,
      adresse, distance, temps à pied, note et nombre d'avis, prix, Ouvert/Fermé et heure.
- [ ] Le crédit photo (« Photo : … ») et « Données Google Maps » en bas de liste sont visibles.
- [ ] « Ouvert maintenant » et le panneau « Filtres » (distance, prix, note) modifient les
      résultats.
- [ ] L'historique affiche les 5 dernières recherches, qui survivent à un redémarrage.
- [ ] En refusant la localisation (Réglages → Sortir à Lille → Position : Jamais), le
      bandeau « résultats autour de la Grand-Place » apparaît et les résultats restent
      cohérents. Le bandeau ramène aux réglages.
- [ ] En mode avion : message d'erreur en français et bouton « Réessayer ».

## 5. Checklist de test : étape 2

Il faut **refaire un build** (`npm run build:dev:android`) : la carte ajoute du code natif.

- [ ] Dans les résultats, le bouton « Carte » affiche une carte Google sombre avec une épingle
      par lieu et votre position (point bleu).
- [ ] Toucher une épingle affiche le nom, puis la carte du lieu en bas ; la toucher ouvre la fiche.
- [ ] La fiche affiche les photos (glisser pour les faire défiler, crédit du photographe),
      la note, le prix, Ouvert/Fermé (toucher pour voir les horaires de la semaine),
      la distance, l'adresse, le téléphone, le site web (ouvert dans l'app), une petite carte.
- [ ] 2 à 3 avis récents avec auteur, note, date relative ; « Lire la suite » déplie les longs avis.
- [ ] Le cœur en haut à droite ajoute le lieu aux favoris ; « Favoris » sur l'accueil le liste,
      y compris après redémarrage de l'app.
- [ ] « Y aller » affiche « Bientôt disponible » (branché à l'étape 3).

## 6. Checklist de test : étape 3

Pas de nouveau build nécessaire : `git pull`, puis relancez `npm start`.
La clé serveur doit avoir **Routes API** activée (Google Cloud → Bibliothèque → Routes API).

- [ ] Sur une fiche lieu, « Y aller » ouvre l'aperçu d'itinéraire.
- [ ] Le tracé (rouge) s'affiche sur la carte, cadré entre votre position et le lieu.
- [ ] Les 4 modes affichent leur durée ; « À pied » est sélectionné par défaut.
- [ ] Changer de mode change le tracé, la durée, la distance et l'heure d'arrivée.
- [ ] « Transports » affiche les lignes (ex. « Métro M1 ») et indique que le guidage
      n'est pas disponible dans ce mode.
- [ ] « Démarrer » affiche « Bientôt disponible » (branché à l'étape 4).

Coût : chaque aperçu interroge Routes API pour les 4 modes (mis en cache 5 minutes).

## 7. Checklist de test : étape 4

Il faut **refaire un build** (`npm run build:dev:android`) : localisation en arrière-plan,
guidage vocal et nouvelles autorisations. La clé Maps de l'app doit avoir **Navigation SDK**
activé.

Testez dehors, à pied, vers un lieu proche (quelques centaines de mètres).

- [ ] « Démarrer » affiche d'abord (une seule fois) l'explication de l'utilisation de la position
      pendant le guidage, puis les **conditions d'utilisation Google** à accepter.
- [ ] Android 13+ : l'app demande l'autorisation d'afficher des notifications.
- [ ] Le guidage démarre en plein écran : instructions en haut, voix en français, barre en bas
      avec temps restant, distance et heure d'arrivée.
- [ ] Écran verrouillé, les instructions vocales continuent (iOS : pastille bleue ;
      Android : notification « guidage en cours »).
- [ ] « Arrêter » (ou le bouton retour Android) demande confirmation puis revient à l'aperçu.
- [ ] À l'arrivée : écran « Vous êtes arrivé ! », notation en étoiles, « Publier un avis sur
      Google » (ouvert dans l'app), « Nouvelle recherche » revient à l'accueil.
- [ ] Mode vélo et voiture : le guidage démarre aussi ; « Transports » n'a pas de bouton Démarrer.

Coût : chaque guidage appelle une fois `setDestinations` (facturé à la destination,
1 000 gratuites par mois) ; les recalculs en cours de route ne sont pas refacturés.

## 8. Checklist de test : étape 5

Il faut **refaire un build** (`npm run build:dev:android`) : AdMob ajoute du code natif.

- [ ] Au premier lancement, en France : le **formulaire de consentement Google** s'affiche
      (seulement si un message RGPD est publié dans AdMob ; sinon les pubs de test
      s'affichent directement). Sur iPhone, la demande de suivi Apple vient ensuite.
- [ ] Accueil : une **bannière « Test Ad »** en bas de l'écran.
- [ ] Résultats en liste : une **annonce native** (badge « Annonce ») après le 5e et le 10e lieu.
- [ ] La 1re recherche n'affiche pas d'interstitiel ; la 2e en affiche un (test),
      les suivantes plus jamais pendant la session.
- [ ] Pendant le guidage : aucune publicité.
- [ ] « Confidentialité et publicité » (accueil) rouvre le formulaire de consentement.
- [ ] Sponsorisé : copiez `server/sponsored.example.json` dans `server/sponsored.json`,
      mettez des dates qui incluent aujourd'hui, relancez `npm start` et cherchez
      « sushi » : le lieu apparaît en tête avec le badge « Sponsorisé ».

## 9. Avant la publication sur les stores

- [ ] Clés Google **séparées** : clé serveur (Places + Routes, sans restriction d'app) et
      clés mobiles (Navigation SDK + Maps SDK, restreintes au package / bundle ID).
      Régénérez toute clé qui a été partagée.
- [ ] Backend déployé (`eas deploy`) avec `GOOGLE_PLACES_API_KEY` en variable d'environnement
      EAS, puis `EXPO_PUBLIC_API_URL` renseignée pour les builds preview et production.
- [ ] Limitation du nombre de requêtes par utilisateur sur `/api/*` (protège votre quota
      Google).
- [ ] Vrais IDs AdMob, message RGPD publié, app-ads.txt en ligne.
- [ ] Justification de la localisation écran verrouillé dans les fiches App Store / Google Play.
- [ ] Politique de confidentialité (position, publicité, identifiant publicitaire).

## Règles Google respectées

- Clé Places uniquement côté serveur ; photos servies via `/api/photo` (URL temporaire).
- Aucune donnée Places stockée durablement : cache mémoire de 5 minutes côté serveur,
  historique local limité aux requêtes tapées. Les favoris (étape 2) ne conserveront que
  le `place_id`.
- Attribution « Google Maps » sous les listes, crédit des auteurs des photos, auteur de
  chaque avis (lien vers son profil Google).
- Données Places affichées uniquement sur une carte Google (Navigation SDK).
- Favoris : seul le `place_id` est stocké ; les infos sont rechargées depuis Google.
- Guidage : conditions d'utilisation du Navigation SDK affichées avant le premier guidage,
  aucune publicité pendant la navigation (`src/features/navigation/guidanceState.ts`).
- Publicité : consentement UMP avant toute annonce, mesure AdMob retardée jusqu'au
  consentement, IDs de test en développement, lieux sponsorisés toujours signalés.
