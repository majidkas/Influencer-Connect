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
import { 
  Plus, Pencil, Trash2, Megaphone, Link as LinkIcon, Tag, DollarSign, 
  Percent, Copy, Check, Loader2, Filter, ShoppingBag 
} from "lucide-react";
import type { CampaignWithInfluencer, Influencer } from "@shared/schema";

// --- TYPES & SCHEMA ---

// Stats étendues pour l'affichage riche des cards
interface CampaignStats extends CampaignWithInfluencer {
  clicks?: number;
  orders?: number; // Total Orders
  revenue?: number; // Revenue 1
  revenuePromoOnly?: number; // Revenue 2
  conversionRate?: number;
  roas?: number;
  totalCost?: number;
  promoCodeUsage?: number;
}

const campaignFormSchema = z.object({
  influencerId: z.string().min(1, "Please select an influencer"),
  name: z.string().min(1, "Campaign name is required"),
  slugUtm: z.string().min(1, "UTM slug is required"),
  promoCode: z.string().optional().or(z.literal("")),
  targetType: z.enum(["homepage", "product"]).default("product"), // NOUVEAU
  productUrl: z.string().optional().or(z.literal("")),
  costFixed: z.number().min(0).default(0),
  commissionPercent: z.number().min(0).max(100).default(0),
  status: z.enum(["active", "paused", "completed"]).default("active"),
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  url: string;
}

const generateSlug = (name: string): string => {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
};

const formatCurrency = (amount: number, currency = "EUR"): string => {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
};

// --- COMPONENTS ---

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
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </CardContent>
    </Card>
  );
}

