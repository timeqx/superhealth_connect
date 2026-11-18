"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { readNotification } from "./actions";
export function ReadButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  return <><Button variant="outline" disabled={pending} onClick={async () => {
    setPending(true);
    try { const result = await readNotification(id); setMessage(result.message); if (result.ok) router.refresh(); }
    catch { setMessage("Could not save. Please retry."); }
    finally { setPending(false); }
  }}>{pending ? "Saving…" : "Mark as read"}</Button><span role="status">{message}</span></>;
}
