"use server";

import { refresh } from "next/cache";

import { requireUser } from "@/lib/auth";
import { isValidTimeZone } from "@/lib/dates";
import { profileInputSchema } from "@/lib/validation";

import { fieldErrorsFrom, type FormState } from "./types";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, userId } = await requireUser();
  const parsed = profileInputSchema.safeParse({
    full_name: String(formData.get("full_name") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }
  if (!isValidTimeZone(parsed.data.timezone)) {
    return { fieldErrors: { timezone: "Zona horaria no válida" } };
  }

  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", userId);
  if (error) {
    return { error: "No se pudieron guardar los cambios." };
  }

  refresh();
  return { success: "Cambios guardados." };
}

export async function completeOnboarding(): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", userId);
}
