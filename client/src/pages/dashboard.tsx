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

// --- STATS ÉTENDUES ---
// On étend l'interface pour inclure les nouveaux champs (si pas déjà dans schema)
interface CampaignDashboardStats extends CampaignWithStats {
  revenuePromoOnly?: number;
  conversionRate?: number;
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
        <div className="text-2xl font-bold" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>
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

function CopyLinkButton({ campaign }: { campaign: CampaignDashboardStats }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const getSponsoredLink = () => {
    // Si Homepage
    if (campaign.targetType === "homepage") {
      return `?utm_campaign=${campaign.slugUtm}`; // Simplifié pour affichage dashboard
    }
    // Si Product
    if (campaign.productUrl && campaign.slugUtm) {
      const separator = campaign.productUrl.includes("?") ? "&" : "?";
      return `${campaign.productUrl}${separator}utm_campaign=${campaign.slugUtm}`;
    }
    return null;
  };

  const handleCopy = async () => {
    const link = getSponsoredLink();
    if (link) {
      // Pour copier un lien complet valide, il faudrait le domaine. 
      // Ici on copie ce qu'on a, ou on reconstruit si possible.
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: "Lien copié" });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({ title: "Lien non disponible", variant: "destructive" });
    }
  };

  const sponsoredLink = getSponsoredLink();

  if (!sponsoredLink) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Copier le lien</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function TargetCell({ campaign }: { campaign: CampaignDashboardStats }) {
  // Cas Homepage
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

  // Cas Product
  const productTitle = campaign.productTitle;
  const productImage = campaign.productImage;
  
  if (!productTitle && !campaign.productUrl) {
    return <span className="text-muted-foreground">-</span>;
  }

  const displayName = productTitle || "Product";
  const truncatedName = displayName.length > 20 
    ? displayName.substring(0, 20) + "..." 
    : displayName;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 max-w-[180px]">
            {productImage ? (
              <img 
                src={productImage} 
                alt={displayName}
                className="h-8 w-8 object-cover rounded flex-shrink-0"
              />
            ) : (
              <div className="h-8 w-8 bg-muted rounded flex-shrink-0" />
            )}
            <span className="text-sm truncate capitalize">{truncatedName}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="capitalize">{displayName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalInfluencers: number;
    activeCampaigns: number;
    totalRevenue: number;
    totalCosts: number;
    averageRoas: number;
  }>({
    queryKey: ["/api/stats"],
  });

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<CampaignDashboardStats[]>({
    queryKey: ["/api/campaigns/stats"],
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Dashboard</h1>
        <p className="text-muted-foreground">
          Track your influencer marketing performance and ROI
        </p>
      </div>

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
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {campaignsLoading ? (
            <DashboardTableSkeleton />
          ) : !campaigns || campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground text-sm">
                Create your first campaign to start tracking influencer performance.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* COLONNES REORDONNEES SELON CAHIER DES CHARGES */}
                    <TableHead className="min-w-[120px]">Campaign</TableHead>
                    <TableHead className="min-w-[150px]">Influencer</TableHead>
                    <TableHead className="min-w-[150px]">Target</TableHead>
                    <TableHead className="text-center w-[50px]">Link</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <MousePointer className="h-3 w-3" /> Clicks
                      </div>
                    </TableHead>
                    
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ShoppingCart className="h-3 w-3" /> Cart
                      </div>
                    </TableHead>

                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Package className="h-3 w-3" /> Orders
                      </div>
                    </TableHead>

                    <TableHead className="text-right">Promo</TableHead>
                    <TableHead className="text-right">Conv Rate</TableHead>

                    <TableHead className="text-right min-w-[100px]">
                      Revenue (1)
                      <span className="block text-[10px] text-muted-foreground font-normal">Link + Code</span>
                    </TableHead>

                    <TableHead className="text-right min-w-[100px]">
                      Revenue (2)
                      <span className="block text-[10px] text-muted-foreground font-normal">Code Only</span>
                    </TableHead>

                    <TableHead className="text-right">ROAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id} data-testid={`row-campaign-${campaign.id}`}>
                      
                      {/* Campaign Name */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium whitespace-nowrap">{campaign.name}</span>
                          <StatusBadge status={campaign.status || "active"} />
                        </div>
                      </TableCell>

                      {/* Influencer */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <InfluencerAvatar
                            name={campaign.influencer?.name || "?"}
                            imageUrl={campaign.influencer?.profileImageUrl}
                            size="sm"
                          />
                          <span className="font-medium text-sm whitespace-nowrap">{campaign.influencer?.name}</span>
                        </div>
                      </TableCell>

                      {/* Target (Product or Homepage) */}
                      <TableCell>
                        <TargetCell campaign={campaign} />
                      </TableCell>

                      {/* Link Copy */}
                      <TableCell className="text-center">
                        <CopyLinkButton campaign={campaign} />
                      </TableCell>

                      {/* Cost */}
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                       {formatCurrency(campaign.totalCost || 0, campaign.currency)}
                      </TableCell>

                      {/* Clicks */}
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(campaign.clicks)}
                      </TableCell>

                      {/* Cart */}
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(campaign.addToCarts)}
                      </TableCell>

                      {/* Orders */}
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatNumber(campaign.orders)}
                      </TableCell>

                      {/* Promo Code */}
                      <TableCell className="text-right tabular-nums">
                        {campaign.promoCode ? (
                          <div className="flex flex-col items-end">
                            <span className="text-xs bg-muted px-1 rounded">{campaign.promoCode}</span>
                            <span className="text-[10px] text-muted-foreground">({campaign.promoCodeUsage})</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      {/* Conv Rate */}
                      <TableCell className="text-right tabular-nums">
                        {campaign.conversionRate ? `${campaign.conversionRate.toFixed(1)}%` : "0.0%"}
                      </TableCell>

                      {/* Revenue (1) */}
                      <TableCell className="text-right tabular-nums font-medium text-green-600">
                       {formatCurrency(campaign.revenue || 0, campaign.currency)}
                      </TableCell>

                      {/* Revenue (2) */}
                      <TableCell className="text-right tabular-nums font-medium text-blue-600">
                       {formatCurrency(campaign.revenuePromoOnly || 0, campaign.currency)}
                      </TableCell>

                      {/* ROAS */}
                      <TableCell className="text-right">
                        <RoiBadge roi={campaign.roas} />
                      </TableCell>

                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}