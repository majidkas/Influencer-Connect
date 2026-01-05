import { register } from "@shopify/web-pixels-extension";

const BACKEND_URL = "https://influ-connect.replit.app";
const UTM_STORAGE_KEY = "_inf_utm";
const SESSION_STORAGE_KEY = "_inf_session";
const UTM_EXPIRY_DAYS = 30;

register(async ({ analytics, browser, settings, init }) => {
  // ============ HELPERS (tous asynchrones) ============

  const getSessionId = async () => {
    try {
      let sessionId = await browser.localStorage.getItem(SESSION_STORAGE_KEY);
      if (!sessionId) {
        sessionId = "sess_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
        await browser.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      }
      return sessionId;
    } catch (e) {
      // Fallback si localStorage échoue
      return "sess_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
    }
  };

  const getStoredUtm = async () => {
    try {
      const stored = await browser.localStorage.getItem(UTM_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const expiryMs = UTM_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        if (Date.now() - data.timestamp < expiryMs) {
          return data.slug;
        }
        await browser.localStorage.removeItem(UTM_STORAGE_KEY);
      }
    } catch (e) {
      console.error("[InfluencerPixel] Error reading UTM:", e);
    }
    return null;
  };

  const storeUtm = async (slug) => {
    try {
      await browser.localStorage.setItem(
        UTM_STORAGE_KEY,
        JSON.stringify({ slug, timestamp: Date.now() })
      );
      console.log("[InfluencerPixel] UTM stored:", slug);
    } catch (e) {
      console.error("[InfluencerPixel] Error storing UTM:", e);
    }
  };

  const extractUtmFromUrl = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get("utm_campaign");
    } catch (e) {
      return null;
    }
  };

  // ============ SEND EVENT (compatible sandbox) ============

  const sendEvent = async (eventType, data = {}) => {
    const utmSlug = await getStoredUtm();
    if (!utmSlug) {
      console.log("[InfluencerPixel] No UTM slug found, skipping event:", eventType);
      return;
    }

    const sessionId = await getSessionId();

    const payload = {
      slugUtm: utmSlug,
      sessionId: sessionId,
      eventType: eventType,
      revenue: data.revenue || 0,
      productId: data.productId || null,
      productTitle: data.productTitle || null,
      quantity: data.quantity || 1,
      currency: data.currency || "EUR",
      orderId: data.orderId || null,
      source: "web_pixel"
    };

    console.log("[InfluencerPixel] Sending event:", eventType, payload);

    try {
      // Utiliser fetch sans mode: "cors" - le sandbox gère ça automatiquement
      const response = await fetch(`${BACKEND_URL}/api/tracking/event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        keepalive: true
      });

      if (response.ok) {
        console.log("[InfluencerPixel] Event sent successfully:", eventType);
      } else {
        console.error("[InfluencerPixel] Event failed:", response.status, await response.text());
      }
    } catch (e) {
      console.error("[InfluencerPixel] Error sending event:", e);
    }
  };

  // ============ INITIALISATION : Vérifier UTM au chargement ============

  // Récupérer l'URL initiale depuis le contexte d'initialisation
  const initialUrl = init?.context?.document?.location?.href ||
                     init?.data?.context?.document?.location?.href || "";

  console.log("[InfluencerPixel] Pixel initialized, URL:", initialUrl);

  const initialUtm = extractUtmFromUrl(initialUrl);
  if (initialUtm) {
    await storeUtm(initialUtm);
    console.log("[InfluencerPixel] Initial UTM captured:", initialUtm);
  }

  // ============ EVENT SUBSCRIPTIONS ============

  // Page View
  analytics.subscribe("page_viewed", async (event) => {
    const url = event?.context?.document?.location?.href || "";
    console.log("[InfluencerPixel] page_viewed triggered, URL:", url);

    const utmFromUrl = extractUtmFromUrl(url);

    if (utmFromUrl) {
      await storeUtm(utmFromUrl);
      await sendEvent("page_view", { url });
    } else {
      const storedUtm = await getStoredUtm();
      if (storedUtm) {
        await sendEvent("page_view", { url });
      }
    }
  });

  // Product Viewed
  analytics.subscribe("product_viewed", async (event) => {
    console.log("[InfluencerPixel] product_viewed triggered");
    const product = event?.data?.productVariant?.product;
    const storedUtm = await getStoredUtm();

    if (product && storedUtm) {
      await sendEvent("product_view", {
        productId: product.id,
        productTitle: product.title
      });
    }
  });

  // Add to Cart
  analytics.subscribe("product_added_to_cart", async (event) => {
    console.log("[InfluencerPixel] product_added_to_cart triggered");
    const cartLine = event?.data?.cartLine;
    const storedUtm = await getStoredUtm();

    if (cartLine && storedUtm) {
      await sendEvent("add_to_cart", {
        productId: cartLine?.merchandise?.product?.id,
        productTitle: cartLine?.merchandise?.product?.title,
        quantity: cartLine?.quantity || 1,
        revenue: parseFloat(cartLine?.cost?.totalAmount?.amount) || 0,
        currency: cartLine?.cost?.totalAmount?.currencyCode || "EUR"
      });
    }
  });

  // Checkout Started
  analytics.subscribe("checkout_started", async (event) => {
    console.log("[InfluencerPixel] checkout_started triggered");
    const checkout = event?.data?.checkout;
    const storedUtm = await getStoredUtm();

    if (checkout && storedUtm) {
      await sendEvent("checkout_started", {
        revenue: parseFloat(checkout?.totalPrice?.amount) || 0,
        currency: checkout?.totalPrice?.currencyCode || "EUR"
      });
    }
  });

  // Purchase Completed
  analytics.subscribe("checkout_completed", async (event) => {
    console.log("[InfluencerPixel] checkout_completed triggered");
    const checkout = event?.data?.checkout;
    const storedUtm = await getStoredUtm();

    if (checkout && storedUtm) {
      await sendEvent("purchase", {
        orderId: checkout?.order?.id,
        revenue: parseFloat(checkout?.totalPrice?.amount) || 0,
        currency: checkout?.totalPrice?.currencyCode || "EUR"
      });
    }
  });

  console.log("[InfluencerPixel] All event subscriptions registered");
});
