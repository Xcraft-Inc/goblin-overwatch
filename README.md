# 📘 Documentation du module goblin-overwatch

## Aperçu

Le module `goblin-overwatch` est un système de surveillance et de rapport d'erreurs pour les applications Xcraft. Il permet de collecter, agréger et notifier les erreurs et comportements suspects qui se produisent dans l'application, via différents canaux comme Discord ou email.

## Structure du module

- **Service principal** : Un goblin singleton qui gère la collecte et l'envoi des erreurs
- **Backends** : Implémentations pour différents canaux de notification (Discord, email)
- **Système de rapport** : Formatage des erreurs pour les différents backends
- **Collecteur** : Agrégation des erreurs avec possibilité de debounce

## Fonctionnement global

Le module fonctionne selon deux modes principaux :

- **debounce** : Les erreurs sont collectées et envoyées périodiquement (par défaut toutes les 30 secondes)
- **manual** : Les erreurs sont collectées mais doivent être envoyées manuellement

Lorsqu'une erreur se produit dans l'application, elle peut être signalée à Overwatch via deux quêtes principales :

- `exception` : Pour les erreurs critiques (exceptions)
- `hazard` : Pour les comportements suspects ou potentiellement problématiques

Les erreurs sont ensuite formatées et envoyées aux canaux configurés (Discord, email) avec des informations contextuelles comme la pile d'appels, l'horodatage, et le nombre d'occurrences.

## Exemples d'utilisation

### Initialisation du service

```javascript
// Dans une méthode d'un acteur Elf
async elfQuest() {
  // Initialiser le service avec un temps de debounce personnalisé (en ms)
  const overwatch = this.quest.getAPI('overwatch');
  await overwatch.init({debounceTime: 60000}); // Debounce de 60 secondes
}
```

### Signaler une exception

```javascript
// Dans une méthode d'un acteur Elf
async elfQuest() {
  const overwatch = this.quest.getAPI('overwatch');
  try {
    // Code qui peut générer une exception
  } catch (err) {
    await overwatch.exception({
      error: {
        err: err.message,
        mod: 'module',
        time: new Date().toISOString(),
      }
    });
  }
}
```

Ce mécanisme est automatiquement utilisé par le module xcraft-core-buslog en cas de génération de message d'erreurs avec `this.log.err` si le module overwatch est activé dans votre app.json pour xcraft-core-buslog.

### Signaler un comportement suspect

```javascript
// Dans une méthode d'un acteur Elf
async elfQuest() {
  const overwatch = this.quest.getAPI('overwatch');
  await overwatch.hazard({
    error: {
      err: 'Description du comportement suspect',
      mod: ['module-name'],
      time: new Date().toISOString(),
    }
  });
}
```

### Récupérer toutes les erreurs manuellement

```javascript
// Dans une méthode d'un acteur Elf
async elfQuest() {
  const overwatch = this.quest.getAPI('overwatch');
  const allErrors = await overwatch.getAllErrors();
  // Traiter les erreurs...
}
```

## Interactions avec d'autres modules

- **[xcraft-core-etc]** : Pour charger la configuration du module
- **[xcraft-core-fs]** : Pour lister les backends disponibles
- **[xcraft-core-utils]** : Pour diverses fonctions utilitaires (ArrayCollector, crypto, locks)
- **[xcraft-core-host]** : Pour obtenir des informations sur l'application (appId, variantId)
- **[xcraft-core-goblin]** : Pour l'infrastructure d'acteurs

## Configuration avancée

La configuration du module se fait via le fichier `config.js` et peut être modifiée dans le fichier `app.json` de l'application :

| Option | Description | Type | Valeur par défaut |
|--------|-------------|------|------------------|
| mode | Mode de fonctionnement (`debounce` ou `manual`) | string | `debounce` |
| channels | Liste des canaux disponibles pour les notifications | object | `null` |
| agent | Nom de l'agent qui rapporte les erreurs | string | `ana` |

Exemple de configuration dans app.json :

```json
"xcraft-core-log": {
  "modes": ["overwatch"]
},
"goblin-overwatch": {
  "mode": "debounce",
  "channels": {
    "discord": [
      "${serverId}/${channelId}"
    ],
    "mail": []
  },
  "agent": "genji"
}
```