function CampaignCard({
  campaign,
  onEdit,
  onDelete,
}: {
  campaign: CampaignStats;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Construction dynamique du lien sponsorisé
  const getSponsoredLink = () => {
    // Si Homepage
    if (campaign.targetType === "homepage") {
      // On suppose que l'URL de base est connue ou on la construit simplement
      // Ici on utilise une URL générique si productUrl est vide, sinon on prend la racine
      const baseUrl = campaign.productUrl ? new URL(campaign.productUrl).origin : `https://${campaign.shopId || "myshopify.com"}`; 
      // Note: shopId est numérique dans le schema, donc on fait au mieux. 
      // L'idéal est d'avoir le shopDomain stocké.
      // Pour l'affichage, on va utiliser une astuce : si productUrl est vide, on prend juste le slug.
      return `?utm_campaign=${campaign.slugUtm}`; // Lien relatif pour l'affichage simple
    }
    // Si Produit
    if (campaign.productUrl && campaign.slugUtm) {
      const separator = campaign.productUrl.includes("?") ? "&" : "?";
      return `${campaign.productUrl}${separator}utm_campaign=${campaign.slugUtm}`;
    }
    return null;
  };

  const fullLink = getSponsoredLink();

  const handleCopyLink = async () => {
    if (fullLink) {
      await navigator.clipboard.writeText(fullLink);
      setCopied(true);
      toast({ title: "Lien sponsorisé copié" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="hover-elevate flex flex-col h-full" data-testid={`card-campaign-${campaign.id}`}>
      <CardHeader className="flex flex-row items-start gap-3 pb-2">
        <InfluencerAvatar
          name={campaign.influencer?.name || "?"}
          imageUrl={campaign.influencer?.profileImageUrl}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate text-base" title={campaign.name}>
            {campaign.name}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span className="truncate max-w-[100px]">{campaign.influencer?.name}</span>
            <StatusBadge status={campaign.status || "active"} />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 flex-1 text-sm">
        {/* Target Info */}
        <div className="flex items-center gap-2 text-xs bg-muted/50 p-2 rounded">
          {campaign.targetType === 'homepage' ? (
            <span className="font-semibold text-primary">🏠 Homepage</span>
          ) : (
             <span className="truncate" title={campaign.productUrl || ""}>🛍️ Product</span>
          )}
          <span className="text-muted-foreground mx-1">|</span>
          <code className="text-xs truncate flex-1">{campaign.slugUtm}</code>
        </div>

        {/* Promo Code */}
        {campaign.promoCode && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Promo Code:</span>
            <div className="flex items-center gap-1 font-mono font-medium bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100">
              <Tag className="h-3 w-3" />
              {campaign.promoCode}
              <span className="text-muted-foreground ml-1">({campaign.promoCodeUsage || 0})</span>
            </div>
          </div>
        )}

        {/* STATS GRID - ENRICHIE */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          
          {/* Revenue 1 */}
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">Rev (1) Link+Code</span>
            <span className="font-semibold text-green-600">{formatCurrency(campaign.revenue || 0)}</span>
          </div>

          {/* Revenue 2 */}
          <div className="flex flex-col">
             <span className="text-[10px] text-muted-foreground">Rev (2) Code Only</span>
             <span className="font-semibold text-blue-600">{formatCurrency(campaign.revenuePromoOnly || 0)}</span>
          </div>

          {/* ROAS & Cost */}
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">ROAS</span>
            <span className={`font-semibold ${campaign.roas && campaign.roas >= 2 ? "text-green-600" : "text-orange-600"}`}>
              {campaign.roas?.toFixed(2) || "0.00"}
            </span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">Total Cost</span>
            <span className="font-medium">{formatCurrency(campaign.totalCost || 0)}</span>
          </div>

          {/* Conv Rate & Orders */}
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">Conv. Rate</span>
            <span className="font-medium">{campaign.conversionRate?.toFixed(1) || "0.0"}%</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">Orders</span>
            <span className="font-medium">{campaign.orders || 0}</span>
          </div>

        </div>
      </CardContent>

      <CardFooter className="flex justify-end gap-2 pt-2 border-t bg-muted/10">
        {fullLink && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleCopyLink}
            title="Copy Link"
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-8 px-2 text-xs"
        >
          <Pencil className="h-3 w-3 mr-1" /> Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-8 px-2 text-xs text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </CardFooter>
    </Card>
  );
}

// --- FORM COMPONENTS ---

function InfluencerSelectItem({ influencer }: { influencer: Influencer }) {
  return (
    <div className="flex items-center gap-3">
      <InfluencerAvatar name={influencer.name} imageUrl={influencer.profileImageUrl} size="sm" />
      <span>{influencer.name}</span>
    </div>
  );
}

function ProductSelectItem({ product }: { product: ShopifyProduct }) {
  return (
    <div className="flex items-center gap-3">
      {product.imageUrl ? (
        <img src={product.imageUrl} alt={product.title} className="h-8 w-8 object-cover rounded" />
      ) : (
        <div className="h-8 w-8 bg-muted rounded flex items-center justify-center">
          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <span className="truncate">{product.title}</span>
    </div>
  );
}

function SponsoredLinkCopier({ 
  productUrl, 
  slugUtm, 
  targetType, 
  shopDomain 
}: { 
  productUrl: string; 
  slugUtm: string;
  targetType: "homepage" | "product";
  shopDomain: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const getSponsoredLink = () => {
    // Si Homepage : https://{shop-domain}?utm_campaign={slug}
    if (targetType === "homepage") {
      return `https://${shopDomain}?utm_campaign=${slugUtm}`;
    }
    // Si Product : productUrl?utm...
    if (productUrl && slugUtm) {
      const separator = productUrl.includes("?") ? "&" : "?";
      return `${productUrl}${separator}utm_campaign=${slugUtm}`;
    }
    return "Complete form to generate link...";
  };

  const link = getSponsoredLink();

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: "Link copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2 p-3 bg-muted/30 rounded border">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Generated Sponsored Link
      </label>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-background px-3 py-2 rounded border text-xs break-all text-muted-foreground">
          {link}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={handleCopyLink}>
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

  const { data: influencers } = useQuery<Influencer[]>({ queryKey: ["/api/influencers"] });
  
  // Hardcoded shop domain fallback, ideally fetched from context or API
  const shopDomain = "clikn01.myshopify.com"; 

  const { data: discountCodes, isLoading: codesLoading } = useQuery<{ codes: any[] }>({
    queryKey: ["/api/shopify/discount-codes", shopDomain],
    queryFn: async () => {
      const res = await fetch(`/api/shopify/discount-codes?shop=${shopDomain}`);
      return res.json();
    },
  });

  const { data: productsData, isLoading: prodLoading } = useQuery<{ products: ShopifyProduct[] }>({
    queryKey: ["/api/shopify/products", shopDomain],
    queryFn: async () => {
      const res = await fetch(`/api/shopify/products?shop=${shopDomain}`);
      return res.json();
    },
  });

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      influencerId: "",
      name: "",
      slugUtm: "",
      promoCode: "",
      targetType: "product",
      productUrl: "",
      costFixed: 0,
      commissionPercent: 0,
      status: "active",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        influencerId: campaign?.influencerId || "",
        name: campaign?.name || "",
        slugUtm: campaign?.slugUtm || "",
        promoCode: campaign?.promoCode || "",
        targetType: (campaign?.targetType as "homepage" | "product") || "product",
        productUrl: campaign?.productUrl || "",
        costFixed: campaign?.costFixed || 0,
        commissionPercent: campaign?.commissionPercent || 0,
        status: (campaign?.status as any) || "active",
      });
    }
  }, [open, campaign, form]);

  // Auto-slug
  const campaignName = form.watch("name");
  const currentSlug = form.watch("slugUtm");
  useEffect(() => {
    if (campaignName && !campaign) {
      const genSlug = generateSlug(campaignName);
      // Only update if empty or matches previous auto-gen
      if (!currentSlug || currentSlug === generateSlug(campaignName.slice(0, -1))) {
        form.setValue("slugUtm", genSlug);
      }
    }
  }, [campaignName, campaign, form, currentSlug]);

  const mutationOpts = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      toast({ title: campaign ? "Updated" : "Created" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  };

  const createMutation = useMutation({
    mutationFn: (data: CampaignFormData) => apiRequest("POST", "/api/campaigns", data),
    ...mutationOpts,
  });

  const updateMutation = useMutation({
    mutationFn: (data: CampaignFormData) => apiRequest("PUT", `/api/campaigns/${campaign?.id}`, data),
    ...mutationOpts,
  });

  const onSubmit = (data: CampaignFormData) => {
    if (campaign) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  const selectedInfluencer = influencers?.find((i) => i.id === form.watch("influencerId"));
  const selectedProduct = productsData?.products?.find((p) => p.url === form.watch("productUrl"));
  const targetType = form.watch("targetType");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit Campaign" : "New Campaign"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            {/* Influencer Select */}
            <FormField
              control={form.control}
              name="influencerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Influencer</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Influencer">
                          {selectedInfluencer && <InfluencerSelectItem influencer={selectedInfluencer} />}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {influencers?.map((inf) => (
                        <SelectItem key={inf.id} value={inf.id}>
                          <InfluencerSelectItem influencer={inf} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campaign Name + Slug */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input placeholder="Summer Sale" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slugUtm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UTM Slug</FormLabel>
                    <FormControl><Input placeholder="summer-sale" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* TARGET TYPE SELECTION */}
            <FormField
              control={form.control}
              name="targetType"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Target Type</FormLabel>
                  <div className="flex gap-4">
                    <label className={`flex-1 border rounded p-3 cursor-pointer hover:bg-muted ${field.value === "homepage" ? "border-primary bg-primary/5" : ""}`}>
                       <div className="flex items-center gap-2">
                         <input type="radio" {...field} value="homepage" checked={field.value === "homepage"} className="accent-primary" />
                         <span className="font-medium">Homepage</span>
                       </div>
                       <p className="text-xs text-muted-foreground pl-6 mt-1">Directs traffic to your main store URL.</p>
                    </label>
                    <label className={`flex-1 border rounded p-3 cursor-pointer hover:bg-muted ${field.value === "product" ? "border-primary bg-primary/5" : ""}`}>
                       <div className="flex items-center gap-2">
                         <input type="radio" {...field} value="product" checked={field.value === "product"} className="accent-primary" />
                         <span className="font-medium">Product</span>
                       </div>
                       <p className="text-xs text-muted-foreground pl-6 mt-1">Directs traffic to a specific product page.</p>
                    </label>
                  </div>
                </FormItem>
              )}
            />

            {/* PRODUCT SELECT (Only if targetType == product) */}
            {targetType === "product" && (
              <FormField
                control={form.control}
                name="productUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product</FormLabel>
                    {prodLoading ? (
                      <div className="text-sm text-muted-foreground flex gap-2"><Loader2 className="animate-spin h-4 w-4"/> Loading...</div>
                    ) : (
                      <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Product">
                              {selectedProduct && <ProductSelectItem product={selectedProduct} />}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Product</SelectItem>
                          {productsData?.products?.map((p) => (
                            <SelectItem key={p.id} value={p.url}>
                              <ProductSelectItem product={p} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Promo Code */}
            <FormField
              control={form.control}
              name="promoCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Promo Code (Optional)</FormLabel>
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select or type code" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {discountCodes?.codes?.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Used to track Revenue (2) even without link clicks.</FormDescription>
                </FormItem>
              )}
            />

            {/* LINK PREVIEW */}
            <SponsoredLinkCopier 
              productUrl={form.watch("productUrl") || ""} 
              slugUtm={form.watch("slugUtm")}
              targetType={targetType}
              shopDomain={shopDomain}
            />

            {/* COSTS */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="costFixed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fixed Cost</FormLabel>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input type="number" className="pl-8" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="commissionPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commission %</FormLabel>
                    <div className="relative">
                      <Percent className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input type="number" className="pl-8" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {campaign ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// --- MAIN PAGE ---

export default function Campaigns() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignStats | undefined>();
  const [sortBy, setSortBy] = useState<string>("recent");
  const { toast } = useToast();

  // Fetch avec paramètre de tri
  const { data: campaigns, isLoading } = useQuery<CampaignStats[]>({
    queryKey: ["/api/campaigns/stats", sortBy],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/stats?sort=${sortBy}`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      toast({ title: "Deleted" });
    }
  });

  const handleDelete = (id: string) => {
    if (confirm("Delete this campaign?")) deleteMutation.mutate(id);
  };

  return (
    <div className="p-6 space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="text-muted-foreground">Manage your influencer marketing campaigns</p>
          {/* LEGEND REVENUE */}
          <p className="text-xs text-muted-foreground mt-1">
            <span className="font-medium">(1) Revenue from UTM links + Promo code</span> • 
            <span className="font-medium ml-1">(2) Revenue from promo codes only</span>
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* SORT DROPDOWN */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="revenue_high">Highest Revenue</SelectItem>
              <SelectItem value="revenue_low">Lowest Revenue</SelectItem>
              <SelectItem value="roas_high">Highest ROAS</SelectItem>
              <SelectItem value="roas_low">Lowest ROAS</SelectItem>
              <SelectItem value="cost_high">Highest Cost</SelectItem>
              <SelectItem value="cost_low">Lowest Cost</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => { setEditingCampaign(undefined); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </Button>
        </div>
      </div>

      {/* CONTENT */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CampaignCardSkeleton key={i} />)}
        </div>
      ) : !campaigns || campaigns.length === 0 ? (
        <Card className="p-12 text-center">
           <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
           <h3 className="text-lg font-medium">No campaigns yet</h3>
           <Button onClick={() => setDialogOpen(true)} className="mt-4">Create Campaign</Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onEdit={() => { setEditingCampaign(campaign); setDialogOpen(true); }}
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