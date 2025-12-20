# Passer en mode "Base de Données en Ligne" (Online Database)

Pour que vos données soient **partagées** et synchronisées entre tous les utilisateurs (ou tous vos appareils), vous devez passer d'une base de données locale (IndexedDB) à une base de données hébergée dans le cloud.

Voici les 3 meilleures options pour votre projet actuel :

---

## Option 1 : Dexie Cloud (Le moins de modifications)
Puisque votre site est déjà construit avec **Dexie.js**, c'est la solution la plus naturelle.
- **Principe** : Dexie propose un service "Cloud" qui synchronise automatiquement votre base de données locale avec le cloud.
- **Avantages** :
  - **Presque aucun changement de code** : Vous gardez vos `useLiveQuery`, vos tables, etc.
  - **Offline-first** : L'app continue de marcher sans internet et se synchronise quand la connexion revient.
- **Prix** : Gratuit pour le développement et très petits projets, mais payant ensuite.
- **Complexité** : Faible.

## Option 2 : Supabase (Le meilleur compromis Gratuit/Puissance)
Supabase est une alternative Open Source à Firebase qui utilise **PostgreSQL**.
- **Avantages** :
  - **Excellente offre gratuite** (500MB de données, suffisant pour des années de biathlon).
  - **Interface de gestion** : Vous voyez vos tables (Events, Competitors) comme dans Excel.
  - **Authentification incluse** : Gère facilement les logins.
- **Inconvénients (Gros travail)** :
  - Il faut **réécrire toute la partie accès aux données**.
  - Remplacer `db.events.toArray()` par `supabase.from('events').select('*')`.
  - Remplacer `useLiveQuery` par `useEffect` ou `React Query`.

## Option 3 : Firebase (Le standard Google)
Très populaire pour les applis React.
- **Avantages** : Très rapide à mettre en place, temps réel (Firestore).
- **Inconvénients** : Base de données NoSQL (pas de schémas fixes), ce qui peut être déroutant si vous avez l'habitude des relations (Event -> Races). Comme pour Supabase, il faut réécrire tout le code d'accès aux données.

---

## Mon Conseil : Supabase
Si vous voulez une solution pérenne, gratuite et standard : **choisissez Supabase**.
Bien que cela demande de refaire le fichier `db.ts` et la façon dont les composants chargent les données, vous aurez :
1. Une vraie base de données PostgreSQL solide.
2. Une interface d'admin pour voir vos données.
3. La possibilité d'ajouter des comptes utilisateurs (Admin vs Visiteur).

### À quoi ressemblerait le changement pour Supabase ?

**Avant (Dexie) :**
```typescript
const events = useLiveQuery(() => db.events.toArray());
```

**Après (Supabase) :**
```typescript
const [events, setEvents] = useState([]);
useEffect(() => {
  supabase.from('events').select('*').then(({ data }) => setEvents(data));
}, []);
```

C'est un chantier important ("Refactoring"), mais c'est ce qui transforme votre "petite application locale" en "vraie application web professionnelle".
