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
| 1 | Recherche + liste de résultats + filtres + historique | ✅ à tester sur téléphone |
| 2 | Fiche lieu + carte (MapView du Navigation SDK) + favoris | ⏳ |
| 3 | Aperçu d'itinéraire (Routes API) | ⏳ |
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
  results.tsx        résultats : liste, filtres
  api/search+api.ts  POST /api/search → reformulation + Places Text Search + classement
  api/photo+api.ts   GET  /api/photo  → photo Google sans exposer la clé
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
eas init                              # crée le projet EAS et renseigne son ID
# Mettez l'ID affiché dans EAS_PROJECT_ID (ou laissez eas init modifier la config).

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

## Règles Google respectées

- Clé Places uniquement côté serveur ; photos servies via `/api/photo` (URL temporaire).
- Aucune donnée Places stockée durablement : cache mémoire de 5 minutes côté serveur,
  historique local limité aux requêtes tapées. Les favoris (étape 2) ne conserveront que
  le `place_id`.
- Attribution « Google Maps » sous les listes et crédit des auteurs des photos.
- Données Places affichées sur une carte Google uniquement (étape 2).
