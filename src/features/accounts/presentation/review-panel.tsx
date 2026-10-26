"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewAccount } from "../application/verification-actions";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/shared/ui/alert-dialog";
export function ReviewPanel({
  user,
  document,
}: {
  user: string;
  document: string;
}) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState<{
    payload: string;
    key: string;
  } | null>(null);
  const router = useRouter();
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(
    null,
  );
  async function decide(decision: "approved" | "rejected") {
    const payload = JSON.stringify({ decision, reason });
    const request =
      attempt?.payload === payload
        ? attempt
        : { payload, key: crypto.randomUUID() };
    setAttempt(request);
    setPending(true);
    try {
      const result = await reviewAccount({
        user,
        document,
        decision,
        reason,
        key: request.key,
      });
      setMessage(result.message);
      if (result.ok) router.refresh();
    } catch {
      setMessage(
        "The response was interrupted. Retry the same decision to check whether it was saved.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="form">
      <Label htmlFor={`reason-${user}`}>
        Correction instructions (required when rejecting)
      </Label>
      <Textarea
        id={`reason-${user}`}
        maxLength={1000}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={pending}
      />
      <div className="actions">
        <Button disabled={pending} onClick={() => setDecision("approved")}>
          Approve account
        </Button>
        <Button
          variant="outline"
          disabled={pending || !reason.trim()}
          onClick={() => setDecision("rejected")}
        >
          Reject with reason
        </Button>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <AlertDialog
        open={decision !== null}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decision === "approved"
                ? "Approve this account?"
                : "Return this submission for correction?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {decision === "approved"
                ? "Confirm you reviewed this document version. Approval lets this patient request appointments."
                : "The patient will see your correction instructions and can submit a new version."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (decision) void decide(decision);
              }}
            >
              Confirm decision
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
