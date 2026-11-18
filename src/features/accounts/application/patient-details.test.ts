import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ actor: vi.fn() }));
vi.mock("@/server/session", () => ({ getActor: mocks.actor }));
import { getPatientDetails } from "./patient-details";

const id = "10000000-0000-4000-8000-000000000001";
function setup(role = "staff") {
  const profile = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: {
    first_name: "Ana", middle_name: "", last_name: "Reyes", phone: null, barangay_code: "Others", other_barangay: "Example",
    review_status: "approved", created_at: "2026-11-01T00:00:00Z",
  }, error: null }) };
  const visits = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [{ id: "visit", public_reference: "SHC-1", status: "completed", decision_reason: null, requested_at: "2026-11-02T00:00:00Z", service_slots: null }], count: 11, error: null }) };
  const from = vi.fn((table: string) => table === "profiles" ? profile : visits);
  mocks.actor.mockResolvedValue({ role, client: { from } });
  return { from, profile, visits };
}
beforeEach(() => vi.clearAllMocks());

describe("patient details", () => {
  it("denies patients and unauthenticated requests before reading records", async () => {
    const { from } = setup("patient");
    expect((await getPatientDetails(id)).ok).toBe(false);
    mocks.actor.mockResolvedValue(null);
    expect((await getPatientDetails(id)).ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
  it.each(["staff", "admin"])("allows %s and scopes paginated history to the selected patient", async role => {
    const { profile, visits } = setup(role);
    const result = await getPatientDetails(id, 2);
    expect(profile.eq).toHaveBeenCalledWith("id", id);
    expect(visits.eq).toHaveBeenCalledWith("patient_id", id);
    expect(visits.range).toHaveBeenCalledWith(10, 19);
    expect(result).toMatchObject({ ok: true, profile: { name: "Ana Reyes", barangay: "Example", phone: null }, count: 11, page: 2, appointments: [{ service: "Service unavailable", status: "completed" }] });
  });
  it("rejects invalid identifiers and pages without querying", async () => {
    const { from } = setup();
    for (const page of [0, -1, 1.5, Infinity, 10001]) expect((await getPatientDetails(id, page)).ok).toBe(false);
    expect((await getPatientDetails("invalid")).ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
  it("does not read history for a missing or inaccessible profile", async () => {
    const { profile, visits } = setup();
    profile.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await getPatientDetails(id)).ok).toBe(false);
    expect(visits.select).not.toHaveBeenCalled();
  });
  it("returns a retryable error without leaking database details", async () => {
    const { visits } = setup();
    visits.range.mockRejectedValue(new Error("private database information"));
    const result = await getPatientDetails(id);
    expect(result).toEqual({ ok: false, message: "Patient details could not be loaded. Please try again." });
  });
});
