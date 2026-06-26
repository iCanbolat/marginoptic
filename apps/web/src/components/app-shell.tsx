import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  ShoppingBag01Icon,
  PackageSearchIcon,
  Coins01Icon,
  Megaphone01Icon,
  PlugSocketIcon,
  Store01Icon,
  Key01Icon,
  CreditCardIcon,
  SidebarLeft01Icon,
  Menu01Icon,
  Logout02Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth/store";
import { useSidebar } from "@/lib/stores/sidebar";
import { cn } from "@/lib/utils";
import { StoreSwitcher } from "./store-switcher";
import { DataFreshnessBadge } from "./data-freshness-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  to: string;
  label: string;
  icon: IconSvgElement;
  exact?: boolean;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Genel",
    items: [
      { to: "/", label: "Genel Bakış", icon: DashboardSquare01Icon, exact: true },
      { to: "/orders", label: "Siparişler", icon: ShoppingBag01Icon },
      { to: "/products", label: "Ürün Analizi", icon: PackageSearchIcon },
      { to: "/costs", label: "Maliyetler", icon: Coins01Icon },
      { to: "/ads", label: "Reklamlar", icon: Megaphone01Icon },
    ],
  },
  {
    label: "Yönetim",
    items: [
      { to: "/integrations", label: "Entegrasyonlar", icon: PlugSocketIcon },
      { to: "/settings/stores", label: "Mağazalar", icon: Store01Icon },
      { to: "/settings/api-keys", label: "API Anahtarları", icon: Key01Icon },
      { to: "/billing", label: "Faturalandırma", icon: CreditCardIcon },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function initials(name: string | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function NavLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const link = (
    <Link
      to={item.to}
      activeOptions={{ exact: item.exact ?? false }}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        collapsed && "justify-center px-0",
      )}
      activeProps={{
        "aria-current": "page",
        className:
          "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
      }}
    >
      <HugeiconsIcon icon={item.icon} className="size-5 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  // Daraltılmış modda etiketi shadcn Tooltip ile göster.
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

/** Mobil hamburger menü — sidebar md altında gizli olduğunda gezinme sağlar. */
function MobileNav() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Menüyü aç"
        >
          <HugeiconsIcon icon={Menu01Icon} className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {ALL_ITEMS.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <Link to={item.to} activeOptions={{ exact: item.exact ?? false }}>
              <HugeiconsIcon icon={item.icon} className="size-4" />
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setStores = useAuthStore((s) => s.setStores);
  const collapsed = useSidebar((s) => s.collapsed);
  const toggleSidebar = useSidebar((s) => s.toggle);

  // Mağaza listesini + kullanıcıyı tazele (switcher bunu kullanır).
  useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const me = await authApi.me();
      setStores(me.stores);
      return me;
    },
  });

  async function handleLogout(): Promise<void> {
    await authApi.logout();
    await navigate({ to: "/login" });
  }

  return (
    <TooltipProvider delayDuration={150}>
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Erişilebilirlik: içeriğe atla bağlantısı (klavye odağında görünür). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        İçeriğe geç
      </a>

      <aside
        className={cn(
          "hidden h-screen shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar p-3 transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div
          className={cn(
            "mb-4 flex items-center gap-2 px-2 pt-2",
            collapsed && "justify-center px-0",
          )}
        >
          <img src="/app-icon.svg" alt="MarginOptic" className="size-8 shrink-0 rounded-md" />
          {!collapsed && (
            <span className="text-lg font-semibold tracking-tight">
              MarginOptic
            </span>
          )}
        </div>

        <nav aria-label="Ana gezinme" className="flex flex-1 flex-col gap-4 text-sm">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              {!collapsed && (
                <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/40">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => (
                <NavLink key={item.to} item={item} collapsed={collapsed} />
              ))}
            </div>
          ))}
        </nav>

        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={toggleSidebar}
          aria-label={collapsed ? "Kenar çubuğunu genişlet" : "Kenar çubuğunu daralt"}
          className={cn(
            "mt-2 text-sidebar-foreground/60",
            collapsed ? "self-center" : "justify-start gap-2",
          )}
        >
          <HugeiconsIcon
            icon={SidebarLeft01Icon}
            className={cn("size-5 transition-transform", collapsed && "rotate-180")}
          />
          {!collapsed && <span>Daralt</span>}
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav />
            <StoreSwitcher />
            <DataFreshnessBadge />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-lg"
                className="rounded-full"
                aria-label="Hesap menüsü"
              >
                <Avatar className="size-8">
                  <AvatarFallback>{initials(user?.name)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">
                {user?.name}
                <span className="block text-xs font-normal text-muted-foreground">
                  {user?.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void handleLogout()}>
                <HugeiconsIcon icon={Logout02Icon} className="size-4" />
                Çıkış yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main id="main-content" className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
    </TooltipProvider>
  );
}
