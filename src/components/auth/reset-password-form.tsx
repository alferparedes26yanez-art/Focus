"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { updatePassword } from "@/lib/actions/auth";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, null);

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage error={state?.error} />
      <FormField
        label="Nueva contraseña"
        htmlFor="password"
        error={state?.fieldErrors?.password}
        hint="Mínimo 8 caracteres."
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </FormField>
      <FormField label="Repite la contraseña" htmlFor="confirm" error={state?.fieldErrors?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </FormField>
      <SubmitButton className="w-full" pendingText="Guardando…">
        Guardar contraseña
      </SubmitButton>
    </form>
  );
}
