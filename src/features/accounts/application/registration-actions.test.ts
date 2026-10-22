import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "../domain/validation";
import { profileValues, registrationStep } from "../domain/registration";

const mocks = vi.hoisted(() => ({ client: vi.fn(), actor: vi.fn() }));
vi.mock("@/shared/supabase/server", () => ({ serverClient: mocks.client }));
vi.mock("@/server/session", () => ({ getActor: mocks.actor }));
import { completeRegistration, saveRegistrationDetails, sendRegistrationLink, resumeRegistration } from "./registration-actions";

const profile: Profile = { id: "synthetic-patient", first_name: "Sample", middle_name: "", last_name: "Patient", barangay_code: "Others", other_barangay: "Sample barangay", phone: "+639171234567", review_status: "pending", rejection_reason: null, current_document_id: "synthetic-document" };
const contact = { profile: profileValues(profile), email: "synthetic@example.test", consent: true };
const password = { password: "synthetic-password-123", confirm: "synthetic-password-123" };
function setup(overrides: Partial<Profile> = {}) {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: profile.current_document_id }, error: null }) };
  const client = { auth: { signInWithOtp: vi.fn().mockResolvedValue({ error: null }), verifyOtp: vi.fn().mockResolvedValue({ error: null }), updateUser: vi.fn().mockResolvedValue({ error: null }), signOut: vi.fn().mockResolvedValue({ error: null }) }, rpc: vi.fn().mockResolvedValue({ error: null }), from: vi.fn(() => query) };
  const actor = { client, role: "patient", user: { id: profile.id, email: contact.email, email_confirmed_at: "2026-10-22T00:00:00Z", user_metadata: { patient_registration_started: true } }, profile: { ...profile, ...overrides } };
  mocks.client.mockResolvedValue(client); mocks.actor.mockResolvedValue(actor);
  return { client, actor, query };
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("APP_URL", "http://localhost:3000"); });
describe("patient registration gates", () => {
  it("requires Others text and consent before sending a real OTP", async () => {
    const { client } = setup();
    expect((await sendRegistrationLink({ ...contact, profile: { ...contact.profile, other: "" } })).ok).toBe(false);
    expect((await sendRegistrationLink({ ...contact, consent: false })).ok).toBe(false);
    expect(client.auth.signInWithOtp).not.toHaveBeenCalled();
    expect((await sendRegistrationLink(contact)).ok).toBe(true);
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({ email: contact.email, options: { shouldCreateUser: true, emailRedirectTo: "http://localhost:3000/auth/callback", data: { patient_registration_started: true, registration_draft: contact.profile } } });
  });
  it("refuses profile writes without verified ownership of the email", async () => {
    const { client, actor } = setup({ review_status: "incomplete", current_document_id: null });
    expect((await saveRegistrationDetails({ ...contact, email: "other@example.test" })).ok).toBe(false);
    actor.user.email_confirmed_at = "";
    expect((await saveRegistrationDetails(contact)).ok).toBe(false);
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("saves a normalized profile only after verification", async () => {
    const { client } = setup({ review_status: "incomplete", current_document_id: null });
    expect((await saveRegistrationDetails({ ...contact, profile: { ...contact.profile, phone: "09171234567" } })).redirectTo).toBe("/register");
    expect(client.rpc).toHaveBeenCalledWith("save_profile", expect.objectContaining({ p_phone: "+639171234567", p_other: "Sample barangay" }));
  });
  it("does not overwrite an identity already submitted for review", async () => {
    const { client } = setup();
    expect((await saveRegistrationDetails(contact)).ok).toBe(true);
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("derives resumed steps from saved profile and document state", () => {
    expect(registrationStep({ ...profile, last_name: "" })).toBe(0);
    expect(registrationStep({ ...profile, current_document_id: null })).toBe(3);
    expect(registrationStep({ ...profile, review_status: "rejected" })).toBe(3);
    expect(registrationStep(profile)).toBe(4);
  });
  it("rejects password completion before QC ID submission", async () => {
    const { client } = setup({ current_document_id: null, review_status: "incomplete" });
    expect((await completeRegistration(password)).ok).toBe(false);
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });
  it("requires an active patient and an owned document even if metadata claims completion", async () => {
    const { client, actor, query } = setup();
    Object.assign(actor.user.user_metadata, { patient_registration_complete: true });
    actor.role = "admin";
    expect((await completeRegistration(password)).ok).toBe(false);
    actor.role = "patient";
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await completeRegistration(password)).ok).toBe(false);
    mocks.actor.mockResolvedValue(null);
    expect((await completeRegistration(password)).ok).toBe(false);
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });
  it("rejects mismatched passwords", async () => {
    const { client } = setup();
    expect((await completeRegistration({ ...password, confirm: "different-password" })).ok).toBe(false);
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });
  it("sets the password then signs out and returns to login", async () => {
    const { client, query } = setup();
    expect((await completeRegistration(password)).redirectTo).toBe("/sign-in?registered=1");
    expect(query.eq).toHaveBeenCalledWith("user_id", profile.id);
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: password.password, data: { patient_registration_complete: true } });
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("reconciles a password already saved after an uncertain response", async () => {
    const { client } = setup();
    client.auth.updateUser.mockResolvedValueOnce({ error: { code: "same_password" } });
    expect((await completeRegistration(password)).ok).toBe(true);
    expect(client.auth.updateUser).toHaveBeenLastCalledWith({ data: { patient_registration_complete: true } });
  });
});


describe("registration email failures", () => {
  it.each([
    ["email_address_not_authorized", "email service is restricted"],
    ["over_email_send_rate_limit", "email limit has been reached"],
    ["signup_disabled", "registrations are temporarily unavailable"],
    ["unexpected_failure", "email service could not send"],
  ])("reports %s without exposing provider details", async (code, message) => {
    const { client } = setup();
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      client.auth.signInWithOtp.mockResolvedValue({ error: { code, status: 422, message: "private provider detail" } });
      const result = await sendRegistrationLink(contact);
      expect(result.ok).toBe(false);
      expect(result.message).toContain(message);
      expect(result.message).not.toContain("private provider detail");
      expect(log).toHaveBeenCalledWith("[registration-email]", { code, status: 422 });
      expect(client.auth.signInWithOtp).toHaveBeenCalledTimes(1);
    } finally { log.mockRestore(); }
  });
});


describe("link registration resume", () => {
  it("waits for verified email before saving", async () => {
    const { client, actor } = setup(); actor.user.email_confirmed_at = "";
    expect((await resumeRegistration()).ok).toBe(false);
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("saves validated draft after verification", async () => {
    const { actor, client } = setup({ first_name: "", review_status: "incomplete", current_document_id: null });
    Object.assign(actor.user.user_metadata, { registration_draft: contact.profile });
    expect(await resumeRegistration()).toMatchObject({ ok: true, redirectTo: "/register" });
    expect(client.rpc).toHaveBeenCalled();
  });
  it("does not overwrite an already submitted profile", async () => {
    const { client } = setup();
    expect(await resumeRegistration()).toMatchObject({ ok: true, redirectTo: "/register" });
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
