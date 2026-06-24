import { z } from "zod";
import { useForm } from "react-hook-form";
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
  shippingRuleInputSchema,
  type ShippingRuleInput,
} from "../types/cost-types";
import { numberFromInput, optionalText } from "../utils/format";
import { FieldError } from "./field-error";

interface ShippingAddFormProps {
  pending: boolean;
  onSubmit: (v: ShippingRuleInput) => void;
  /** Sheet/Dialog içinde gösterilirken dıştaki Card chrome'unu atla. */
  embedded?: boolean;
  /** Gönder butonu etiketi (batch akışında "Listeye ekle"). */
  submitLabel?: string;
}

type FormValues = z.input<typeof shippingRuleInputSchema>;

const EMPTY: FormValues = {
  name: "",
  country: "",
  minQty: undefined,
  maxQty: undefined,
  minWeightGrams: undefined,
  maxWeightGrams: undefined,
  baseCost: "",
  perItemCost: "",
};

export function ShippingAddForm({
  pending,
  onSubmit,
  embedded,
  submitLabel = "Ekle",
}: ShippingAddFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues, unknown, ShippingRuleInput>({
    resolver: zodResolver(shippingRuleInputSchema),
    defaultValues: EMPTY,
  });

  function submit(values: ShippingRuleInput) {
    onSubmit(values);
    reset(EMPTY);
  }

  const body = (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
          <div className="space-y-1">
            <Label>Ad</Label>
            <Input
              placeholder="Standart"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="space-y-1">
            <Label>Ülke (ISO-2)</Label>
            <Input
              maxLength={2}
              placeholder="Tümü"
              aria-invalid={!!errors.country}
              {...register("country", { setValueAs: optionalText })}
            />
            <FieldError message={errors.country?.message} />
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
            <Label>Maks adet</Label>
            <Input
              inputMode="numeric"
              aria-invalid={!!errors.maxQty}
              {...register("maxQty", { setValueAs: numberFromInput })}
            />
            <FieldError message={errors.maxQty?.message} />
          </div>
          <div className="space-y-1">
            <Label>Min ağırlık (g)</Label>
            <Input
              inputMode="numeric"
              aria-invalid={!!errors.minWeightGrams}
              {...register("minWeightGrams", { setValueAs: numberFromInput })}
            />
            <FieldError message={errors.minWeightGrams?.message} />
          </div>
          <div className="space-y-1">
            <Label>Maks ağırlık (g)</Label>
            <Input
              inputMode="numeric"
              aria-invalid={!!errors.maxWeightGrams}
              {...register("maxWeightGrams", { setValueAs: numberFromInput })}
            />
            <FieldError message={errors.maxWeightGrams?.message} />
          </div>
          <div className="space-y-1">
            <Label>Sabit maliyet</Label>
            <Input
              inputMode="decimal"
              placeholder="0.00"
              aria-invalid={!!errors.baseCost}
              {...register("baseCost", { setValueAs: optionalText })}
            />
            <FieldError message={errors.baseCost?.message} />
          </div>
          <div className="space-y-1">
            <Label>Adet başı</Label>
            <Input
              inputMode="decimal"
              placeholder="opsiyonel"
              aria-invalid={!!errors.perItemCost}
              {...register("perItemCost", { setValueAs: optionalText })}
            />
            <FieldError message={errors.perItemCost?.message} />
          </div>
      <div className="col-span-2 sm:col-span-4">
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );

  if (embedded) return body;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kargo kuralı ekle</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
