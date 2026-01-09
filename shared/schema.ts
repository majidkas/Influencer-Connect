import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Shopify shops table
export const shops = pgTable("shops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shopDomain: text("shop_domain").notNull().unique(),
  accessToken: text("access_token").notNull(),
  scope: text("scope"),
  isActive: boolean("is_active").default(true),
  isInstalled: boolean("is_installed").default(true),
  installedAt: timestamp("installed_at").defaultNow(),
  uninstalledAt: timestamp("uninstalled_at"),
});

// Influencers table
export const influencers = pgTable("influencers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  profileImageUrl: text("profile_image_url"),
  gender: text("gender"),
  // SUPPRIMÉ : internalRating (le rating sera calculé dynamiquement)
  internalNotes: text("internal_notes"),
  whatsapp: text("whatsapp"), // AJOUTÉ : Pour le contact WhatsApp
  createdAt: timestamp("created_at").defaultNow(),
});


// Social accounts
export const socialAccounts = pgTable("social_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  influencerId: varchar("influencer_id").notNull().references(() => influencers.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  handle: text("handle").notNull(),
  followersCount: integer("followers_count").default(0),
});

// Campaigns table
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  influencerId: varchar("influencer_id"), 
  name: text("name").notNull(),
  slugUtm: text("slug_utm").notNull(),
  promoCode: text("promo_code"),
  discountType: text("discount_type"),
  discountValue: real("discount_value"),
  
  // MODIFICATION CIBLAGE
  targetType: text("target_type").default("product"), // AJOUTÉ : "homepage" ou "product"
  productUrl: text("product_url"),
  
  costFixed: real("cost_fixed").default(0),
  commissionPercent: real("commission_percent").default(0),
  status: text("status").default("active"),
  shopId: integer("shop_id"), 
  createdAt: timestamp("created_at").defaultNow(),
});

// Events table
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  utmCampaign: text("utm_campaign"), 
  eventType: text("event_type").notNull(), 
  sessionId: text("session_id"),
  revenue: real("revenue").default(0),
  payload: jsonb("payload"), 
  createdAt: timestamp("created_at").defaultNow(),
});

// Orders table
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shopifyOrderId: text("shopify_order_id").notNull().unique(),
  totalPrice: real("total_price"),
  currency: text("currency"),
  promoCode: text("promo_code"), // AJOUTÉ : Pour lier au Revenue (2) - Commandes hors lien tracké
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const influencersRelations = relations(influencers, ({ many }) => ({
  socialAccounts: many(socialAccounts),
  campaigns: many(campaigns),
}));

export const socialAccountsRelations = relations(socialAccounts, ({ one }) => ({
  influencer: one(influencers, {
    fields: [socialAccounts.influencerId],
    references: [influencers.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  influencer: one(influencers, {
    fields: [campaigns.influencerId],
    references: [influencers.id],
  }),
}));

// Insert schemas
export const insertShopSchema = createInsertSchema(shops);
export const insertInfluencerSchema = createInsertSchema(influencers);
export const insertSocialAccountSchema = createInsertSchema(socialAccounts);
export const insertCampaignSchema = createInsertSchema(campaigns);
export const insertEventSchema = createInsertSchema(events);

// Types exportés
export type Shop = typeof shops.$inferSelect;
export type InsertShop = z.infer<typeof insertShopSchema>;
export type Influencer = typeof influencers.$inferSelect;
export type InsertInfluencer = z.infer<typeof insertInfluencerSchema>;
export type SocialAccount = typeof socialAccounts.$inferSelect;
export type InsertSocialAccount = z.infer<typeof insertSocialAccountSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type InfluencerWithSocials = Influencer & { socialAccounts: SocialAccount[] };
export type CampaignWithInfluencer = Campaign & { influencer?: Influencer };
export type CampaignWithStats = Campaign & {
  influencer?: Influencer;
  clicks: number;
  addToCarts: number;
  orders: number;
  promoCodeUsage: number;
  revenue: number;
  revenuePromoOnly: number; // AJOUTÉ pour le typage frontend futur
  totalCost: number;
  roi: number;
  conversionRate: number; // AJOUTÉ pour le typage frontend futur
};