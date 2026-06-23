import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCogs } from "../hooks/use-cogs";
import { CogsAddForm } from "./cogs-add-form";
import { CogsRulesTable } from "./cogs-rules-table";
import { CogsCsvImport } from "./cogs-csv-import";

export function CogsTab({
  storeId,
  canEdit,
}: {
  storeId: string;
  canEdit: boolean;
}) {
  const { rulesQ, create, remove, invalidate } = useCogs(storeId);

  return (
    <div className="space-y-6">
      {canEdit ? (
        <CogsAddForm
          pending={create.isPending}
          onSubmit={(v) => create.mutate(v)}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">COGS kuralları</CardTitle>
          <CardDescription>
            Çözümleme önceliği: SKU &gt; Varyant &gt; Ürün &gt; Genel. Birim
            maliyet + işleme ücreti satır maliyetine yazılır.
          </CardDescription>
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

      {canEdit ? (
        <CogsCsvImport storeId={storeId} onImported={invalidate} />
      ) : null}
    </div>
  );
}
