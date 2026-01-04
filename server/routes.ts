import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertInfluencerSchema, insertCampaignSchema, insertEventSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ============ STATS ============
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ============ INFLUENCERS ============
  app.get("/api/influencers", async (req, res) => {
    try {
      const influencers = await storage.getInfluencers();
      res.json(influencers);
    } catch (error) {
      console.error("Error fetching influencers:", error);
      res.status(500).json({ message: "Failed to fetch influencers" });
    }
  });

  app.get("/api/influencers/:id", async (req, res) => {
    try {
      const influencer = await storage.getInfluencer(req.params.id);
      if (!influencer) {
        return res.status(404).json({ message: "Influencer not found" });
      }
      res.json(influencer);
    } catch (error) {
      console.error("Error fetching influencer:", error);
      res.status(500).json({ message: "Failed to fetch influencer" });
    }
  });

  app.post("/api/influencers", async (req, res) => {
    try {
      const schema = insertInfluencerSchema.extend({
        socialAccounts: z.array(z.object({
          platform: z.string(),
          handle: z.string(),
          followersCount: z.number().optional(),
        })).optional(),
      });

      const data = schema.parse(req.body);
      const { socialAccounts, ...influencerData } = data;

      const influencer = await storage.createInfluencer(influencerData, socialAccounts);
      res.status(201).json(influencer);
    } catch (error) {
      console.error("Error creating influencer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create influencer" });
    }
  });

  app.patch("/api/influencers/:id", async (req, res) => {
    try {
      const schema = insertInfluencerSchema.partial().extend({
        socialAccounts: z.array(z.object({
          platform: z.string(),
          handle: z.string(),
          followersCount: z.number().optional(),
        })).optional(),
      });

      const data = schema.parse(req.body);
      const { socialAccounts, ...influencerData } = data;

      const influencer = await storage.updateInfluencer(req.params.id, influencerData, socialAccounts);
      if (!influencer) {
        return res.status(404).json({ message: "Influencer not found" });
      }
      res.json(influencer);
    } catch (error) {
      console.error("Error updating influencer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update influencer" });
    }
  });

  app.delete("/api/influencers/:id", async (req, res) => {
    try {
      const success = await storage.deleteInfluencer(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Influencer not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting influencer:", error);
      res.status(500).json({ message: "Failed to delete influencer" });
    }
  });

  // ============ CAMPAIGNS ============
  app.get("/api/campaigns", async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/campaigns/stats", async (req, res) => {
    try {
      const campaigns = await storage.getCampaignsWithStats();
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaign stats:", error);
      res.status(500).json({ message: "Failed to fetch campaign stats" });
    }
  });

  app.get("/api/campaigns/:id", async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Error fetching campaign:", error);
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  app.post("/api/campaigns", async (req, res) => {
    try {
      const data = insertCampaignSchema.parse(req.body);
      const campaign = await storage.createCampaign(data);
      res.status(201).json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });

  app.patch("/api/campaigns/:id", async (req, res) => {
    try {
      const data = insertCampaignSchema.partial().parse(req.body);
      const campaign = await storage.updateCampaign(req.params.id, data);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Error updating campaign:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });

  app.delete("/api/campaigns/:id", async (req, res) => {
    try {
      const success = await storage.deleteCampaign(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  // ============ EVENTS ============
  app.post("/api/events", async (req, res) => {
    try {
      const data = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(data);
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  app.get("/api/campaigns/:id/events", async (req, res) => {
    try {
      const events = await storage.getEventsByCampaign(req.params.id);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  return httpServer;
}
