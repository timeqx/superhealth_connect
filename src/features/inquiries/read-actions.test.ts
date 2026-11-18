import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ actor: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/server/session", () => ({ getActor: mocks.actor }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { markInquiryRead } from "./application-actions";

const id = "10000000-0000-4000-8000-000000000001";
const through = "2026-11-18T08:00:00.123456+00:00";

beforeEach(() => vi.clearAllMocks());

describe("marking viewed inquiry updates as read", () => {
  it.each(["patient", "staff", "admin"])("uses the %s session and preserves the viewed timestamp", async role => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.actor.mockResolvedValue({ role, client: { rpc } });
    expect((await markInquiryRead({ id, through })).ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("mark_inquiry_read", { p_inquiry: id, p_through: through });
    expect(mocks.revalidate).toHaveBeenCalledWith(role === "patient" ? "/patient/inquiries" : "/admin/inquiries");
    if (role === "patient") expect(mocks.revalidate).toHaveBeenCalledWith("/patient/notifications");
  });

  it("rejects unauthenticated reads", async () => {
    mocks.actor.mockResolvedValue(null);
    expect((await markInquiryRead({ id, through })).ok).toBe(false);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it.each([{ id: "bad-id", through }, { id, through: "not-a-date" }, { id }])("rejects an invalid read boundary", async input => {
    expect((await markInquiryRead(input)).ok).toBe(false);
    expect(mocks.actor).not.toHaveBeenCalled();
  });

  it("reports rejected database writes without pretending the update was read", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: new Error("FORBIDDEN") });
    mocks.actor.mockResolvedValue({ role: "patient", client: { rpc } });
    expect((await markInquiryRead({ id, through })).ok).toBe(false);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
