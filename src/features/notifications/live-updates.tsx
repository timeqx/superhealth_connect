"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/shared/supabase/browser";
export function LiveUpdates({ userId }: { userId: string }) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const client = browserClient();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      timer = setTimeout(() => { router.refresh(); window.dispatchEvent(new Event("care-update")); }, 300);
    };
    const channel = client.channel(`care-notices:${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` }, refresh).subscribe(status => {
      setConnected(status === "SUBSCRIBED");
      if (status === "SUBSCRIBED") refresh();
    });
    const interval = setInterval(refresh, 60000);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearTimeout(timer); clearInterval(interval); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", refresh); void client.removeChannel(channel); };
  }, [userId, router]);
  return <p className="caption" role="status">{connected ? "Live updates connected" : "Live connection unavailable · checking for updates every minute"}</p>;
}
