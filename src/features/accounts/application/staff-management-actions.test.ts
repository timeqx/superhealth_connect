import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ actor: vi.fn(), privileged: vi.fn(), revalidate: vi.fn(), redirect: vi.fn() }));
vi.mock("@/server/session", () => ({ getActor: mocks.actor }));
vi.mock("@/shared/supabase/privileged", () => ({ authAdminClient: mocks.privileged }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { mocks.redirect(path); throw new Error(`NEXT_REDIRECT:${path}`); } }));
import { changeStaffRole, createStaffAccount, manageStaffAccount } from "./staff-management-actions";

const adminId = "10000000-0000-4000-8000-000000000001";
const targetId = "10000000-0000-4000-8000-000000000002";
const expected = "2026-11-18T08:00:00.123456+08:00";
const input = { first: " Health ", last: " Worker ", email: " Worker@Example.test ", password: "synthetic-password-123", role: "staff", employeeId: " EMP-001 " };

function setup(role: string | null = "admin") {
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  const createUser = vi.fn().mockResolvedValue({ data: { user: { id: targetId } }, error: null });
  mocks.actor.mockResolvedValue(role ? { role, user: { id: adminId }, client: { rpc } } : null);
  const updateUserById = vi.fn().mockResolvedValue({ error: null });
  const deleteUser = vi.fn().mockResolvedValue({ error: null });
  mocks.privileged.mockReturnValue({ auth: { admin: { createUser, updateUserById, deleteUser } } });
  return { rpc, createUser, updateUserById, deleteUser };
}

beforeEach(() => vi.resetAllMocks());

describe("admin staff account creation", () => {
  it.each(["staff", "admin"])("creates a ready-to-sign-in %s account with server-owned provisioning metadata", async role => {
    const { rpc, createUser } = setup();
    const result = await createStaffAccount({ ...input, role, actor_id: targetId });
    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("staff_management_ready");
    expect(createUser).toHaveBeenCalledExactlyOnceWith({
      email: "worker@example.test", password: input.password, email_confirm: true,
      app_metadata: { staff_provisioning: { actor_id: adminId, role, first_name: "Health", last_name: "Worker", employee_id: "EMP-001" } },
    });
    expect(result.message).not.toContain(input.password);
    expect(result.message).toContain("No email confirmation");
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin/staff");
  });

  it.each(["patient", "staff", null])("rejects %s before using privileged Auth APIs", async role => {
    const { rpc, createUser } = setup(role);
    expect((await createStaffAccount(input)).ok).toBe(false);
    expect((await changeStaffRole({ id: targetId, role: "admin", expected })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect(mocks.privileged).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });

  it.each([
    { first: " " }, { last: "" }, { email: "not-an-email" }, { password: "short" },
    { role: "patient" }, { role: "owner" }, { employeeId: "x".repeat(81) },
  ])("rejects invalid account input before Auth creation: %o", async invalid => {
    const { rpc, createUser } = setup();
    expect((await createStaffAccount({ ...input, ...invalid })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });

  it.each([
    { data: null, error: { code: "PGRST202" } },
    { data: false, error: null },
    { data: null, error: { message: "FORBIDDEN" } },
  ])("does not create a default patient if the provisioning preflight fails: %o", async response => {
    const { rpc, createUser } = setup();
    rpc.mockResolvedValue(response);
    expect((await createStaffAccount(input)).ok).toBe(false);
    expect(mocks.privileged).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("reports missing server configuration without exposing it", async () => {
    setup();
    mocks.privileged.mockImplementation(() => { throw new Error("STAFF_MANAGEMENT_NOT_CONFIGURED"); });
    const result = await createStaffAccount(input);
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("temporarily unavailable") });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it.each(["email_exists", "user_already_exists"])("handles %s without modifying an existing account", async code => {
    const { createUser } = setup();
    createUser.mockResolvedValue({ data: { user: null }, error: { code } });
    const result = await createStaffAccount(input);
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("already uses this email") });
    expect(createUser).toHaveBeenCalledOnce();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("returns a safe failure for Auth/trigger errors", async () => {
    const { createUser } = setup();
    createUser.mockRejectedValue(new Error("Internal SQL and secret details"));
    const result = await createStaffAccount(input);
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain("Internal SQL");
    expect(result.message).not.toContain(input.password);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});

describe("admin staff role changes", () => {
  it.each(["admin", "staff"])("assigns %s through the authenticated, version-checked database operation", async role => {
    const { rpc } = setup();
    expect((await changeStaffRole({ id: targetId, role, expected })).ok).toBe(true);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("update_staff_role", { p_user: targetId, p_role: role, p_expected: expected });
    expect(mocks.privileged).not.toHaveBeenCalled();
    expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
  });

  it("returns the shared Requests page after an allowed self-demotion", async () => {
    setup();
    await expect(changeStaffRole({ id: adminId, role: "staff", expected })).rejects.toThrow("NEXT_REDIRECT:/admin");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin");
  });

  it.each([
    ["LAST_ADMIN", "At least one active admin"],
    ["CONFLICT", "Refresh"],
    ["FORBIDDEN", "cannot perform"],
  ])("leaves %s failures unacknowledged", async (error, message) => {
    const { rpc } = setup();
    rpc.mockResolvedValue({ data: null, error: { message: error } });
    expect(await changeStaffRole({ id: targetId, role: "staff", expected })).toMatchObject({ ok: false, message: expect.stringContaining(message) });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it.each([{ role: "patient" }, { id: "bad-id" }, { expected: "" }])("rejects malformed role changes: %o", async invalid => {
    const { rpc } = setup();
    expect((await changeStaffRole({ id: targetId, role: "staff", expected, ...invalid })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});


describe("staff account editing and deletion", () => {
  it.each(["patient", "staff", null])("blocks %s before privileged edits", async role => {
    const { updateUserById, deleteUser } = setup(role);
    for (const kind of ["details", "password", "delete"] as const) {
      expect((await manageStaffAccount(kind, { ...input, id: targetId, expected })).ok).toBe(false);
    }
    expect(updateUserById).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it("changes password without copying it into metadata or the response", async () => {
    const { updateUserById } = setup();
    const result = await manageStaffAccount("password", { id: targetId, expected, password: input.password });
    expect(result.ok).toBe(true);
    const payload = updateUserById.mock.calls[0][1];
    expect(payload.password).toBe(input.password);
    expect(JSON.stringify(payload.app_metadata)).not.toContain(input.password);
    expect(result.message).not.toContain(input.password);
  });
  it("preserves history and does not delete Auth accounts when the guard fails", async () => {
    const { rpc, deleteUser } = setup();
    rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ error: { message: "LAST_ADMIN" } });
    expect((await manageStaffAccount("delete", { id: targetId, expected })).ok).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: true, error: null });
    expect((await manageStaffAccount("delete", { id: targetId, expected })).ok).toBe(true);
    expect(deleteUser).toHaveBeenCalledWith(targetId, true);
  });
});
