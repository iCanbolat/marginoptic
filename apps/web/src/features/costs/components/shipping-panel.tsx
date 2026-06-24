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
import { useShipping } from "../hooks/use-shipping";
import { ShippingBatchAddDialog } from "./shipping-batch-add-dialog";
import { ShippingRulesTable } from "./shipping-rules-table";

export function ShippingPanel({
  storeId,
  canEdit,
}: {
  storeId: string;
  canEdit: boolean;
}) {
  const { rulesQ, createBatch, remove } = useShipping(storeId);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kargo kuralları</CardTitle>
        <CardDescription>
          Maliyet = sabit + (adet başı × adet). En özgül eşleşen kural seçilir
          (ülke &gt; adet aralığı).
        </CardDescription>
        {canEdit ? (
          <CardAction>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={2} />
              Kural ekle
            </Button>

            <ShippingBatchAddDialog
              open={addOpen}
              onOpenChange={setAddOpen}
              pending={createBatch.isPending}
              onSubmit={(rules) =>
                createBatch.mutate(rules, {
                  onSuccess: () => setAddOpen(false),
                })
              }
            />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <ShippingRulesTable
          rules={rulesQ.data}
          isLoading={rulesQ.isLoading}
          canEdit={canEdit}
          deletePending={remove.isPending}
          onDelete={(id) => remove.mutate(id)}
        />
      </CardContent>
    </Card>
  );
}
