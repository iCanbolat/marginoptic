import { z } from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COGS_SCOPES,
  SCOPE_LABELS,
  cogsRuleInputSchema,
  type CogsRuleInput,
} from "../types/cost-types";
import { numberFromInput, optionalText } from "../utils/format";
import { FieldError } from "./field-error";

interface CogsAddFormProps {
  pending: boolean;
  onSubmit: (v: CogsRuleInput) => void;
}

type FormValues = z.input<typeof cogsRuleInputSchema>;

export function CogsAddForm({ pending, onSubmit }: CogsAddFormProps) {
  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues, unknown, CogsRuleInput>({
    resolver: zodResolver(cogsRuleInputSchema),
    defaultValues: {
      scope: "sku",
      matchValue: "",
      costAmount: "",
      handlingFee: "",
      minQty: 1,
      country: "",
    },
  });

  const scope = watch("scope");
  const isGlobal = scope === "global";

  function submit(values: CogsRuleInput) {
    onSubmit(values);
    reset({
      scope: values.scope,
      matchValue: "",
      costAmount: "",
      handlingFee: "",
      minQty: values.minQty,
      country: values.country ?? "",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kural ekle</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(submit)}
          noValidate
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        >
          <div className="space-y-1">
            <Label>Kapsam</Label>
            <Controller
              control={control}
              name="scope"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COGS_SCOPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SCOPE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1">
            <Label>Eşleşme {isGlobal ? "(yok)" : ""}</Label>
            <Input
              disabled={isGlobal}
              placeholder={scope === "sku" ? "SKU-123" : "ID"}
              aria-invalid={!!errors.matchValue}
              {...register("matchValue", { setValueAs: optionalText })}
            />
            <FieldError message={errors.matchValue?.message} />
          </div>
          <div className="space-y-1">
            <Label>Birim maliyet</Label>
            <Input
              inputMode="decimal"
              placeholder="0.00"
              aria-invalid={!!errors.costAmount}
              {...register("costAmount", { setValueAs: optionalText })}
            />
            <FieldError message={errors.costAmount?.message} />
          </div>
          <div className="space-y-1">
            <Label>İşleme ücreti</Label>
            <Input
              inputMode="decimal"
              placeholder="opsiyonel"
              aria-invalid={!!errors.handlingFee}
              {...register("handlingFee", { setValueAs: optionalText })}
            />
            <FieldError message={errors.handlingFee?.message} />
          </div>
          <div className="space-y-1">
            <Label>Min adet</Label>
            <Input
              inputMode="numeric"
              aria-invalid={!!errors.minQty}
              {...register("minQty", { setValueAs: numberFromInput })}
            />
            <FieldError message={errors.minQty?.message} />
          </div>
          <div className="space-y-1">
            <Label>Ülke (ISO-2)</Label>
            <Input
              maxLength={2}
              placeholder="TR"
              aria-invalid={!!errors.country}
              {...register("country", { setValueAs: optionalText })}
            />
            <FieldError message={errors.country?.message} />
          </div>
          <div className="col-span-2 sm:col-span-3 lg:col-span-6">
            <Button type="submit" disabled={pending}>
              Ekle
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
