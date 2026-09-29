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
| 4 | Guidage : ouvert dans Google Maps (le guidage intégré a été retiré) | ✅ |
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
- **Trajets en transports, façon Citymapper** (aperçu d'itinéraire → mode transports →
  « Horaires et trajet détaillé ») : propositions avec heure de départ et d'arrivée,
  lignes aux couleurs officielles (M1 jaune, M2 rouge…), marche, prix du ticket et départs
  suivants ; étapes détaillées (arrêt de montée, direction, nombre d'arrêts, arrêt de
  descente). « Y aller avec Google Maps » ouvre le trajet dans Google Maps. Données
  Google Routes API (horaires prévus d'Ilévia, tarif indiqué par Google).
- **Prochains passages Ilévia** (métro, tram, bus) : « Départs près de vous » en mode
  transports, et « Pour rentrer en transports » sur la fiche d'un lieu. Données temps réel
  de l'open data de la MEL, rafraîchies toutes les 30 s. Le serveur essaie les adresses
  connues de la MEL (API Opendatasoft puis OGC) et garde celle qui répond ;
  `ILEVIA_PASSAGES_URL` permet d'en imposer une. Si l'API exige une clé, créez un compte
  sur <https://data.lillemetropole.fr> et renseignez `MEL_API_KEY` côté serveur. Si aucune
  source ne répond, l'encart est simplement masqué.
- **Filtres d'ambiance** : terrasse, musique live, en groupe, avec enfants, cocktails,
  végétarien, **accès fauteuil** (entrée accessible en fauteuil roulant) (panneau « Filtres », ou déduits de la phrase par Claude). Seuls les lieux
  pour lesquels Google confirme l'ambiance sont gardés. Ces champs Google ne sont demandés
  **que** lorsqu'un filtre d'ambiance est actif (tranche Places plus chère).
- **Surprends-moi** (accueil) : tire au sort un lieu **ouvert**, noté au moins 4,2 ★
  (30 avis minimum), à moins de 1,5 km (puis 3 km), choisi selon l'heure de Lille
  (café le matin, estaminet le soir, bar la nuit…) et la météo. Jamais un lieu sponsorisé.
  Au plus 4 recherches Google par tirage (mises en cache 5 min).
- **Suggestions météo** (accueil) : température et idée de sortie selon le temps
  (pluie → estaminet ou salon de thé, soleil et 17 °C ou plus → bars en terrasse).
  Données Open-Meteo, gratuites et sans clé, mises en cache 10 min (`OPEN_METEO_URL`).
- **Partager un lieu** (bouton en haut de la fiche) : WhatsApp, SMS… avec le nom,
  l'adresse, la note et le lien Google Maps (ou le lien web de l'app si
  `EXPO_PUBLIC_API_URL` est défini).
- **Ce soir à Lille** (accueil + écran « Agenda ») : concerts, soirées, expos… ce soir,
  demain ou ce week-end, avec **filtres** (catégorie, style de musique : jazz, rock,
  électro, rap, classique…, gratuit, à moins de 2 km) et une **fiche événement** dans
  l'app (date, lieu, description, prix, billets, « Y aller », partage). Sources : les événements saisis dans l'espace partenaires
  (option **« À la une »**, payante, affichée en premier avec un badge) et l'agenda
  culturel de la **Ville de Lille** sur OpenAgenda (`OPENAGENDA_KEY`).
