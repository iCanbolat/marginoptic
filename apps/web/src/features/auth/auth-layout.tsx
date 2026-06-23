import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Animasyonlu bulanık blob arkaplan — dekoratif, içerik akışının dışında.
          Negatif z-index kullanmıyoruz: aksi halde parent'ın opak arkaplanının
          ALTINDA kalıp görünmez olur. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="animate-blob absolute -left-24 -top-24 size-112 rounded-full bg-primary/30 blur-3xl"
          style={{ animationDelay: "0s" }}
        />
        <div
          className="animate-blob absolute -right-24 top-1/4 size-104 rounded-full bg-accent-teal/25 blur-3xl"
          style={{ animationDelay: "-7s" }}
        />
        <div
          className="animate-blob absolute -bottom-32 left-1/3 size-120 rounded-full bg-accent-amber/20 blur-3xl"
          style={{ animationDelay: "-14s" }}
        />
      </div>

      <Card className="relative z-10 w-full max-w-sm border-border/60 bg-card/80 shadow-xl backdrop-blur-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
            C
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
