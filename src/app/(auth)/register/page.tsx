import { profileSchema } from "@/features/accounts/domain/validation";
import { RegistrationForm } from "@/features/accounts/presentation/registration-form";
import { needsRegistration, registrationStep } from "@/features/accounts/domain/registration";
import { getActor } from "@/server/session";
import { supabaseConfig } from "@/shared/supabase/config";
import { redirect } from "next/navigation";
import { PageTitle } from "@/shared/ui/components";
import { AuthBackLink } from "@/shared/ui/auth-back-link";
export default async function Register() {
  const configured = Boolean(supabaseConfig());
  const actor = configured ? await getActor() : null;
  if (actor && (actor.role !== "patient" || !needsRegistration(actor.user.user_metadata)))
    redirect(actor.role === "admin" ? "/admin" : "/patient");
  if (actor?.profile.review_status === "rejected") redirect("/patient/profile");
  const verified = actor && actor.user.email_confirmed_at ? actor : null;
  const needsPassword = Boolean(verified && verified.user.user_metadata.patient_registration_password_set !== true);
  const documentDraftId = typeof verified?.user.user_metadata.patient_registration_qc_id_draft_id === "string"
    ? verified.user.user_metadata.patient_registration_qc_id_draft_id
    : undefined;
  const draft = profileSchema.safeParse(verified?.user.user_metadata.registration_draft);
  const resumeDraft = verified && registrationStep(verified.profile) === 0 && draft.success;
  return (
    <>
      <AuthBackLink />
      <PageTitle eyebrow="GET STARTED" title="Create your account">
        Enter your details, optionally select your QC ID, then set your email and password. Staff approval is required before appointment requests.
      </PageTitle>
      <RegistrationForm key={`${verified?.user.id ?? "new"}:${resumeDraft ? 2 : verified ? 3 : 0}`} initialStep={resumeDraft ? 2 : verified ? 3 : 0} draft={resumeDraft ? draft.data : undefined}
        profile={verified?.profile} verifiedEmail={verified?.user.email} needsPassword={needsPassword} documentDraftId={documentDraftId}
        uploadsConfigured={configured && Boolean(process.env.SUPABASE_SECRET_KEY)} />
    </>
  );
}
