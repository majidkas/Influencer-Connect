import { type Express, type Request, type Response, Router } from "express";
import { type Server } from "http";
import { shopify } from "./shopify";
import { db } from "./db";
import { shops, campaigns, influencers, events, orders } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export async function registerRoutes(server: Server, app: Express) {
  const router = Router();

  // ==============================================================================
  // 1. AUTHENTIFICATION & INSTALLATION
  // ==============================================================================
  router.get("/api/shopify/auth", async (req: Request, res: Response) => {
    const shop = req.query.shop as string;
    if (!shop) return res.status(400).send("Missing shop parameter");

    const sanitizedShop = shopify.utils.sanitizeShop(shop);
    if (!sanitizedShop) return res.status(400).send("Invalid shop");

    const authUrl = await shopify.auth.begin({
      shop: sanitizedShop,
      callbackPath: "/api/shopify/callback",
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    });

    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head><script>window.top.location.href = "${authUrl}";</script></head>
        <body>Redirecting...</body>
      </html>
    `);
  });

  router.get("/api/shopify/callback", async (req: Request, res: Response) => {
    try {
      const callback = await shopify.auth.callback({ rawRequest: req, rawResponse: res });
      const { session } = callback;
      const shop = session.shop;

      console.log(`[OAuth] Session validée pour ${shop}`);

      try {
        await shopify.webhooks.register({ session });
        console.log("[OAuth] Webhooks registered");
      } catch (e) {
        console.error("[OAuth] Webhook error (non-fatal):", e);
      }

      const client = new shopify.clients.Graphql({ session });
      try {
        await client.query({
          data: `mutation { webPixelCreate(webPixel: { settings: "{}" }) { userErrors { field message } } }`
        });
        console.log("[OAuth] Pixel activated automatically ✅");
      } catch (e) {
        console.error("[OAuth] Pixel activation error:", e);
      }

      await db.insert(shops).values({
        shopDomain: shop,
        accessToken: session.accessToken,
        isInstalled: true,
        installedAt: new Date(),
      }).onConflictDoUpdate({
        target: shops.shopDomain,
        set: { accessToken: session.accessToken, isInstalled: true, uninstalledAt: null },
      });

      const host = req.query.host as string;
      if (host) {
          return res.redirect(shopify.utils.getEmbeddedAppUrl(req));
      }
      const redirectUrl = `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/${process.env.SHOPIFY_API_KEY}`;
      return res.redirect(redirectUrl);

    } catch (error) {
      console.error(`[OAuth Error] ${error}`);
      return res.status(500).send("Installation failed");
    }
  });

  // ==============================================================================
  // 2. TRACKING PIXEL
  // ==============================================================================
  router.post("/api/tracking/event", async (req: Request, res: Response) => {
    res.header("Access-Control-Allow-Origin", "*");
    
    try {
      const eventData = req.body;
      console.log("📥 Pixel Event:", eventData.eventType);

      await db.insert(events).values({
          eventType: eventData.eventType,
          sessionId: eventData.sessionId,
          utmCampaign: eventData.slugUtm,
          payload: eventData,
          createdAt: new Date()
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Tracking Error:", error);
      res.status(500).json({ error: "Failed" });
    }
  });

  // ==============================================================================
  // 3. WEBHOOKS
  // ==============================================================================
  router.post("/api/webhooks/orders/create", async (req: Request, res: Response) => {
    try {
      console.log("💰 ORDER WEBHOOK RECEIVED!");
      const order = req.body;
      // Ici, on pourrait ajouter le code pour lier la commande à la campagne via l'email ou le code promo
      // Pour l'instant on log juste pour confirmer la réception
      console.log(`Order ID: ${order.id} - Total: ${order.total_price}`);
      res.status(200).send();
    } catch (error) {
      console.error("Webhook Error:", error);
      res.status(500).send();
    }
  });

  // ==============================================================================
  // 4. API DASHBOARD (C'EST ICI QUE J'AI CORRIGÉ)
  // ==============================================================================
  
  // GET: Liste des campagnes (CORRIGÉ: On joint l'influenceur)
  router.get("/api/campaigns", async (req: Request, res: Response) => {
    try {
      // 1. Récupérer toutes les campagnes
      const allCampaigns = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
      
      // 2. Récupérer tous les influenceurs
      const allInfluencers = await db.select().from(influencers);

      // 3. Associer manuellement (Jointure) pour que le frontend ne plante pas
      const result = allCampaigns.map(campaign => {
        const influencer = allInfluencers.find(inf => inf.id === campaign.influencerId);
        return {
          ...campaign,
          influencer: influencer || null // On renvoie l'objet complet ou null si pas trouvé
        };
      });

      res.json(result);
    } catch (error) {
      console.error("Fetch Campaigns Error:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  // GET: Liste des influenceurs
  router.get("/api/influencers", async (req, res) => {
    try {
      const allInfluencers = await db.select().from(influencers).orderBy(desc(influencers.createdAt));
      res.json(allInfluencers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch influencers" });
    }
  });

  // POST: Créer une campagne
  router.post("/api/campaigns", async (req: Request, res: Response) => {
      const { name, slug, discountType, discountValue, influencerId } = req.body;
      try {
        const newCampaign = await db.insert(campaigns).values({
            name,
            slugUtm: slug,
            discountType,
            discountValue,
            influencerId: influencerId || null, // On gère le cas où l'ID est manquant
            status: 'active',
        }).returning();
        res.json(newCampaign[0]);
      } catch (e) {
        console.error(e);
        res.status(500).json({error: "Create failed"});
      }
  });

  // POST: Créer un influenceur
  router.post("/api/influencers", async (req: Request, res: Response) => {
    const { name, email, instagramHandle } = req.body;
    try {
      const newInfluencer = await db.insert(influencers).values({
          name,
          email,
          instagramHandle
      }).returning();
      res.json(newInfluencer[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({error: "Create influencer failed"});
    }
  });

  router.get("/api/stats", async (req, res) => {
      // Stats basiques pour éviter l'erreur 404
      const infCount = await db.select({ count: campaigns.id }).from(influencers);
      const campCount = await db.select({ count: campaigns.id }).from(campaigns);
      
      res.json({ 
        totalInfluencers: infCount.length, 
        activeCampaigns: campCount.length, 
        totalRevenue: 0, 
        averageRoi: 0 
      });
  });

  router.get("/api/shopify/register-webhook", async (req, res) => {
      res.json({ message: "Use main install flow" });
  });

  app.use(router);
}