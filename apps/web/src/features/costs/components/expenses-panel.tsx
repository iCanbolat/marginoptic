import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useExpenses } from "../hooks/use-expenses";
import { ExpenseForm } from "./expense-form";
import { ExpensesTable } from "./expenses-table";

export function ExpensesPanel({
  activeStoreId,
  canEdit,
}: {
  activeStoreId: string | null;
  canEdit: boolean;
}) {
  const { expensesQ, create, toggle, recompute, remove } = useExpenses();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Özel giderler</CardTitle>
        <CardDescription>
          Yinelenen giderler günlük tutara amortize edilip gün+mağaza seviyesine
          dağıtılır (org genelinde).
        </CardDescription>
        {canEdit ? (
          <CardAction>
            <Sheet open={addOpen} onOpenChange={setAddOpen}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={2} />
                  Gider ekle
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-2xl">
                <SheetHeader>
                  <SheetTitle>Gider ekle</SheetTitle>
                  <SheetDescription>
                    Tek seferlik gider yalnız başlangıç gününe; yinelenen gider
                    amortize edilerek her güne yazılır.
                  </SheetDescription>
                </SheetHeader>
                <ExpenseForm
                  embedded
                  activeStoreId={activeStoreId}
                  pending={create.isPending}
                  onSubmit={(v) =>
                    create.mutate(v, { onSuccess: () => setAddOpen(false) })
                  }
                />
              </SheetContent>
            </Sheet>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <ExpensesTable
          expenses={expensesQ.data}
          isLoading={expensesQ.isLoading}
          canEdit={canEdit}
          togglePending={toggle.isPending}
          recomputePending={recompute.isPending}
          deletePending={remove.isPending}
          onToggle={(e) => toggle.mutate(e)}
          onRecompute={(e) => recompute.mutate(e)}
          onDelete={(id) => remove.mutate(id)}
        />
      </CardContent>
    </Card>
  );
}
