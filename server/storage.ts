import {
  influencers,
  socialAccounts,
  campaigns,
  events,
  type Influencer,
  type InsertInfluencer,
  type SocialAccount,
  type InsertSocialAccount,
  type Campaign,
  type InsertCampaign,
  type Event,
  type InsertEvent,
  type InfluencerWithSocials,
  type CampaignWithInfluencer,
  type CampaignWithStats,
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, and, count } from "drizzle-orm";

export interface IStorage {
  // Influencers
  getInfluencers(): Promise<InfluencerWithSocials[]>;
  getInfluencer(id: string): Promise<InfluencerWithSocials | undefined>;
  createInfluencer(data: InsertInfluencer, socialAccountsData?: Omit<InsertSocialAccount, "influencerId">[]): Promise<Influencer>;
  updateInfluencer(id: string, data: Partial<InsertInfluencer>, socialAccountsData?: Omit<InsertSocialAccount, "influencerId">[]): Promise<Influencer | undefined>;
  deleteInfluencer(id: string): Promise<boolean>;

  // Social Accounts
  getSocialAccountsByInfluencer(influencerId: string): Promise<SocialAccount[]>;
  createSocialAccount(data: InsertSocialAccount): Promise<SocialAccount>;
  deleteSocialAccountsByInfluencer(influencerId: string): Promise<void>;

  // Campaigns
  getCampaigns(): Promise<CampaignWithInfluencer[]>;
  getCampaign(id: string): Promise<CampaignWithInfluencer | undefined>;
  getCampaignsWithStats(): Promise<CampaignWithStats[]>;
  createCampaign(data: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, data: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: string): Promise<boolean>;

  // Events
  createEvent(data: InsertEvent): Promise<Event>;
  getEventsByCampaign(campaignId: string): Promise<Event[]>;

  // Stats
  getStats(): Promise<{
    totalInfluencers: number;
    activeCampaigns: number;
    totalRevenue: number;
    averageRoi: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Influencers
  async getInfluencers(): Promise<InfluencerWithSocials[]> {
    const allInfluencers = await db.select().from(influencers).orderBy(influencers.createdAt);
    const allSocialAccounts = await db.select().from(socialAccounts);

    return allInfluencers.map((inf) => ({
      ...inf,
      socialAccounts: allSocialAccounts.filter((sa) => sa.influencerId === inf.id),
    }));
  }

  async getInfluencer(id: string): Promise<InfluencerWithSocials | undefined> {
    const [influencer] = await db.select().from(influencers).where(eq(influencers.id, id));
    if (!influencer) return undefined;

    const influencerSocials = await db
      .select()
      .from(socialAccounts)
      .where(eq(socialAccounts.influencerId, id));

    return { ...influencer, socialAccounts: influencerSocials };
  }

  async createInfluencer(
    data: InsertInfluencer,
    socialAccountsData?: Omit<InsertSocialAccount, "influencerId">[]
  ): Promise<Influencer> {
    const [influencer] = await db.insert(influencers).values(data).returning();

    if (socialAccountsData && socialAccountsData.length > 0) {
      await db.insert(socialAccounts).values(
        socialAccountsData.map((sa) => ({
          ...sa,
          influencerId: influencer.id,
        }))
      );
    }

    return influencer;
  }

  async updateInfluencer(
    id: string,
    data: Partial<InsertInfluencer>,
    socialAccountsData?: Omit<InsertSocialAccount, "influencerId">[]
  ): Promise<Influencer | undefined> {
    const [influencer] = await db
      .update(influencers)
      .set(data)
      .where(eq(influencers.id, id))
      .returning();

    if (!influencer) return undefined;

    if (socialAccountsData !== undefined) {
      await db.delete(socialAccounts).where(eq(socialAccounts.influencerId, id));
      if (socialAccountsData.length > 0) {
        await db.insert(socialAccounts).values(
          socialAccountsData.map((sa) => ({
            ...sa,
            influencerId: id,
          }))
        );
      }
    }

    return influencer;
  }

  async deleteInfluencer(id: string): Promise<boolean> {
    const result = await db.delete(influencers).where(eq(influencers.id, id)).returning();
    return result.length > 0;
  }

  // Social Accounts
  async getSocialAccountsByInfluencer(influencerId: string): Promise<SocialAccount[]> {
    return db.select().from(socialAccounts).where(eq(socialAccounts.influencerId, influencerId));
  }

  async createSocialAccount(data: InsertSocialAccount): Promise<SocialAccount> {
    const [account] = await db.insert(socialAccounts).values(data).returning();
    return account;
  }

  async deleteSocialAccountsByInfluencer(influencerId: string): Promise<void> {
    await db.delete(socialAccounts).where(eq(socialAccounts.influencerId, influencerId));
  }

  // Campaigns
  async getCampaigns(): Promise<CampaignWithInfluencer[]> {
    const allCampaigns = await db.select().from(campaigns).orderBy(campaigns.createdAt);
    const allInfluencers = await db.select().from(influencers);

    return allCampaigns.map((campaign) => ({
      ...campaign,
      influencer: allInfluencers.find((inf) => inf.id === campaign.influencerId)!,
    }));
  }

  async getCampaign(id: string): Promise<CampaignWithInfluencer | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    if (!campaign) return undefined;

    const [influencer] = await db
      .select()
      .from(influencers)
      .where(eq(influencers.id, campaign.influencerId));

    return { ...campaign, influencer };
  }

