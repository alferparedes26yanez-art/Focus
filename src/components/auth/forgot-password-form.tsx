"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/actions/auth";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, null);

  if (state?.success) {
    return <FormMessage success={state.success} />;
  }

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage error={state?.error} />
      <FormField label="Correo" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state?.values?.email}
        />
      </FormField>
      <SubmitButton className="w-full" pendingText="Enviando…">
        Enviar enlace
      </SubmitButton>
    </form>
  );
}
