import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth/store";
import { OrgSwitcher } from "./org-switcher";
import { StoreSelector } from "./store-selector";
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

const NAV = [
  { to: "/", label: "Genel Bakış", exact: true },
  { to: "/orders", label: "Siparişler", exact: false },
  { to: "/costs", label: "Maliyetler", exact: false },
  { to: "/ads", label: "Reklamlar", exact: false },
  { to: "/integrations", label: "Entegrasyonlar", exact: false },
  { to: "/settings/members", label: "Üyeler", exact: false },
  { to: "/settings/api-keys", label: "API Anahtarları", exact: false },
  { to: "/billing", label: "Faturalandırma", exact: false },
] as const;

function initials(name: string | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.exact }}
          onClick={onNavigate}
          className="rounded-md px-3 py-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          activeProps={{
            "aria-current": "page",
            className:
              "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
          }}
        >
          {item.label}
        </Link>
      ))}
    </>
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="size-5"
            aria-hidden="true"
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {NAV.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <Link to={item.to} activeOptions={{ exact: item.exact }}>
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
  const setOrganizations = useAuthStore((s) => s.setOrganizations);

  // Organizasyon listesini + kullanıcıyı tazele (switcher bunu kullanır).
  useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const me = await authApi.me();
      setOrganizations(me.organizations);
      return me;
    },
  });

  async function handleLogout(): Promise<void> {
    await authApi.logout();
    await navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Erişilebilirlik: içeriğe atla bağlantısı (klavye odağında görünür). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        İçeriğe geç
      </a>

      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 md:flex">
        <div className="mb-6 px-2 pt-2 text-lg font-semibold tracking-tight">
          Churnify
        </div>
        <nav aria-label="Ana gezinme" className="flex flex-col gap-1 text-sm">
          <NavLinks />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-2 border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav />
            <OrgSwitcher />
            <StoreSelector />
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
                Çıkış yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main id="main-content" className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
