"use server";
import { serverClient } from "@/shared/supabase/server";
import { credentialsSchema, registrationSchema } from "../domain/validation";
import type { ActionResult } from "@/shared/lib/errors";
import { safeError } from "@/shared/lib/errors";
import { redirect } from "next/navigation";
import { needsRegistration } from "../domain/registration";
export async function authenticate(
  mode: string,
  input: { email: string; password: string; consent: boolean },
  portal: "patient" | "staff" = "patient",
): Promise<ActionResult> {
  try {
    const client = await serverClient();
    const origin = process.env.APP_URL;
    if (mode === "register") return { ok: false, message: "Start patient registration at /register." };
    if (mode === "forgot") {
      const parsed = credentialsSchema.shape.email.safeParse(input.email);
      if (!parsed.success)
        return { ok: false, message: "Enter a valid email address." };
      if (!origin) throw new Error("NOT_CONFIGURED");
      await client.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${origin}/auth/callback?next=${portal === "staff" ? "/staff/reset-password" : "/reset-password"}`,
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
      const { data: role } = await client.from("user_roles").select("role,disabled_at").eq("user_id", user.id).single();
      if (!role || role.disabled_at) {
        await client.auth.signOut({ scope: "local" });
        return { ok: false, message: "Password updated, but account access could not be confirmed. Contact the project operator." };
      }
      return { ok: true, message: "Password updated.", redirectTo: role.role === "admin" ? "/admin" : needsRegistration(user.user_metadata) ? "/register" : "/patient" };
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
    if (role.role !== (portal === "staff" ? "admin" : "patient")) {
      await client.auth.signOut({ scope: "local" });
      return {
        ok: false,
        message: portal === "staff"
          ? "This account does not have staff access. Use the patient sign-in page."
          : "This is a staff account. Use the staff sign-in page.",
      };
    }
    return {
      ok: true,
      message: "Signed in.",
      redirectTo: role.role === "admin" ? "/admin" : needsRegistration(data.user.user_metadata) ? "/register" : "/patient",
    };
  } catch (error) {
    return { ok: false, message: safeError(error) };
  }
}
export async function signOut() {
  const client = await serverClient();
  const { data: { user } } = await client.auth.getUser();
  const role = user ? (await client.from("user_roles").select("role").eq("user_id", user.id).single()).data?.role : null;
  const { error } = await client.auth.signOut();
  if (error) throw new Error("Sign out failed. Please try again.");
  redirect(role === "admin" ? "/staff/sign-in" : "/sign-in");
}
