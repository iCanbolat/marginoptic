import { useState } from "react";
import { useStoreSelection } from "@/lib/stores/selection";
import { Skeleton } from "@/components/ui/skeleton";
import { useStores } from "./hooks/use-stores";
import { CostsEmptyState } from "./components/costs-empty-state";
import {
  CostsSummaryCards,
  type CostCategory,
} from "./components/costs-summary-cards";
import { CogsPanel } from "./components/cogs-panel";
import { ShippingPanel } from "./components/shipping-panel";
import { PaymentFeesCard } from "./components/payment-fees-card";
import { TaxConfigCard } from "./components/tax-config-card";
import { ExpensesPanel } from "./components/expenses-panel";

export function CostsPage() {
  const canEdit = true;

  const activeStoreId = useStoreSelection((s) => s.activeStoreId);
  const { data: stores = [], isLoading } = useStores();
  const storeId = activeStoreId ?? stores[0]?.id ?? null;
  const storeName = stores.find((s) => s.id === storeId)?.name ?? null;

  const [category, setCategory] = useState<CostCategory>("cogs");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Maliyetler</h1>
          <p className="text-sm text-muted-foreground">
            COGS, kargo, ödeme ücreti, vergi ve özel giderler — net kâr motorunun
            girdileri.
          </p>
        </div>
        {storeName ? (
          <span className="text-sm text-muted-foreground">
            Mağaza: <span className="text-foreground">{storeName}</span>
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : stores.length === 0 ? (
        <CostsEmptyState />
      ) : storeId ? (
        <div className="space-y-6">
          <CostsSummaryCards
            storeId={storeId}
            active={category}
            onSelect={setCategory}
          />

          {category === "cogs" ? (
            <CogsPanel storeId={storeId} canEdit={canEdit} />
          ) : category === "shipping" ? (
            <ShippingPanel storeId={storeId} canEdit={canEdit} />
          ) : category === "payment" ? (
            <PaymentFeesCard storeId={storeId} canEdit={canEdit} />
          ) : category === "tax" ? (
            <TaxConfigCard storeId={storeId} canEdit={canEdit} />
          ) : (
            <ExpensesPanel activeStoreId={storeId} canEdit={canEdit} />
          )}
        </div>
      ) : null}
    </div>
  );
}
