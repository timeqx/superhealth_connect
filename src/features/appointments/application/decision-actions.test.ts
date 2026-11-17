import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ actor: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/server/session", () => ({ getActor: mocks.actor }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { bulkDecideAppointments, decideAppointment } from "./decision-actions";

const requests = [1, 2, 3].map(index => ({
  id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  key: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  expected: "2026-11-16T08:00:00.123456+08:00",
}));
const input = { decision: "approve", reason: "", requests };
function setup(role = "admin") {
  const rpc = vi.fn().mockResolvedValue({ error: null });
  mocks.actor.mockResolvedValue({ role, client: { rpc } });
  return rpc;
}
beforeEach(() => vi.clearAllMocks());

describe("staff appointment decisions", () => {
  it("requires an authenticated staff member for individual and bulk decisions", async () => {
    const rpc = setup("patient");
    expect((await bulkDecideAppointments(input)).ok).toBe(false);
    expect((await decideAppointment({ ...requests[0], decision: "approve", reason: "" })).ok).toBe(false);
    mocks.actor.mockResolvedValue(null);
    expect((await bulkDecideAppointments(input)).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("approves each selected request with its exact timestamp and retry key", async () => {
    const rpc = setup();
    const result = await bulkDecideAppointments(input);
    expect(result.ok).toBe(true);
    expect(result.results).toEqual(requests.map(({ id }) => ({ id, ok: true, message: "Appointment approved." })));
    for (const request of requests) {
      expect(rpc).toHaveBeenCalledWith("change_appointment", {
        p_id: request.id, p_key: request.key, p_expected: request.expected,
        p_action: "approve", p_reason: null, p_target: null,
      });
    }
    expect(mocks.revalidate).toHaveBeenCalledWith("/patient/appointments");
    expect(mocks.revalidate).toHaveBeenCalledWith("/patient/notifications");
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin");
  });

  it("keeps successful decisions and reports stale or interrupted requests individually", async () => {
    const rpc = setup();
    rpc.mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "CONFLICT" } })
      .mockRejectedValueOnce(new Error("Private database details"));
    const result = await bulkDecideAppointments(input);
    expect(result.ok).toBe(false);
    expect(result.results.map(row => row.ok)).toEqual([true, false, false]);
    expect(result.message).toContain("1 request approved");
    expect(result.message).toContain("2 could not be updated");
    expect(result.results[1].message).toContain("Refresh");
    expect(result.results[2].message).not.toContain("Private database details");
    expect(mocks.revalidate).toHaveBeenCalledWith("/patient");
  });

  it("requires a reason for bulk decline and sends the shared note to each patient", async () => {
    const rpc = setup();
    expect((await bulkDecideAppointments({ ...input, decision: "reject", reason: "  " })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    const result = await bulkDecideAppointments({ ...input, decision: "reject", reason: " Please choose another date. " });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("3 requests declined");
    expect(rpc).toHaveBeenCalledWith("change_appointment", expect.objectContaining({ p_action: "reject", p_reason: "Please choose another date." }));
  });

  it.each([
    { requests: [] },
    { requests: [requests[0], requests[0]] },
    { requests: [requests[0], { ...requests[1], key: requests[0].key }] },
    { requests: [{ ...requests[0], expected: "" }] },
    { requests: Array.from({ length: 26 }, (_, i) => ({ id: `30000000-0000-4000-8000-${String(i).padStart(12, "0")}`, key: `40000000-0000-4000-8000-${String(i).padStart(12, "0")}`, expected: requests[0].expected })) },
    { decision: "check_in" },
  ])("rejects invalid batches without changing appointments: %o", async invalid => {
    const rpc = setup();
    expect((await bulkDecideAppointments({ ...input, ...invalid })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("preserves receipt keys when an identical bulk request is retried", async () => {
    const rpc = setup();
    await bulkDecideAppointments(input);
    const first = rpc.mock.calls.slice();
    await bulkDecideAppointments(input);
    expect(rpc.mock.calls.slice(first.length)).toEqual(first);
  });

  it("processes an entire page of 25 selected requests", async () => {
    const rpc = setup();
    const page = Array.from({ length: 25 }, (_, i) => ({
      id: `30000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      key: `40000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      expected: requests[0].expected,
    }));
    const result = await bulkDecideAppointments({ ...input, requests: page });
    expect(result.ok).toBe(true);
    expect(result.results.map(row => row.id)).toEqual(page.map(row => row.id));
    expect(rpc).toHaveBeenCalledTimes(25);
  });

  it("keeps individual approval available and refreshes the notification view", async () => {
    const rpc = setup();
    expect((await decideAppointment({ ...requests[0], decision: "approve", reason: "" })).ok).toBe(true);
    expect(rpc).toHaveBeenCalledOnce();
    expect(mocks.revalidate).toHaveBeenCalledWith("/patient/notifications");
  });
});
