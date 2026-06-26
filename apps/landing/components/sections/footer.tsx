import { Logo } from "@/components/logo";

const COLUMNS = [
  {
    title: "Product",
    links: ["Dashboard", "Integrations", "Product analysis", "AI / MCP", "Pricing"],
  },
  {
    title: "Company",
    links: ["About", "Blog", "Careers", "Contact"],
  },
  {
    title: "Legal",
    links: ["Privacy", "Terms", "Security", "DPA"],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border py-14">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-3">
            <Logo />
            <p className="max-w-xs text-xs text-muted-foreground">
              Multi-channel profit tracking for modern e-commerce brands. See
              real net profit across every store and ad account.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              <h4 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-foreground/70 transition-colors hover:text-foreground"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>© 2026 MarginOptic. All rights reserved.</span>
          <span className="font-mono uppercase tracking-wider">
            Multi-channel profit tracking
          </span>
        </div>
      </div>
    </footer>
  );
}
