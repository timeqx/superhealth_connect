"use server";
import { z } from "zod";
import { serverClient } from "@/shared/supabase/server";
import { getActor } from "@/server/session";
import { safeError, type ActionResult } from "@/shared/lib/errors";
import { credentialsSchema } from "../domain/validation";
import { needsRegistration, registrationStep, signupAccountSchema, signupContactSchema, signupPasswordSchema } from "../domain/registration";

function failure(error: unknown): ActionResult {
  return { ok: false, message: error instanceof z.ZodError ? error.issues[0].message : safeError(error) };
}

function registrationEmailFailure(error: { code?: string; status?: number }): ActionResult {
  const code = typeof error.code === "string" && /^[a-z_]{1,80}$/.test(error.code) ? error.code : "unknown";
  console.warn("[registration-email]", { code, status: error.status });
  const messages: Record<string, string> = {
    email_address_not_authorized: "Verification email is not available for this address because the email service is restricted. Please contact the center to complete registration.",
    over_email_send_rate_limit: "The verification email limit has been reached. Please wait before requesting another email, or contact the center if this continues.",
    over_request_rate_limit: "Too many verification requests. Please wait a few minutes before trying again.",
    email_address_invalid: "This email address cannot receive verification emails. Check the address or use another email address.",
    signup_disabled: "New registrations are temporarily unavailable. Please contact the center.",
    email_provider_disabled: "Email registration is temporarily unavailable. Please contact the center.",
    otp_disabled: "Email verification is temporarily unavailable. Please contact the center.",
  };
  return { ok: false, message: messages[code] ?? "The email service could not send your verification link. Please try again later or contact the center if this continues." };
}

export async function sendRegistrationLink(input: unknown): Promise<ActionResult> {
  try {
    const value = signupAccountSchema.parse(input);
    const client = await serverClient();
    const origin = process.env.APP_URL;
    if (!origin) throw new Error("NOT_CONFIGURED");
    const { error } = await client.auth.signUp({
      email: value.email,
      password: value.password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
          patient_registration_started: true,
          patient_registration_password_set: true,
          registration_draft: value.profile,
          ...(value.qcIdDraftId ? { patient_registration_qc_id_draft_id: value.qcIdDraftId } : {}),
        },
      },
    });
    if (error) return registrationEmailFailure(error);
    return { ok: true, message: "Open the confirmation link in your email using this browser. Your password is set; registration will continue after verification." };
  } catch (error) { return failure(error); }
}

export async function resendRegistrationLink(input: unknown): Promise<ActionResult> {
  try {
    const email = credentialsSchema.shape.email.parse(input).toLowerCase();
    const client = await serverClient();
    const origin = process.env.APP_URL;
    if (!origin) throw new Error("NOT_CONFIGURED");
    const { error } = await client.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error) return registrationEmailFailure(error);
    return { ok: true, message: "A new confirmation link was requested. Open the latest link in your email using this browser." };
  } catch (error) { return failure(error); }
}

export async function resumeRegistration(): Promise<ActionResult> {
  try {
    const actor = await getActor();
    if (!actor?.user.email_confirmed_at) return { ok: false, message: "Waiting for email verification." };
    if (actor.role !== "patient" || !needsRegistration(actor.user.user_metadata))
      return { ok: true, message: "Already registered.", redirectTo: actor.role === "admin" ? "/admin" : "/patient" };
    if (registrationStep(actor.profile) !== 0)
      return { ok: true, message: "Email verified.", redirectTo: "/register" };
    const draft = signupContactSchema.safeParse({ profile: actor.user.user_metadata.registration_draft, email: actor.user.email, consent: true });
    if (!draft.success) return { ok: true, message: "Email verified. Complete your details.", redirectTo: "/register" };
    return await saveRegistrationDetails(draft.data);
  } catch (error) { return failure(error); }
}

export async function saveRegistrationDetails(input: unknown): Promise<ActionResult> {
  try {
    const value = signupContactSchema.parse(input);
    const actor = await getActor();
    if (!actor || !actor.user.email_confirmed_at) throw new Error("UNAUTHENTICATED");
    if (actor.role !== "patient" || !needsRegistration(actor.user.user_metadata))
      return { ok: true, message: "This account is already registered.", redirectTo: actor.role === "admin" ? "/admin" : "/patient" };
    if (actor.user.email?.toLowerCase() !== value.email) throw new Error("FORBIDDEN");
    if (actor.profile.review_status !== "incomplete" || actor.profile.current_document_id)
      return { ok: true, message: "Continue your registration.", redirectTo: "/register" };
    const p = value.profile;
    const { error } = await actor.client.rpc("save_profile", {
      p_first: p.first, p_middle: p.middle, p_last: p.last,
      p_barangay: p.barangay, p_other: p.other, p_phone: p.phone,
    });
    if (error) throw error;
    return { ok: true, message: "Details saved.", redirectTo: "/register" };
  } catch (error) { return failure(error); }
}

export async function completeRegistration(input?: unknown): Promise<ActionResult> {
  try {
    const actor = await getActor();
    if (!actor || !actor.user.email_confirmed_at) throw new Error("UNAUTHENTICATED");
    if (actor.role !== "patient") throw new Error("FORBIDDEN");
    if (registrationStep(actor.profile) === 0)
      return { ok: false, message: "Complete your name, barangay, and mobile number before finishing registration." };
    if (actor.profile.current_document_id) {
      const { data: document, error: documentError } = await actor.client.from("verification_documents")
        .select("id").eq("id", actor.profile.current_document_id).eq("user_id", actor.user.id).maybeSingle();
      if (documentError || !document) throw new Error("FORBIDDEN");
    }
    const completionData = { patient_registration_password_set: true, patient_registration_complete: true };
    if (actor.user.user_metadata.patient_registration_password_set !== true) {
      const value = signupPasswordSchema.parse(input);
      const { error } = await actor.client.auth.updateUser({ password: value.password, data: completionData });
      if (error && error.code !== "same_password")
        return { ok: false, message: "Your password could not be saved. Try a different password, or verify your email again if your session has expired." };
      if (error) {
        const { error: metadataError } = await actor.client.auth.updateUser({ data: completionData });
        if (metadataError) throw metadataError;
      }
    } else {
      const { error } = await actor.client.auth.updateUser({ data: { patient_registration_complete: true } });
      if (error) throw error;
    }
    const { error: signOutError } = await actor.client.auth.signOut({ scope: "local" });
    if (signOutError) return { ok: false, message: "Your registration is saved. Retry to finish signing out safely." };
    return { ok: true, message: "Registration complete. Sign in with your verified email and password.", redirectTo: "/sign-in?registered=1" };
  } catch (error) { return failure(error); }
}
