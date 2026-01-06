import "@shopify/shopify-api/adapters/node";
import { shopifyApi, ApiVersion } from "@shopify/shopify-api";

const getHostName = () => {
  // Priorité : APP_URL (production), sinon Replit (dev), sinon défaut
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace("https://", "").replace("http://", "");
  }
  if (process.env.REPLIT_DEPLOYED_URL) {
    return process.env.REPLIT_DEPLOYED_URL.replace("https://", "").replace("http://", "");
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return process.env.REPLIT_DEV_DOMAIN.replace("https://", "").replace("http://", "");
  }
  return "api.influtrak.com";
};

const SCOPES = [
  "read_products",
  "read_orders", 
  "read_discounts",
  "write_discounts",
  "read_pixels",
  "write_pixels",
  "read_script_tags",
  "write_script_tags",
  "read_customer_events",
];

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || "",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  scopes: SCOPES,
  hostName: getHostName(),
  hostScheme: "https",
  apiVersion: ApiVersion.January25,
  isEmbeddedApp: true,
});

export const SHOPIFY_SCOPES = SCOPES.join(",");