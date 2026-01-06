import { type Express, type Request, type Response, Router } from "express";
import { type Server } from "http";
import { shopify } from "./shopify"; // Chemin corrigé
import { db } from "./db"; // Chemin corrigé
import { shops, campaigns, influencers, events, orders } from "@shared/schema"; // Schema corrigé
import { eq } from "drizzle-orm";

// C'est cette fonction que server/index.ts cherche !
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

    // FIX IFRAME : On force la sortie de l'iframe pour le cookie First-Party
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

      // A. Enregistrer le Webhook Order
      try {
        const webhookResponse = await shopify.webhooks.register({ session });
        console.log("[OAuth] Webhooks registered", webhookResponse);
      } catch (e) {
        console.error("[OAuth] Webhook error (non-fatal):", e);
      }

      // B. Activer le Pixel via GraphQL (Auto-Connect)
      const client = new shopify.clients.Graphql({ session });
      try {
        await client.query({
          data: `mutation { webPixelCreate(webPixel: { settings: "{}" }) { userErrors { field message } } }`
        });
        console.log("[OAuth] Pixel activated automatically ✅");
      } catch (e) {
        console.error("[OAuth] Pixel activation error:", e);
      }

      // C. Sauvegarder le Shop
      await db.insert(shops).values({
        shopDomain: shop,
        accessToken: session.accessToken,
        isInstalled: true,
        installedAt: new Date(),
      }).onConflictDoUpdate({
        target: shops.shopDomain,
        set: { accessToken: session.accessToken, isInstalled: true, uninstalledAt: null },
      });

      // D. Redirection vers l'App
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
  // 2. TRACKING PIXEL (Réception des événements)
  // ==============================================================================
  router.post("/api/tracking/event", async (req: Request, res: Response) => {
    res.header("Access-Control-Allow-Origin", "*");
    
    try {
      const eventData = req.body;
      console.log("📥 Pixel Event:", eventData.eventType);

      // Sauvegarde l'événement
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
  // 3. WEBHOOKS (Réception des Commandes)
  // ==============================================================================
  router.post("/api/webhooks/orders/create", async (req: Request, res: Response) => {
    try {
      console.log("💰 ORDER WEBHOOK RECEIVED!");
      const order = req.body;
      console.log(`Order ID: ${order.id} - Total: ${order.total_price}`);
      res.status(200).send();
    } catch (error) {
      console.error("Webhook Error:", error);
      res.status(500).send();
    }
  });

  // ==============================================================================
  // 4. API DASHBOARD
  // ==============================================================================
  router.get("/api/campaigns", async (req, res) => {
      const all = await db.select().from(campaigns);
      res.json(all);
  });

  router.post("/api/campaigns", async (req, res) => {
      const { name, slug, discountType, discountValue } = req.body;
      try {
        const newCampaign = await db.insert(campaigns).values({
            name,
            slugUtm: slug,
            discountType,
            discountValue,
            status: 'active',
            // Note: Idéalement il faut récupérer l'ID de l'influenceur ici
        }).returning();
        res.json(newCampaign[0]);
      } catch (e) {
        console.error(e);
        res.status(500).json({error: "Create failed"});
      }
  });

  router.get("/api/stats", async (req, res) => {
      res.json({ totalInfluencers: 0, activeCampaigns: 0, totalRevenue: 0, averageRoi: 0 });
  });

  router.get("/api/shopify/register-webhook", async (req, res) => {
      res.json({ message: "Use main install flow" });
  });

  // Enregistrer le routeur dans l'application Express
  app.use(router);
}