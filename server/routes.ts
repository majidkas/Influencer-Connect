import { type Express, type Request, type Response, Router } from "express";
import { type Server } from "http";
import { shopify } from "./shopify";
import { db } from "./db";
import { shops, campaigns, influencers, events, orders, socialAccounts } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";

export async function registerRoutes(server: Server, app: Express) {
  const router = Router();

  // ==============================================================================
  // 0. MIDDLEWARE DE SÉCURITÉ & CONFIG
  // ==============================================================================
  
  app.use(require("express").json({ limit: "10mb" }));
  app.use(require("express").urlencoded({ limit: "10mb", extended: true }));
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

      // Installation automatique du Pixel
      try {
        const client = new shopify.clients.Graphql({
          session: {
            shop: session.shop,
            accessToken: session.accessToken,
          } as any
        });

        const accountID = session.shop.replace('.myshopify.com', '');
        const settingsJson = JSON.stringify({ accountID: accountID });

        await client.request(`
          mutation {
            webPixelCreate(webPixel: { settings: ${JSON.stringify(settingsJson)} }) {
              userErrors { code field message }
              webPixel { id settings }
            }
          }
        `);
        console.log("✅ [OAuth] Pixel activated automatically");
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
      return res.redirect(redirectUrl);

    } catch (error) {
      console.error(`[OAuth Error] ${error}`);
      return res.status(500).send("Installation failed");
    }
  });

  // ==============================================================================
  // 2. API DASHBOARD & STATS (Calculs Avancés)
  // ==============================================================================

  router.get("/api/campaigns/stats", async (req: Request, res: Response) => {
    try {
      const { sort } = req.query; // Pour le tri
      
      const allCampaigns = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
      const allInfluencers = await db.select().from(influencers);
      const allEvents = await db.select().from(events);
      const allOrders = await db.select().from(orders); // Récupère les commandes (Revenue 2)

      // Get shop data
      const [shopData] = await db.select().from(shops).limit(1);
      let shopifyProducts: any[] = [];
      let currency = "EUR";

      if (shopData && shopData.accessToken) {
        try {
          const client = new shopify.clients.Graphql({
            session: { shop: shopData.shopDomain, accessToken: shopData.accessToken } as any
          });
          
          const shopRes = await client.request(`query { shop { currencyCode } }`);
          currency = (shopRes as any).data?.shop?.currencyCode || "EUR";
          
          const prodRes = await client.request(`query { products(first: 100) { nodes { handle title featuredImage { url } } } }`);
          shopifyProducts = (prodRes as any).data?.products?.nodes || [];
        } catch (e) {
          console.error("Shopify API error (Stats):", e);
        }
      }

      let stats = allCampaigns.map(campaign => {
        const influencer = allInfluencers.find(inf => inf.id === campaign.influencerId);
        const campaignEvents = allEvents.filter(e => e.utmCampaign === campaign.slugUtm);

        // --- REVENUE (1) : Tracking UTM ---
        const clicks = campaignEvents.filter(e => e.eventType === 'page_view' || e.eventType === 'product_view').length;
        const purchaseEvents = campaignEvents.filter(e => e.eventType === 'purchase');
        
        const ordersCountUtm = purchaseEvents.length;
        const revenueLink = purchaseEvents.reduce((acc, curr) => acc + (curr.revenue || 0), 0);

        // --- REVENUE (2) : Promo Code Only (Orders DB) ---
        // On cherche les commandes qui ont utilisé le code promo de la campagne
        const campaignPromoCode = campaign.promoCode ? campaign.promoCode.toLowerCase().trim() : null;
        
        const promoOrders = campaignPromoCode 
          ? allOrders.filter(o => o.promoCode && o.promoCode.toLowerCase() === campaignPromoCode) 
          : [];
          
        const revenuePromoOnly = promoOrders.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);
        const promoCodeUsage = promoOrders.length;
        
        // Total Orders pour l'affichage (Priorité au plus grand nombre si chevauchement, ou simplement UTM + PromoOnly)
        // Ici on simplifie : Orders = nombre de commandes via Promo Code (Source 2) car c'est souvent plus fiable pour l'influenceur
        // Si pas de code promo, on prend le tracking UTM.
        const totalOrders = campaignPromoCode ? promoCodeUsage : ordersCountUtm;

        // --- ROI & CONVERSION ---
        const commissionCost = revenueLink * ((campaign.commissionPercent || 0) / 100);
        const totalCost = (campaign.costFixed || 0) + commissionCost;
        const roas = totalCost > 0 ? (revenueLink / totalCost) : 0;
        
        // Conversion Rate = (Orders / Clicks) * 100
        const conversionRate = clicks > 0 ? (totalOrders / clicks) * 100 : 0;

        return {
          ...campaign,
          influencer: influencer || null,
          clicks,
          addToCarts: campaignEvents.filter(e => e.eventType === 'add_to_cart').length,
          orders: totalOrders, 
          promoCodeUsage,
          revenue: revenueLink,       // Revenue (1)
          revenuePromoOnly,           // Revenue (2)
          totalCost,
          roas,
          conversionRate,
          productImage: (() => {
            if (campaign.targetType === 'homepage') return null; // Pas d'image pour homepage
            if (!campaign.productUrl) return null;
            const handle = campaign.productUrl.split('/products/')[1]?.split('?')[0];
            const product = shopifyProducts.find((p: any) => p.handle === handle);
            return product?.featuredImage?.url || null;
          })(),
          productTitle: (() => {
            if (campaign.targetType === 'homepage') return "Homepage";
            if (!campaign.productUrl) return null;
            const handle = campaign.productUrl.split('/products/')[1]?.split('?')[0];
            const product = shopifyProducts.find((p: any) => p.handle === handle);
            return product?.title || null;
          })(),
          currency
        };
      });

      // --- TRI (SORTING) ---
      if (sort) {
        switch (sort) {
          case 'recent': stats.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()); break;
          case 'oldest': stats.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime()); break;
          case 'revenue_high': stats.sort((a, b) => b.revenue - a.revenue); break;
          case 'revenue_low': stats.sort((a, b) => a.revenue - b.revenue); break;
          case 'roas_high': stats.sort((a, b) => b.roas - a.roas); break;
          case 'roas_low': stats.sort((a, b) => a.roas - b.roas); break;
          case 'cost_high': stats.sort((a, b) => b.totalCost - a.totalCost); break;
          case 'cost_low': stats.sort((a, b) => a.totalCost - b.totalCost); break;
        }
      }

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
      
      // Récupération globale pour le ROAS
      const allCampaigns = await db.select().from(campaigns);
      
      const totalCosts = allCampaigns.reduce((acc, camp) => {
        const fixedCost = camp.costFixed || 0;
        const campaignRevenue = allPurchaseEvents
          .filter(e => e.utmCampaign === camp.slugUtm)
          .reduce((sum, e) => sum + (e.revenue || 0), 0);
        const commissionCost = campaignRevenue * ((camp.commissionPercent || 0) / 100);
        return acc + fixedCost + commissionCost;
      }, 0);

      const averageRoas = totalCosts > 0 ? totalRevenue / totalCosts : 0;

      res.json({
        totalInfluencers: Number(infCount[0].count),
        activeCampaigns: Number(activeCampCount[0].count),
        totalRevenue,
        totalCosts,
        averageRoas
      });
    } catch (e) {
      res.json({ totalInfluencers: 0, activeCampaigns: 0, totalRevenue: 0, totalCosts: 0, averageRoas: 0 });
    }
  });

  // ==============================================================================
  // 3. API CRUD CAMPAGNES (Avec TargetType)
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
      const { 
        name, slug, slugUtm, discountType, discountValue, influencerId, 
        promoCode, productUrl, costFixed, commissionPercent, targetType // NEW
      } = req.body;

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
        targetType: targetType || "product", // NEW
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
      const { 
        name, slugUtm, discountType, discountValue, influencerId, 
        promoCode, productUrl, costFixed, commissionPercent, status, targetType // NEW
      } = req.body;
      
      const cleanInfluencerId = influencerId && influencerId.length > 0 ? influencerId : null;

      const updated = await db.update(campaigns)
        .set({
          name,
          slugUtm,
          promoCode: promoCode || null,
          targetType: targetType || "product", // NEW
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

  // ==============================================================================
  // 4. API CRUD INFLUENCEURS (Avec WhatsApp & Auto-Rating)
  // ==============================================================================

  router.get("/api/influencers", async (req, res) => {
    try {
      const allInfluencers = await db.select().from(influencers).orderBy(desc(influencers.createdAt));
      const allSocialAccounts = await db.select().from(socialAccounts);
      
      const result = allInfluencers.map(inf => ({
        ...inf,
        socialAccounts: allSocialAccounts.filter(s => s.influencerId === inf.id)
      }));
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch influencers" });
    }
  });

  router.post("/api/influencers", async (req, res) => {
    try {
      // NOTE: internalRating retiré, whatsapp ajouté
      const { name, email, profileImageUrl, gender, internalNotes, whatsapp, socialAccounts: socialAccountsData } = req.body;
      
      const [newInf] = await db.insert(influencers).values({ 
        name, 
        email: email || null, 
        profileImageUrl: profileImageUrl || null,
        gender: gender || null,
        // internalRating supprimé (calculé auto)
        internalNotes: internalNotes || null,
        whatsapp: whatsapp || null // NEW
      }).returning();
      
      if (socialAccountsData && socialAccountsData.length > 0) {
        for (const account of socialAccountsData) {
          await db.insert(socialAccounts).values({
            influencerId: newInf.id,
            platform: account.platform,
            handle: account.handle,
            followersCount: account.followersCount || 0
          });
        }
      }
      
      const accounts = await db.select().from(socialAccounts).where(eq(socialAccounts.influencerId, newInf.id));
      res.json({ ...newInf, socialAccounts: accounts });
    } catch (e) {
      console.error("Create Influencer Error:", e);
      res.status(500).json({ error: "Create failed" });
    }
  });

  router.patch("/api/influencers/:id", async (req: Request, res: Response) => {
    try {
      const { name, email, profileImageUrl, gender, internalNotes, whatsapp, socialAccounts: socialAccountsData } = req.body;
      
      const [updated] = await db.update(influencers)
        .set({ 
          name, 
          email: email || null, 
          profileImageUrl: profileImageUrl || null,
          gender: gender || null,
          internalNotes: internalNotes || null,
          whatsapp: whatsapp || null // NEW
        })
        .where(eq(influencers.id, req.params.id))
        .returning();
      
      if (!updated) return res.status(404).json({ error: "Influencer not found" });
      
      // Update Socials
      await db.delete(socialAccounts).where(eq(socialAccounts.influencerId, req.params.id));
      if (socialAccountsData && socialAccountsData.length > 0) {
        for (const account of socialAccountsData) {
          await db.insert(socialAccounts).values({
            influencerId: req.params.id,
            platform: account.platform,
            handle: account.handle,
            followersCount: account.followersCount || 0
          });
        }
      }
      
      const accounts = await db.select().from(socialAccounts).where(eq(socialAccounts.influencerId, req.params.id));
      res.json({ ...updated, socialAccounts: accounts });
    } catch (e) {
      console.error("Update Influencer Error:", e);
      res.status(500).json({ error: "Update failed" });
    }
  });

  router.delete("/api/influencers/:id", async (req: Request, res: Response) => {
    try {
      await db.delete(influencers).where(eq(influencers.id, req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Delete failed" });
    }
  });

  // --- STATS INFLUENCEURS & AUTO-RATING ---
  router.get("/api/influencers/stats", async (req: Request, res: Response) => {
    try {
      const allInfluencers = await db.select().from(influencers);
      const allSocialAccounts = await db.select().from(socialAccounts);
      const allCampaigns = await db.select().from(campaigns);
      const allEvents = await db.select().from(events);
      const allOrders = await db.select().from(orders); // Pour Revenue (2) dans le ROAS global

      const influencersWithStats = allInfluencers.map(influencer => {
        const influencerCampaigns = allCampaigns.filter(c => c.influencerId === influencer.id);
        const activeCampaigns = influencerCampaigns.filter(c => c.status === 'active');
        
        let totalRevenue = 0;
        let totalCost = 0;
        let totalOrders = 0;

        influencerCampaigns.forEach(campaign => {
          // Revenue 1 (UTM)
          const campaignEvents = allEvents.filter(e => e.utmCampaign === campaign.slugUtm);
          const rev1 = campaignEvents.filter(e => e.eventType === 'purchase').reduce((acc, curr) => acc + (curr.revenue || 0), 0);
          
          // Revenue 2 (Promo Code)
          const code = campaign.promoCode ? campaign.promoCode.toLowerCase() : null;
          const rev2 = code 
            ? allOrders.filter(o => o.promoCode && o.promoCode.toLowerCase() === code).reduce((acc, curr) => acc + (curr.totalPrice || 0), 0)
            : 0;

          // On prend le Max ou la somme ? Pour le ROAS global, prenons le Revenue (1) (Tracking) 
          // ou le Revenue (2) si supérieur ? 
          // Simplifions : On base le ROAS sur le Revenue (1) (Tracking direct) pour la fiabilité technique
          // OU sur le Revenue (2) si dispo.
          // LOGIQUE PROJET : On additionne tout le revenu généré (1 + 2 sans doublon c'est dur sans deduplication).
          // Hypothèse : Revenue 2 inclut Revenue 1 si le code promo est utilisé.
          // On va utiliser le Revenue le plus favorable pour l'influenceur pour calculer sa note.
          const bestRevenue = Math.max(rev1, rev2);

          const fixedCost = campaign.costFixed || 0;
          const commissionCost = bestRevenue * ((campaign.commissionPercent || 0) / 100);
          
          totalRevenue += bestRevenue;
          totalCost += fixedCost + commissionCost;

          // Count orders (approx)
          totalOrders += (code ? allOrders.filter(o => o.promoCode === code).length : 0);
        });

        const roas = totalCost > 0 ? totalRevenue / totalCost : 0;

        // CALCUL AUTO DE LA NOTE (ÉTOILES)
        let calculatedRating = 0;
        if (influencerCampaigns.length === 0) {
          calculatedRating = 0; // Aucune campagne
        } else if (roas < 0) {
          calculatedRating = 1; // < 0 (Rouge)
        } else if (roas >= 0 && roas < 2) {
          calculatedRating = 1; // 0 à 1.99 (Rouge)
        } else if (roas >= 2 && roas < 4) {
          calculatedRating = 2; // 2 à 4 (Vert)
        } else {
          calculatedRating = 3; // > 4 (Vert super)
        }

        return {
          ...influencer,
          socialAccounts: allSocialAccounts.filter(s => s.influencerId === influencer.id),
          totalCampaigns: influencerCampaigns.length,
          activeCampaigns: activeCampaigns.length,
          totalCost,
          totalRevenue,
          totalOrders, // NEW
          roas,
          calculatedRating // NEW
        };
      });

      res.json(influencersWithStats);
    } catch (error) {
      console.error("GET Influencers Stats Error:", error);
      res.status(500).json({ error: "Failed to fetch influencers stats" });
    }
  });

  // ==============================================================================
  // 5. TRACKING & WEBHOOKS (Le Coeur du Revenue 2)
  // ==============================================================================

  router.post("/api/tracking/event", async (req: Request, res: Response) => {
    try {
      const eventData = req.body;
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

  // WEBHOOK ORDERS : Capture les commandes pour Revenue (2)
  router.post("/api/webhooks/orders/create", async (req: Request, res: Response) => {
    try {
      const order = req.body; // Payload brut Shopify
      console.log(`💰 [Webhook] Order received: ${order.id} - Codes:`, order.discount_codes);

      const discountCodes = order.discount_codes || [];
      const primaryCode = discountCodes.length > 0 ? discountCodes[0].code : null;

      await db.insert(orders).values({
        shopifyOrderId: order.id.toString(),
        totalPrice: parseFloat(order.total_price),
        currency: order.currency,
        promoCode: primaryCode, // On stocke le code promo utilisé
        createdAt: new Date()
      }).onConflictDoUpdate({
        target: orders.shopifyOrderId,
        set: {
          totalPrice: parseFloat(order.total_price),
          promoCode: primaryCode
        }
      });

      res.status(200).send();
    } catch (e) {
      console.error("❌ [Webhook] Order Error:", e);
      res.status(500).send("Error processing webhook");
    }
  });

  // ==============================================================================
  // 6. UTILITAIRES SHOPIFY & DEBUG
  // ==============================================================================
  
  router.get("/api/shopify/discount-codes", async (req: Request, res: Response) => {
    const shop = req.query.shop as string;
    if (!shop) return res.json({ error: "Missing shop parameter", codes: [] });
    const [shopData] = await db.select().from(shops).where(eq(shops.shopDomain, shop));
    if (!shopData || !shopData.accessToken) return res.json({ error: "Shop not found", codes: [] });

    try {
      const client = new shopify.clients.Graphql({
        session: { shop: shopData.shopDomain, accessToken: shopData.accessToken } as any
      });
      const response = await client.request(`
        query {
          codeDiscountNodes(first: 50) {
            nodes {
              codeDiscount {
                ... on DiscountCodeBasic { title codes(first:5) { nodes { code } } status }
                ... on DiscountCodeBxgy { title codes(first:5) { nodes { code } } status }
                ... on DiscountCodeFreeShipping { title codes(first:5) { nodes { code } } status }
              }
            }
          }
        }
      `);
      const nodes = (response as any).data?.codeDiscountNodes?.nodes || [];
      const codes: any[] = [];
      nodes.forEach((n: any) => {
        const d = n.codeDiscount;
        if(d?.codes?.nodes) {
          d.codes.nodes.forEach((c: any) => codes.push({ code: c.code, status: d.status }));
        }
      });
      res.json({ codes });
    } catch (e: any) {
      console.error("❌ Discount Codes Error:", e);
      res.json({ error: e.message, codes: [] });
    }
  });

  router.get("/api/shopify/products", async (req: Request, res: Response) => {
    const shop = req.query.shop as string;
    if (!shop) return res.json({ error: "Missing shop parameter", products: [] });
    const [shopData] = await db.select().from(shops).where(eq(shops.shopDomain, shop));
    if (!shopData || !shopData.accessToken) return res.json({ error: "Shop not found", products: [] });

    try {
      const client = new shopify.clients.Graphql({
        session: { shop: shopData.shopDomain, accessToken: shopData.accessToken } as any
      });
      const response = await client.request(`
        query {
          products(first: 50) {
            nodes { id title handle featuredImage { url } onlineStoreUrl }
          }
        }
      `);
      const products = (response as any).data?.products?.nodes?.map((p: any) => ({
        id: p.id,
        title: p.title,
        handle: p.handle,
        imageUrl: p.featuredImage?.url || null,
        url: p.onlineStoreUrl
      })) || [];
      res.json({ products });
    } catch (e: any) {
      res.json({ error: e.message, products: [] });
    }
  });

  // Force Pixel Endpoint
  router.get("/api/force-pixel", async (req: Request, res: Response) => {
    const shop = req.query.shop as string;
    if (!shop) return res.json({ error: "Missing shop parameter" });
    const [shopData] = await db.select().from(shops).where(eq(shops.shopDomain, shop));
    if (!shopData || !shopData.accessToken) return res.json({ error: "Shop non trouvé." });

    try {
      const client = new shopify.clients.Graphql({
        session: { shop: shopData.shopDomain, accessToken: shopData.accessToken } as any
      });
      const accountID = shopData.shopDomain.replace('.myshopify.com', '');
      const settingsJson = JSON.stringify({ accountID: accountID });
      const response = await client.request(`
        mutation {
          webPixelCreate(webPixel: { settings: ${JSON.stringify(settingsJson)} }) {
            userErrors { code field message }
            webPixel { id }
          }
        }
      `);
      res.json(response);
    } catch (e: any) {
      res.json({ error: "CRASH", details: e.message });
    }
  });

  // Debug Endpoints
  router.get("/api/webhooks/test", (req, res) => res.json({ status: "OK", time: new Date() }));
  router.get("/api/debug/shop", async (req, res) => {
    const shop = req.query.shop as string;
    const [shopData] = await db.select().from(shops).where(eq(shops.shopDomain, shop));
    res.json(shopData || { error: "Not found" });
  });

  // Image Upload
  const uploadDir = path.join(process.cwd(), "uploads/influencers/images-profils");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`),
  });
  const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (allowedTypes.includes(file.mimetype)) cb(null, true);
      else cb(new Error("Only images are allowed"));
    },
  });

  router.post("/api/upload-image", upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    res.json({ success: true, url: `https://api.influtrak.com/uploads/influencers/images-profils/${req.file.filename}` });
  });

  app.use("/uploads", require("express").static(path.join(process.cwd(), "uploads")));

  app.use(router);
}