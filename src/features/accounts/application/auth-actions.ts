"use server";
import { serverClient } from "@/shared/supabase/server";
import { credentialsSchema, registrationSchema } from "../domain/validation";
import type { ActionResult } from "@/shared/lib/errors";
import { safeError } from "@/shared/lib/errors";
import { redirect } from "next/navigation";
export async function authenticate(
  mode: string,
  input: { email: string; password: string; consent: boolean },
): Promise<ActionResult> {
  try {
    const client = await serverClient();
    const origin = process.env.APP_URL;
    if (mode === "register") {
      const parsed = registrationSchema.safeParse(input);
      if (!parsed.success)
        return { ok: false, message: parsed.error.issues[0].message };
      if (!origin) throw new Error("NOT_CONFIGURED");
      const { error } = await client.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      if (error)
        return {
          ok: false,
          message:
            "We couldn’t create your account. Check your details or try again later.",
        };
      return {
        ok: true,
        message:
          "Check your email to verify your account, then sign in to complete your profile.",
      };
    }
    if (mode === "forgot") {
      const parsed = credentialsSchema.shape.email.safeParse(input.email);
      if (!parsed.success)
        return { ok: false, message: "Enter a valid email address." };
      if (!origin) throw new Error("NOT_CONFIGURED");
      await client.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      });
      return {
        ok: true,
        message:
          "If this address has an account, you’ll receive a password reset email.",
      };
    }
    if (mode === "reset") {
      const parsed = registrationSchema.shape.password.safeParse(
        input.password,
      );
      if (!parsed.success)
        return { ok: false, message: parsed.error.issues[0].message };
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user)
        return {
          ok: false,
          message: "Open a valid password reset link first.",
        };
      const { error } = await client.auth.updateUser({ password: parsed.data });
      if (error)
        return {
          ok: false,
          message:
            "The password could not be updated. Request a new reset link.",
        };
      return { ok: true, message: "Password updated.", redirectTo: "/patient" };
    }
    const parsed = credentialsSchema.safeParse(input);
    if (!parsed.success)
      return { ok: false, message: parsed.error.issues[0].message };
    const { data, error } = await client.auth.signInWithPassword(parsed.data);
    if (error)
      return {
        ok: false,
        message:
          "Unable to sign in. Check your email, password, and email verification.",
      };
    const { data: role, error: roleError } = await client
      .from("user_roles")
      .select("role,disabled_at")
      .eq("user_id", data.user.id)
      .single();
    if (roleError || !role || role.disabled_at) {
      await client.auth.signOut();
      return {
        ok: false,
        message:
          "Account access could not be confirmed. Please contact the project operator.",
      };
    }
    return {
      ok: true,
      message: "Signed in.",
      redirectTo: role.role === "admin" ? "/admin" : "/patient",
    };
  } catch (error) {
    return { ok: false, message: safeError(error) };
  }
}
export async function signOut() {
  const client = await serverClient();
  const { error } = await client.auth.signOut();
  if (error) throw new Error("Sign out failed. Please try again.");
  redirect("/sign-in");
}
