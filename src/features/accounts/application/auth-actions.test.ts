import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: vi.fn(), redirect: vi.fn() }));
vi.mock("@/shared/supabase/server", () => ({ serverClient: mocks.client }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { authenticate, signOut } from "./auth-actions";

const input = { email: "operator@example.test", password: "synthetic-password-123", consent: true };
function setup(role: string | null = "staff", disabled = false) {
  const user = { id: "synthetic-user", user_metadata: { patient_registration_started: true } };
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: role ? { role, disabled_at: disabled ? "2026-11-18T00:00:00Z" : null } : null, error: null }),
  };
  const client = {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(() => query),
  };
  mocks.client.mockResolvedValue(client);
  return { client, user, query };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_URL", "http://localhost:3000");
});

describe("shared staff sign-in", () => {
  it.each(["staff", "admin"])("accepts %s accounts and opens the same portal", async role => {
    const { client } = setup(role);
    expect(await authenticate("sign-in", input, "staff")).toMatchObject({ ok: true, redirectTo: "/admin" });
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  it.each(["staff", "admin"])("rejects %s accounts from patient sign-in", async role => {
    const { client } = setup(role);
    expect(await authenticate("sign-in", input, "patient")).toMatchObject({ ok: false, message: expect.stringContaining("staff sign-in") });
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("rejects patients from staff sign-in", async () => {
    const { client } = setup("patient");
    expect(await authenticate("sign-in", input, "staff")).toMatchObject({ ok: false, message: expect.stringContaining("patient sign-in") });
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it.each(["staff", "admin"])("rejects a disabled %s account", async role => {
    const { client } = setup(role, true);
    expect((await authenticate("sign-in", input, "staff")).ok).toBe(false);
    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it.each([null, "owner"])("rejects a missing or invalid role: %s", async role => {
    const { client } = setup(role);
    expect((await authenticate("sign-in", input, "staff")).ok).toBe(false);
    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it("preserves patient registration and completed-account destinations", async () => {
    const { user } = setup("patient");
    expect((await authenticate("sign-in", input)).redirectTo).toBe("/register");
    Object.assign(user.user_metadata, { patient_registration_complete: true });
    expect((await authenticate("sign-in", input)).redirectTo).toBe("/patient");
  });
});

describe("staff account recovery and sign-out", () => {
  it.each(["staff", "admin"])("returns %s accounts to the staff portal after password reset", async role => {
    setup(role);
    expect(await authenticate("reset", input, "staff")).toMatchObject({ ok: true, redirectTo: "/admin" });
  });

  it.each(["staff", "admin"])("returns %s accounts to shared staff sign-in after sign-out", async role => {
    setup(role);
    await signOut();
    expect(mocks.redirect).toHaveBeenCalledWith("/staff/sign-in");
  });

  it("retains patient sign-out", async () => {
    setup("patient");
    await signOut();
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("uses the shared staff password-recovery route", async () => {
    const { client } = setup();
    expect((await authenticate("forgot", input, "staff")).ok).toBe(true);
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(input.email, {
      redirectTo: "http://localhost:3000/auth/callback?next=/staff/reset-password",
    });
  });
});
