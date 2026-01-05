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

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || "",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  scopes: ["read_products", "read_orders", "read_discounts", "write_script_tags", "write_webhooks", "read_webhooks"],
  hostName: getHostName(),
  hostScheme: "https",
  apiVersion: ApiVersion.January25,
  isEmbeddedApp: true,
});

export const SHOPIFY_SCOPES = [
  "read_products",
  "read_orders", 
  "read_discounts",
  "write_script_tags",
  "write_webhooks",
  "read_webhooks",
].join(",");
