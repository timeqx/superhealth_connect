import type { Profile } from "../domain/validation";
import { inspectDocument } from "../domain/validation";

export type Submission = {
  id: string;
  path: string;
  mime: string;
  size: number;
};
export interface VerificationRepository {
  findSubmission(id: string): Promise<Submission | null>;
  store(path: string, bytes: Uint8Array, mime: string): Promise<void>;
  submit(document: Submission): Promise<void>;
}
export async function submitVerification(
  repository: VerificationRepository,
  actor: { id: string; role: string; verified: boolean; profile: Profile },
  input: { id: string; name: string; type: string; bytes: Uint8Array },
) {
  if (actor.role !== "patient" || !actor.verified) throw new Error("FORBIDDEN");
  const detected = inspectDocument(input.bytes, input.name, input.type);
  const path = `${actor.id}/${input.id}.${detected.extension}`;
  const previous = await repository.findSubmission(input.id);
  if (previous) {
    if (
      previous.path !== path ||
      previous.size !== input.bytes.length ||
      previous.mime !== detected.mime
    )
      throw new Error("CONFLICT");
    return;
  }
  const p = actor.profile;
  if (!["incomplete", "rejected"].includes(p.review_status))
    throw new Error("INVALID_TRANSITION");
  if (!p.first_name || !p.last_name || !p.barangay_code || !p.phone)
    throw new Error("PROFILE_INCOMPLETE");
  await repository.store(path, input.bytes, detected.mime);
  await repository.submit({
    id: input.id,
    path,
    mime: detected.mime,
    size: input.bytes.length,
  });
}
