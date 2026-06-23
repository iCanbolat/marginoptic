import { useEffect } from "react";
import { z } from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useTax } from "../hooks/use-tax";
import { taxConfigInputSchema, type TaxConfigInput } from "../types/cost-types";
import { FieldError } from "./field-error";

type FormValues = z.input<typeof taxConfigInputSchema>;

/** Boş input → null (vergi PUT'unda oranı temizler). */
const rateOrNull = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

export function TaxConfigCard({
  storeId,
  canEdit,
}: {
  storeId: string;
  canEdit: boolean;
}) {
  const { taxQ, save } = useTax(storeId);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues, unknown, TaxConfigInput>({
    resolver: zodResolver(taxConfigInputSchema),
    defaultValues: { salesTaxBorne: false, incomeTaxRate: "" },
  });

  useEffect(() => {
    if (taxQ.data) {
      reset({
        salesTaxBorne: taxQ.data.salesTaxBorne,
        incomeTaxRate: taxQ.data.incomeTaxRate ?? "",
      });
    }
  }, [taxQ.data, reset]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vergi ayarı</CardTitle>
        <CardDescription>
          Tahsil edilen satış vergisini satıcı üstleniyorsa maliyete dahil
          edilir. Gelir vergisi oranı net kâra uygulanır (opsiyonel).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {taxQ.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <form
            onSubmit={handleSubmit((v) => save.mutate(v))}
            noValidate
            className="space-y-4"
          >
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Satış vergisini satıcı üstleniyor</Label>
                <p className="text-xs text-muted-foreground">
                  Açıksa toplanan vergi maliyet olarak sayılır.
                </p>
              </div>
              <Controller
                control={control}
                name="salesTaxBorne"
                render={({ field }) => (
                  <Switch
                    checked={!!field.value}
                    disabled={!canEdit}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="max-w-xs space-y-1">
              <Label>Gelir vergisi oranı (%)</Label>
              <Input
                inputMode="decimal"
                disabled={!canEdit}
                placeholder="örn. 15"
                aria-invalid={!!errors.incomeTaxRate}
                {...register("incomeTaxRate", { setValueAs: rateOrNull })}
              />
              <FieldError message={errors.incomeTaxRate?.message} />
            </div>
            {canEdit ? (
              <Button type="submit" disabled={save.isPending}>
                Kaydet
              </Button>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
