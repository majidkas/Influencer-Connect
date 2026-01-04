import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Shopify shops table - stores shop credentials and tokens
export const shops = pgTable("shops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shopDomain: text("shop_domain").notNull().unique(),
  accessToken: text("access_token").notNull(),
  scope: text("scope"),
  isActive: boolean("is_active").default(true),
  installedAt: timestamp("installed_at").defaultNow(),
});

// Influencers table - Core CRM data
export const influencers = pgTable("influencers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  profileImageUrl: text("profile_image_url"),
  instagramHandle: text("instagram_handle"),
  internalRating: integer("internal_rating").default(0),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Social accounts linked to influencers
export const socialAccounts = pgTable("social_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  influencerId: varchar("influencer_id").notNull().references(() => influencers.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(), // instagram, tiktok, snapchat
  handle: text("handle").notNull(),
  followersCount: integer("followers_count").default(0),
});

// Campaigns table
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  influencerId: varchar("influencer_id").notNull().references(() => influencers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slugUtm: text("slug_utm").notNull(),
  promoCode: text("promo_code"),
  productUrl: text("product_url"), // Shopify product URL for the campaign
  costFixed: real("cost_fixed").default(0),
  commissionPercent: real("commission_percent").default(0),
  status: text("status").default("active"), // active, paused, completed
  createdAt: timestamp("created_at").defaultNow(),
});

// Events table for tracking
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // page_view, add_to_cart, purchase
  sessionId: text("session_id"), // Unique visitor session ID
  revenue: real("revenue").default(0),
  geoCountry: text("geo_country"),
  geoCity: text("geo_city"),
  promoCodeUsed: boolean("promo_code_used").default(false), // True if attribution via code
  source: text("source"), // utm, promo_code
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
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [events.campaignId],
    references: [campaigns.id],
  }),
}));

// Insert schemas
export const insertShopSchema = createInsertSchema(shops).omit({
  id: true,
  installedAt: true,
});

export const insertInfluencerSchema = createInsertSchema(influencers).omit({
  id: true,
  createdAt: true,
});

export const insertSocialAccountSchema = createInsertSchema(socialAccounts).omit({
  id: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});

// Types
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

// Extended types for frontend
export type InfluencerWithSocials = Influencer & {
  socialAccounts: SocialAccount[];
};

export type CampaignWithInfluencer = Campaign & {
  influencer: Influencer;
};

export type CampaignWithStats = Campaign & {
  influencer: Influencer;
  clicks: number;
  addToCarts: number;
  orders: number;
  promoCodeUsage: number;
  revenue: number;
  totalCost: number;
  roi: number;
};
