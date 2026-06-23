import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useExpenses } from "../hooks/use-expenses";
import { ExpenseForm } from "./expense-form";
import { ExpensesTable } from "./expenses-table";

export function ExpensesTab({
  activeStoreId,
  canEdit,
}: {
  activeStoreId: string | null;
  canEdit: boolean;
}) {
  const { expensesQ, create, toggle, recompute, remove } = useExpenses();

  return (
    <div className="space-y-6">
      {canEdit ? (
        <ExpenseForm
          activeStoreId={activeStoreId}
          pending={create.isPending}
          onSubmit={(v) => create.mutate(v)}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Özel giderler</CardTitle>
          <CardDescription>
            Yinelenen giderler günlük tutara amortize edilip gün+mağaza
            seviyesine dağıtılır (org genelinde).
          </CardDescription>
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
    </div>
  );
}
