import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfluencerAvatar } from "@/components/influencer-avatar";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Megaphone, Link as LinkIcon, Tag, DollarSign, Percent, Copy, Check } from "lucide-react";
import type { CampaignWithInfluencer, Influencer } from "@shared/schema";

const campaignFormSchema = z.object({
  influencerId: z.string().min(1, "Please select an influencer"),
  name: z.string().min(1, "Campaign name is required"),
  slugUtm: z.string().min(1, "UTM slug is required"),
  promoCode: z.string().optional().or(z.literal("")),
  productUrl: z.string().optional().or(z.literal("")),
  costFixed: z.number().min(0).default(0),
  commissionPercent: z.number().min(0).max(100).default(0),
  status: z.enum(["active", "paused", "completed"]).default("active"),
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

function CampaignCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-28" />
      </CardContent>
    </Card>
  );
}

function CampaignCard({
  campaign,
  onEdit,
  onDelete,
}: {
  campaign: CampaignWithInfluencer;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const getSponsoredLink = () => {
    if (campaign.productUrl && campaign.slugUtm) {
      const separator = campaign.productUrl.includes("?") ? "&" : "?";
      return `${campaign.productUrl}${separator}utm_campaign=${campaign.slugUtm}`;
    }
    return null;
  };

  const handleCopyLink = async () => {
    const link = getSponsoredLink();
    if (link) {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: "Lien sponsorisé copié" });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({ title: "URL produit manquante", variant: "destructive" });
    }
  };

  const sponsoredLink = getSponsoredLink();

  return (
    <Card className="hover-elevate" data-testid={`card-campaign-${campaign.id}`}>
      <CardHeader className="flex flex-row items-start gap-4 pb-2">
        <InfluencerAvatar
          name={campaign.influencer.name}
          imageUrl={campaign.influencer.profileImageUrl}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate" data-testid="text-campaign-name">
            {campaign.name}
          </h3>
          <p className="text-sm text-muted-foreground truncate">
            {campaign.influencer.name}
          </p>
        </div>
        <StatusBadge status={campaign.status || "active"} />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <LinkIcon className="h-4 w-4 text-muted-foreground" />
          <code className="bg-muted px-2 py-0.5 rounded text-xs truncate max-w-[200px]">
            {campaign.slugUtm}
          </code>
        </div>
        {campaign.promoCode && (
          <div className="flex items-center gap-2 text-sm">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono font-medium">{campaign.promoCode}</span>
          </div>
        )}
        <div className="flex items-center gap-4 text-sm pt-2 text-muted-foreground">
          <div className="flex items-center gap-1">
            <DollarSign className="h-4 w-4" />
            <span>{formatCurrency(campaign.costFixed || 0)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Percent className="h-4 w-4" />
            <span>{campaign.commissionPercent || 0}%</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2 pt-2 flex-wrap">
        {sponsoredLink && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            data-testid="button-copy-sponsored-link"
          >
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            Lien sponsorisé
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          data-testid="button-edit-campaign"
        >
          <Pencil className="h-4 w-4 mr-1" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
          data-testid="button-delete-campaign"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}

function InfluencerSelectItem({ influencer }: { influencer: Influencer }) {
  return (
    <div className="flex items-center gap-3">
      <InfluencerAvatar
        name={influencer.name}
        imageUrl={influencer.profileImageUrl}
        size="sm"
      />
      <span>{influencer.name}</span>
    </div>
  );
}

function SponsoredLinkCopier({ productUrl, slugUtm }: { productUrl: string; slugUtm: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const getSponsoredLink = () => {
    if (productUrl && slugUtm) {
      const separator = productUrl.includes("?") ? "&" : "?";
      return `${productUrl}${separator}utm_campaign=${slugUtm}`;
    }
    return null;
  };

  const handleCopyLink = async () => {
    const link = getSponsoredLink();
    if (link) {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: "Lien sponsorisé copié" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sponsoredLink = getSponsoredLink();

  if (!sponsoredLink) {
    return null;
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Lien sponsorisé complet</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-muted px-3 py-2 rounded-md text-xs break-all">
          {sponsoredLink}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          data-testid="button-copy-form-link"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function CampaignFormDialog({
  campaign,
  open,
  onOpenChange,
}: {
  campaign?: CampaignWithInfluencer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const { data: influencers } = useQuery<Influencer[]>({
    queryKey: ["/api/influencers"],
  });

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      influencerId: campaign?.influencerId || "",
      name: campaign?.name || "",
      slugUtm: campaign?.slugUtm || "",
      promoCode: campaign?.promoCode || "",
      productUrl: campaign?.productUrl || "",
      costFixed: campaign?.costFixed || 0,
      commissionPercent: campaign?.commissionPercent || 0,
      status: (campaign?.status as "active" | "paused" | "completed") || "active",
    },
  });

  const campaignName = form.watch("name");
  const slugUtm = form.watch("slugUtm");

  useEffect(() => {
    if (campaignName && !campaign) {
      const generatedSlug = generateSlug(campaignName);
      if (slugUtm === "" || slugUtm === generateSlug(form.getValues("name").slice(0, -1))) {
        form.setValue("slugUtm", generatedSlug);
      }
    }
  }, [campaignName, campaign, form, slugUtm]);

  const createMutation = useMutation({
    mutationFn: async (data: CampaignFormData) => {
      const response = await apiRequest("POST", "/api/campaigns", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Campaign created successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to create campaign", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CampaignFormData) => {
      const response = await apiRequest("PATCH", `/api/campaigns/${campaign?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Campaign updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to update campaign", variant: "destructive" });
    },
  });

  const onSubmit = (data: CampaignFormData) => {
    if (campaign) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const selectedInfluencer = influencers?.find((i) => i.id === form.watch("influencerId"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {campaign ? "Edit Campaign" : "Create New Campaign"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="influencerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Influencer *</FormLabel>
                  {campaign ? (
                    <div className="flex items-center gap-3 p-2 bg-muted rounded-md opacity-70">
                      <InfluencerAvatar
                        name={campaign.influencer.name}
                        imageUrl={campaign.influencer.profileImageUrl}
                        size="sm"
                      />
                      <span className="text-sm">{campaign.influencer.name}</span>
                    </div>
                  ) : (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-influencer">
                          <SelectValue placeholder="Select an influencer">
                            {selectedInfluencer && (
                              <InfluencerSelectItem influencer={selectedInfluencer} />
                            )}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {influencers?.map((influencer) => (
                          <SelectItem
                            key={influencer.id}
                            value={influencer.id}
                            data-testid={`option-influencer-${influencer.id}`}
                          >
                            <InfluencerSelectItem influencer={influencer} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Summer Collection 2026"
                      {...field}
                      data-testid="input-campaign-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slugUtm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>UTM Slug *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="summer-collection-2026"
                      {...field}
                      data-testid="input-utm-slug"
                    />
                  </FormControl>
                  <FormDescription>
                    Auto-generated from campaign name. You can modify it.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="promoCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Promo Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="SARAH20"
                      {...field}
                      value={field.value || ""}
                      className="uppercase"
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      data-testid="input-promo-code"
                    />
                  </FormControl>
                  <FormDescription>
                    Used for secure attribution tracking
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="productUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://your-store.myshopify.com/products/summer-dress"
                      {...field}
                      value={field.value || ""}
                      data-testid="input-product-url"
                    />
                  </FormControl>
                  <FormDescription>
                    The Shopify product page for this campaign
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SponsoredLinkCopier 
              productUrl={form.watch("productUrl") || ""} 
              slugUtm={form.watch("slugUtm")} 
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="costFixed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fixed Cost ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="500"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        data-testid="input-cost-fixed"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="commissionPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commission (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        placeholder="10"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        data-testid="input-commission"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {campaign && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-campaign">
                {isPending ? "Saving..." : campaign ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Campaigns() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignWithInfluencer | undefined>();
  const { toast } = useToast();

  const { data: campaigns, isLoading } = useQuery<CampaignWithInfluencer[]>({
    queryKey: ["/api/campaigns"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/campaigns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Campaign deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete campaign", variant: "destructive" });
    },
  });

  const handleEdit = (campaign: CampaignWithInfluencer) => {
    setEditingCampaign(campaign);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingCampaign(undefined);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this campaign?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Campaigns</h1>
          <p className="text-muted-foreground">
            Create and manage your influencer marketing campaigns
          </p>
        </div>
        <Button onClick={handleCreate} data-testid="button-add-campaign">
          <Plus className="h-4 w-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CampaignCardSkeleton key={i} />
          ))}
        </div>
      ) : !campaigns || campaigns.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Create your first campaign to start tracking influencer performance.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onEdit={() => handleEdit(campaign)}
              onDelete={() => handleDelete(campaign.id)}
            />
          ))}
        </div>
      )}

      <CampaignFormDialog
        campaign={editingCampaign}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
