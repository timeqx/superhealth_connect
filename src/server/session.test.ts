import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: vi.fn(), config: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("@/shared/supabase/server", () => ({ serverClient: mocks.client }));
vi.mock("@/shared/supabase/config", () => ({ supabaseConfig: mocks.config }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
import { getActor, requireActor, requireStaffActor } from "./session";

function setup(role: string | null, disabled = false) {
  const user = { id: "synthetic-user" };
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: table === "profiles" ? { id: user.id } : role ? { role, disabled_at: disabled ? "2026-11-18" : null } : null,
        error: null,
      }),
    })),
  };
  mocks.client.mockResolvedValue(client);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.mockReturnValue({ url: "https://example.test", key: "public-test-key" });
});

describe("server portal authorization", () => {
  it.each(["staff", "admin"])("permits %s accounts in shared staff pages", async role => {
    setup(role);
    expect((await requireStaffActor()).role).toBe(role);
  });

  it("blocks staff on administrator-only pages even when requested directly", async () => {
    setup("staff");
    await expect(requireActor(true)).rejects.toThrow("REDIRECT:/access-denied");
  });

  it("retains administrator access to all protected pages", async () => {
    setup("admin");
    expect((await requireActor(true)).role).toBe("admin");
  });

  it("blocks patients in the shared staff portal", async () => {
    setup("patient");
    await expect(requireStaffActor()).rejects.toThrow("REDIRECT:/access-denied");
    await expect(requireActor(true)).rejects.toThrow("REDIRECT:/access-denied");
    expect((await requireActor()).role).toBe("patient");
  });

  it.each(["staff", "admin"])("requires a new sign-in for disabled %s accounts", async role => {
    setup(role, true);
    expect(await getActor()).toBeNull();
    await expect(requireStaffActor()).rejects.toThrow("REDIRECT:/staff/sign-in");
  });

  it.each([null, "owner"])("denies missing or unknown account roles: %s", async role => {
    setup(role);
    expect(await getActor()).toBeNull();
    await expect(requireStaffActor()).rejects.toThrow("REDIRECT:/staff/sign-in");
  });

  it("sends signed-out visitors to the shared staff sign-in", async () => {
    const client = setup("staff");
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireStaffActor()).rejects.toThrow("REDIRECT:/staff/sign-in");
    expect(client.from).not.toHaveBeenCalled();
  });
});
