"use client";

import { motion, useReducedMotion } from "motion/react";
import { ChannelBadge } from "@/components/mocks/channel-badge";
import { PRODUCTS, type Product } from "@/lib/mock-data";
import { cn, usd } from "@/lib/utils";

const money = (n: number) =>
  n < 0 ? `−${usd(Math.abs(n))}` : usd(n);

function Row({ p, i, full }: { p: Product; i: number; full: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.tr
      className="border-t border-border/70"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.4, delay: i * 0.05 }}
    >
      <td className="py-2 pr-2">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{p.title}</span>
          {full && <ChannelBadge channel={p.channel} />}
        </div>
      </td>
      <td className="py-2 text-right tabular-nums text-muted-foreground">
        {p.units.toLocaleString("en-US")}
      </td>
      {full && (
        <>
          <td className="py-2 text-right tabular-nums">{usd(p.revenue)}</td>
          <td className="py-2 text-right tabular-nums text-muted-foreground">
            {usd(p.adSpend)}
          </td>
          <td className="py-2 text-right tabular-nums">{p.roas.toFixed(2)}×</td>
          <td className="py-2 text-right tabular-nums text-muted-foreground">
            {p.conversion.toFixed(1)}%
          </td>
        </>
      )}
      <td
        className={cn(
          "py-2 text-right font-medium tabular-nums",
          p.netProfit < 0 ? "text-red-600" : "text-foreground",
        )}
      >
        {money(p.netProfit)}
      </td>
    </motion.tr>
  );
}

export function ProductsTableMock({
  variant = "full",
  limit,
}: {
  variant?: "full" | "compact";
  limit?: number;
}) {
  const full = variant === "full";
  const rows = [...PRODUCTS]
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, limit ?? PRODUCTS.length);

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="pb-2 font-medium">Product</th>
          <th className="pb-2 text-right font-medium">Units</th>
          {full && (
            <>
              <th className="pb-2 text-right font-medium">Revenue</th>
              <th className="pb-2 text-right font-medium">Ad Spend</th>
              <th className="pb-2 text-right font-medium">ROAS</th>
              <th className="pb-2 text-right font-medium">Conv.</th>
            </>
          )}
          <th className="pb-2 text-right font-medium">Net Profit</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p, i) => (
          <Row key={p.title} p={p} i={i} full={full} />
        ))}
      </tbody>
    </table>
  );
}
