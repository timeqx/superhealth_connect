"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { markInquiryRead } from "../application-actions";

// Mounted inside the conversation dialog, so previews and route prefetches
// never mark messages read. A new displayed update advances the read receipt.
export function InquiryReadMarker({ id, through }: { id: string; through?: string }) {
  const router = useRouter();
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!through) return;
    let active = true;
    async function markRead() {
      try {
        const result = await markInquiryRead({ id, through });
        if (active) setFailed(!result.ok);
        if (result.ok) router.refresh();
      } catch {
        if (active) setFailed(true);
      }
    }
    void markRead();
    return () => { active = false; };
  }, [id, through, retry, router]);

  return failed ? <div className="notice" role="status">
    <p>We could not mark this conversation as read.</p>
    <Button variant="outline" onClick={() => { setFailed(false); setRetry(value => value + 1); }}>Retry marking as read</Button>
  </div> : null;
}
