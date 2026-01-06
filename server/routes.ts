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
      } catch (e) {
        console.error("[OAuth] Webhook error (non-fatal):", e);
      }

      const client = new shopify.clients.Graphql({ session });
      try {
        await client.query({
          data: `mutation { webPixelCreate(webPixel: { settings: "{}" }) { userErrors { field message } } }`
        });
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
  // 2. API CAMPAGNES (AVEC LE FIX DU SLUG)
  // ==============================================================================
  
  router.get("/api/campaigns", async (req: Request, res: Response) => {
    try {
      const allCampaigns = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
      const allInfluencers = await db.select().from(influencers);

      const result = allCampaigns.map(campaign => {
        const influencer = allInfluencers.find(inf => inf.id === campaign.influencerId);
        return {
          ...campaign,
          influencer: influencer || null 
        };
      });

      res.json(result);
    } catch (error) {
      console.error("GET Campaigns Error:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  // POST: Créer une campagne
  router.post("/api/campaigns", async (req: Request, res: Response) => {
      try {
        // On récupère 'slug' ET 'slugUtm' au cas où le frontend change de nom
        const { name, slug, slugUtm, discountType, discountValue, influencerId } = req.body;
        
        // 1. FIX DU SLUG : Si pas de slug, on le génère depuis le nom
        // Ex: "Promo Hiver" -> "promo-hiver"
        let finalSlug = slug || slugUtm;
        if (!finalSlug || finalSlug.trim() === "") {
             finalSlug = name.toLowerCase()
                .replace(/ /g, '-')
                .replace(/[^\w-]+/g, '');
             // Sécurité si le nom est vide ou bizarre
             if (!finalSlug) finalSlug = `campagne-${Date.now()}`;
        }

        // 2. Gestion de l'ID Influenceur (éviter les erreurs UUID)
        const cleanInfluencerId = influencerId && influencerId.length > 0 ? influencerId : null;

        const newCampaign = await db.insert(campaigns).values({
            name,
            slugUtm: finalSlug, // On utilise notre slug sécurisé
            discountType,
            discountValue: discountValue ? parseFloat(discountValue) : 0,
            influencerId: cleanInfluencerId, 
            status: 'active',
        }).returning();

        console.log("✅ Campaign created:", newCampaign[0]);
        res.json(newCampaign[0]);
      } catch (e) {
        console.error("❌ CREATE Campaign Error:", e);
        res.status(500).json({error: "Create failed. Check server logs."});
      }
  });

  // DELETE: Supprimer une campagne
  router.delete("/api/campaigns/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(campaigns).where(eq(campaigns.id, id));
      console.log("🗑️ Campaign deleted:", id);
      res.json({ success: true });
    } catch (e) {
      console.error("DELETE Campaign Error:", e);
      res.status(500).json({ error: "Delete failed" });
    }
  });

  // ==============================================================================
  // 3. API INFLUENCEURS
  // ==============================================================================

  router.get("/api/influencers", async (req, res) => {
    try {
      const allInfluencers = await db.select().from(influencers).orderBy(desc(influencers.createdAt));
      res.json(allInfluencers);
    } catch (error) {
      console.error("GET Influencers Error:", error);
      res.status(500).json({ error: "Failed to fetch influencers" });
    }
  });

  router.post("/api/influencers", async (req: Request, res: Response) => {
    try {
      const { name, email, instagramHandle } = req.body;
      const newInfluencer = await db.insert(influencers).values({
          name,
          email,
          instagramHandle
      }).returning();
      res.json(newInfluencer[0]);
    } catch (e) {
      console.error("CREATE Influencer Error:", e);
      res.status(500).json({error: "Create influencer failed"});
    }
  });

  router.delete("/api/influencers/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(influencers).where(eq(influencers.id, id));
      res.json({ success: true });
    } catch (e) {
      console.error("DELETE Influencer Error:", e);
      res.status(500).json({ error: "Delete failed" });
    }
  });

  // ==============================================================================
  // 4. STATS & TRACKING
  // ==============================================================================

  router.get("/api/stats", async (req, res) => {
      try {
        const infCount = await db.select({ id: influencers.id }).from(influencers);
        const campCount = await db.select({ id: campaigns.id }).from(campaigns);
        res.json({ 
          totalInfluencers: infCount.length, 
          activeCampaigns: campCount.length, 
          totalRevenue: 0, 
          averageRoi: 0 
        });
      } catch (e) {
        console.error("GET Stats Error:", e);
        res.json({ totalInfluencers: 0, activeCampaigns: 0, totalRevenue: 0, averageRoi: 0 });
      }
  });

  router.post("/api/tracking/event", async (req: Request, res: Response) => {
    res.header("Access-Control-Allow-Origin", "*");
    try {
      const eventData = req.body;
      // Protection si le slug est manquant dans l'événement (pour éviter le crash DB)
      // Note: Notre schéma permet utmCampaign en nullable ou text, donc ça devrait aller.
      await db.insert(events).values({
          eventType: eventData.eventType,
          sessionId: eventData.sessionId,
          utmCampaign: eventData.slugUtm || "unknown", // Fallback de sécurité
          payload: eventData,
          createdAt: new Date()
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Tracking Error:", error);
      res.status(500).json({ error: "Failed" });
    }
  });

  router.post("/api/webhooks/orders/create", async (req: Request, res: Response) => {
    console.log("💰 ORDER WEBHOOK RECEIVED");
    res.status(200).send();
  });

  router.get("/api/shopify/register-webhook", async (req, res) => {
      res.json({ message: "Use main install flow" });
  });

  app.use(router);
}