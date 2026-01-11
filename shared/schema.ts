import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ... (Gardez les tables shops, influencers, campaigns, events, orders telles quelles)
// Je remets juste le début pour le contexte, mais ne copiez pas tout si vous avez déjà le reste.
// COPIEZ JUSTE LA TABLE SETTINGS CI-DESSOUS POUR REMPLACER L'ANCIENNE

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

export const influencers = pgTable("influencers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  profileImageUrl: text("profile_image_url"),
  gender: text("gender"),
  internalNotes: text("internal_notes"),
  whatsapp: text("whatsapp"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const socialAccounts = pgTable("social_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  influencerId: varchar("influencer_id").notNull().references(() => influencers.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  handle: text("handle").notNull(),
  followersCount: integer("followers_count").default(0),
});

export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  influencerId: varchar("influencer_id"), 
  name: text("name").notNull(),
  slugUtm: text("slug_utm").notNull(),
  promoCode: text("promo_code"),
  discountType: text("discount_type"),
  discountValue: real("discount_value"),
  targetType: text("target_type").default("product"),
  productUrl: text("product_url"),
  costFixed: real("cost_fixed").default(0),
  commissionPercent: real("commission_percent").default(0),
  status: text("status").default("active"),
  shopId: integer("shop_id"), 
  createdAt: timestamp("created_at").defaultNow(),
});

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  utmCampaign: text("utm_campaign"), 
  eventType: text("event_type").notNull(), 
  sessionId: text("session_id"),
  revenue: real("revenue").default(0),
  payload: jsonb("payload"), 
  createdAt: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shopifyOrderId: text("shopify_order_id").notNull().unique(),
  totalPrice: real("total_price"),
  currency: text("currency"),
  promoCode: text("promo_code"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- TABLE SETTINGS (MISE À JOUR) ---
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  language: text("language").default("fr"),
  
  // Logic 1 étoile (Plage)
  star1Min: real("star_1_min").default(0.0),
  star1Max: real("star_1_max").default(1.99),
  
  // Logic 2 étoiles (Plage)
  star2Min: real("star_2_min").default(2.0),
  star2Max: real("star_2_max").default(2.99),
  
  // Logic 3 étoiles (Seuil Min)
  star3Min: real("star_3_min").default(3.0),
  
  lossText: text("loss_text").default("⚠️ Loss !"),
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
export const insertSettingsSchema = createInsertSchema(settings);

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
export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;

export type InfluencerWithSocials = Influencer & { socialAccounts: SocialAccount[] };
export type CampaignWithInfluencer = Campaign & { influencer?: Influencer };
export type CampaignWithStats = Campaign & {
  influencer?: Influencer;
  clicks: number;
  addToCarts: number;
  orders: number;
  promoCodeUsage: number;
  revenue: number;
  revenuePromoOnly: number;
  totalCost: number;
  roi: number;
  conversionRate: number;
};