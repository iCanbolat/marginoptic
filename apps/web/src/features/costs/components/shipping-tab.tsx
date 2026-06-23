import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useShipping } from "../hooks/use-shipping";
import { ShippingAddForm } from "./shipping-add-form";
import { ShippingRulesTable } from "./shipping-rules-table";

export function ShippingTab({
  storeId,
  canEdit,
}: {
  storeId: string;
  canEdit: boolean;
}) {
  const { rulesQ, create, remove } = useShipping(storeId);

  return (
    <div className="space-y-6">
      {canEdit ? (
        <ShippingAddForm
          pending={create.isPending}
          onSubmit={(v) => create.mutate(v)}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kargo kuralları</CardTitle>
          <CardDescription>
            Maliyet = sabit + (adet başı × adet). En özgül eşleşen kural seçilir
            (ülke &gt; adet aralığı).
          </CardDescription>
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
    </div>
  );
}
