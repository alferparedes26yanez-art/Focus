"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, null);
  const linkError = useSearchParams().get("error") === "link";

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage
        error={
          state?.error ??
          (linkError && !state ? "El enlace no es válido o ya expiró. Inicia sesión o pide uno nuevo." : null)
        }
      />
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
      <FormField label="Contraseña" htmlFor="password" error={state?.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </FormField>
      <div className="-mt-2 text-right">
        <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
      <SubmitButton className="w-full" pendingText="Entrando…">
        Iniciar sesión
      </SubmitButton>
    </form>
  );
}
