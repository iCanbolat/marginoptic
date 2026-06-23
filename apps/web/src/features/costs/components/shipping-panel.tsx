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
import { useShipping } from "../hooks/use-shipping";
import { ShippingAddForm } from "./shipping-add-form";
import { ShippingRulesTable } from "./shipping-rules-table";

export function ShippingPanel({
  storeId,
  canEdit,
}: {
  storeId: string;
  canEdit: boolean;
}) {
  const { rulesQ, create, remove } = useShipping(storeId);
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
            <Sheet open={addOpen} onOpenChange={setAddOpen}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={2} />
                  Kural ekle
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-xl">
                <SheetHeader>
                  <SheetTitle>Kargo kuralı ekle</SheetTitle>
                  <SheetDescription>
                    Ülke, adet ve ağırlık aralığına göre kargo maliyeti
                    tanımlayın.
                  </SheetDescription>
                </SheetHeader>
                <ShippingAddForm
                  embedded
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
