import { type Express, type Request, type Response, Router } from "express";
import { type Server } from "http";
import { shopify } from "./shopify";
import { db } from "./db";
import { shops, campaigns, influencers, events, orders } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export async function registerRoutes(server: Server, app: Express) {
  const router = Router();

  // ==============================================================================
  // 1. AUTHENTIFICATION & INSTALLATION (AVEC DEBUG PIXEL AMÉLIORÉ)
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

      // 1. Enregistrement Webhooks
      try {
        await shopify.webhooks.register({ session });
        console.log("[OAuth] Webhooks registered");
      } catch (e) {
        console.error("[OAuth] Webhook error (non-fatal):", e);
      }

      // 2. ACTIVATION PIXEL (DEBUG MODE)
      const client = new shopify.clients.Graphql({ session });
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
                  id
                  settings
                }
              }
            }
          `
        });

        // @ts-ignore
        const responseBody = pixelResponse.body.data?.webPixelCreate;
        
        if (responseBody?.userErrors && responseBody.userErrors.length > 0) {
          console.error("❌ [OAuth] PIXEL ERROR (Voici pourquoi ça ne connecte pas) :", JSON.stringify(responseBody.userErrors, null, 2));
        } else {
          console.log("✅ [OAuth] PIXEL SUCCESS : Connecté avec ID", responseBody?.webPixel?.id);
        }

      } catch (e) {
        console.error("❌ [OAuth] Pixel CRASH :", e);
      }

      // 3. Sauvegarde Shop
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
  // 2. API DASHBOARD & STATS
  // ==============================================================================
  
  router.get("/api/campaigns/stats", async (req: Request, res: Response) => {
    try {
      const allCampaigns = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
      const allInfluencers = await db.select().from(influencers);
      const allEvents = await db.select().from(events);

      const stats = allCampaigns.map(campaign => {
        const influencer = allInfluencers.find(inf => inf.id === campaign.influencerId);
        const campaignEvents = allEvents.filter(e => e.utmCampaign === campaign.slugUtm);

        const clicks = campaignEvents.filter(e => e.eventType === 'page_view').length;
        const orders = campaignEvents.filter(e => e.eventType === 'purchase').length;
        const revenue = campaignEvents
            .filter(e => e.eventType === 'purchase')
            .reduce((acc, curr) => acc + (curr.revenue || 0), 0);
        
        const commissionCost = revenue * ((campaign.commissionPercent || 0) / 100);
        const totalCost = (campaign.costFixed || 0) + commissionCost;
        const roi = totalCost > 0 ? ((revenue - totalCost) / totalCost) * 100 : 0;

        return {
          ...campaign,
          influencer: influencer || null,
          clicks,
          addToCarts: campaignEvents.filter(e => e.eventType === 'add_to_cart').length,
          orders,
          promoCodeUsage: 0,
          revenue,
          totalCost,
          roi
        };
      });

      res.json(stats);
    } catch (error) {
      console.error("GET Campaign Stats Error:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  router.get("/api/stats", async (req, res) => {
      try {
        const infCount = await db.select({ count: sql<number>`count(*)` }).from(influencers);
        const activeCampCount = await db.select({ count: sql<number>`count(*)` }).from(campaigns).where(eq(campaigns.status, 'active'));
        
        const allPurchaseEvents = await db.select().from(events).where(eq(events.eventType, 'purchase'));
        const totalRevenue = allPurchaseEvents.reduce((acc, curr) => acc + (curr.revenue || 0), 0);

        res.json({ 
          totalInfluencers: Number(infCount[0].count), 
          activeCampaigns: Number(activeCampCount[0].count), 
          totalRevenue: totalRevenue, 
          averageRoi: 0
        });
      } catch (e) {
        console.error("GET Global Stats Error:", e);
        res.json({ totalInfluencers: 0, activeCampaigns: 0, totalRevenue: 0, averageRoi: 0 });
      }
  });

  // ==============================================================================
  // 3. API CRUD
  // ==============================================================================
  
  router.get("/api/campaigns", async (req: Request, res: Response) => {
    try {
      const allCampaigns = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
      const allInfluencers = await db.select().from(influencers);
      const result = allCampaigns.map(campaign => ({
          ...campaign,
          influencer: allInfluencers.find(inf => inf.id === campaign.influencerId) || null
      }));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed" });
    }
  });

  router.post("/api/campaigns", async (req: Request, res: Response) => {
      try {
        const { name, slug, slugUtm, discountType, discountValue, influencerId } = req.body;
        
        // FIX SLUG
        let finalSlug = slug || slugUtm;
        if (!finalSlug || finalSlug.trim() === "") {
             finalSlug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
             if (!finalSlug) finalSlug = `campagne-${Date.now()}`;
        }

        // FIX UUID
        const cleanInfluencerId = influencerId && influencerId.length > 0 ? influencerId : null;

        const newCampaign = await db.insert(campaigns).values({
            name,
            slugUtm: finalSlug,
            discountType,
            discountValue: discountValue ? parseFloat(discountValue) : 0,
            influencerId: cleanInfluencerId, 
            status: 'active',
        }).returning();

        res.json(newCampaign[0]);
      } catch (e) {
        console.error("Create Campaign Error:", e);
        res.status(500).json({error: "Create failed"});
      }
  });

  router.delete("/api/campaigns/:id", async (req: Request, res: Response) => {
    try {
      await db.delete(campaigns).where(eq(campaigns.id, req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Delete failed" });
    }
  });

  router.get("/api/influencers", async (req, res) => {
    const all = await db.select().from(influencers).orderBy(desc(influencers.createdAt));
    res.json(all);
  });

  router.post("/api/influencers", async (req, res) => {
    const { name, email, instagramHandle } = req.body;
    const newInf = await db.insert(influencers).values({ name, email, instagramHandle }).returning();
    res.json(newInf[0]);
  });
  
  router.delete("/api/influencers/:id", async (req: Request, res: Response) => {
    try {
      await db.delete(influencers).where(eq(influencers.id, req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Delete failed" });
    }
  });

  // ==============================================================================
  // 4. TRACKING & WEBHOOKS
  // ==============================================================================

  router.post("/api/tracking/event", async (req: Request, res: Response) => {
    res.header("Access-Control-Allow-Origin", "*");
    try {
      const eventData = req.body;
      await db.insert(events).values({
          eventType: eventData.eventType,
          sessionId: eventData.sessionId,
          utmCampaign: eventData.slugUtm || "unknown",
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