# The Blind Game

Un blind test musical à jouer entre amis, depuis son navigateur ou son téléphone. Un hôte crée un salon, les joueurs le rejoignent avec un code ou un QR code, puis devinent le titre des morceaux avant les autres. Le jeu se joue en solo ou par équipes, avec un bonus optionnel pour le nom de l'artiste.

## Sommaire

- [Fonctionnement](#fonctionnement)
- [Stack technique](#stack-technique)
- [Structure du monorepo](#structure-du-monorepo)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Ajouter des musiques](#ajouter-des-musiques)
- [Lancer en développement](#lancer-en-développement)
- [Variables d'environnement](#variables-denvironnement)
- [Tests et build](#tests-et-build)
- [Déploiement](#déploiement)

## Fonctionnement

1. **L'hôte crée un salon** et choisit le mode (solo ou par équipes), le nombre de manches (de 5 à 20) et s'il y a un bonus artiste.
2. **Les joueurs rejoignent** en saisissant le code du salon ou en scannant le QR code affiché sur la page du salon.
3. **Chaque manche** diffuse un extrait d'un morceau (30 secondes maximum). Les joueurs saisissent le titre.
   - Titre trouvé dans les 5 premières secondes : 100 points, puis le score baisse progressivement (environ 40 points à 30 secondes).
   - Bonus artiste (si activé) : +50 points si la réponse contient le nom de l'artiste, une fois par joueur (ou par équipe).
   - La comparaison ignore la casse, les accents et les espaces en début ou fin de texte. Elle n'accepte pas les fautes de frappe.
4. **La manche se termine** dès que tous les joueurs ont trouvé, ou au bout de 30 secondes. Les résultats s'affichent, puis la manche suivante commence.
5. **En fin de partie**, le podium s'affiche. L'hôte peut modifier la configuration et relancer une partie sans recréer le salon.

Les connexions sont résilientes : un joueur qui perd le réseau ou recharge la page est reconnecté à sa partie pendant 15 secondes après la coupure, et l'état du salon lui est renvoyé.

## Stack technique

| Partie | Technologies |
| --- | --- |
| Front (`apps/web`) | Next.js 16 (App Router), React 19, Tailwind CSS 4, Zustand, socket.io-client, qrcode.react |
| Back (`apps/api`) | NestJS 11, `@nestjs/websockets`, socket.io 4, serveur de fichiers statiques pour la musique |
| Partagé (`packages/shared`) | Types TypeScript et noms d'événements socket, partagés entre le front et le back |
| Outillage | pnpm workspaces, Turborepo, Jest, ESLint, Prettier |

## Structure du monorepo

```
blind-game/
├── apps/
│   ├── api/          # Serveur NestJS : logique de jeu, websockets, liste des musiques
│   │   └── music/    # Dossier des musiques (voir ci-dessous)
│   └── web/          # Application Next.js : pages hôte, joueur, rejoindre, accueil
├── packages/
│   └── shared/       # Événements et types partagés (@blindtest/shared)
├── turbo.json
└── pnpm-workspace.yaml
```

Pages principales du front :

- `/` : accueil, création d'un salon
- `/join` : rejoindre un salon avec un code
- `/room/[codeGame]` : page de l'hôte (configuration, gestion des musiques, lancement)
- `/play/[codeGame]` : page du joueur (choix d'équipe, réponses, résultats)

## Prérequis

- **Node.js** 20.9 ou plus récent (requis par Next.js 16)
- **pnpm** 11 
## Installation

```bash
# À la racine du projet
pnpm install

# Compile le package partagé (à refaire après toute modification de packages/shared)
pnpm --filter @blindtest/shared build
```

## Ajouter des musiques

Le serveur cherche le dossier des musiques dans cet ordre (le premier existant est utilisé) :

1. `~/musica`
2. `./music` à la racine où le serveur est lancé
3. `apps/api/music` (dossier présent dans le dépôt)

Formats supportés : `.mp3`, `.wav`, `.ogg`, `.m4a`, `.aac`, `.flac`.

**Nommage.** Le titre attendu est le nom du fichier sans son extension : une réponse est juste si elle *contient* ce nom (après normalisation). Un fichier nommé `Allumer le feu.mp3` attend donc « allumer le feu ». Garde des noms de fichiers qui correspondent au titre, et indique l'artiste dans les métadonnées. Sans métadonnée, l'artiste est déduit de ce qui précède le ` - ` dans le nom du fichier.
Quand le bonus artiste est désactivé, le nom de l'artiste compte aussi comme bonne réponse principale.

**Métadonnées (optionnel).** Au premier démarrage, un fichier texte est créé pour chaque morceau dans le sous-dossier `metadata/` :

```
Nom de l'artiste
13, 30, 60
```

- Ligne 1 : le nom de l'artiste (utilisé pour le bonus artiste).
- Ligne 2 : les instants de départ possibles de l'extrait, en secondes ou au format `m:ss`, séparés par des virgules. Un instant est tiré au hasard à chaque manche. Sans cette ligne, l'extrait démarre à un instant calculé à partir de la durée du morceau.

Les fichiers sont servis par le backend sous `/music/...`. Le fichier `apps/api/music/.gitkeep` garde simplement le dossier dans Git.

## Lancer en développement

Dans deux terminaux, ou avec `pnpm dev` qui lance les deux via Turborepo :

```bash
# Terminal 1 : API sur le port 3001
pnpm dev:api

# Terminal 2 : web sur le port 3000
pnpm dev:web
```

Ouvrir [http://localhost:3000](http://localhost:3000).

Pour tester avec un téléphone sur le même réseau :

1. Ouvrir le site via l'adresse IP de la machine (par exemple `http://192.168.1.20:3000`). Le front se connecte alors à l'API sur `http://<même hôte>:3001` automatiquement.
2. Si le QR code pointe encore vers `localhost`, définir `NEXT_PUBLIC_PUBLIC_URL` (voir ci-dessous).

## Variables d'environnement

Toutes les variables sont optionnelles en développement.

| Variable | Où | Rôle |
| --- | --- | --- |
| `PORT` | API | Port d'écoute de l'API (3001 par défaut) |
| `NODE_ENV` | API | En `production`, les origines websocket autorisées sont lues dans `WEB_ORIGIN` |
| `WEB_ORIGIN` | API | Liste d'origines autorisées séparées par des virgules, ex. `https://blindtest.example.com` |
| `NEXT_PUBLIC_API_URL` | Web | URL complète de l'API. Par défaut : `http://<hostname de la page>:3001` |
| `NEXT_PUBLIC_PUBLIC_URL` | Web | URL publique du site utilisée pour générer le QR code (utile quand la page est ouverte en `localhost`) |

Exemple pour un test sur réseau local :

```bash
NEXT_PUBLIC_PUBLIC_URL=http://192.168.1.20:3000 pnpm dev:web
```

## Tests et build

```bash
# Tests unitaires de l'API (Jest)
pnpm --filter api test

# Build de tout le monorepo
pnpm build

# Lint du front
pnpm --filter web lint
```

## Déploiement

En production, le front et l'API sont des processus Node distincts :

```bash
pnpm build

# API
cd apps/api && NODE_ENV=production WEB_ORIGIN=https://ton-domaine.fr pnpm start:prod

# Web
cd apps/web && pnpm start
```

Pense à :

- définir `NEXT_PUBLIC_API_URL` **au moment du build** du front si l'API n'est pas sur le même hôte ;
- définir `NEXT_PUBLIC_PUBLIC_URL` pour que le QR code pointe vers le bon domaine ;
- servir l'API et le front en HTTPS : les navigateurs bloquent souvent les contenus audio et les websockets mixtes.
