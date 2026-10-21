"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { updateProfile } from "@/lib/actions/profile";

export function ProfileForm({
  fullName,
  timezone,
  timeZones,
}: {
  fullName: string | null;
  timezone: string;
  timeZones: string[];
}) {
  const [state, formAction] = useActionState(updateProfile, null);
  const options = timeZones.includes(timezone) ? timeZones : [timezone, ...timeZones];

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage error={state?.error} success={state?.success} />
      <FormField label="Nombre" htmlFor="full_name" error={state?.fieldErrors?.full_name}>
        <Input id="full_name" name="full_name" defaultValue={fullName ?? ""} maxLength={120} autoComplete="given-name" />
      </FormField>
      <FormField
        label="Zona horaria"
        htmlFor="timezone"
        error={state?.fieldErrors?.timezone}
        hint="Define qué día es «hoy» para tus exámenes y entregas."
      >
        <NativeSelect id="timezone" name="timezone" defaultValue={timezone}>
          {options.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <SubmitButton className="w-fit" pendingText="Guardando…">
        Guardar cambios
      </SubmitButton>
    </form>
  );
}
