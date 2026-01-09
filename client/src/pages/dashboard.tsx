import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InfluencerAvatar } from "@/components/influencer-avatar";
import { RoiBadge } from "@/components/roi-badge";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, Megaphone, DollarSign, TrendingUp, MousePointer, ShoppingCart, 
  Package, Tag, Copy, Check, Link, CreditCard, Home 
} from "lucide-react";
import type { CampaignWithStats } from "@shared/schema";

// --- TYPES ---
interface CampaignDashboardStats extends CampaignWithStats {
  ordersUtm: number;
  revenueUtm: number;
  ordersPromo: number;
  revenuePromo: number;
  clicks: number;
  addToCarts: number;
  fixedCost: number;
  commissionPercent: number;
  currency?: string;
  productImage?: string | null;
  productTitle?: string | null;
  targetType?: string;
}

const formatCurrency = (amount: number, currency: string = "EUR"): string => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency,
  }).format(amount);
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("en-US").format(num);
};

// ... (StatCard, DashboardTableSkeleton, TargetCell identiques au précédent envoi)
// ... Je remets TargetCell pour la complétude

function TargetCell({ campaign }: { campaign: CampaignDashboardStats }) {
  if (campaign.targetType === "homepage") {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 bg-muted rounded flex items-center justify-center text-muted-foreground">
          <Home className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium">Homepage</span>
      </div>
    );
  }
  const productTitle = campaign.productTitle;
  const productImage = campaign.productImage;
  
  if (!productTitle && !campaign.productUrl) return <span className="text-muted-foreground">-</span>;
  const displayName = productTitle || "Product";

  return (
    <div className="flex items-center gap-2 max-w-[180px]">
      {productImage ? (
        <img src={productImage} alt={displayName} className="h-8 w-8 object-cover rounded flex-shrink-0" />
      ) : (
        <div className="h-8 w-8 bg-muted rounded flex-shrink-0" />
      )}
      <span className="text-sm truncate capitalize">{displayName}</span>
    </div>
  );
}

function CopyLinkButton({ campaign }: { campaign: CampaignDashboardStats }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const getSponsoredLink = () => {
    if (campaign.targetType === "homepage") return `?utm_campaign=${campaign.slugUtm}`;
    if (campaign.productUrl && campaign.slugUtm) {
      const separator = campaign.productUrl.includes("?") ? "&" : "?";
      return `${campaign.productUrl}${separator}utm_campaign=${campaign.slugUtm}`;
    }
    return null;
  };
  const handleCopy = async () => {
    const link = getSponsoredLink();
    if (link) {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: "Lien copié" });
      setTimeout(() => setCopied(false), 2000);
    }
  };
  if (!getSponsoredLink()) return <span className="text-muted-foreground">-</span>;
  return (
    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleCopy}>
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

// --- MAIN COMPONENT ---

