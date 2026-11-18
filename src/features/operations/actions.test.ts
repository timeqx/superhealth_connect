import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ actor: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/server/session", () => ({ getActor: mocks.actor }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { saveDefinition, saveServiceSchedule } from "./actions";

const id = "10000000-0000-4000-8000-000000000001";
const key = "10000000-0000-4000-8000-000000000002";
const expected = "2026-11-16T08:00:00+08:00";
const schedule = { open: "08:00", close: "10:00", duration: "30", capacity: "3", days: ["1", "2", "3", "4", "5"] };
const definition = { id: null, expected: null, name: "Consultation", slug: "consultation", description: "General care", key };

beforeEach(() => vi.clearAllMocks());
function setup(role = "admin") {
  const rpc = vi.fn().mockResolvedValue({ error: null });
  mocks.actor.mockResolvedValue({ role, client: { rpc } });
  return rpc;
}

describe("service schedule actions", () => {
  it("creates service details and the chosen time slots in one operation", async () => {
    const rpc = setup();
    expect((await saveDefinition({ ...definition, ...schedule })).ok).toBe(true);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("save_service_definition", {
      p_id: null, p_name: "Consultation", p_slug: "consultation", p_description: "General care", p_expected: null, p_key: key,
      p_open: "08:00", p_close: "10:00", p_slot_duration: 30, p_slot_capacity: 3, p_days: [1, 2, 3, 4, 5],
    });
  });

  it("requires a schedule for new services while allowing independent details edits", async () => {
    const rpc = setup();
    expect((await saveDefinition(definition)).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect((await saveDefinition({ ...definition, id, expected })).ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("save_service_definition", expect.not.objectContaining({ p_open: expect.anything() }));
  });

  it.each([
    { open: "25:00" }, { close: "08:00" }, { close: "07:00" },
    { duration: "0" }, { duration: "121" }, { duration: "1.5" },
    { capacity: "0" }, { capacity: "501" }, { capacity: "2.5" }, { days: ["7"] },
  ])("rejects invalid schedules before saving: %o", async invalid => {
    const rpc = setup();
    expect((await saveDefinition({ ...definition, ...schedule, ...invalid })).ok).toBe(false);
    expect((await saveServiceSchedule({ service: id, expected, key, ...schedule, ...invalid })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("saves capacity per time slot and refreshes both booking portals", async () => {
    const rpc = setup();
    expect((await saveServiceSchedule({ service: id, expected, key, ...schedule })).ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("save_service_schedule", {
      p_service: id, p_open: "08:00", p_close: "10:00", p_slot_duration: 30, p_slot_capacity: 3, p_days: [1, 2, 3, 4, 5], p_expected: expected, p_key: key,
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/patient/book");
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin/book");
  });

  it.each(["patient", "staff"])("denies %s callers and leaves failed saves unacknowledged", async role => {
    const rpc = setup(role);
    expect((await saveDefinition({ ...definition, ...schedule })).ok).toBe(false);
    expect((await saveServiceSchedule({ service: id, expected, key, ...schedule })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    mocks.actor.mockResolvedValue({ role: "admin", client: { rpc } });
    rpc.mockResolvedValue({ error: { message: "CONFLICT" } });
    expect((await saveServiceSchedule({ service: id, expected, key, ...schedule })).ok).toBe(false);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
