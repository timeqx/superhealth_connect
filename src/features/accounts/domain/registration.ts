import { z } from "zod";
import { credentialsSchema, profileSchema, registrationSchema, type Profile } from "./validation";

export const signupContactSchema = z.object({
  profile: profileSchema,
  email: credentialsSchema.shape.email.transform(value => value.toLowerCase()),
  consent: registrationSchema.shape.consent,
});
export const signupPasswordSchema = z.object({
  password: registrationSchema.shape.password,
  confirm: z.string(),
}).refine(value => value.password === value.confirm, { message: "Passwords must match.", path: ["confirm"] });

export function profileValues(profile?: Profile) {
  return {
    first: profile?.first_name ?? "", middle: profile?.middle_name ?? "", last: profile?.last_name ?? "",
    barangay: profile?.barangay_code ?? "", other: profile?.other_barangay ?? "", phone: profile?.phone ?? "",
  };
}

export function registrationStep(profile: Profile): 0 | 3 | 4 {
  if (!profileSchema.safeParse(profileValues(profile)).success) return 0;
  return profile.current_document_id && ["pending", "approved"].includes(profile.review_status) ? 4 : 3;
}
export function needsRegistration(metadata: Record<string, unknown>) {
  return metadata.patient_registration_started === true && metadata.patient_registration_complete !== true;
}
