import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  ASSIGNABLE_ROLES,
  inviteMemberSchema,
  type InviteMemberInput,
} from "../types/member-types";

interface InviteMemberDialogProps {
  pending: boolean;
  /** Davet mutasyonu (mutateAsync); başarılıysa modal kapanır. */
  onInvite: (v: InviteMemberInput) => Promise<unknown>;
}

const DEFAULTS: InviteMemberInput = { email: "", role: "viewer" };

/** "Üye davet et" akışını barındıran modal (tetikleyici buton + form). */
export function InviteMemberDialog({ pending, onInvite }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: DEFAULTS,
  });

  async function submit(values: InviteMemberInput) {
    try {
      await onInvite(values);
      form.reset(DEFAULTS);
      setOpen(false);
    } catch {
      /* hata mutasyonun onError'ında toast'lanır; modal açık kalır */
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) form.reset(DEFAULTS);
      }}
    >
      <DialogTrigger asChild>
        <Button>Üye davet et</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Üye davet et</DialogTitle>
          <DialogDescription>
            E-posta ile davet oluştur; davet linki üretilir.
          </DialogDescription>
        </DialogHeader>
        <form
          id="invite-member-form"
          onSubmit={form.handleSubmit(submit)}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label htmlFor="invite-email">E-posta</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="ad@ornek.com"
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label>Rol</Label>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </form>
        <DialogFooter>
          <Button
            type="submit"
            form="invite-member-form"
            disabled={pending}
          >
            Davet et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
