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
  Package, Tag, Copy, Check, CreditCard, Home 
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

// --- COMPOSANTS UTILITAIRES (MANQUANTS DANS LA VERSION PRÉCÉDENTE) ---

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value}
        </div>
        {trend !== undefined && (
          <p className={`text-xs mt-1 ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
            {trend >= 0 ? "+" : ""}{trend}% from last month
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardTableSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

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
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-sm truncate capitalize cursor-default">{displayName}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{displayName}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
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

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalInfluencers: number;
    activeCampaigns: number;
    totalRevenue: number;
    totalCosts: number;
    averageRoas: number;
  }>({ 
    queryKey: ["/api/stats"] 
  });
  
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

      {/* STATS CARDS (GLOBAL) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Total Influencers"
              value={formatNumber(stats?.totalInfluencers || 0)}
              icon={Users}
            />
            <StatCard
              title="Active Campaigns"
              value={formatNumber(stats?.activeCampaigns || 0)}
              icon={Megaphone}
            />
            <StatCard
              title="Total Revenue"
              value={formatCurrency(stats?.totalRevenue || 0)}
              icon={DollarSign}
            />
            <StatCard
              title="Total Costs"
              value={formatCurrency(stats?.totalCosts || 0)}
              icon={CreditCard}
            />
            <StatCard
              title="Average ROAS"
              value={(stats?.averageRoas || 0).toFixed(2)}
              icon={TrendingUp}
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Campaign Performance</CardTitle>
          
          {/* TABS SWITCHER */}
          <div className="flex p-1 bg-muted rounded-lg border">
            <button
              onClick={() => setActiveTab("utm")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === "utm" 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              Lien UTM + Code Promo
            </button>
            <button
              onClick={() => setActiveTab("promo")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === "promo" 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
            <div className="text-center py-12">
              <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground text-sm">Create your first campaign to start tracking.</p>
            </div>
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