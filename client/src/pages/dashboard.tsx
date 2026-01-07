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
import { Users, Megaphone, DollarSign, TrendingUp, MousePointer, ShoppingCart, Package, Tag, Copy, Check, Link, CreditCard, Image } from "lucide-react";
import type { CampaignWithStats } from "@shared/schema";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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

function CopyLinkButton({ campaign }: { campaign: CampaignWithStats }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const getSponsoredLink = () => {
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
      toast({ title: "Lien sponsorisé copié" });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({ title: "URL produit manquante", variant: "destructive" });
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
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Copier le lien sponsorisé</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ProductCell({ campaign }: { campaign: CampaignWithStats }) {
  const productName = campaign.productUrl 
    ? campaign.productUrl.split('/products/')[1]?.split('?')[0]?.replace(/-/g, ' ') || "Produit"
    : null;

  if (!productName) {
    return <span className="text-muted-foreground">-</span>;
  }

  const truncatedName = productName.length > 20 
    ? productName.substring(0, 20) + "..." 
    : productName;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 max-w-[150px]">
            <div className="h-8 w-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
              <Image className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-sm truncate capitalize">{truncatedName}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="capitalize">{productName}</p>
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

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<CampaignWithStats[]>({
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
                    <TableHead className="min-w-[180px]">Influencer</TableHead>
                    <TableHead className="min-w-[120px]">Campaign</TableHead>
                    <TableHead className="min-w-[150px]">Product</TableHead>
                    <TableHead className="text-center w-[60px]">
                      <div className="flex items-center justify-center gap-1">
                        <Link className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <MousePointer className="h-3 w-3" />
                        Clicks
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ShoppingCart className="h-3 w-3" />
                        Cart
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Package className="h-3 w-3" />
                        Orders
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tag className="h-3 w-3" />
                        Promo
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Costs</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id} data-testid={`row-campaign-${campaign.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <InfluencerAvatar
                            name={campaign.influencer.name}
                            imageUrl={campaign.influencer.profileImageUrl}
                            size="md"
                          />
                          <span className="font-medium">{campaign.influencer.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{campaign.name}</span>
                          <StatusBadge status={campaign.status || "active"} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <ProductCell campaign={campaign} />
                      </TableCell>
                      <TableCell className="text-center">
                        <CopyLinkButton campaign={campaign} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(campaign.clicks)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(campaign.addToCarts)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(campaign.orders)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {campaign.promoCode ? (
                          <span>
                            <span className="text-muted-foreground text-xs">{campaign.promoCode}</span>
                            {" "}
                            <span className="font-medium">({campaign.promoCodeUsage})</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(campaign.revenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCurrency(campaign.totalCost)}
                      </TableCell>
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
