import "@shopify/shopify-api/adapters/node";
import { shopifyApi, ApiVersion } from "@shopify/shopify-api";

const isDev = process.env.NODE_ENV === "development";

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || "",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  scopes: ["read_products", "read_orders", "read_discounts", "write_script_tags"],
  hostName: process.env.REPLIT_DEV_DOMAIN?.replace("https://", "") || "localhost:5000",
  hostScheme: "https",
  apiVersion: ApiVersion.January25,
  isEmbeddedApp: true,
});

export const SHOPIFY_SCOPES = [
  "read_products",
  "read_orders", 
  "read_discounts",
  "write_script_tags",
].join(",");
