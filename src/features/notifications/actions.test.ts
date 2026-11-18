import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ actor: vi.fn(), revalidate: vi.fn(), rpc: vi.fn() }));
vi.mock("@/server/session", () => ({ getActor: mocks.actor }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { readAllNotifications } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.actor.mockResolvedValue({ role: "patient", client: { rpc: mocks.rpc } });
  mocks.rpc.mockResolvedValue({ data: 35, error: null });
});

describe("mark all notifications as read", () => {
  it("marks all pages using the signed-in session without accepting another recipient", async () => {
    expect(await readAllNotifications()).toEqual({ ok: true, message: "All notifications marked as read." });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("mark_all_notifications_read");
    expect(mocks.revalidate).toHaveBeenCalledWith("/patient/notifications");
  });

  it("handles an already cleared inbox", async () => {
    mocks.rpc.mockResolvedValue({ data: 0, error: null });
    expect(await readAllNotifications()).toEqual({ ok: true, message: "All notifications are already read." });
  });

  it("requires a signed-in user", async () => {
    mocks.actor.mockResolvedValue(null);
    expect((await readAllNotifications()).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("reports database failures without presenting a successful read", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("FORBIDDEN") });
    expect((await readAllNotifications()).ok).toBe(false);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("reports connection failures so the user can retry", async () => {
    mocks.rpc.mockRejectedValue(new Error("Network unavailable"));
    expect((await readAllNotifications()).ok).toBe(false);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
