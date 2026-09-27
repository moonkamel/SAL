# Sortir à Lille

Application mobile (iOS + Android) : on tape ce qu'on veut faire ce soir
(« manger japonais », « aller danser »…) et l'app affiche les lieux les plus
proches et les plus pertinents de la métropole lilloise, puis guide l'utilisateur
jusqu'au lieu **sans quitter l'app**.

Stack : Expo SDK 57 (React Native 0.86, New Architecture) · TypeScript · Expo Router
(écrans + routes API) · Google Places API (New) · Claude (reformulation optionnelle).

## État d'avancement

| Étape | Contenu | État |
| --- | --- | --- |
| 0 | Socle : Expo Router, thème sombre, localisation, EAS | ✅ à tester sur téléphone |
| 1 | Recherche + liste de résultats + filtres + historique | ✅ testé avec les vraies données Google, à tester sur téléphone |
| 2 | Fiche lieu + carte (MapView du Navigation SDK) + favoris | ✅ à tester sur téléphone (nouveau build nécessaire) |
| 3 | Aperçu d'itinéraire (Routes API) | ✅ testé avec les vraies données Google, à tester sur téléphone |
| 4 | Navigation guidée intégrée (Google Navigation SDK) | ⏳ |
| 5 | Publicité AdMob + consentement + lieux sponsorisés | ⏳ |

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
  route/[id].tsx     aperçu d'itinéraire : tracé, choix du mode, durée, « Démarrer »
plugins/withGoogleNavigation.js  plugin Expo : clés Maps, désugarage Android, Jetifier
server/              logique backend (testable seule)
  places.ts          client Places API (New)
  rewrite.ts         reformulation par Claude (optionnelle)
  ranking.ts         score note / nombre d'avis / distance / pertinence : tous les réglages ici
  cache.ts           cache mémoire court (5 min)
  search.ts          orchestration
shared/              types, géo et formatage communs à l'app et au serveur
src/                 composants, localisation, historique, thème
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

### AdMob (étape 5)

La procédure (application AdMob, blocs d'annonces, IDs de test, consentement UMP) sera
détaillée à l'étape 5.

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

## Règles Google respectées

- Clé Places uniquement côté serveur ; photos servies via `/api/photo` (URL temporaire).
- Aucune donnée Places stockée durablement : cache mémoire de 5 minutes côté serveur,
  historique local limité aux requêtes tapées. Les favoris (étape 2) ne conserveront que
  le `place_id`.
- Attribution « Google Maps » sous les listes, crédit des auteurs des photos, auteur de
  chaque avis (lien vers son profil Google).
- Données Places affichées uniquement sur une carte Google (Navigation SDK).
- Favoris : seul le `place_id` est stocké ; les infos sont rechargées depuis Google.