### Variables d'environnement

| Variable | Description | Exemple | Valeur par défaut |
|----------|-------------|---------|------------------|
| NODE_ENV | Environnement d'exécution, affecte le formatage des messages | `development` | - |

## Détails des sources

### `service.js`

Ce fichier définit le service principal qui gère la collecte et l'envoi des erreurs. Il expose les quêtes suivantes :

- **`init(debounceTime)`** - Initialise le service avec les backends configurés. Le paramètre `debounceTime` (par défaut 30000ms) définit l'intervalle de regroupement des erreurs.
- **`exception(error)`** - Collecte une exception pour traitement ultérieur.
- **`hazard(error)`** - Collecte un comportement suspect pour traitement ultérieur.
- **`push-errors(errorsCollected)`** - Traite les erreurs collectées et les ajoute à l'état du service.
- **`prepare-send-errors()`** - Prépare l'envoi des erreurs via tous les backends configurés.
- **`send-errors-by-backend(backendKey, mode)`** - Envoie les erreurs via un backend spécifique.
- **`send-errors(backend, channel, errors, mode, appInfo, agent)`** - Envoie les erreurs à un canal spécifique.
- **`get-all-errors()`** - Récupère toutes les erreurs collectées et les efface.
- **`clear-all-errors()`** - Efface toutes les erreurs collectées.

Le service utilise un `ArrayCollector` pour regrouper les erreurs similaires et réduire le nombre de notifications.

### `report.js`

Cette classe est responsable de la génération des rapports d'erreurs formatés pour les différents backends. Elle extrait les informations pertinentes des erreurs et les présente de manière structurée avec des sections comme :

- En-tête avec le nom de l'hôte et de l'application
- Sujet de l'erreur
- Date de l'erreur
- Message d'erreur
- Pile d'appels (goblin ou module)
- Nombre d'occurrences

La classe fournit des méthodes pour accéder à ces différentes parties du rapport et gère également les erreurs internes qui pourraient survenir lors de la génération du rapport.

### `backends/discord.js`

Implémentation du backend Discord pour l'envoi de notifications. Il gère :

- La conversion du format HTML vers Markdown
- La gestion des limites de taille des messages Discord (2000 caractères)
- L'envoi de fichiers pour les messages trop longs
- La gestion des erreurs et des limites de taux d'envoi (avec retry automatique)
- L'utilisation d'emojis et d'avatars personnalisés pour les notifications

Le backend utilise la bibliothèque `got` pour les requêtes HTTP et `formdata-node` pour l'envoi de fichiers.

### `backends/mail.js`

Implémentation du backend email pour l'envoi de notifications. Il gère :

- La conversion du format HTML vers texte brut
- Le formatage des messages d'erreur pour l'envoi par email

Note: L'implémentation actuelle du backend mail n'est pas complète et lance une erreur "Not implemented! See nodemailer module".

### `config.js`

Définit les options de configuration disponibles pour le module :

- **mode** : Mode de fonctionnement (`debounce` ou `manual`)
- **channels** : Canaux disponibles pour les notifications
- **agent** : Nom de l'agent qui rapporte les erreurs (avec une liste de personnages d'Overwatch comme choix)

### `eslint.config.js`

Configuration ESLint pour le module, définissant les règles de style de code et les plugins utilisés (js, react, jsdoc, babel, prettier).

### `overwatch.js`

Point d'entrée du module qui expose les commandes Xcraft disponibles via la fonction `xcraftCommands`.

_Cette documentation a été mise à jour automatiquement._

[xcraft-core-etc]: https://github.com/Xcraft-Inc/xcraft-core-etc
[xcraft-core-fs]: https://github.com/Xcraft-Inc/xcraft-core-fs
[xcraft-core-utils]: https://github.com/Xcraft-Inc/xcraft-core-utils
[xcraft-core-host]: https://github.com/Xcraft-Inc/xcraft-core-host
[xcraft-core-goblin]: https://github.com/Xcraft-Inc/xcraft-core-goblin