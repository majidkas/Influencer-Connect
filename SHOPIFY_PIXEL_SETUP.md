# Guide de Configuration - Shopify Web Pixel Extension

Ce guide explique comment deployer le pixel de tracking via Shopify CLI pour une integration native dans "Evenements clients".

## Prerequis

1. **Node.js** v18 ou superieur
2. **Shopify CLI** installe globalement :
   ```bash
   npm install -g @shopify/cli @shopify/theme
   ```
3. **Acces Partner Dashboard** : https://partners.shopify.com

## Etapes de Configuration

### 1. Configurer le Client ID

Dans le fichier `shopify.app.toml`, remplacez `client_id = "your-client-id"` par votre vrai Client ID depuis le Partner Dashboard :

```toml
client_id = "VOTRE_CLIENT_ID_ICI"
```

### 2. Lier l'Application

```bash
# Dans le repertoire du projet
shopify app config link
```

Selectionnez votre application existante ou creez-en une nouvelle.

### 3. Deployer l'Extension Pixel

```bash
# Deployer uniquement l'extension pixel
shopify app deploy
```

Cela deploiera le Web Pixel Extension sur Shopify.

### 4. Activer le Pixel dans la Boutique

1. Allez dans **Shopify Admin** > **Parametres** > **Evenements clients**
2. Votre pixel "Influencer Tracking Pixel" devrait apparaitre
3. Cliquez dessus et activez-le ("Connecte")

## Structure des Fichiers

```
├── shopify.app.toml                    # Configuration principale de l'app
└── extensions/
    └── tracking-pixel/
        ├── shopify.extension.toml      # Config de l'extension
        └── src/
            └── index.js                # Code du pixel
```

## Evenements Trackes

Le pixel capture automatiquement :

| Evenement | Description |
|-----------|-------------|
| `page_view` | Visiteur arrive via lien UTM |
| `product_view` | Consultation d'une fiche produit |
| `add_to_cart` | Ajout au panier |
| `purchase` | Achat complete (checkout_completed) |

## Attribution UTM

1. Le visiteur clique sur un lien avec `?utm_campaign=SLUG`
2. Le pixel stocke le slug dans `localStorage` (30 jours)
3. Tous les evenements suivants sont attribues a cette campagne

## Backend API

Les evenements sont envoyes a :
```
POST https://influ-connect.replit.app/api/tracking/event
```

Payload :
```json
{
  "slugUtm": "campaign-slug",
  "sessionId": "sess_xxx_timestamp",
  "eventType": "purchase",
  "revenue": 99.99,
  "currency": "EUR",
  "source": "web_pixel"
}
```

## Commandes Utiles

```bash
# Voir le statut de l'app
shopify app info

# Lancer en mode developpement
shopify app dev

# Deployer les changements
shopify app deploy

# Voir les logs
shopify app logs
```

## Depannage

### Le pixel n'apparait pas dans "Evenements clients"
- Verifiez que `shopify app deploy` s'est termine avec succes
- Attendez quelques minutes, puis rafraichissez la page

### Evenements non recus
- Verifiez les logs serveur pour les erreurs CORS
- Assurez-vous que le slug UTM existe dans la base de donnees

### Erreur "App not installed"
- Reinstallez l'app depuis : `https://admin.shopify.com/store/VOTRE_STORE/oauth/install?client_id=VOTRE_CLIENT_ID`
