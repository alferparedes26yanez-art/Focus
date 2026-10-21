"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ConfigError } from "@/lib/env/config-error";
import { getSiteUrl } from "@/lib/env/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { passwordSchema } from "@/lib/validation";

import { fieldErrorsFrom, type FormState } from "./types";

const emailSchema = z.email("Correo no válido").max(200).transform((email) => email.toLowerCase());

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// While the app is being set up, say which variable is wrong instead of a
// generic error. Config messages never include the values themselves.
function setupError(error: unknown, fallback: string): string {
  if (error instanceof ConfigError) return `La app no está bien configurada. ${error.message}`;
  console.error("[auth]", error);
  return fallback;
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1, "Escribe tu contraseña") })
    .safeParse({ email: text(formData, "email"), password: text(formData, "password") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values: { email: text(formData, "email") } };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    return {
      error: setupError(error, "No pudimos iniciar sesión. Inténtalo de nuevo en un momento."),
      values: { email: parsed.data.email },
    };
  }
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message =
      error.code === "email_not_confirmed"
        ? "Primero confirma tu correo: revisa tu bandeja de entrada (y la carpeta de spam)."
        : error.code === "invalid_credentials"
          ? "Correo o contraseña incorrectos."
          : "No pudimos iniciar sesión. Inténtalo de nuevo en un momento.";
    return { error: message, values: { email: parsed.data.email } };
  }

  redirect("/home");
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { full_name: text(formData, "full_name"), email: text(formData, "email") };
  const parsed = z
    .object({
      full_name: z.string().trim().min(1, "Escribe tu nombre").max(120),
      email: emailSchema,
      password: passwordSchema,
      timezone: z.string().max(64),
    })
    .safeParse({ ...values, password: text(formData, "password"), timezone: text(formData, "timezone") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values };
  }

  // Checked here for a clear message; the database enforces it too.
  let allowed = false;
  try {
    const { data, error } = await createAdminClient().rpc("is_signup_allowed", {
      p_email: parsed.data.email,
    });
    if (error) throw error;
    allowed = data === true;
  } catch (error) {
    console.error("[auth] allowlist check failed:", error);
    return { error: setupError(error, "No pudimos crear tu cuenta en este momento. Inténtalo más tarde."), values };
  }
  if (!allowed) {
    return {
      error: "Este correo todavía no está habilitado. Focus está en etapa privada por ahora.",
      values,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/confirm`,
      data: { full_name: parsed.data.full_name, timezone: parsed.data.timezone },
    },
  });

  if (error) {
    const message =
      error.code === "user_already_exists"
        ? "Ya existe una cuenta con este correo. Inicia sesión."
        : error.code === "weak_password"
          ? "Esa contraseña es muy débil. Prueba con una más larga."
          : error.code === "over_email_send_rate_limit"
            ? "Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo."
            : "No pudimos crear tu cuenta. Inténtalo de nuevo.";
    return { error: message, values };
  }

  if (data.session) {
    // Email confirmation is disabled in this project.
    redirect("/onboarding");
  }

  return {
    success: `Te enviamos un correo a ${parsed.data.email}. Abre el enlace para activar tu cuenta.`,
  };
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(text(formData, "email"));
  if (!parsed.success) {
    return { fieldErrors: { email: "Correo no válido" }, values: { email: text(formData, "email") } };
  }

  let supabase;
  let siteUrl;
  try {
    supabase = await createClient();
    siteUrl = getSiteUrl();
  } catch (error) {
    return { error: setupError(error, "No pudimos enviar el enlace. Inténtalo más tarde."), values: { email: parsed.data } };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  });
  if (error && error.code === "over_email_send_rate_limit") {
    return { error: "Se enviaron demasiados correos. Espera unos minutos.", values: { email: parsed.data } };
  }

  // Same answer whether or not the account exists.
  return {
    success: "Si hay una cuenta con ese correo, te llegará un enlace para elegir una nueva contraseña.",
  };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ password: passwordSchema, confirm: z.string() })
    .refine((value) => value.password === value.confirm, {
      path: ["confirm"],
      message: "Las contraseñas no coinciden",
    })
    .safeParse({ password: text(formData, "password"), confirm: text(formData, "confirm") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return { error: "El enlace expiró. Pide uno nuevo desde «¿Olvidaste tu contraseña?»." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "La nueva contraseña debe ser distinta de la anterior."
          : "No pudimos cambiar tu contraseña. Inténtalo de nuevo.",
    };
  }

  redirect("/home");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
