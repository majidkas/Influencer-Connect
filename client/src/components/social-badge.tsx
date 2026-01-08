import { Badge } from "@/components/ui/badge";
import { SiInstagram, SiTiktok, SiSnapchat, SiYoutube } from "react-icons/si";
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
    case "youtube":
      return <SiYoutube className={iconClass} />;
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
    case "youtube":
      return "bg-red-600 text-white border-transparent";
    default:
      return "";
  }
};

const getPlatformUrl = (platform: string, handle: string): string => {
  const cleanHandle = handle.replace(/^@/, "");
  switch (platform.toLowerCase()) {
    case "instagram":
      return `https://instagram.com/${cleanHandle}`;
    case "tiktok":
      return `https://tiktok.com/@${cleanHandle}`;
    case "snapchat":
      return `https://snapchat.com/add/${cleanHandle}`;
    case "youtube":
      return `https://youtube.com/@${cleanHandle}`;
    default:
      return "#";
  }
};

export function SocialBadge({
  platform,
  handle,
  followersCount,
  size = "sm",
}: SocialBadgeProps) {
  const cleanHandle = handle.replace(/^@/, "");
  const profileUrl = getPlatformUrl(platform, handle);

  return (
    <a 
      href={profileUrl} 
      target="_blank" 
      rel="noopener noreferrer"
      className="no-underline"
    >
      <Badge
        variant="secondary"
        className={cn(
          "gap-1 font-normal cursor-pointer hover:opacity-80 transition-opacity",
          getPlatformColor(platform),
          size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"
        )}
      >
        {getPlatformIcon(platform)}
        <span>{cleanHandle}</span>
        {followersCount !== undefined && followersCount > 0 && (
          <span className="opacity-80">{formatFollowers(followersCount)}</span>
        )}
      </Badge>
    </a>
  );
}