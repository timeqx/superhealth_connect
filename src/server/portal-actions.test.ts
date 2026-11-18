import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ actor: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/server/session", () => ({ getActor: mocks.actor }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { queueOperation } from "@/features/queue/actions";
import { replyInquiry } from "@/features/inquiries/application-actions";
import { staffAppointmentAction, staffBook, staffAlternatives } from "@/features/appointments/application/staff-actions";

const id = "10000000-0000-4000-8000-000000000001";
const key = "20000000-0000-4000-8000-000000000001";
const expected = "2026-11-18T08:00:00+08:00";
const reply = { id, key, body: "Please bring your appointment reference.", publish: false, status: "in_progress" };

beforeEach(() => vi.clearAllMocks());
function setup(role: string | null) {
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn();
  mocks.actor.mockResolvedValue(role ? { role, client: { rpc, from } } : null);
  return { rpc, from };
}

describe("shared staff portal actions", () => {
  it.each(["staff", "admin"])("allows %s to check in patients and advance queues", async role => {
    const { rpc } = setup(role);
    expect((await queueOperation({ id, key, action: "check_in" })).ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("check_in", { p_id: id, p_key: key, p_override_reason: null });
    expect((await queueOperation({ id, key, action: "call_next" })).ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("advance_queue", { p_session: id, p_action: "call_next", p_key: key, p_ticket: null });
  });

  it.each(["patient", null])("rejects queue operations by %s before contacting the database", async role => {
    const { rpc } = setup(role);
    expect((await queueOperation({ id, key, action: "check_in" })).ok).toBe(false);
    expect((await queueOperation({ id, key, action: "call_next" })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(["staff", "admin"])("allows %s to create, edit, and publish inquiry drafts", async role => {
    const { rpc } = setup(role);
    expect((await replyInquiry(reply)).ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("reply_inquiry", expect.objectContaining({ p_publish: false, p_status: "in_progress" }));
    expect((await replyInquiry({ ...reply, draft: id, expected })).ok).toBe(true);
    expect((await replyInquiry({ ...reply, draft: id, expected, publish: true, status: "resolved" })).ok).toBe(true);
    expect(rpc).toHaveBeenLastCalledWith("edit_inquiry_draft", {
      p_id: id, p_body: reply.body, p_publish: true, p_status: "resolved", p_expected: expected, p_key: key,
    });
  });

  it("preserves patient replies while rejecting private drafts and staff-only statuses", async () => {
    const { rpc } = setup("patient");
    expect((await replyInquiry(reply)).ok).toBe(false);
    expect((await replyInquiry({ ...reply, publish: true, status: "resolved" })).ok).toBe(false);
    expect((await replyInquiry({ ...reply, draft: id, expected, publish: true, status: "open" })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect((await replyInquiry({ ...reply, publish: true, status: "open" })).ok).toBe(true);
    expect(rpc).toHaveBeenCalledOnce();
  });

  it.each(["staff", "patient", null])("denies %s access to booking and appointment-history management", async role => {
    const { rpc } = setup(role);
    expect((await staffBook({ patient: id, slot: id, reason: "Patient requested assistance", key })).ok).toBe(false);
    for (const action of (role === "staff" ? ["no_show"] : ["cancel", "no_show"])) {
      expect((await staffAppointmentAction({ id, key, expected, action, reason: "Patient unavailable" })).ok).toBe(false);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(["staff", "admin"])("allows %s to cancel with a required patient-visible reason", async role => {
    const { rpc } = setup(role);
    expect((await staffAppointmentAction({ id, key, expected, action: "cancel", reason: "  " })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect((await staffAppointmentAction({ id, key, expected, action: "cancel", reason: " Staff emergency " })).ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("change_appointment", { p_id: id, p_key: key, p_expected: expected, p_action: "cancel", p_reason: "Staff emergency" });
    expect(mocks.revalidate).toHaveBeenCalledWith("/patient/notifications");
  });

  it("retains admin booking and appointment-history management", async () => {
    const { rpc } = setup("admin");
    expect((await staffBook({ patient: id, slot: id, reason: "Patient requested assistance", key })).ok).toBe(true);
    expect((await staffAppointmentAction({ id, key, expected, action: "no_show", reason: "Patient unavailable" })).ok).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it.each(["staff", "admin"])("allows %s to suggest alternative sessions when declining a request", async role => {
    const { from, rpc } = setup(role);
    const single = vi.fn().mockResolvedValue({ data: { slot_id: id, service_slots: { service_id: id } }, error: null });
    from.mockReturnValue({ select: () => ({ eq: () => ({ single }) }) });
    const slots = [{ id: key, starts_at: expected, ends_at: expected }];
    rpc.mockReturnValue({ neq: () => ({ gt: () => ({ order: () => ({ limit: async () => ({ data: slots, error: null }) }) }) }) });
    expect(await staffAlternatives(id)).toEqual(slots);
    expect(rpc).toHaveBeenCalledWith("slot_availability", { p_service: id });
  });
});
