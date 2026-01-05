import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertInfluencerSchema, insertCampaignSchema, insertEventSchema } from "@shared/schema";
import { z } from "zod";
import { shopify, SHOPIFY_SCOPES } from "./shopify";
import crypto from "crypto";

function verifyShopifyWebhook(rawBody: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret || !hmacHeader) return false;
  
  const generatedHmac = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  
  return crypto.timingSafeEqual(
    Buffer.from(generatedHmac),
    Buffer.from(hmacHeader)
  );
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ============ SHOPIFY APP ENTRY POINT ============
  // This handles when Shopify loads our app (legacy install flow)
  app.get("/api/shopify/install", async (req, res) => {
    try {
      const shop = req.query.shop as string;
      console.log("[Install] App loaded for shop:", shop);
      
      if (!shop) {
        return res.status(400).send("Missing shop parameter");
      }

      // Check if shop is already authenticated
      const shopData = await storage.getShopByDomain(shop);
      if (shopData && shopData.accessToken) {
        // Shop is authenticated, redirect to embedded app
        const shopName = shop.replace(".myshopify.com", "");
        return res.redirect(`https://admin.shopify.com/store/${shopName}/apps/app-influ`);
      }

      // Shop not authenticated, start OAuth
      console.log("[Install] Shop not authenticated, redirecting to OAuth");
      return res.redirect(`/api/shopify/auth?shop=${shop}`);
    } catch (error) {
      console.error("[Install] Error:", error);
      res.status(500).send("Installation error");
    }
  });

  // ============ SHOPIFY OAUTH ============
  app.get("/api/shopify/auth", async (req, res) => {
    try {
      const shop = req.query.shop as string;
      console.log("[OAuth] Starting auth for shop:", shop);
      console.log("[OAuth] Configured scopes:", SHOPIFY_SCOPES);
      
      if (!shop) {
        return res.status(400).json({ message: "Missing shop parameter" });
      }

      const sanitizedShop = shopify.utils.sanitizeShop(shop, true);
      if (!sanitizedShop) {
        return res.status(400).json({ message: "Invalid shop parameter" });
      }

      const authUrl = await shopify.auth.begin({
        shop: sanitizedShop,
        callbackPath: "/api/shopify/callback",
        isOnline: false,
        rawRequest: req,
        rawResponse: res,
      });

      console.log("[OAuth] Redirecting to auth URL:", authUrl);
      res.redirect(authUrl);
    } catch (error) {
      console.error("[OAuth] Shopify auth error:", error);
      res.status(500).json({ message: "Failed to start Shopify authentication" });
    }
  });

  app.get("/api/shopify/callback", async (req, res) => {
    try {
      console.log("[OAuth Callback] Processing callback...");
      console.log("[OAuth Callback] Query params:", JSON.stringify(req.query));
      
      const callback = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      const { session } = callback;
      console.log("[OAuth Callback] Session received for shop:", session.shop);
      console.log("[OAuth Callback] Access token received:", !!session.accessToken);
      console.log("[OAuth Callback] Granted scopes:", session.scope);
      
      // Save shop to database - this is critical
      await storage.upsertShop({
        shopDomain: session.shop,
        accessToken: session.accessToken || "",
        scope: session.scope || "",
      });
      console.log("[OAuth Callback] Shop saved to database");

      // Get app URL for registering script tag and webhook
      const appUrl = process.env.REPLIT_DEPLOYED_URL || `https://${req.get("host")}`;
      
      // Register script tag for tracking pixel (non-blocking)
      try {
        const client = new shopify.clients.Rest({ session });
        
        // First, check if script tag already exists
        const existingScripts = await client.get({
          path: "script_tags",
        });
        
        const pixelUrl = `${appUrl}/api/tracking/pixel.js`;
        const scriptExists = (existingScripts.body as any).script_tags?.some(
          (tag: any) => tag.src === pixelUrl
        );
        
        if (!scriptExists) {
          await client.post({
            path: "script_tags",
            data: {
              script_tag: {
                event: "onload",
                src: pixelUrl,
              },
            },
          });
          console.log(`[OAuth Callback] Script tag registered for ${session.shop}`);
        } else {
          console.log(`[OAuth Callback] Script tag already exists for ${session.shop}`);
        }
      } catch (scriptError: any) {
        console.error("[OAuth Callback] Script tag setup error (non-fatal):", scriptError?.message || scriptError);
      }
        
      // Register webhook for order creation (non-blocking)
      try {
        const client = new shopify.clients.Rest({ session });
        const existingWebhooks = await client.get({
          path: "webhooks",
        });
        
        const webhookUrl = `${appUrl}/api/webhooks/orders/create`;
        const webhookExists = (existingWebhooks.body as any).webhooks?.some(
          (hook: any) => hook.address === webhookUrl && hook.topic === "orders/create"
        );
        
        if (!webhookExists) {
          await client.post({
            path: "webhooks",
            data: {
              webhook: {
                topic: "orders/create",
                address: webhookUrl,
                format: "json",
              },
            },
          });
          console.log(`[OAuth Callback] Webhook registered for ${session.shop}`);
        } else {
          console.log(`[OAuth Callback] Webhook already exists for ${session.shop}`);
        }
      } catch (webhookError: any) {
        console.error("[OAuth Callback] Webhook setup error (non-fatal):", webhookError?.message || webhookError);
      }

      // For embedded apps, redirect back to Shopify admin
      const shopName = session.shop.replace(".myshopify.com", "");
      const embeddedUrl = `https://admin.shopify.com/store/${shopName}/apps/app-influ`;
      console.log("[OAuth Callback] Redirecting to embedded URL:", embeddedUrl);
      return res.redirect(embeddedUrl);
    } catch (error: any) {
      console.error("[OAuth Callback] CRITICAL ERROR:", error?.message || error);
      console.error("[OAuth Callback] Error stack:", error?.stack);
      res.status(500).send("Installation failed. Please try again or contact support.");
    }
  });

  app.get("/api/shopify/shop", async (req, res) => {
    try {
      const shop = req.query.shop as string;
      if (!shop) {
        return res.status(400).json({ message: "Missing shop parameter" });
      }

      const shopData = await storage.getShopByDomain(shop);
      if (!shopData) {
        return res.status(404).json({ message: "Shop not found", needsAuth: true });
      }

      res.json({ shop: shopData.shopDomain, isActive: shopData.isActive });
    } catch (error) {
      console.error("Error fetching shop:", error);
      res.status(500).json({ message: "Failed to fetch shop" });
    }
  });

  // Endpoint to manually reinstall tracking for existing shops
  app.post("/api/shopify/setup-tracking", async (req, res) => {
    try {
      const { shopDomain } = req.body;
      if (!shopDomain) {
        return res.status(400).json({ message: "Missing shopDomain" });
      }

      const shopData = await storage.getShopByDomain(shopDomain);
      if (!shopData || !shopData.accessToken) {
        return res.status(404).json({ message: "Shop not found or not authenticated" });
      }

      const appUrl = process.env.REPLIT_DEPLOYED_URL || process.env.REPLIT_DEV_DOMAIN || `https://${req.get("host")}`;
      
      const session = {
        shop: shopData.shopDomain,
        accessToken: shopData.accessToken,
      };
      
      const client = new shopify.clients.Rest({ session: session as any });
      
      const results = { scriptTag: false, webhook: false, errors: [] as string[] };
      
      // Register script tag
      try {
        const existingScripts = await client.get({ path: "script_tags" });
        const pixelUrl = `${appUrl}/api/tracking/pixel.js`;
        const scriptExists = (existingScripts.body as any).script_tags?.some(
          (tag: any) => tag.src === pixelUrl
        );
        
        if (!scriptExists) {
          await client.post({
            path: "script_tags",
            data: {
              script_tag: { event: "onload", src: pixelUrl },
            },
          });
        }
        results.scriptTag = true;
      } catch (e: any) {
        results.errors.push(`Script tag error: ${e.message}`);
      }
      
      // Register webhook
      try {
        const existingWebhooks = await client.get({ path: "webhooks" });
        const webhookUrl = `${appUrl}/api/webhooks/orders/create`;
        const webhookExists = (existingWebhooks.body as any).webhooks?.some(
          (hook: any) => hook.address === webhookUrl && hook.topic === "orders/create"
        );
        
        if (!webhookExists) {
          await client.post({
            path: "webhooks",
            data: {
              webhook: { topic: "orders/create", address: webhookUrl, format: "json" },
            },
          });
        }
        results.webhook = true;
      } catch (e: any) {
        results.errors.push(`Webhook error: ${e.message}`);
      }
      
      res.json({ 
        success: results.scriptTag && results.webhook, 
        results,
        appUrl,
        pixelUrl: `${appUrl}/api/tracking/pixel.js`,
        webhookUrl: `${appUrl}/api/webhooks/orders/create`
      });
    } catch (error: any) {
      console.error("Setup tracking error:", error);
      res.status(500).json({ message: "Failed to setup tracking", error: error.message });
    }
  });

  // ============ TRACKING PIXEL ============
  app.get("/api/tracking/pixel.js", async (req, res) => {
    const appUrl = process.env.REPLIT_DEPLOYED_URL || `https://${req.get("host")}`;
    
    const script = `
(function() {
  var APP_URL = "${appUrl}";
  
  function getSessionId() {
    var sessionId = localStorage.getItem('_inf_session');
    if (!sessionId) {
      sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      localStorage.setItem('_inf_session', sessionId);
    }
    return sessionId;
  }
  
  function getUtmCampaign() {
    var params = new URLSearchParams(window.location.search);
    var utmCampaign = params.get('utm_campaign');
    if (utmCampaign) {
      localStorage.setItem('_inf_utm', utmCampaign);
      localStorage.setItem('_inf_utm_ts', Date.now().toString());
    }
    return localStorage.getItem('_inf_utm');
  }
  
  function trackEvent(eventType, data) {
    var utmCampaign = getUtmCampaign();
    if (!utmCampaign) return;
    
    var payload = {
      slugUtm: utmCampaign,
      sessionId: getSessionId(),
      eventType: eventType,
      revenue: data.revenue || 0,
      geoCountry: data.country || '',
      geoCity: data.city || '',
      promoCodeUsed: data.promoCode ? true : false,
      promoCode: data.promoCode || null
    };
    
    fetch(APP_URL + '/api/tracking/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'cors'
    }).catch(function(e) { console.log('Tracking error:', e); });
  }
  
  var utmCampaign = getUtmCampaign();
  if (utmCampaign) {
    trackEvent('page_view', {});
  }
  
  window.InfluencerTracker = {
    trackAddToCart: function(data) { trackEvent('add_to_cart', data || {}); },
    trackPurchase: function(data) { trackEvent('purchase', data || {}); }
  };
})();
`;
    
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(script);
  });

  app.post("/api/tracking/event", async (req, res) => {
    try {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      const { 
        slugUtm, promoCode, sessionId, eventType, revenue, 
        geoCountry, geoCity, promoCodeUsed,
        productId, productTitle, quantity, currency, orderId, source 
      } = req.body;
      
      console.log("[Tracking] Event received:", { slugUtm, eventType, sessionId, revenue, source: source || "legacy" });

      let campaign = null;
      if (slugUtm) {
        campaign = await storage.getCampaignByUtmSlug(slugUtm);
        console.log("[Tracking] Campaign lookup by UTM:", slugUtm, "-> Found:", !!campaign);
      }
      if (!campaign && promoCode) {
        campaign = await storage.getCampaignByPromoCode(promoCode);
        console.log("[Tracking] Campaign lookup by promo:", promoCode, "-> Found:", !!campaign);
      }

      if (!campaign) {
        console.log("[Tracking] No campaign found for:", { slugUtm, promoCode });
        return res.status(404).json({ message: "Campaign not found" });
      }

      const event = await storage.createEvent({
        campaignId: campaign.id,
        eventType,
        sessionId: sessionId || null,
        revenue: revenue || 0,
        geoCountry: geoCountry || null,
        geoCity: geoCity || null,
        promoCodeUsed: promoCodeUsed || false,
        source: source || (promoCodeUsed ? "promo_code" : "utm"),
      });

      console.log("[Tracking] Event created:", event.id, "for campaign:", campaign.name);
      res.status(201).json({ success: true, eventId: event.id });
    } catch (error) {
      console.error("Error tracking event:", error);
      res.status(500).json({ message: "Failed to track event" });
    }
  });

  app.options("/api/tracking/event", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send();
  });

  // ============ SHOPIFY WEBHOOKS ============
  app.post("/api/webhooks/orders/create", async (req, res) => {
    try {
      const hmacHeader = req.get("X-Shopify-Hmac-Sha256") || "";
      const rawBody = JSON.stringify(req.body);
      
      if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
        console.error("Webhook signature verification failed");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const order = req.body;
      const discountCodes = order.discount_codes || [];
      
      for (const discount of discountCodes) {
        const campaign = await storage.getCampaignByPromoCode(discount.code);
        if (campaign) {
          await storage.createEvent({
            campaignId: campaign.id,
            eventType: "purchase",
            revenue: parseFloat(order.total_price) || 0,
            promoCodeUsed: true,
            source: "promo_code",
            geoCountry: order.billing_address?.country || null,
            geoCity: order.billing_address?.city || null,
          });
        }
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // ============ STATS ============
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ============ INFLUENCERS ============
  app.get("/api/influencers", async (req, res) => {
    try {
      const influencers = await storage.getInfluencers();
      res.json(influencers);
    } catch (error) {
      console.error("Error fetching influencers:", error);
      res.status(500).json({ message: "Failed to fetch influencers" });
    }
  });

  app.get("/api/influencers/:id", async (req, res) => {
    try {
      const influencer = await storage.getInfluencer(req.params.id);
      if (!influencer) {
        return res.status(404).json({ message: "Influencer not found" });
      }
      res.json(influencer);
    } catch (error) {
      console.error("Error fetching influencer:", error);
      res.status(500).json({ message: "Failed to fetch influencer" });
    }
  });

  app.post("/api/influencers", async (req, res) => {
    try {
      const schema = insertInfluencerSchema.extend({
        socialAccounts: z.array(z.object({
          platform: z.string(),
          handle: z.string(),
          followersCount: z.number().optional(),
        })).optional(),
      });

      const data = schema.parse(req.body);
      const { socialAccounts, ...influencerData } = data;

      const influencer = await storage.createInfluencer(influencerData, socialAccounts);
      res.status(201).json(influencer);
    } catch (error) {
      console.error("Error creating influencer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create influencer" });
    }
  });

  app.patch("/api/influencers/:id", async (req, res) => {
    try {
      const schema = insertInfluencerSchema.partial().extend({
        socialAccounts: z.array(z.object({
          platform: z.string(),
          handle: z.string(),
          followersCount: z.number().optional(),
        })).optional(),
      });

      const data = schema.parse(req.body);
      const { socialAccounts, ...influencerData } = data;

      const influencer = await storage.updateInfluencer(req.params.id, influencerData, socialAccounts);
      if (!influencer) {
        return res.status(404).json({ message: "Influencer not found" });
      }
      res.json(influencer);
    } catch (error) {
      console.error("Error updating influencer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update influencer" });
    }
  });

  app.delete("/api/influencers/:id", async (req, res) => {
    try {
      const success = await storage.deleteInfluencer(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Influencer not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting influencer:", error);
      res.status(500).json({ message: "Failed to delete influencer" });
    }
  });

  // ============ CAMPAIGNS ============
  app.get("/api/campaigns", async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/campaigns/stats", async (req, res) => {
    try {
      const campaigns = await storage.getCampaignsWithStats();
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaign stats:", error);
      res.status(500).json({ message: "Failed to fetch campaign stats" });
    }
  });

  app.get("/api/campaigns/:id", async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Error fetching campaign:", error);
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  app.post("/api/campaigns", async (req, res) => {
    try {
      const data = insertCampaignSchema.parse(req.body);
      const campaign = await storage.createCampaign(data);
      res.status(201).json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });

  app.patch("/api/campaigns/:id", async (req, res) => {
    try {
      const data = insertCampaignSchema.partial().parse(req.body);
      const campaign = await storage.updateCampaign(req.params.id, data);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Error updating campaign:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });

  app.delete("/api/campaigns/:id", async (req, res) => {
    try {
      const success = await storage.deleteCampaign(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  // ============ EVENTS ============
  app.post("/api/events", async (req, res) => {
    try {
      const data = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(data);
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  app.get("/api/campaigns/:id/events", async (req, res) => {
    try {
      const events = await storage.getEventsByCampaign(req.params.id);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  return httpServer;
}
