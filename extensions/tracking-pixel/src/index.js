import { register } from "@shopify/web-pixels-extension";

register(async ({ analytics, browser, settings, init }) => {
  // 1. Configuration
  const API_URL = "https://api.influtrak.com/api/tracking/event";
  const ACCOUNT_ID = settings.accountID || "unknown";

  // 2. Helper pour générer un session ID
  const generateSessionId = () => {
    return `sess_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  };

  // 3. Récupérer l'UTM depuis l'URL actuelle
  const getUtmFromUrl = () => {
    try {
      const url = init.context.document.location.href;
      const urlObj = new URL(url);
      return urlObj.searchParams.get("utm_campaign");
    } catch (e) {
      return null;
    }
  };

  // 4. Gestion du localStorage (async dans le sandbox Shopify)
  let cachedSessionId = null;
  let cachedUtmCampaign = null;

  const initSession = async () => {
    try {
      // Essayer de récupérer depuis localStorage
      cachedSessionId = await browser.localStorage.getItem("inf_session_id");
      cachedUtmCampaign = await browser.localStorage.getItem("inf_utm_campaign");
      
      // Générer un nouveau session ID si nécessaire
      if (!cachedSessionId) {
        cachedSessionId = generateSessionId();
        await browser.localStorage.setItem("inf_session_id", cachedSessionId);
      }

      // Vérifier l'UTM dans l'URL actuelle
      const urlUtm = getUtmFromUrl();
      if (urlUtm) {
        cachedUtmCampaign = urlUtm;
        await browser.localStorage.setItem("inf_utm_campaign", urlUtm);
      }
    } catch (e) {
      // Fallback si localStorage échoue
      if (!cachedSessionId) {
        cachedSessionId = generateSessionId();
      }
      const urlUtm = getUtmFromUrl();
      if (urlUtm) {
        cachedUtmCampaign = urlUtm;
      }
    }
  };

  // Initialiser la session immédiatement
  await initSession();

  // 5. Fonction pour envoyer les événements
  const sendEvent = async (eventName, payload = {}) => {
    // Toujours essayer de récupérer l'UTM depuis l'URL au cas où
    const urlUtm = getUtmFromUrl();
    if (urlUtm && urlUtm !== cachedUtmCampaign) {
      cachedUtmCampaign = urlUtm;
      try {
        await browser.localStorage.setItem("inf_utm_campaign", urlUtm);
      } catch (e) {}
    }

    const body = {
      eventType: eventName,
      sessionId: cachedSessionId,
      slugUtm: cachedUtmCampaign || "direct",
      accountId: ACCOUNT_ID,
      timestamp: new Date().toISOString(),
      ...payload
    };

    // Utiliser fetch avec les bonnes options pour le sandbox Shopify
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        keepalive: true
      });
    } catch (err) {
      // Silencieux en production
    }
  };

  // 6. Abonnements aux événements

  // A. Vue de page - TOUJOURS envoyer (même sans UTM pour debug)
  analytics.subscribe("page_viewed", async (event) => {
    await sendEvent("page_view", {
      url: event.context.document.location.href,
      referrer: event.context.document.referrer || null,
      title: event.context.document.title || null
    });
  });

  // B. Produit vu
  analytics.subscribe("product_viewed", async (event) => {
    const product = event.data.productVariant;
    await sendEvent("product_view", {
      productId: product?.product?.id,
      productTitle: product?.product?.title,
      variantId: product?.id,
      price: product?.price?.amount
    });
  });

  // C. Ajout au panier
  analytics.subscribe("product_added_to_cart", async (event) => {
    await sendEvent("add_to_cart", {
      productId: event.data.cartLine?.merchandise?.product?.id,
      productTitle: event.data.cartLine?.merchandise?.product?.title,
      variantId: event.data.cartLine?.merchandise?.id,
      quantity: event.data.cartLine?.quantity,
      price: event.data.cartLine?.merchandise?.price?.amount
    });
  });

  // D. Début du checkout
  analytics.subscribe("checkout_started", async (event) => {
    const checkout = event.data.checkout;
    await sendEvent("checkout_started", {
      totalPrice: checkout?.totalPrice?.amount,
      currency: checkout?.totalPrice?.currencyCode,
      itemCount: checkout?.lineItems?.length
    });
  });

  // E. Achat complété
  analytics.subscribe("checkout_completed", async (event) => {
    const checkout = event.data.checkout;

    // Récupérer le code promo
    const promoCode = checkout.discountApplications && checkout.discountApplications.length > 0
      ? checkout.discountApplications[0].title
      : null;

    await sendEvent("purchase", {
      revenue: checkout.totalPrice?.amount,
      currency: checkout.totalPrice?.currencyCode,
      orderId: checkout.order?.id,
      promoCode: promoCode,
      promoCodeUsed: !!promoCode,
      geoCountry: checkout.shippingAddress?.countryCode,
      geoCity: checkout.shippingAddress?.city
    });
  });
});