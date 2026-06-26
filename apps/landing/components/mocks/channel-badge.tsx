import { HugeiconsIcon } from "@hugeicons/react";
import { AmazonIcon, AuctionIcon, ShoppingBag01Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import type { Channel } from "@/lib/mock-data";

const CHANNEL_META: Record<Channel, { label: string; icon: typeof AmazonIcon }> =
  {
    shopify: { label: "Shopify", icon: ShoppingBag01Icon },
    amazon: { label: "Amazon", icon: AmazonIcon },
    ebay: { label: "eBay", icon: AuctionIcon },
  };

export function ChannelBadge({ channel }: { channel: Channel }) {
  const meta = CHANNEL_META[channel];
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <HugeiconsIcon icon={meta.icon} />
      {meta.label}
    </Badge>
  );
}