  async getCampaignsWithStats(): Promise<CampaignWithStats[]> {
    const allCampaigns = await db.select().from(campaigns).orderBy(campaigns.createdAt);
    const allInfluencers = await db.select().from(influencers);
    const allEvents = await db.select().from(events);

    return allCampaigns.map((campaign) => {
      const campaignEvents = allEvents.filter((e) => e.campaignId === campaign.id);
      const clicks = campaignEvents.filter((e) => e.eventType === "click").length;
      const addToCarts = campaignEvents.filter((e) => e.eventType === "add_to_cart").length;
      const purchases = campaignEvents.filter((e) => e.eventType === "purchase");
      const orders = purchases.length;
      const promoCodeUsage = purchases.filter((e) => e.source === "promo_code").length;
      const revenue = purchases.reduce((sum, e) => sum + (e.revenue || 0), 0);
      const commissionCost = revenue * ((campaign.commissionPercent || 0) / 100);
      const totalCost = (campaign.costFixed || 0) + commissionCost;
      const roi = totalCost > 0 ? ((revenue - totalCost) / totalCost) * 100 : 0;

      return {
        ...campaign,
        influencer: allInfluencers.find((inf) => inf.id === campaign.influencerId)!,
        clicks,
        addToCarts,
        orders,
        promoCodeUsage,
        revenue,
        totalCost,
        roi,
      };
    });
  }

  async createCampaign(data: InsertCampaign): Promise<Campaign> {
    const [campaign] = await db.insert(campaigns).values(data).returning();
    return campaign;
  }

  async updateCampaign(id: string, data: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    const [campaign] = await db
      .update(campaigns)
      .set(data)
      .where(eq(campaigns.id, id))
      .returning();
    return campaign;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    const result = await db.delete(campaigns).where(eq(campaigns.id, id)).returning();
    return result.length > 0;
  }

  // Events
  async createEvent(data: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(data).returning();
    return event;
  }

  async getEventsByCampaign(campaignId: string): Promise<Event[]> {
    return db.select().from(events).where(eq(events.campaignId, campaignId));
  }

  // Stats
  async getStats(): Promise<{
    totalInfluencers: number;
    activeCampaigns: number;
    totalRevenue: number;
    averageRoi: number;
  }> {
    const [influencerCount] = await db
      .select({ count: count() })
      .from(influencers);

    const [activeCampaignCount] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(eq(campaigns.status, "active"));

    const allEvents = await db
      .select()
      .from(events)
      .where(eq(events.eventType, "purchase"));

    const totalRevenue = allEvents.reduce((sum, e) => sum + (e.revenue || 0), 0);

    const campaignsWithStats = await this.getCampaignsWithStats();
    const totalRoi = campaignsWithStats.reduce((sum, c) => sum + c.roi, 0);
    const averageRoi = campaignsWithStats.length > 0 ? totalRoi / campaignsWithStats.length : 0;

    return {
      totalInfluencers: influencerCount?.count || 0,
      activeCampaigns: activeCampaignCount?.count || 0,
      totalRevenue,
      averageRoi,
    };
  }
}

export const storage = new DatabaseStorage();
