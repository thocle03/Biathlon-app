# Déployer Biathlon App Gratuitement

Puisque votre application utilise **Dexie.js (IndexedDB)**, la base de données est stockée directement dans le navigateur de l'utilisateur. Cela signifie que votre application est techniquement un "site statique" (HTML/CSS/JS uniquement, sans serveur backend).

Vous pouvez donc l'héberger **gratuitement** et **très facilement** sur des plateformes comme **Netlify** ou **Vercel**.

## ⚠️ Important : Le stockage local
Avant de déployer, comprenez bien ceci :
1. **Données locales uniquement** : Les données que vous entrez sur votre ordinateur ne seront **pas** visibles sur votre téléphone. Chaque appareil a sa propre base de données isolée.
2. **Pas de partage** : Si vous envoyez le lien à un ami, il verra une application vide (sans vos concurrents ni résultats).
3. **Sauvegardes** : Utilisez la page **Paramètres > Sauvegarde (Export)** pour générer un fichier `.json` si vous voulez transférer vos données d'un appareil à l'autre.

---

## Méthode 1 : Netlify Drop (Le plus simple)
Cette méthode ne nécessite même pas d'installer Git.

1. **Créer la version de production** :
   Ouvrez votre terminal dans le dossier du projet et lancez :
   ```bash
   npm run build
   ```
   Cela va créer un dossier `dist` (parfois appelé `build`) à la racine de votre projet.

2. **Héberger** :
   - Allez sur [app.netlify.com/drop](https://app.netlify.com/drop).
   - Prenez le dossier `dist` qui vient d'être créé.
   - Glissez-le directement dans la zone pointillée sur la page web.
   - C'est tout ! Netlify va vous donner un lien (ex: `biathlon-app.netlify.app`).

---

## Méthode 2 : Vercel (Recommandé pour les mises à jour)
Cette méthode permet de mettre à jour automatiquement le site quand vous modifiez le code.

1. Mettez votre code sur **GitHub** (créez un repo et poussez votre code).
2. Créez un compte sur [Vercel.com](https://vercel.com) (connexion avec GitHub).
3. Cliquez sur "Add New..." -> "Project".
4. Sélectionnez votre repo `Biathlon-app`.
5. Vercel va détecter que c'est du Vite/React. Cliquez juste sur **Deploy**.
6. En quelques secondes, votre site est en ligne.

---

## Méthode 3 : GitHub Pages
Si vous préférez rester sur GitHub :

1. Installez le package `gh-pages` :
   ```bash
   npm install gh-pages --save-dev
   ```
2. Ajoutez ces lignes dans votre `package.json` :
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```
3. Lancez la commande :
   ```bash
   npm run deploy
   ```
4. Votre site sera visible sur `https://votre-pseudo.github.io/Biathlon-app`.
