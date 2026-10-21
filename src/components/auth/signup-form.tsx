"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { signUp } from "@/lib/actions/auth";

export function SignupForm() {
  const [state, formAction] = useActionState(signUp, null);

  if (state?.success) {
    return <FormMessage success={state.success} />;
  }

  return (
    <form
      action={(formData) => {
        // The time zone decides what "today" is for exams and reminders.
        formData.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
        return formAction(formData);
      }}
      className="grid gap-4"
    >
      <FormMessage error={state?.error} />
      <FormField label="Nombre" htmlFor="full_name" error={state?.fieldErrors?.full_name}>
        <Input
          id="full_name"
          name="full_name"
          autoComplete="given-name"
          required
          defaultValue={state?.values?.full_name}
        />
      </FormField>
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
      <FormField
        label="Contraseña"
        htmlFor="password"
        error={state?.fieldErrors?.password}
        hint="Mínimo 8 caracteres."
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </FormField>
      <SubmitButton className="w-full" pendingText="Creando cuenta…">
        Crear cuenta
      </SubmitButton>
    </form>
  );
}
