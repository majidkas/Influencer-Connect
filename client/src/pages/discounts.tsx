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
import { Tag, TrendingUp, AlertCircle } from "lucide-react";
import { useI18n } from "@/lib/i18nContext";
import { useDate } from "@/lib/date-context";

interface DiscountStats {
  code: string;
  count: number;
  sales: number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
};

export default function Discounts() {
  const { t } = useI18n();
  const { from, to } = useDate(); // Récupère les dates globales

  // Requête API pour les stats de codes promo
  const { data: discounts, isLoading } = useQuery<DiscountStats[]>({
    queryKey: ["/api/discounts/stats", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/discounts/stats?from=${from}&to=${to}`);
      return res.json();
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("disc.title")}</h1>
        <p className="text-muted-foreground">{t("disc.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t("dash.campaign_performance")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !discounts || discounts.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">{t("disc.no_data")}</h3>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("disc.col_code")}</TableHead>
                  <TableHead className="text-right">{t("disc.col_orders")}</TableHead>
                  <TableHead className="text-right">{t("disc.col_sales")}</TableHead>
                  <TableHead className="text-right">{t("disc.col_aov")}</TableHead>
                  <TableHead className="w-[30%]">Visualisation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discounts.map((discount) => {
                  // Calcul pour la barre de progression (par rapport au meilleur code)
                  const maxSales = discounts[0].sales; // Le premier est le plus grand car trié par l'API
                  const percentage = maxSales > 0 ? (discount.sales / maxSales) * 100 : 0;
                  const aov = discount.count > 0 ? discount.sales / discount.count : 0;

                  return (
                    <TableRow key={discount.code}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="bg-primary/10 p-1.5 rounded text-primary">
                            <Tag className="h-4 w-4" />
                          </div>
                          {discount.code}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{discount.count}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {formatCurrency(discount.sales)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(aov)}
                      </TableCell>
                      <TableCell>
                        <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-500" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}