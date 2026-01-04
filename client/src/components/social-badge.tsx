import { Badge } from "@/components/ui/badge";
import { SiInstagram, SiTiktok, SiSnapchat } from "react-icons/si";
import { cn } from "@/lib/utils";

interface SocialBadgeProps {
  platform: string;
  handle: string;
  followersCount?: number;
  size?: "sm" | "md";
}

const formatFollowers = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

const getPlatformIcon = (platform: string) => {
  const iconClass = "h-3 w-3";
  switch (platform.toLowerCase()) {
    case "instagram":
      return <SiInstagram className={iconClass} />;
    case "tiktok":
      return <SiTiktok className={iconClass} />;
    case "snapchat":
      return <SiSnapchat className={iconClass} />;
    default:
      return null;
  }
};

const getPlatformColor = (platform: string) => {
  switch (platform.toLowerCase()) {
    case "instagram":
      return "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent";
    case "tiktok":
      return "bg-black text-white dark:bg-white dark:text-black border-transparent";
    case "snapchat":
      return "bg-yellow-400 text-black border-transparent";
    default:
      return "";
  }
};

export function SocialBadge({
  platform,
  handle,
  followersCount,
  size = "sm",
}: SocialBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 font-normal",
        getPlatformColor(platform),
        size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"
      )}
    >
      {getPlatformIcon(platform)}
      <span className="truncate max-w-20">@{handle}</span>
      {followersCount !== undefined && followersCount > 0 && (
        <span className="opacity-80">{formatFollowers(followersCount)}</span>
      )}
    </Badge>
  );
}
