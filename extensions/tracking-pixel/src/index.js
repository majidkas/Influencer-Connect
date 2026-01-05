import { register } from "@shopify/web-pixels-extension";

const BACKEND_URL = "https://influ-connect.replit.app";
const UTM_STORAGE_KEY = "_inf_utm";
const SESSION_STORAGE_KEY = "_inf_session";
const UTM_EXPIRY_DAYS = 30;

register(({ analytics, browser, settings }) => {
  const getSessionId = () => {
    let sessionId = browser.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) {
      sessionId = "sess_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
      browser.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }
    return sessionId;
  };

  const getStoredUtm = () => {
    try {
      const stored = browser.localStorage.getItem(UTM_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const expiryMs = UTM_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        if (Date.now() - data.timestamp < expiryMs) {
          return data.slug;
        }
        browser.localStorage.removeItem(UTM_STORAGE_KEY);
      }
    } catch (e) {}
    return null;
  };

  const storeUtm = (slug) => {
    browser.localStorage.setItem(
      UTM_STORAGE_KEY,
      JSON.stringify({ slug, timestamp: Date.now() })
    );
  };

  const extractUtmFromUrl = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get("utm_campaign");
    } catch (e) {
      return null;
    }
  };

  const sendEvent = async (eventType, data = {}) => {
    const utmSlug = getStoredUtm();
    if (!utmSlug) return;

    const payload = {
      slugUtm: utmSlug,
      sessionId: getSessionId(),
      eventType,
      revenue: data.revenue || 0,
      productId: data.productId || null,
      productTitle: data.productTitle || null,
      quantity: data.quantity || 1,
      currency: data.currency || "USD",
      orderId: data.orderId || null,
      source: "web_pixel"
    };

    try {
      await fetch(`${BACKEND_URL}/api/tracking/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        mode: "cors",
        keepalive: true
      });
    } catch (e) {
      console.error("[InfluencerPixel] Error sending event:", e);
    }
  };

  analytics.subscribe("page_viewed", (event) => {
    const url = event.context?.document?.location?.href || "";
    const utmFromUrl = extractUtmFromUrl(url);
    
    if (utmFromUrl) {
      storeUtm(utmFromUrl);
      sendEvent("page_view", { url });
    } else if (getStoredUtm()) {
      sendEvent("page_view", { url });
    }
  });

  analytics.subscribe("product_viewed", (event) => {
    const product = event.data?.productVariant?.product;
    if (product && getStoredUtm()) {
      sendEvent("product_view", {
        productId: product.id,
        productTitle: product.title
      });
    }
  });

  analytics.subscribe("product_added_to_cart", (event) => {
    const cartLine = event.data?.cartLine;
    if (cartLine && getStoredUtm()) {
      sendEvent("add_to_cart", {
        productId: cartLine.merchandise?.product?.id,
        productTitle: cartLine.merchandise?.product?.title,
        quantity: cartLine.quantity,
        revenue: parseFloat(cartLine.cost?.totalAmount?.amount) || 0,
        currency: cartLine.cost?.totalAmount?.currencyCode || "USD"
      });
    }
  });

  analytics.subscribe("checkout_completed", (event) => {
    const checkout = event.data?.checkout;
    if (checkout && getStoredUtm()) {
      sendEvent("purchase", {
        orderId: checkout.order?.id,
        revenue: parseFloat(checkout.totalPrice?.amount) || 0,
        currency: checkout.totalPrice?.currencyCode || "USD"
      });
    }
  });
});
