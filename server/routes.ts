import { Router, type Request, type Response } from "express";
import { shopify } from "./lib/shopify"; // Vérifie que le chemin est bon selon ton projet
import { db } from "@db"; // Vérifie ton import de base de données
import { shops, campaigns, influencers, events, orders } from "@shared/schema"; // Vérifie tes schémas
import { eq, sql, desc } from "drizzle-orm";
import { DataType } from "@shopify/shopify-api";

const router = Router();

// ==============================================================================
// 1. ROUTE D'AUTHENTIFICATION (DÉMARRAGE)
// ==============================================================================
router.get("/api/shopify/auth", async (req: Request, res: Response) => {
  const shop = req.query.shop as string;

  if (!shop) {
    return res.status(400).send("Missing shop parameter");
  }

  // Nettoyage du nom de domaine
  const sanitizedShop = shopify.utils.sanitizeShop(shop);
  if (!sanitizedShop) {
    return res.status(400).send("Invalid shop parameter");
  }

  // FIX CRITIQUE : ÉJECTION DE L'IFRAME
  // Si la requête vient de l'intérieur de Shopify (iframe), on force le navigateur
  // à recharger la page "Top Level" pour autoriser les cookies First-Party.
  // Sans ça, l'installation échoue silencieusement sur Chrome/Safari.
  const authUrl = await shopify.auth.begin({
    shop: sanitizedShop,
    callbackPath: "/api/shopify/callback",
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });

  // On renvoie un petit bout de HTML qui force la redirection
  return res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <script>
          window.top.location.href = "${authUrl}";
        </script>
      </head>
      <body>
        <h1>Redirecting to Shopify Authentication...</h1>
      </body>
    </html>
  `);
});

// ==============================================================================
// 2. ROUTE DE CALLBACK (RETOUR APRÈS INSTALLATION)
// ==============================================================================
router.get("/api/shopify/callback", async (req: Request, res: Response) => {
  try {
    // 1. Validation de l'authentification OAuth
    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callback;
    const shop = session.shop;

    console.log(`[OAuth Callback] Session validée pour : ${shop}`);

    // 2. Initialisation du client GraphQL pour configurer le shop
    const client = new shopify.clients.Graphql({ session });

    // --------------------------------------------------------
    // A. ENREGISTREMENT DES WEBHOOKS
    // --------------------------------------------------------
    try {
      await shopify.webhooks.register({ session });
      console.log(`[OAuth Callback] Webhooks enregistrés avec succès`);
    } catch (whError) {
      console.error(`[OAuth Callback] Erreur Webhooks (non bloquant): ${whError}`);
    }

    // --------------------------------------------------------
    // B. ACTIVATION AUTOMATIQUE DU WEB PIXEL (NOUVEAU !)
    // --------------------------------------------------------
    // C'est ici qu'on force le pixel à passer en "Connecté"
    try {
      const pixelResponse = await client.query({
        data: `
          mutation {
            webPixelCreate(webPixel: { settings: "{}" }) {
              userErrors {
                code
                field
                message
              }
              webPixel {
                settings
                id
              }
            }
          }
        `,
      });
      
      // @ts-ignore
      const userErrors = pixelResponse.body.data?.webPixelCreate?.userErrors;
      if (userErrors && userErrors.length > 0) {
        console.error("[OAuth Callback] Erreur activation Pixel:", userErrors);
      } else {
        console.log("[OAuth Callback] ✅ Web Pixel activé et CONNECTÉ automatiquement !");
      }
    } catch (pixelError) {
      console.error(`[OAuth Callback] Erreur fatale Pixel: ${pixelError}`);
    }

    // --------------------------------------------------------
    // C. SAUVEGARDE EN BASE DE DONNÉES
    // --------------------------------------------------------
    await db.insert(shops).values({
      shopDomain: shop,
      accessToken: session.accessToken,
      isInstalled: true,
      installedAt: new Date(),
    }).onConflictDoUpdate({
      target: shops.shopDomain,
      set: { 
        accessToken: session.accessToken, 
        isInstalled: true,
        uninstalledAt: null
      },
    });
    console.log(`[OAuth Callback] Shop sauvegardé en BDD`);

    // --------------------------------------------------------
    // D. REDIRECTION FINALE VERS L'APP
    // --------------------------------------------------------
    // On renvoie l'utilisateur vers son dashboard Shopify
    const host = req.query.host as string;
    const redirectUrl = `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/${process.env.SHOPIFY_API_KEY}`;
    
    // Si on a le paramètre host (nouveau format), on l'utilise
    if (host) {
        return res.redirect(shopify.utils.getEmbeddedAppUrl(req));
    }
    
    return res.redirect(redirectUrl);

  } catch (error) {
    console.error(`[OAuth Callback] CRITICAL ERROR: ${error}`);
    return res.status(500).send("Installation failed. Check server logs.");
  }
});

// ==============================================================================
// 3. API ROUTES (POUR TON FRONTEND)
// ==============================================================================

// Route pour vérifier si le shop est connecté
router.get("/api/me", async (req, res) => {
    // Note: Dans une vraie app, tu devrais vérifier session.shop ici via un middleware
    res.json({ status: "ok" });
});

// GET: Liste des campagnes
router.get("/api/campaigns", async (req: Request, res: Response) => {
  try {
    const allCampaigns = await db.select().from(campaigns);
    res.json(allCampaigns);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

// POST: Créer une campagne
router.post("/api/campaigns", async (req: Request, res: Response) => {
  try {
    const { name, slug, discountType, discountValue } = req.body;
    // (Ajoute ici la validation de session si nécessaire pour récupérer le shopId)
    
    const newCampaign = await db.insert(campaigns).values({
        name,
        slug,
        discountType,
        discountValue,
        status: 'active',
        // Attention: Assure-toi d'avoir un shopId valide ici, sinon mets-en un par défaut ou récupère-le de la session
        shopId: 1 // Temporaire si tu n'as pas encore le middleware de session sur l'API
    }).returning();
    
    res.json(newCampaign[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

// GET: Stats Dashboard
router.get("/api/stats", async (req: Request, res: Response) => {
  try {
    // Exemples de requêtes agrégées
    const totalInfluencers = await db.select({ count: sql<number>`count(*)` }).from(influencers);
    const activeCampaigns = await db.select({ count: sql<number>`count(*)` }).from(campaigns).where(eq(campaigns.status, 'active'));
    
    res.json({
      totalInfluencers: totalInfluencers[0].count,
      activeCampaigns: activeCampaigns[0].count,
      totalRevenue: 0, // À connecter avec ta table orders
      averageRoi: 0
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ==============================================================================
// 4. ROUTE DE TRACKING (POUR LE PIXEL)
// ==============================================================================
router.post("/api/tracking/event", async (req: Request, res: Response) => {
  // CORS: Autoriser tout le monde (puisque ça vient des navigateurs clients)
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === 'OPTIONS') {
    return res.status(200).send("OK");
  }

  try {
    const eventData = req.body;
    console.log("📥 Pixel Event Received:", eventData.eventType, eventData);

    // Sauvegarde brute de l'événement
    await db.insert(events).values({
        eventType: eventData.eventType,
        sessionId: eventData.sessionId,
        utmCampaign: eventData.slugUtm,
        payload: eventData, // Assure-toi que ta colonne payload est de type JSONB
        createdAt: new Date()
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Tracking Error:", error);
    res.status(500).json({ error: "Tracking failed" });
  }
});

// Helper Route: Ré-enregistrer les webhooks manuellement
router.get("/api/shopify/register-webhook", async (req, res) => {
    const shop = req.query.shop as string;
    // Note: Ceci est simplifié, normalement il faut charger la session depuis la DB
    // Cette route sert surtout au debug immédiat
    res.json({ message: "Utilise l'installation normale pour enregistrer les webhooks" });
});

export default router;