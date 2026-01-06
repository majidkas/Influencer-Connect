import { register } from "@shopify/web-pixels-extension";

register(async ({ analytics, browser, settings, init }) => {
  // 1. Configuration : Ton URL API
  // IMPORTANT : Mets ton vrai domaine HTTPS ici
  const API_URL = "https://api.influtrak.com/api/tracking/event";

  // 2. Récupérer l'UTM ou le Code Promo stocké
  const getSessionId = async () => {
    let id = await browser.localStorage.getItem("inf_session_id");
    if (!id) {
      id = `sess_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
      await browser.localStorage.setItem("inf_session_id", id);
    }
    return id;
  };

  const getUtmCampaign = async () => {
    // Vérifier l'URL actuelle
    const url = new URL(init.context.document.location.href);
    const utm = url.searchParams.get("utm_campaign");

    if (utm) {
      await browser.localStorage.setItem("inf_utm_campaign", utm);
      return utm;
    }
    return await browser.localStorage.getItem("inf_utm_campaign");
  };

  // 3. Fonction générique pour envoyer les données (Types retirés ici)
  const sendEvent = async (eventName, payload = {}) => {
    const sessionId = await getSessionId();
    const utmSlug = await getUtmCampaign();

    // On n'envoie rien si pas de campagne identifiée (sauf pour l'achat)
    if (!utmSlug && eventName !== "purchase") return;

    const body = {
      eventType: eventName,
      sessionId: sessionId,
      slugUtm: utmSlug,
      ...payload
    };

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true
    }).catch(err => console.error("Pixel Error:", err));
  };

  // 4. Abonnements aux événements

  // A. Vue de page
  analytics.subscribe("page_view", async (event) => {
    await sendEvent("page_view", {
      url: event.context.document.location.href
    });
  });

  // B. Ajout au panier
  analytics.subscribe("product_added_to_cart", async (event) => {
    await sendEvent("add_to_cart", {
      productId: event.data.cartLine?.merchandise?.product?.id,
      quantity: event.data.cartLine?.quantity
    });
  });

  // C. Achat / Paiement
  analytics.subscribe("checkout_completed", async (event) => {
    const checkout = event.data.checkout;

    // Récupérer le code promo
    const promoCode = checkout.discountApplications && checkout.discountApplications.length > 0
      ? checkout.discountApplications[0].title
      : null;

    await sendEvent("purchase", {
      revenue: checkout.totalPrice.amount,
      currency: checkout.totalPrice.currencyCode,
      orderId: checkout.order?.id,
      promoCode: promoCode,
      promoCodeUsed: !!promoCode,
      geoCountry: checkout.shippingAddress?.countryCode,
      geoCity: checkout.shippingAddress?.city
    });
  });
});
