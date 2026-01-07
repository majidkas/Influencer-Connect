import { type Express, type Request, type Response, Router } from "express";
import { type Server } from "http";
import { shopify } from "./shopify";
import { db } from "./db";
import { shops, campaigns, influencers, events, orders } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export async function registerRoutes(server: Server, app: Express) {
  const router = Router();

  // ==============================================================================
  // 0. MIDDLEWARE DE SÉCURITÉ (CORS) - INDISPENSABLE POUR LE PIXEL
  // ==============================================================================
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-requested-with");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

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
        console.log("✅ [OAuth] Webhooks registered");
      } catch (e) {
        console.error("[OAuth] Webhook error:", e);
      }

      try {
        const client = new shopify.clients.Graphql({
          session: {
            shop: session.shop,
            accessToken: session.accessToken,
          } as any
        });

        const accountID = session.shop.replace('.myshopify.com', '');
        const settingsJson = JSON.stringify({ accountID: accountID });

        const pixelResponse = await client.request(`
          mutation {
            webPixelCreate(webPixel: { settings: ${JSON.stringify(settingsJson)} }) {
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
        `);
        console.log("✅ [OAuth] Pixel activated automatically:", pixelResponse);
      } catch (e) {
        console.error("❌ [OAuth] Pixel activation error:", e);
      }

      await db.insert(shops).values({
        shopDomain: shop,
        accessToken: session.accessToken,
        scope: session.scope,
        isInstalled: true,
        installedAt: new Date(),
      }).onConflictDoUpdate({
        target: shops.shopDomain,
        set: { 
          accessToken: session.accessToken, 
          scope: session.scope,
          isInstalled: true, 
          uninstalledAt: null 
        },
      });

      const shopName = shop.replace(".myshopify.com", "");
      const redirectUrl = `https://admin.shopify.com/store/${shopName}/apps/${process.env.SHOPIFY_API_KEY}`;
      console.log(`✅ [OAuth] Installation complete, redirecting to: ${redirectUrl}`);
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

        const clicks = campaignEvents.filter(e => e.eventType === 'page_view' || e.eventType === 'product_view').length;
        const ordersCount = campaignEvents.filter(e => e.eventType === 'purchase').length;
        const revenue = campaignEvents
            .filter(e => e.eventType === 'purchase')
            .reduce((acc, curr) => acc + (curr.revenue || 0), 0);
        
        const commissionCost = revenue * ((campaign.commissionPercent || 0) / 100);
        const totalCost = (campaign.costFixed || 0) + commissionCost;
        const roas = totalCost > 0 ? (revenue / totalCost) : 0;

        return {
          ...campaign,
          influencer: influencer || null,
          clicks,
          addToCarts: campaignEvents.filter(e => e.eventType === 'add_to_cart').length,
          orders: ordersCount,
          promoCodeUsage: campaignEvents.filter(e => {
  if (e.eventType !== 'purchase') return false;
  const payload = e.payload as any;
  if (!payload?.promoCode || !campaign.promoCode) return false;
  return payload.promoCode.toLowerCase() === campaign.promoCode.toLowerCase();
}).length,
          revenue,
          totalCost,
          roas
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
    const { name, slug, slugUtm, discountType, discountValue, influencerId, promoCode, productUrl, costFixed, commissionPercent } = req.body;
    let finalSlug = slug || slugUtm;
    if (!finalSlug || finalSlug.trim() === "") {
      finalSlug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
      if (!finalSlug) finalSlug = `campagne-${Date.now()}`;
    }
    const cleanInfluencerId = influencerId && influencerId.length > 0 ? influencerId : null;
    const newCampaign = await db.insert(campaigns).values({
      name, 
      slugUtm: finalSlug, 
      promoCode: promoCode || null,
      productUrl: productUrl || null,
      discountType, 
      discountValue: discountValue ? parseFloat(discountValue) : 0, 
      costFixed: costFixed ? parseFloat(costFixed) : 0,
      commissionPercent: commissionPercent ? parseFloat(commissionPercent) : 0,
      influencerId: cleanInfluencerId, 
      status: 'active',
    }).returning();
    res.json(newCampaign[0]);
  } catch (e) {
    console.error("Create Campaign Error:", e);
    res.status(500).json({ error: "Create failed" });
  }
});


