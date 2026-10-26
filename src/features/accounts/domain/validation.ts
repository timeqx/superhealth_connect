import { z } from "zod";
export const barangays = [
  "Bagong Silangan",
  "Batasan Hills",
  "Commonwealth",
  "Holy Spirit",
  "Payatas",
  "Others",
] as const;
export function normalizePhone(value: string) {
  const cleaned = value.replace(/[\s()-]/g, "");
  if (/^09\d{9}$/.test(cleaned)) return `+63${cleaned.slice(1)}`;
  if (/^639\d{9}$/.test(cleaned)) return `+${cleaned}`;
  return cleaned;
}
export const profileSchema = z
  .object({
    first: z.string().trim().min(1, "Enter your first name.").max(80),
    middle: z.string().trim().max(80),
    last: z.string().trim().min(1, "Enter your last name.").max(80),
    barangay: z.enum(barangays),
    other: z.string().trim().max(100),
    phone: z
      .string()
      .transform(normalizePhone)
      .pipe(
        z
          .string()
          .regex(
            /^\+639\d{9}$/,
            "Enter a Philippine mobile number, e.g. 09171234567.",
          ),
      ),
  })
  .refine((v) => v.barangay !== "Others" || v.other.length >= 2, {
    path: ["other"],
    message: "Enter your barangay.",
  });
export const credentialsSchema = z.object({
  email: z.email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password.").max(128),
});
export const registrationSchema = credentialsSchema.extend({
  password: z.string().min(12, "Use at least 12 characters.").max(128),
  consent: z.literal(true, {
    error: "Acknowledge the development privacy notice.",
  }),
});
export type Profile = {
  id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  barangay_code: string | null;
  other_barangay: string | null;
  phone: string | null;
  review_status: "incomplete" | "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  current_document_id: string | null;
};
export function inspectDocument(
  bytes: Uint8Array,
  name: string,
  claimedType: string,
) {
  if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024)
    throw new Error("Use a file between 1 byte and 5 MB.");
  const signature = [...bytes.slice(0, 8)];
  let detected: { mime: string; extension: string } | undefined;
  if (signature.slice(0, 3).join() === "255,216,255")
    detected = { mime: "image/jpeg", extension: "jpg" };
  if (signature.join() === "137,80,78,71,13,10,26,10")
    detected = { mime: "image/png", extension: "png" };
  if (new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-")
    detected = { mime: "application/pdf", extension: "pdf" };
  const extension = name.split(".").pop()?.toLowerCase();
  if (
    !detected ||
    claimedType !== detected.mime ||
    ![
      detected.extension,
      ...(detected.extension === "jpg" ? ["jpeg"] : []),
    ].includes(extension ?? "")
  ) {
    throw new Error(
      "Choose a JPEG, PNG, or PDF with matching file contents and extension.",
    );
  }
  return detected;
}
