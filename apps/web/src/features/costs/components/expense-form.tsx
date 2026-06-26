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
import { DatePicker } from "@/components/ui/date-picker";
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
  ALLOCATION_LABELS,
  EXPENSE_ALLOCATIONS,
  EXPENSE_RECURRENCES,
  RECURRENCE_LABELS,
  customExpenseInputSchema,
  type CustomExpenseInput,
  type ExpenseAllocation,
  type ExpenseRecurrence,
  type ExpenseType,
} from "../types/cost-types";
import { optionalText, todayIso } from "../utils/format";
import { FieldError } from "./field-error";

interface ExpenseFormProps {
  activeStoreId: string | null;
  pending: boolean;
  onSubmit: (v: CustomExpenseInput) => void;
  /** Sheet/Dialog içinde gösterilirken dıştaki Card chrome'unu atla. */
  embedded?: boolean;
}

type FormValues = z.input<typeof customExpenseInputSchema>;

export function ExpenseForm({
  activeStoreId,
  pending,
  onSubmit,
  embedded,
}: ExpenseFormProps) {
  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    resetField,
    formState: { errors },
  } = useForm<FormValues, unknown, CustomExpenseInput>({
    resolver: zodResolver(customExpenseInputSchema),
    defaultValues: {
      name: "",
      category: "",
      type: "recurring",
      recurrence: "monthly",
      allocation: "store",
      channelId: activeStoreId ?? undefined,
      amount: "",
      currency: "USD",
      startDate: todayIso(),
      endDate: undefined,
      active: true,
    },
  });

  const type = watch("type");
  const allocation = watch("allocation");
  const missingStore = allocation === "store" && !activeStoreId;

  // channelId, dağıtım + aktif mağaza seçiminden türetilir (gizli alan).
  useEffect(() => {
    setValue(
      "channelId",
      allocation === "store" ? (activeStoreId ?? undefined) : undefined,
      { shouldValidate: true },
    );
  }, [allocation, activeStoreId, setValue]);

  function submit(values: CustomExpenseInput) {
    onSubmit({
      ...values,
      recurrence: values.type === "recurring" ? values.recurrence : undefined,
    });
    resetField("name");
    resetField("amount");
    resetField("category");
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
              placeholder="Kira"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="space-y-1">
            <Label>Kategori</Label>
            <Input
              placeholder="opsiyonel"
              aria-invalid={!!errors.category}
              {...register("category", { setValueAs: optionalText })}
            />
            <FieldError message={errors.category?.message} />
          </div>
          <div className="space-y-1">
            <Label>Tür</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => field.onChange(v as ExpenseType)}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recurring">Yinelenen</SelectItem>
                    <SelectItem value="one_time">Tek seferlik</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1">
            <Label>Sıklık</Label>
            <Controller
              control={control}
              name="recurrence"
              render={({ field }) => (
                <Select
                  value={field.value ?? undefined}
                  disabled={type !== "recurring"}
                  onValueChange={(v) => field.onChange(v as ExpenseRecurrence)}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_RECURRENCES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {RECURRENCE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.recurrence?.message} />
          </div>
          <div className="space-y-1">
            <Label>Dağıtım</Label>
            <Controller
              control={control}
              name="allocation"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => field.onChange(v as ExpenseAllocation)}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_ALLOCATIONS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {ALLOCATION_LABELS[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {missingStore ? (
              <p className="text-xs text-destructive">Mağaza seçili değil</p>
            ) : (
              <FieldError message={errors.channelId?.message} />
            )}
          </div>
          <div className="space-y-1">
            <Label>Tutar</Label>
            <Input
              inputMode="decimal"
              placeholder="0.00"
              aria-invalid={!!errors.amount}
              {...register("amount", { setValueAs: optionalText })}
            />
            <FieldError message={errors.amount?.message} />
          </div>
          <div className="space-y-1">
            <Label>Para</Label>
            <Input
              maxLength={3}
              aria-invalid={!!errors.currency}
              {...register("currency", { setValueAs: optionalText })}
            />
            <FieldError message={errors.currency?.message} />
          </div>
          <div className="space-y-1">
            <Label>Başlangıç</Label>
            <Controller
              control={control}
              name="startDate"
              render={({ field }) => (
                <DatePicker
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  toDate={watch("endDate") || undefined}
                  className="w-full"
                />
              )}
            />
            <FieldError message={errors.startDate?.message} />
          </div>
          <div className="space-y-1">
            <Label>Bitiş (opsiyonel)</Label>
            <Controller
              control={control}
              name="endDate"
              render={({ field }) => (
                <DatePicker
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="Bitiş yok"
                  fromDate={watch("startDate") || undefined}
                  className="w-full"
                />
              )}
            />
            <FieldError message={errors.endDate?.message} />
          </div>
      <div className="col-span-2 flex items-end sm:col-span-4">
        <Button type="submit" disabled={pending}>
          Ekle
        </Button>
      </div>
    </form>
  );

  if (embedded) return body;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gider ekle</CardTitle>
        <CardDescription>
          Tek seferlik gider yalnız başlangıç gününe; yinelenen gider amortize
          edilerek her güne yazılır.
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