router.put("/api/campaigns/:id", async (req: Request, res: Response) => {
  try {
    const { name, slugUtm, discountType, discountValue, influencerId, promoCode, productUrl, costFixed, commissionPercent, status } = req.body;
    const cleanInfluencerId = influencerId && influencerId.length > 0 ? influencerId : null;
    
    const updated = await db.update(campaigns)
      .set({
        name,
        slugUtm,
        promoCode: promoCode || null,
        productUrl: productUrl || null,
        discountType,
        discountValue: discountValue ? parseFloat(discountValue) : 0,
        costFixed: costFixed ? parseFloat(costFixed) : 0,
        commissionPercent: commissionPercent ? parseFloat(commissionPercent) : 0,
        influencerId: cleanInfluencerId,
        status: status || 'active',
      })
      .where(eq(campaigns.id, req.params.id))
      .returning();
    
    res.json(updated[0]);
  } catch (e) {
    console.error("Update Campaign Error:", e);
    res.status(500).json({ error: "Update failed" });
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
    try {
      const eventData = req.body;
      console.log("📥 Event Received:", eventData.eventType, "UTM:", eventData.slugUtm || "none");

await db.insert(events).values({
  eventType: eventData.eventType,
  sessionId: eventData.sessionId,
  utmCampaign: eventData.slugUtm || "unknown",
  revenue: eventData.revenue ? parseFloat(eventData.revenue) : 0,
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

  // ==============================================================================
  // 5. FORCE PIXEL
  // ==============================================================================
  router.get("/api/force-pixel", async (req: Request, res: Response) => {
    const shop = req.query.shop as string;
    
    if (!shop) return res.json({ error: "Missing shop parameter" });

    const [shopData] = await db.select().from(shops).where(eq(shops.shopDomain, shop));
    
    if (!shopData || !shopData.accessToken) {
      return res.json({ error: "Shop non trouvé en BDD ou pas de token. Réinstalle l'app." });
    }

    try {
      const client = new shopify.clients.Graphql({
        session: {
          shop: shopData.shopDomain,
          accessToken: shopData.accessToken,
        } as any
      });

      const accountID = shopData.shopDomain.replace('.myshopify.com', '');
      const settingsJson = JSON.stringify({ accountID: accountID });

      const response = await client.request(`
        mutation {
          webPixelCreate(webPixel: { settings: ${JSON.stringify(settingsJson)} }) {
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
      `);
      
      console.log("✅ Force Pixel Response:", response);
      res.json(response);
    } catch (e: any) {
      console.error("❌ Force Pixel Error:", e);
      res.json({ error: "CRASH", details: e.message, stack: e.stack });
    }
  });

  // ==============================================================================
  // 6. DEBUG & HEALTH CHECK
  // ==============================================================================
  router.get("/api/webhooks/test", (req: Request, res: Response) => {
    res.json({ 
      status: "OK", 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development"
    });
  });

  router.get("/api/debug/shop", async (req: Request, res: Response) => {
    const shop = req.query.shop as string;
    if (!shop) return res.json({ error: "Missing shop parameter" });
    
    const [shopData] = await db.select().from(shops).where(eq(shops.shopDomain, shop));
    
    if (!shopData) return res.json({ error: "Shop not found", shop });
    
    res.json({
      shop: shopData.shopDomain,
      hasToken: !!shopData.accessToken,
      tokenPreview: shopData.accessToken ? `${shopData.accessToken.substring(0, 10)}...` : null,
      scope: shopData.scope,
      isInstalled: shopData.isInstalled,
      installedAt: shopData.installedAt
    });
  });




// ==============================================================================
// 7. SHOPIFY DISCOUNT CODES
// ==============================================================================
router.get("/api/shopify/discount-codes", async (req: Request, res: Response) => {
  const shop = req.query.shop as string;
  
  if (!shop) {
    return res.json({ error: "Missing shop parameter", codes: [] });
  }

  const [shopData] = await db.select().from(shops).where(eq(shops.shopDomain, shop));
  
  if (!shopData || !shopData.accessToken) {
    return res.json({ error: "Shop not found", codes: [] });
  }

  try {
    const client = new shopify.clients.Graphql({
      session: {
        shop: shopData.shopDomain,
        accessToken: shopData.accessToken,
      } as any
    });

    const response = await client.request(`
      query {
        codeDiscountNodes(first: 50) {
          nodes {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                codes(first: 10) {
                  nodes {
                    code
                  }
                }
                status
              }
              ... on DiscountCodeBxgy {
                title
                codes(first: 10) {
                  nodes {
                    code
                  }
                }
                status
              }
              ... on DiscountCodeFreeShipping {
                title
                codes(first: 10) {
                  nodes {
                    code
                  }
                }
                status
              }
            }
          }
        }
      }
    `);

    const discountNodes = (response as any).data?.codeDiscountNodes?.nodes || [];
    const codes: { code: string; title: string; status: string }[] = [];

    for (const node of discountNodes) {
      const discount = node.codeDiscount;
      if (discount && discount.codes?.nodes) {
        for (const codeNode of discount.codes.nodes) {
          codes.push({
            code: codeNode.code,
            title: discount.title || codeNode.code,
            status: discount.status || "ACTIVE"
          });
        }
      }
    }

    res.json({ codes });
  } catch (e: any) {
    console.error("❌ Discount Codes Error:", e);
    res.json({ error: e.message, codes: [] });
  }
});







  

  app.use(router);
}