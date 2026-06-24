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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCogs } from "../hooks/use-cogs";
import { CogsBatchAddDialog } from "./cogs-batch-add-dialog";
import { CogsRulesTable } from "./cogs-rules-table";
import { CogsCsvImport } from "./cogs-csv-import";

export function CogsPanel({
  storeId,
  canEdit,
}: {
  storeId: string;
  canEdit: boolean;
}) {
  const { rulesQ, createBatch, remove, invalidate } = useCogs(storeId);
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
            <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>
              <HugeiconsIcon
                icon={FileImportIcon}
                size={16}
                strokeWidth={1.8}
              />
              CSV içe aktar
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={2} />
              Kural ekle
            </Button>

            <CogsBatchAddDialog
              open={addOpen}
              onOpenChange={setAddOpen}
              pending={createBatch.isPending}
              onSubmit={(rules) =>
                createBatch.mutate(rules, {
                  onSuccess: () => setAddOpen(false),
                })
              }
            />

            <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="sr-only">CSV ile içe aktar</DialogTitle>
                </DialogHeader>
                <CogsCsvImport
                  storeId={storeId}
                  onImported={() => {
                    invalidate();
                    setCsvOpen(false);
                  }}
                />
              </DialogContent>
            </Dialog>
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
