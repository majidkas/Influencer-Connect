import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfluencerAvatar } from "@/components/influencer-avatar";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Megaphone, Tag, Percent, Copy, Check, Loader2, Filter, ShoppingBag, Home } from "lucide-react";
import { useI18n } from "@/lib/i18nContext";
import { useDate } from "@/lib/date-context";
import type { CampaignWithInfluencer, Influencer } from "@shared/schema";

// --- TYPES & SCHEMA ---

interface CampaignStats extends CampaignWithInfluencer {
  clicks: number;
  ordersUtm: number;
  revenueUtm: number;
  addToCarts: number;
  ordersPromo: number; // RECU DU BACKEND (Intersection)
  revenuePromo: number;
  fixedCost: number;
  commissionPercent: number;
  productImage?: string | null;
  productTitle?: string | null;
  currency?: string;
  promoCodeUsage?: number;
  createdAt?: string | Date;
}

const campaignFormSchema = z.object({
  influencerId: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  slugUtm: z.string().min(1, "Required"),
  promoCode: z.string().optional().or(z.literal("")),
  targetType: z.enum(["homepage", "product"]).default("product"),
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

const getCurrencySymbol = (currency = "EUR") => {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency })
      .formatToParts(0)
      .find(part => part.type === "currency")?.value || currency;
  } catch (e) {
    return currency;
  }
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
  onDelete 
}: { 
  campaign: CampaignStats; 
  onEdit: () => void; 
  onDelete: () => void; 
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // --- STATS D'AFFICHAGE ---
  // On se base PRINCIPALEMENT sur le tracking UTM pour les performances globales
  const revenue = campaign.revenueUtm;
  const orders = campaign.ordersUtm; 
  
  // Utilisation "Vérifiée" du Code Promo (Calculée par le backend via intersection)
  const promoCountDisplay = campaign.ordersPromo; 

  const commissionCost = revenue * (campaign.commissionPercent / 100);
  const totalCost = campaign.fixedCost + commissionCost;
  
  const roas = totalCost > 0 ? revenue / totalCost : 0;
  
  const convRate = campaign.clicks > 0 ? (orders / campaign.clicks) * 100 : 0;
  const clicksDisplay = campaign.clicks;

  const getSponsoredLink = () => {
    if (campaign.targetType === "homepage") {
      return `?utm_campaign=${campaign.slugUtm}`;
    }
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
      toast({ title: t("camp.link_copied") });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderTarget = () => {
    if (campaign.targetType === "homepage") {
      return (
        <div className="flex items-center gap-2 text-sm font-medium">
          <div className="h-8 w-8 bg-primary/10 rounded flex items-center justify-center text-primary">
            <Home className="h-4 w-4" />
          </div>
          <span>{t("camp.form.homepage")}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm font-medium overflow-hidden">
        {campaign.productImage ? (
          <img src={campaign.productImage} alt="Product" className="h-8 w-8 rounded object-cover flex-shrink-0" />
        ) : (
          <div className="h-8 w-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <span className="truncate" title={campaign.productTitle || "Product"}>
          {campaign.productTitle || "Product"}
        </span>
      </div>
    );
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
        
        <div className="bg-muted/30 p-2 rounded border border-border/50">
          {renderTarget()}
        </div>

        {/* AFFICHAGE CODE PROMO (Scénario 4: Si pas de code, rien ne s'affiche) */}
        {campaign.promoCode && (
          <div className="flex items-center justify-between text-xs mt-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{t("dash.col_promo")}:</span>
              <div className="flex items-center gap-1 font-mono font-medium bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100">
                <Tag className="h-3 w-3" />
                {campaign.promoCode}
              </div>
            </div>
            {/* Scénario 1, 2, 3, 5 : Affiche le résultat de l'intersection (0 ou 1) */}
            <span className="font-medium text-muted-foreground">
              {promoCountDisplay} {t("camp.used")}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-y-3 gap-x-2 pt-3 border-t mt-2">
          
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">{t("camp.clicks")}</span>
            <span className="font-medium">{clicksDisplay}</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-muted-foreground">{t("camp.conv")}</span>
            <span className="font-medium">{convRate.toFixed(1)}%</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">{t("camp.orders")}</span>
            <span className="font-medium">{orders}</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-muted-foreground">{t("camp.roas")}</span>
            <span className={`font-semibold ${roas >= 2 ? "text-green-600" : roas > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
              {roas.toFixed(2)}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">{t("camp.total_cost")}</span>
            <span className="font-medium">{formatCurrency(totalCost, campaign.currency)}</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-muted-foreground">{t("camp.cost_details")}</span>
            <span className="text-xs font-medium">
              {formatCurrency(campaign.fixedCost, campaign.currency).replace(",00", "")} | {campaign.commissionPercent}%
            </span>
          </div>

        </div>

        <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed">
           <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("camp.revenue")}</span>
           <span className="font-bold text-lg text-green-600">{formatCurrency(revenue, campaign.currency)}</span>
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
          <Pencil className="h-3 w-3 mr-1" /> {t("common.edit")}
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
  const { t } = useI18n();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const getSponsoredLink = () => {
    if (targetType === "homepage") {
      return `https://${shopDomain}?utm_campaign=${slugUtm}`;
    }
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
    toast({ title: t("camp.link_copied") });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2 p-3 bg-muted/30 rounded border">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {t("camp.form.gen_link")}
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
  currencySymbol = "€"
}: {
  campaign?: CampaignWithInfluencer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currencySymbol?: string;
}) {
  const { t } = useI18n();
  const { toast } = useToast();

  const { data: influencers } = useQuery<Influencer[]>({ queryKey: ["/api/influencers"] });
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

  const campaignName = form.watch("name");
  const currentSlug = form.watch("slugUtm");
  useEffect(() => {
    if (campaignName && !campaign) {
      const genSlug = generateSlug(campaignName);
      if (!currentSlug || currentSlug === generateSlug(campaignName.slice(0, -1))) {
        form.setValue("slugUtm", genSlug);
      }
    }
  }, [campaignName, campaign, form, currentSlug]);

  const mutationOpts = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      toast({ title: campaign ? t("camp.updated") : t("camp.created") });
      onOpenChange(false);
    },
    onError: () => toast({ title: t("common.error"), variant: "destructive" }),
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
          <DialogTitle>{campaign ? t("camp.form.edit_title") : t("camp.form.new_title")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField
              control={form.control}
              name="influencerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("camp.form.influencer")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("camp.form.select_inf")}>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("camp.form.name")}</FormLabel>
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
                    <FormLabel>{t("camp.form.slug")}</FormLabel>
                    <FormControl><Input placeholder="summer-sale" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="targetType"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>{t("camp.form.target")}</FormLabel>
                  <div className="flex gap-4">
                    <label className={`flex-1 border rounded p-3 cursor-pointer hover:bg-muted ${field.value === "homepage" ? "border-primary bg-primary/5" : ""}`}>
                       <div className="flex items-center gap-2">
                         <input type="radio" {...field} value="homepage" checked={field.value === "homepage"} className="accent-primary" />
                         <span className="font-medium">{t("camp.form.homepage")}</span>
                       </div>
                    </label>
                    <label className={`flex-1 border rounded p-3 cursor-pointer hover:bg-muted ${field.value === "product" ? "border-primary bg-primary/5" : ""}`}>
                       <div className="flex items-center gap-2">
                         <input type="radio" {...field} value="product" checked={field.value === "product"} className="accent-primary" />
                         <span className="font-medium">{t("camp.form.product")}</span>
                       </div>
                    </label>
                  </div>
                </FormItem>
              )}
            />

            {targetType === "product" && (
              <FormField
                control={form.control}
                name="productUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("camp.form.product")}</FormLabel>
                    {prodLoading ? (
                      <div className="text-sm text-muted-foreground flex gap-2"><Loader2 className="animate-spin h-4 w-4"/> {t("common.loading")}</div>
                    ) : (
                      <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("camp.form.select_prod")}>
                              {selectedProduct && <ProductSelectItem product={selectedProduct} />}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">{t("camp.form.no_prod")}</SelectItem>
                          {productsData?.products?.map((p) => {
                            const robustUrl = p.url && p.url.length > 0 
                              ? p.url 
                              : `https://${shopDomain}/products/${p.handle}`;
                              
                            return (
                              <SelectItem key={p.id} value={robustUrl}>
                                <ProductSelectItem product={p} />
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="promoCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("camp.form.promo")}</FormLabel>
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("camp.form.select_code")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t("camp.form.select_none")}</SelectItem>
                      {discountCodes?.codes?.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <SponsoredLinkCopier 
              productUrl={form.watch("productUrl") || ""} 
              slugUtm={form.watch("slugUtm")}
              targetType={targetType}
              shopDomain={shopDomain}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="costFixed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("camp.form.fixed_cost")}</FormLabel>
                    <div className="relative">
                      <div className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">
                        {currencySymbol}
                      </div>
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
                    <FormLabel>{t("camp.form.commission")}</FormLabel>
                    <div className="relative">
                      <Percent className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input type="number" className="pl-8" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {campaign ? t("common.update") : t("common.create")}
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
  const { t } = useI18n();
  const { from, to } = useDate(); // INTÉGRATION DE LA DATE
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignStats | undefined>();
  const [sortBy, setSortBy] = useState<string>("date_desc");
  
  const { toast } = useToast();

  // Requête API filtrée par date
  const { data: campaigns, isLoading } = useQuery<CampaignStats[]>({
    queryKey: ["/api/campaigns/stats", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/stats?from=${from}&to=${to}`);
      return res.json();
    },
  });

  const detectedCurrencySymbol = campaigns && campaigns.length > 0 
    ? getCurrencySymbol(campaigns[0].currency) 
    : "€";

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      toast({ title: t("common.deleted") });
    }
  });

  const handleDelete = (id: string) => {
    if (confirm(t("common.confirm_delete"))) deleteMutation.mutate(id);
  };

  // Tri côté client (adapté sans onglets)
  const sortedCampaigns = useMemo(() => {
    if (!campaigns) return [];
    
    return [...campaigns].sort((a, b) => {
      // Données "Utm" utilisées comme standard pour le tri
      const getStats = (c: CampaignStats) => {
        const rev = c.revenueUtm;
        const comm = rev * (c.commissionPercent / 100);
        const cost = c.fixedCost + comm;
        const roas = cost > 0 ? rev / cost : 0;
        return { rev, cost, roas, date: new Date(c.createdAt || 0).getTime() };
      };

      const statsA = getStats(a);
      const statsB = getStats(b);

      switch (sortBy) {
        case "date_desc": return statsB.date - statsA.date;
        case "date_asc": return statsA.date - statsB.date;
        case "rev_desc": return statsB.rev - statsA.rev;
        case "rev_asc": return statsA.rev - statsB.rev;
        case "roas_desc": return statsB.roas - statsA.roas;
        case "roas_asc": return statsA.roas - statsB.roas;
        case "cost_desc": return statsB.cost - statsA.cost;
        case "cost_asc": return statsA.cost - statsB.cost;
        default: return 0;
      }
    });
  }, [campaigns, sortBy]);

  return (
    <div className="p-6 space-y-6">
      
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t("camp.title")}</h1>
            <p className="text-muted-foreground">{t("camp.subtitle")}</p>
          </div>
          
          <div className="flex items-center gap-2">
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder={t("common.sort")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">{t("camp.sort_date_desc")}</SelectItem>
                <SelectItem value="date_asc">{t("camp.sort_date_asc")}</SelectItem>
                <SelectItem value="rev_desc">{t("camp.sort_rev_desc")}</SelectItem>
                <SelectItem value="rev_asc">{t("camp.sort_rev_asc")}</SelectItem>
                <SelectItem value="roas_desc">{t("camp.sort_roas_desc")}</SelectItem>
                <SelectItem value="roas_asc">{t("camp.sort_roas_asc")}</SelectItem>
                <SelectItem value="cost_desc">{t("camp.sort_cost_desc")}</SelectItem>
                <SelectItem value="cost_asc">{t("camp.sort_cost_asc")}</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={() => { setEditingCampaign(undefined); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              {t("camp.add_btn")}
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CampaignCardSkeleton key={i} />)}
        </div>
      ) : !sortedCampaigns || sortedCampaigns.length === 0 ? (
        <Card className="p-12 text-center">
           <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
           <h3 className="text-lg font-medium">{t("dash.no_campaigns")}</h3>
           <Button onClick={() => setDialogOpen(true)} className="mt-4">{t("camp.add_btn")}</Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedCampaigns.map((campaign) => (
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
        currencySymbol={detectedCurrencySymbol}
      />
    </div>
  );
}