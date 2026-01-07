import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoiBadgeProps {
  roi: number;
  size?: "sm" | "md";
}

export function RoiBadge({ roi, size = "md" }: RoiBadgeProps) {
  // ROAS: > 1 = profitable, < 1 = loss, = 1 = break-even
  const isPositive = roi > 1;
  const isNegative = roi < 1 && roi > 0;
  const isNeutral = roi === 0 || roi === 1;

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 font-medium",
        isPositive && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
        isNegative && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
        isNeutral && "bg-muted text-muted-foreground",
        size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
      <span>{roi.toFixed(2)}</span>
    </Badge>
  );
}