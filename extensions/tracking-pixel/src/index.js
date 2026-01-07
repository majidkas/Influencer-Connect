import { register } from "@shopify/web-pixels-extension";

register(async ({ analytics, browser, settings, init }) => {
  const API_URL = "https://api.influtrak.com/api/tracking/event";

  // --- FONCTIONS UTILITAIRES SÉCURISÉES ---

  // Fonction pour lire/écrire dans le stockage sans faire planter le script
  const safeStorage = {
    getItem: async (key) => {
      try {
        return await browser.localStorage.getItem(key);
      } catch (e) {
        return null; // Si bloqué (Safari), on renvoie null sans planter
      }
    },
    setItem: async (key, value) => {
      try {
        await browser.localStorage.setItem(key, value);
      } catch (e) {
        // Si bloqué, on ne fait rien (tant pis pour la persistance long terme)
      }
    }
  };

  // Génération d'ID robuste (Même si le stockage est bloqué)
  const getSessionId = async () => {
    let id = await safeStorage.getItem("inf_session_id");
    
    // Si pas d'ID trouvé ou stockage bloqué, on en crée un nouveau
    if (!id) {
      id = `sess_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
      // On tente de le sauvegarder pour la prochaine fois
      await safeStorage.setItem("inf_session_id", id);
    }
    return id;
  };

  const getUtmCampaign = async () => {
    // 1. Priorité : Lire l'URL actuelle
    const urlString = init.context.document.location.href;
    let utm = null;
    
    if (urlString) {
      try {
        const url = new URL(urlString);
        utm = url.searchParams.get("utm_campaign");
      } catch (e) {
        console.error("URL parsing error", e);
      }
    }

    // 2. Si trouvé dans l'URL, on sauvegarde et on renvoie
    if (utm) {
      await safeStorage.setItem("inf_utm_campaign", utm);
      return utm;
    }

    // 3. Sinon, on essaie de récupérer le dernier connu en mémoire
    return await safeStorage.getItem("inf_utm_campaign");
  };

  // --- ENVOI DES DONNÉES ---

  const sendEvent = async (eventName, payload = {}) => {
    // On génère les infos (ne plantera plus grâce au safeStorage)
    const sessionId = await getSessionId();
    const utmSlug = await getUtmCampaign();

    // MODE DEBUG : On envoie TOUT, même si pas d'UTM
    const body = {
      eventType: eventName,
      sessionId: sessionId,
      slugUtm: utmSlug || "UTM_NOT_FOUND", // On verra clairement si l'UTM manque
      ...payload
    };

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true
    }).catch(err => console.error("Pixel Error:", err));
  };

  // --- ABONNEMENTS ---

  analytics.subscribe("page_view", async (event) => {
    await sendEvent("page_view", {
      url: event.context.document.location.href
    });
  });

  analytics.subscribe("product_viewed", async (event) => {
    await sendEvent("product_view", {
      url: event.context.document.location.href
    });
  });

  analytics.subscribe("product_added_to_cart", async (event) => {
    await sendEvent("add_to_cart", {
      productId: event.data.cartLine?.merchandise?.product?.id,
      quantity: event.data.cartLine?.quantity
    });
  });

  analytics.subscribe("checkout_completed", async (event) => {
    const checkout = event.data.checkout;
    const promoCode = checkout.discountApplications?.[0]?.title || null;

    await sendEvent("purchase", {
      revenue: checkout.totalPrice.amount,
      currency: checkout.totalPrice.currencyCode,
      orderId: checkout.order?.id,
      promoCode: promoCode,
      promoCodeUsed: !!promoCode
    });
  });
});