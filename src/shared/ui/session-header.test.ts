import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ actor: vi.fn(), config: vi.fn(), rpc: vi.fn() }));
vi.mock("@/server/session", () => ({ getActor: mocks.actor }));
vi.mock("@/shared/supabase/config", () => ({ supabaseConfig: mocks.config }));
vi.mock("./app-header", () => ({ AppHeader: () => null }));
import { SessionHeader } from "./session-header";
import { navigationBadge, parsePortalBadgeCounts } from "@/features/notifications/portal-badges";

const counts = { notifications: 36, inquiries: 3, requests: 27, accounts: 21 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.mockReturnValue({ url: "https://example.test", key: "public-test-key" });
  mocks.actor.mockResolvedValue({ role: "admin", client: { rpc: mocks.rpc } });
  mocks.rpc.mockResolvedValue({ data: counts, error: null });
});

describe("portal navigation counts", () => {
  it("uses the full database counts rather than a visible page length", async () => {
    const header = await SessionHeader();
    expect(header.props).toMatchObject({ role: "admin", unavailable: false, counts });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("portal_badge_counts");
    expect(navigationBadge("/admin", counts)?.count).toBe(27);
    expect(navigationBadge("/patient/notifications", counts)?.count).toBe(36);
  });

  it("keeps signed-in navigation when the badge RPC is unavailable", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    expect((await SessionHeader()).props).toMatchObject({ role: "admin", unavailable: false, counts: undefined });
    mocks.rpc.mockRejectedValue(new Error("Network unavailable"));
    expect((await SessionHeader()).props).toMatchObject({ role: "admin", unavailable: false, counts: undefined });
  });

  it("does not fetch protected counts for a signed-out visitor", async () => {
    mocks.actor.mockResolvedValue(null);
    expect((await SessionHeader()).props).toMatchObject({ role: null, unavailable: false, counts: undefined });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not turn malformed responses into misleading zero badges", async () => {
    for (const value of [null, {}, { ...counts, inquiries: -1 }, { ...counts, accounts: "21" }, { ...counts, notifications: 1.5 }]) {
      expect(parsePortalBadgeCounts(value)).toBeUndefined();
    }
    mocks.rpc.mockResolvedValue({ data: { requests: 27 }, error: null });
    expect((await SessionHeader()).props).toMatchObject({ role: "admin", unavailable: false, counts: undefined });
  });

  it("hides cleared and unrelated badges while preserving exact large counts", () => {
    expect(navigationBadge("/patient/inquiries", { ...counts, inquiries: 0 })).toBeNull();
    expect(navigationBadge("/admin/queue", counts)).toBeNull();
    expect(navigationBadge("/admin", undefined)).toBeNull();
    expect(navigationBadge("/admin/reviews", { ...counts, accounts: 1234 })?.count).toBe(1234);
  });
});