export default function Dashboard() {
  // ETAT POUR LES ONGLETS
  const [activeTab, setActiveTab] = useState<"utm" | "promo">("utm");

  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ["/api/stats"] });
  const { data: campaigns, isLoading: campaignsLoading } = useQuery<CampaignDashboardStats[]>({
    queryKey: ["/api/campaigns/stats"],
  });

  // Fonction utilitaire pour calculer les stats dynamiques selon l'onglet
  const getDynamicStats = (campaign: CampaignDashboardStats) => {
    const isUtm = activeTab === "utm";
    
    // Revenue
    const revenue = isUtm ? campaign.revenueUtm : campaign.revenuePromo;
    
    // Orders
    const orders = isUtm ? campaign.ordersUtm : campaign.ordersPromo;
    
    // Coûts (Fixe + Commission sur le revenu affiché)
    const commissionCost = revenue * (campaign.commissionPercent / 100);
    const totalCost = campaign.fixedCost + commissionCost;
    
    // ROAS
    const roas = totalCost > 0 ? revenue / totalCost : 0;
    
    // Conv Rate (Uniquement pour UTM car on a les clics)
    const convRate = isUtm && campaign.clicks > 0 ? (orders / campaign.clicks) * 100 : 0;

    return { revenue, orders, totalCost, roas, convRate };
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Track your influencer marketing performance and ROI</p>
      </div>

      {/* STATS CARDS (GLOBAL) - Inchangé */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
         {/* ... (Je garde les stats globales telles quelles pour l'instant) */}
         {/* Si tu veux que les cartes du haut changent aussi selon l'onglet, dis-le moi, 
             mais généralement le dashboard global montre tout cumulé. */}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Campaign Performance</CardTitle>
          
          {/* TABS SWITCHER */}
          <div className="flex p-1 bg-muted rounded-lg">
            <button
              onClick={() => setActiveTab("utm")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === "utm" 
                  ? "bg-white text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Lien UTM + Code Promo
            </button>
            <button
              onClick={() => setActiveTab("promo")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === "promo" 
                  ? "bg-white text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Code Promo Uniquement
            </button>
          </div>
        </CardHeader>
        
        <CardContent>
          {campaignsLoading ? (
            <DashboardTableSkeleton />
          ) : !campaigns || campaigns.length === 0 ? (
            <div className="text-center py-12">No campaigns yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Campaign</TableHead>
                    <TableHead className="min-w-[150px]">Influencer</TableHead>
                    <TableHead className="min-w-[150px]">Target</TableHead>
                    
                    {/* COLONNES CONDITIONNELLES */}
                    {activeTab === "utm" && <TableHead className="text-center w-[50px]">Link</TableHead>}
                    
                    <TableHead className="text-right">Cost</TableHead>
                    
                    {activeTab === "utm" && (
                      <>
                        <TableHead className="text-right"><MousePointer className="h-3 w-3 inline mr-1"/>Clicks</TableHead>
                        <TableHead className="text-right"><ShoppingCart className="h-3 w-3 inline mr-1"/>Cart</TableHead>
                      </>
                    )}

                    <TableHead className="text-right"><Package className="h-3 w-3 inline mr-1"/>Orders</TableHead>
                    <TableHead className="text-right">Promo Code</TableHead>
                    
                    {activeTab === "utm" && <TableHead className="text-right">Conv Rate</TableHead>}
                    
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => {
                    const stats = getDynamicStats(campaign);
                    
                    return (
                      <TableRow key={campaign.id}>
                        {/* Campaign */}
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{campaign.name}</span>
                            <StatusBadge status={campaign.status || "active"} />
                          </div>
                        </TableCell>

                        {/* Influencer */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <InfluencerAvatar name={campaign.influencer?.name || "?"} imageUrl={campaign.influencer?.profileImageUrl} size="sm" />
                            <span className="font-medium text-sm">{campaign.influencer?.name}</span>
                          </div>
                        </TableCell>

                        {/* Target */}
                        <TableCell><TargetCell campaign={campaign} /></TableCell>

                        {/* Link (UTM Only) */}
                        {activeTab === "utm" && (
                          <TableCell className="text-center"><CopyLinkButton campaign={campaign} /></TableCell>
                        )}

                        {/* Cost (Dynamique) */}
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatCurrency(stats.totalCost, campaign.currency)}
                        </TableCell>

                        {/* Clicks & Cart (UTM Only) */}
                        {activeTab === "utm" && (
                          <>
                            <TableCell className="text-right tabular-nums">{formatNumber(campaign.clicks)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(campaign.addToCarts)}</TableCell>
                          </>
                        )}

                        {/* Orders (Dynamique) */}
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatNumber(stats.orders)}
                        </TableCell>

                        {/* Promo Code */}
                        <TableCell className="text-right">
                          {campaign.promoCode ? (
                            <span className="text-xs bg-muted px-1 rounded">{campaign.promoCode}</span>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>

                        {/* Conv Rate (UTM Only) */}
                        {activeTab === "utm" && (
                          <TableCell className="text-right tabular-nums">
                            {stats.convRate.toFixed(1)}%
                          </TableCell>
                        )}

                        {/* Revenue (Dynamique) */}
                        <TableCell className="text-right tabular-nums font-medium text-green-600">
                          {formatCurrency(stats.revenue, campaign.currency)}
                        </TableCell>

                        {/* ROAS (Dynamique) */}
                        <TableCell className="text-right">
                          <RoiBadge roi={stats.roas} />
                        </TableCell>

                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}