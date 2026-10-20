"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadVerification } from "../application/verification-actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
export function VerificationUpload({ configured }: { configured: boolean }) {
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const attempt = key || crypto.randomUUID();
        setKey(attempt);
        data.set("key", attempt);
        setPending(true);
        try {
          const result = await uploadVerification(data);
          setMessage(result.message);
          if (result.ok) router.refresh();
        } catch {
          setMessage(
            "Connection interrupted. Keep the same file selected and retry to check your submission.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <h2>Upload your QC ID</h2>
      <p>
        Use a synthetic QC ID for development. JPEG, PNG or PDF, up to 5 MB. The
        document stays private.
      </p>
      <Label htmlFor="verification-document">Verification document</Label>
      <Input
        id="verification-document"
        name="document"
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        required
        disabled={!configured || pending}
        onChange={() => {
          setKey("");
          setMessage("");
        }}
      />
      {!configured && (
        <p className="notice">
          Private uploads are temporarily unavailable. Please contact staff or
          try again later.
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <Button type="submit" disabled={pending || !configured}>
        {pending ? "Submitting…" : "Submit for review"}
      </Button>
    </form>
  );
}