- **Bons plans** (accueil, écran « Bons plans » et fiche du lieu) : offres des
  établissements partenaires (« 2 bières pour le prix d'1 de 18 h à 20 h »), avec dates,
  jours et créneau horaire.
- **Espace partenaires** (`/admin`, dans un navigateur) : gérer bons plans, agenda,
  lieux sponsorisés et liens partenaires sans toucher au code, et voir les clics sur les
  liens partenaires. Voir « Espace partenaires » plus bas.
- **Économies Google** : photos chargées seulement quand elles sont visibles (liste et
  carrousel), fiches gardées 5 min dans l'app, cache de recherche partagé par quartier
  (~500 m), et limite d'appels par appareil (429 au-delà de 30 recherches par minute).

### Choix techniques validés

- **Navigation SDK** : `@googlemaps/react-native-navigation-sdk` **0.16.3**. La 0.17+ exige
  React Native 0.87, que l'Expo stable (SDK 57) n'embarque pas encore. On passera à la 0.17+
  avec Expo SDK 58.
- **Carte** : le composant `MapView` du Navigation SDK remplace `react-native-maps`. Les deux
  embarquent le Maps SDK Google et ne peuvent pas cohabiter dans la même app (symboles
  dupliqués sur iOS, classes dupliquées sur Android).
- **Guidage** : l'app affiche temps de trajet, tracés et étapes, puis « Y aller avec Google
  Maps » ouvre Google Maps (à pied, vélo, voiture ou transports). Pas de guidage intégré :
  le Navigation SDK ne sert plus qu'à la carte.
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
  affiliates.json    liens partenaires (voir « Liens d'affiliation »)
  offers.json, events.json  bons plans et agenda sans base de données
  content.ts         stockage (Supabase ou fichiers JSON), schemas.ts
  search.ts          orchestration
shared/              types, géo et formatage communs à l'app et au serveur
src/                 composants, localisation, historique, favoris, thème
  features/ads/      consentement UMP + ATT, bannière, pub native, interstitiel, règles
  features/navigation/  contexte du Navigation SDK (carte), liens Google Maps
  features/lille/    V’Lille, Ilévia, pastilles d’ambiance
  features/moment/   Surprends-moi, carte météo, rubriques de l'accueil
  features/admin/    espace partenaires (/admin)
  features/offers/, features/agenda/  bons plans et agenda
supabase/            schéma de la base de l'espace partenaires
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
5. **Protégez votre budget** (fortement recommandé) :
   - *Facturation → Budgets et alertes → Créer un budget* : par exemple 20 €/mois, avec
     des alertes par e-mail à 50 %, 90 % et 100 %. Une alerte **ne coupe rien** : elle
     prévient seulement.
   - *API et services → Places API (New) → Quotas et limites du système* : baissez les
     « requêtes par jour » (par exemple 1 000 pour Text Search et Place Details). C'est
     la **vraie limite dure** : au-delà, Google refuse les appels au lieu de les facturer
     (l'app affiche alors une erreur). Faites de même pour la Routes API.

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

### Langues (français, anglais, néerlandais, allemand, espagnol)

Au premier lancement, l'app demande la langue (liste de drapeaux) et la mémorise ; le
bouton drapeau de l'accueil permet d'en changer. Les langues proposées correspondent aux
visiteurs étrangers les plus nombreux à Lille : Belges (néerlandais et français),
Britanniques, Allemands, Néerlandais et Espagnols.

- **Textes de l'app** : le français sert de clé (`t('Favoris')`). Les traductions sont dans
  `shared/i18n/locales/*.json`. Après avoir ajouté ou modifié des textes, lancez
  `npm run translate` : le script repère les nouveaux textes et les fait traduire par
  Claude (clé `ANTHROPIC_API_KEY` dans `.env.local`). Les traductions existantes ne sont
  jamais écrasées : vous pouvez les corriger à la main. `npm run translate:check` vérifie
  qu'il ne manque rien (c'est aussi testé par `npm test`).
- **Données Google** (noms, avis, horaires, jours) : demandées directement dans la langue
  choisie.
- **Agenda et bons plans** (textes saisis en français) : traduits automatiquement par le
  serveur avec Claude (`claude-haiku-4-5`), gardés en mémoire 24 h. Les textes déjà rédigés
  dans la langue sur OpenAgenda sont utilisés tels quels. Sans clé Anthropic, ils restent
  en français. `ENABLE_AUTO_TRANSLATE=false` coupe cette traduction.
- **Demandes d'autorisation iPhone** : `locales/ios/*.json` (nouveau build nécessaire).
- L'espace partenaires reste en français.

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

Sans base de données, modifier le fichier demande un redéploiement du backend : utilisez
plutôt l'**espace partenaires** (ci-dessous).

### Liens d'affiliation (réservation, billetterie, VTC)

La fiche d'un lieu peut afficher une carte **« Réserver et y aller »** avec jusqu'à
3 liens partenaires (un par type : réservation, billets, livraison, VTC), toujours suivis
de la mention « Liens partenaires : Sortir à Lille peut toucher une commission ».

1. **Inscrivez-vous** aux programmes d'affiliation qui vous intéressent : réservation de
   restaurant, billetterie de soirées ou concerts, VTC. Certains ont leur propre programme,
   d'autres passent par des plateformes d'affiliation. Chaque programme vous donne un
   **identifiant** et un **format de lien** (lisez leurs conditions : certains interdisent
   les liens dans une app, ou exigent un lien direct par établissement).
2. Copiez `server/affiliates.example.json` dans `server/affiliates.json` et remplacez les
   exemples par les vrais liens :

```jsonc
{
  "id": "reservation",                 // minuscules, chiffres, tirets
  "kind": "booking",                   // booking | tickets | ride | delivery
  "label": "Réserver une table",       // texte du bouton
  "partner": "Nom du partenaire",      // affiché sous le bouton
  // Modèle d'URL (https obligatoire). Variables : {name} {address} {lat} {lng} {placeId} {city}
  "urlTemplate": "https://partenaire.fr/recherche?q={name}&aff=VOTRE_ID",
  "placeTypes": ["restaurant"],        // types Google concernés ; absent = tous les lieux
  "places": {                          // liens directs par place_id (prioritaires)
    "ChIJ…": "https://partenaire.fr/restaurant/123?aff=VOTRE_ID"
  },
  "active": true                       // false pour couper sans supprimer
}
```

Sans `urlTemplate`, le partenaire n'apparaît que pour les lieux listés dans `places`
(pratique pour ne proposer la réservation que chez les restaurants inscrits).

Chaque clic passe par `/api/go`, qui écrit une ligne `[affiliate-click]` dans les journaux
du serveur (partenaire, lieu, heure : aucune donnée personnelle) puis redirige vers le
partenaire. Vous pouvez ainsi comparer vos clics avec les commissions du partenaire.
L'adresse de destination est toujours reconstruite à partir de `affiliates.json` :
personne ne peut détourner `/api/go` vers un autre site.

### Espace partenaires (bons plans, agenda, sponsorisés, liens)

L'espace partenaires est une page web protégée par mot de passe, à l'adresse de votre
serveur suivie de **`/admin`** (en local : <http://localhost:8081/admin>). Sans base de
données, il fonctionne en **lecture seule** : il montre le contenu des fichiers
`server/offers.json`, `events.json`, `sponsored.json` et `affiliates.json` (vides par
défaut ; modèles dans les fichiers `*.example.json`).

**1. Choisir un mot de passe** d'au moins 12 caractères et l'ajouter côté serveur :
`ADMIN_PASSWORD=…` dans `.env.local` (et dans les variables d'environnement EAS pour le
serveur en ligne). Sans ce réglage, l'espace reste fermé.

**2. Créer la base de données** (gratuite pour démarrer) pour pouvoir modifier en ligne :

1. Créez un compte sur <https://supabase.com>, puis un projet (région Europe, par
   exemple Paris ou Francfort).
2. Menu *SQL Editor → New query* : collez le contenu de `supabase/schema.sql`, puis
   **Run**.
3. Menu *Project Settings → API* : copiez l'**URL du projet** et la clé
   **`service_role`** (secrète).
4. Ajoutez-les côté serveur, **jamais** avec le préfixe `EXPO_PUBLIC_` :

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Relancez `npm start` : l'espace partenaires indique « Base de données connectée » et les
boutons **Ajouter / Modifier / Supprimer** apparaissent. Les changements sont visibles
dans l'app en moins d'une minute, sans redéploiement. Dès que la base est configurée,
ce sont ses données qui comptent (les fichiers JSON sont ignorés).

**Remplir un formulaire** : tapez le nom de l'établissement dans « Chercher le lieu » et
choisissez-le dans la liste : le `place_id`, le nom et la position se remplissent seuls.
Les dates sont au format `AAAA-MM-JJ`, les heures `HH:MM` (heure de Lille).

**Statistiques** : l'onglet « Statistiques » montre les clics sur les liens partenaires
des 30 derniers jours, par partenaire et par lieu. C'est utile pour montrer à un
établissement ce que lui apporte l'app.

### Agenda OpenAgenda (Ville de Lille)

« Ce soir à Lille » reprend l'agenda officiel de la **Ville de Lille**
(<https://openagenda.com/fr/ville-de-lille>, identifiant `57621068`), filtré pour ne garder
que les **sorties culturelles** qui intéressent touristes et jeunes Lillois (concerts,
expos, spectacles, festivals, cinéma, soirées, visites…). Les réunions, conseils de
quartier, activités pour tout-petits ou seniors, collectes, inscriptions et événements
annulés sont écartés. Il suffit d'une **clé API OpenAgenda** (gratuite) :

1. Créez un compte sur <https://openagenda.com>, puis allez dans *Paramètres du compte →
   Clé API* et copiez la **clé publique**.
2. Ajoutez-la côté serveur (dans `.env.local`, et dans les variables d'environnement EAS
   pour le serveur en ligne) :

```
OPENAGENDA_KEY=votre-cle
```

Pour ajouter d'autres agendas, listez leurs identifiants séparés par des virgules :
`OPENAGENDA_AGENDAS=57621068,12345678`. Les réponses sont gardées 15 min en cache. Un
événement présent à la fois chez un partenaire et dans OpenAgenda (même titre, même lieu)
n'apparaît qu'une fois.

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
serveur de développement **sur le même réseau Wi-Fi** (ou en mode tunnel, voir plus bas) :

```bash
npm start
```

Ouvrez l'app sur le téléphone : elle se connecte au serveur Metro, qui sert aussi les
routes API (`/api/search`). La clé Google reste donc sur votre ordinateur.

> Un nouveau build EAS n'est nécessaire que si on ajoute ou modifie un module natif
> (ce sera le cas aux étapes 2, 4 et 5). Le reste se met à jour à chaud.

### Tester hors du Wi-Fi : mode tunnel

```bash
npx expo start --dev-client --tunnel
```

Le téléphone peut être en 4G : l'app et les routes API passent par le tunnel (l'ordinateur
doit rester allumé).

### Version autonome (sans ordinateur) : backend en ligne + APK « preview »

1. Variables serveur dans EAS (une commande par variable, valeurs copiées depuis `.env.local`) :

   ```bash
   eas env:set --name GOOGLE_PLACES_API_KEY --value "…" --visibility sensitive --environment production
   eas env:set --name OPENAGENDA_KEY --value "…" --visibility sensitive --environment production
   ```

   (idem pour `MEL_API_KEY`, `ADMIN_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ANTHROPIC_API_KEY` si vous les utilisez.)

2. Mise en ligne du backend (EAS Hosting) :

   ```bash
   npm run deploy:api
   ```

   Au premier déploiement, choisissez le sous-domaine (ex. `sortir-a-lille` →
   `https://sortir-a-lille.expo.app`). Vérifiez : `https://sortir-a-lille.expo.app/api/weather`.

3. Variables de l'app (lues au moment du build, pour preview et production) :

   ```bash
   eas env:set --name EXPO_PUBLIC_API_URL --value "https://sortir-a-lille.expo.app" --visibility plaintext --environment preview --environment production
   eas env:set --name GOOGLE_MAPS_ANDROID_API_KEY --value "…" --visibility sensitive --environment preview --environment production
   ```

4. APK installable sans ordinateur :

   ```bash
   npm run build:preview:android
   ```

Après une modification du code serveur, relancez `npm run deploy:api` ; après une
modification de l'app, relancez le build preview.

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

- [ ] Aperçu d'itinéraire, mode à pied, vélo ou voiture : « Y aller avec Google Maps » ouvre
      Google Maps avec le guidage vers le lieu (nom du lieu affiché).
- [ ] « Horaires et trajet détaillé » (transports) : trajets, étapes et temps réel Ilévia ;
      « Y aller avec Google Maps » ouvre le trajet en transports dans Google Maps.

## 8. Checklist de test : étape 5

Il faut **refaire un build** (`npm run build:dev:android`) : AdMob ajoute du code natif.

- [ ] Au premier lancement, en France : le **formulaire de consentement Google** s'affiche
      (seulement si un message RGPD est publié dans AdMob ; sinon les pubs de test
      s'affichent directement). Sur iPhone, la demande de suivi Apple vient ensuite.
- [ ] Accueil : une **bannière « Test Ad »** en bas de l'écran.
- [ ] Résultats en liste : une **annonce native** (badge « Annonce ») après le 5e et le 10e lieu.
- [ ] La 1re recherche n'affiche pas d'interstitiel ; la 2e en affiche un (test),
      les suivantes plus jamais pendant la session.
- [ ] « Confidentialité et publicité » (accueil) rouvre le formulaire de consentement.
- [ ] Sponsorisé : copiez `server/sponsored.example.json` dans `server/sponsored.json`,
      mettez des dates qui incluent aujourd'hui, relancez `npm start` et cherchez
      « sushi » : le lieu apparaît en tête avec le badge « Sponsorisé ».

## 8 bis. Checklist : Surprends-moi, météo, accessibilité, partage

Pas besoin de nouveau build (aucun module natif ajouté) : relancez simplement `npm start`.

- [ ] Accueil : la température s'affiche à côté de « … SOIR · LILLE », et une carte
      météo propose une idée ; un appui lance la recherche (avec le filtre « Terrasse »
      s'il fait beau).
- [ ] « Surprends-moi » : ouvre la fiche d'un lieu ouvert et bien noté, avec la pastille
      « Surprise ! Ouvert · 4,5 ★ · ~8 min à pied ». Un 2e appui donne souvent un autre lieu.
- [ ] Filtres → « Accès fauteuil » : seuls les lieux dont l'entrée est accessible restent.
      La phrase « resto accessible en fauteuil » active aussi ce filtre (si Claude est actif).
- [ ] Fiche d'un lieu → icône partage : la feuille de partage s'ouvre, le message contient
      le nom, l'adresse et un lien qui ouvre Google Maps.

## 8 ter. Checklist : liens d'affiliation

- [ ] Copiez `server/affiliates.example.json` dans `server/affiliates.json` et relancez
      `npm start`.
- [ ] Fiche d'un restaurant : la carte « Réserver et y aller » affiche « Réserver une
      table » et « Commander un VTC », avec la mention « Liens partenaires ».
- [ ] Fiche d'un bar ou d'une boîte : « Soirées et billets » apparaît.
- [ ] « Commander un VTC » ouvre Uber (ou son site) avec le lieu comme destination.
- [ ] Remettez `[]` dans `server/affiliates.json` tant que vous n'avez pas de vrais
      identifiants partenaires (les liens d'exemple ne mènent nulle part).

## 8 quater. Checklist : économies, bons plans, espace partenaires, agenda

Pas de nouveau build nécessaire : relancez simplement `npm start`.

- [ ] Ajoutez `ADMIN_PASSWORD=` (12 caractères minimum) dans `.env.local`, relancez, puis
      ouvrez <http://localhost:8081/admin> sur l'ordinateur : le mot de passe ouvre
      l'espace, un mauvais mot de passe est refusé.
- [ ] Avec Supabase configuré : ajoutez un **bon plan** pour un bar proche (bouton
      « Chercher le lieu »), valable aujourd'hui. Dans l'app : il apparaît dans « Bons
      plans » sur l'accueil et sur la fiche du lieu.
- [ ] Ajoutez un **événement** ce soir, coché « À la une » : il apparaît en premier dans
      « Ce soir à Lille » avec le badge ; un appui ouvre la fiche du lieu.
- [ ] Onglet « Statistiques » : après un clic sur un lien partenaire dans l'app, il est
      compté.
- [ ] Économies : en faisant défiler les résultats, les photos se chargent au fur et à
      mesure ; revenir sur une fiche déjà vue est instantané.
- [ ] Dans Google Cloud : budget et quotas par jour réglés (voir « Protégez votre
      budget »).

## 9. Avant la publication sur les stores

- [ ] Clés Google **séparées** : clé serveur (Places + Routes, sans restriction d'app) et
      clés mobiles (Navigation SDK + Maps SDK, restreintes au package / bundle ID).
      Régénérez toute clé qui a été partagée.
- [ ] Backend déployé (`eas deploy`) avec `GOOGLE_PLACES_API_KEY` en variable d'environnement
      EAS, puis `EXPO_PUBLIC_API_URL` renseignée pour les builds preview et production.
- [ ] Quotas par jour et budget Google Cloud réglés (la limite par appareil de l'app
      n'est qu'un garde-fou).
- [ ] Espace partenaires : `ADMIN_PASSWORD` long et unique, variables Supabase définies
      dans EAS (environnement production).
- [ ] Vrais IDs AdMob, message RGPD publié, app-ads.txt en ligne.
- [ ] Justification de la localisation écran verrouillé dans les fiches App Store / Google Play.
- [ ] Politique de confidentialité (position, publicité, identifiant publicitaire).
- [ ] Liens d'affiliation : vrais identifiants partenaires, conditions de chaque programme
      respectées, mention des commissions dans les CGU et la fiche store.

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
