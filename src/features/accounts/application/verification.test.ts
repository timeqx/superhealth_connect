import { describe, expect, it, vi } from "vitest";
import {
  submitVerification,
  type VerificationRepository,
} from "./verification";
import type { Profile } from "../domain/validation";
const user = "10000000-0000-4000-8000-000000000001";
const id = "20000000-0000-4000-8000-000000000001";
const profile: Profile = {
  id: user,
  first_name: "Synthetic",
  middle_name: "",
  last_name: "Patient",
  barangay_code: "Batasan Hills",
  other_barangay: null,
  phone: "+639171234567",
  review_status: "incomplete",
  rejection_reason: null,
  current_document_id: null,
};
const actor = { id: user, role: "patient", verified: true, profile };
const input = {
  id,
  name: "synthetic.png",
  type: "image/png",
  bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]),
};
function repository() {
  return {
    findSubmission: vi
      .fn<VerificationRepository["findSubmission"]>()
      .mockResolvedValue(null),
    store: vi.fn<VerificationRepository["store"]>().mockResolvedValue(),
    submit: vi.fn<VerificationRepository["submit"]>().mockResolvedValue(),
  };
}
describe("verification use case", () => {
  it("derives a private user path and stores before submitting metadata", async () => {
    const repo = repository();
    await submitVerification(repo, actor, input);
    expect(repo.store).toHaveBeenCalledWith(
      `${user}/${id}.png`,
      input.bytes,
      "image/png",
    );
    expect(repo.submit).toHaveBeenCalledWith({
      id,
      path: `${user}/${id}.png`,
      mime: "image/png",
      size: 9,
    });
    expect(repo.store.mock.invocationCallOrder[0]).toBeLessThan(
      repo.submit.mock.invocationCallOrder[0],
    );
  });
  it.each([
    { role: "admin", verified: true },
    { role: "patient", verified: false },
  ])("refuses ineligible actors before storage access: %j", async (flags) => {
    const repo = repository();
    await expect(
      submitVerification(repo, { ...actor, ...flags }, input),
    ).rejects.toThrow("FORBIDDEN");
    expect(repo.store).not.toHaveBeenCalled();
    expect(repo.findSubmission).not.toHaveBeenCalled();
  });
  it("rejects spoofed file types before any repository call", async () => {
    const repo = repository();
    await expect(
      submitVerification(repo, actor, {
        ...input,
        bytes: new TextEncoder().encode("<svg>test</svg>"),
      }),
    ).rejects.toThrow("Choose a JPEG");
    expect(repo.findSubmission).not.toHaveBeenCalled();
  });
  it("refuses incomplete profiles and new uploads during review", async () => {
    const repo = repository();
    await expect(
      submitVerification(
        repo,
        { ...actor, profile: { ...profile, phone: null } },
        input,
      ),
    ).rejects.toThrow("PROFILE_INCOMPLETE");
    await expect(
      submitVerification(
        repo,
        { ...actor, profile: { ...profile, review_status: "pending" } },
        input,
      ),
    ).rejects.toThrow("INVALID_TRANSITION");
    expect(repo.store).not.toHaveBeenCalled();
  });
  it("reconciles an already committed submission without overwriting storage", async () => {
    const repo = repository();
    repo.findSubmission.mockResolvedValue({
      id,
      path: `${user}/${id}.png`,
      mime: "image/png",
      size: 9,
    });
    await submitVerification(
      repo,
      { ...actor, profile: { ...profile, review_status: "pending" } },
      input,
    );
    expect(repo.store).not.toHaveBeenCalled();
    expect(repo.submit).not.toHaveBeenCalled();
  });
  it("does not submit metadata when storage fails", async () => {
    const repo = repository();
    repo.store.mockRejectedValue(new Error("UPLOAD_FAILED"));
    await expect(submitVerification(repo, actor, input)).rejects.toThrow(
      "UPLOAD_FAILED",
    );
    expect(repo.submit).not.toHaveBeenCalled();
  });
  it("allows a corrected version after rejection", async () => {
    const repo = repository();
    await submitVerification(
      repo,
      { ...actor, profile: { ...profile, review_status: "rejected" } },
      input,
    );
    expect(repo.submit).toHaveBeenCalledOnce();
  });
  it("rejects conflicting existing metadata", async () => {
    const repo = repository();
    repo.findSubmission.mockResolvedValue({
      id,
      path: `${user}/${id}.png`,
      mime: "image/png",
      size: 10,
    });
    await expect(submitVerification(repo, actor, input)).rejects.toThrow(
      "CONFLICT",
    );
    expect(repo.store).not.toHaveBeenCalled();
  });
});
