import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, FileImportIcon } from "@hugeicons/core-free-icons";
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
import { useCogs } from "../hooks/use-cogs";
import { CogsAddForm } from "./cogs-add-form";
import { CogsRulesTable } from "./cogs-rules-table";
import { CogsCsvImport } from "./cogs-csv-import";

export function CogsPanel({
  storeId,
  canEdit,
}: {
  storeId: string;
  canEdit: boolean;
}) {
  const { rulesQ, create, remove, invalidate } = useCogs(storeId);
  const [addOpen, setAddOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">COGS kuralları</CardTitle>
        <CardDescription>
          Çözümleme önceliği: SKU &gt; Varyant &gt; Ürün &gt; Genel. Birim
          maliyet + işleme ücreti satır maliyetine yazılır.
        </CardDescription>
        {canEdit ? (
          <CardAction className="flex gap-2">
            <Sheet open={csvOpen} onOpenChange={setCsvOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <HugeiconsIcon
                    icon={FileImportIcon}
                    size={16}
                    strokeWidth={1.8}
                  />
                  CSV içe aktar
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-2xl">
                <SheetHeader>
                  <SheetTitle className="sr-only">CSV ile içe aktar</SheetTitle>
                </SheetHeader>
                <CogsCsvImport
                  storeId={storeId}
                  onImported={() => {
                    invalidate();
                    setCsvOpen(false);
                  }}
                />
              </SheetContent>
            </Sheet>
            <Sheet open={addOpen} onOpenChange={setAddOpen}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={2} />
                  Kural ekle
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-2xl">
                <SheetHeader>
                  <SheetTitle>COGS kuralı ekle</SheetTitle>
                  <SheetDescription>
                    SKU / varyant / ürün / genel kapsamında birim maliyet
                    tanımlayın.
                  </SheetDescription>
                </SheetHeader>
                <CogsAddForm
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
        <CogsRulesTable
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
