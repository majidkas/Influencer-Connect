import "@shopify/shopify-api/adapters/node";
import { shopifyApi, ApiVersion } from "@shopify/shopify-api";

const isDev = process.env.NODE_ENV === "development";

// Use production URL first, then fall back to dev domain
const getHostName = () => {
  if (process.env.REPLIT_DEPLOYED_URL) {
    return process.env.REPLIT_DEPLOYED_URL.replace("https://", "").replace("http://", "");
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return process.env.REPLIT_DEV_DOMAIN.replace("https://", "").replace("http://", "");
  }
  return "influ-connect.replit.app";
};

// Scopes must match exactly what's configured in Partner Dashboard
// Note: There are NO separate webhook scopes - webhooks use the data scopes (e.g. read_orders)
const SCOPES = [
  "read_products",
  "read_orders", 
  "read_discounts",
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
