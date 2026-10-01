# Tableau des allergènes pour restaurants

Outil web pour les restaurateurs : le chef saisit ses plats et leurs ingrédients
(au clavier ou **en scannant le code-barres** des produits), l’outil sort :

- le **tableau des 14 allergènes réglementaires**, prêt à imprimer (A4 paysage) ;
- un **QR code** à poser sur les tables : le client choisit ses allergies et voit
  tout de suite les plats qu’il peut manger, en français, anglais ou néerlandais ;
- des **chevalets** imprimables (4 par page A4) avec ce QR code.

Aucun compte, aucun serveur, aucune clé d’API : tout tourne dans le navigateur.

## Fonctionnement

| Onglet | Rôle |
| --- | --- |
| Ma carte | Nom de l’établissement, plats par catégorie (Entrées, Plats, Desserts…), sauvegarde |
| Ingrédients | Bibliothèque d’ingrédients réutilisables, scan de code-barres |
| Tableau | Matrice plats × 14 allergènes : ● contient, ○ peut contenir (traces) |
| QR code | Lien et QR code de la carte client, impression des chevalets |

- **Scan de code-barres** (EAN-13, EAN-8, UPC) avec la caméra du téléphone :
  `BarcodeDetector` natif sur Chrome/Android, sinon la bibliothèque ZXing embarquée
  (`vendor/zxing.min.js`, chargée seulement si besoin : iPhone, Firefox). Le code
  peut aussi être tapé à la main.
- **Open Food Facts** (gratuit, sans clé) : nom, marque, photo, allergènes et
  traces du produit scanné. Les allergènes déclarés sur Open Food Facts sont
  complétés par une lecture de la liste d’ingrédients. Le chef valide toujours.
- **Détection en français** pour les produits frais : en tapant « crème fraîche »,
  « moules de bouchot » ou « farine de blé », l’outil propose les allergènes, sans
  tomber dans les faux amis (« lait de coco », « noix de Saint-Jacques », « farine
  de riz », « sucre glace »…). Cela remplace Edamam / CalorieNinjas, payants, en
  anglais et inutiles pour ce besoin.
- **Carte client sans serveur** : toute la carte est compressée dans le lien du QR
  code (après le `#`, jamais envoyé à un serveur). Une carte de 30 plats tient
  dans un QR code lisible imprimé à 4 cm. Revers : après chaque changement de
  carte, il faut réimprimer les chevalets.
- **Données** : stockées sur l’appareil (`localStorage`). Export / import en JSON
  pour les sauvegarder ou passer d’un appareil à l’autre.
- « Charger un exemple » remplit une brasserie lilloise (welsh, carbonnade,
  moules, potjevleesch, tarte au sucre, merveilleux) : pratique en démonstration.

Mentions réglementaires imprimées sur le tableau : règlement (UE) n° 1169/2011,
annexe II, et décret n° 2015-447 du 17 avril 2015 (information allergènes des
denrées non préemballées, obligatoire par écrit en restauration).

## Lancer en local

Les modules JavaScript ne marchent pas en ouvrant le fichier directement : il faut
un petit serveur.

```bash
cd allergenes
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

La caméra n’est accessible qu’en **https** (ou sur `localhost`). Pour scanner avec
un téléphone et pour que les QR codes fonctionnent chez les clients, l’outil doit
être en ligne.

## Mettre en ligne

C’est un site statique : n’importe quel hébergeur gratuit convient.

- **GitHub Pages** : Settings → Pages → Source : « GitHub Actions », puis lancer
  le workflow « Allergènes — GitHub Pages » (onglet Actions). Il republie ensuite
  à chaque modification du dossier `allergenes/` sur `main`.
- **Netlify / Cloudflare Pages** : glisser-déposer le dossier `allergenes/`.

Si l’outil est utilisé depuis une autre adresse que celle où il est publié,
renseigner l’adresse publique dans l’onglet QR code.

## Code

| Fichier | Contenu |
| --- | --- |
| `index.html`, `js/app.js` | Outil du chef |
| `carte.html`, `js/carte.js` | Carte client ouverte par le QR code |
| `js/core.js` | Logique métier sans DOM : 14 allergènes, détection, Open Food Facts, encodage du lien (testé dans `tests/allergenes.test.ts`) |
| `js/scanner.js` | Caméra + lecture de code-barres |
| `vendor/` | ZXing 0.23.0 (Apache-2.0), qrcode-generator 2.0.4 (MIT) |

```bash
npx vitest run tests/allergenes.test.ts
```

## Suites possibles

- **Abonnement « mises à jour de carte »** : héberger la carte sur un lien fixe
  (`/r/nom-du-restaurant`) pour ne plus réimprimer les QR codes à chaque changement.
- **Coût matière par fiche technique** : prix d’achat et grammage par ingrédient,
  coût et marge par plat.
- Comptes multi-appareils (synchronisation), plusieurs établissements, export PDF direct.
