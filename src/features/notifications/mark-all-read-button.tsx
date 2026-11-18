"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { useSnackbar } from "@/shared/ui/snackbar";
import { readAllNotifications } from "./actions";

export function MarkAllReadButton({ unreadCount }: { unreadCount: number }) {
  const router = useRouter();
  const notify = useSnackbar();
  const [pending, startTransition] = useTransition();

  return <div className="notification-read-actions">
    <span className="caption">{unreadCount === 0 ? "No unread notifications." : "Applies to all notification pages."}</span>
    <Button variant="outline" disabled={pending || unreadCount === 0} onClick={() => startTransition(async () => {
      try {
        const result = await readAllNotifications();
        notify(result.message, !result.ok);
        if (result.ok) router.refresh();
      } catch {
        notify("Could not mark notifications as read. Please try again.", true);
      }
    })}>
      {pending ? "Marking all as read…" : "Mark all as read"}
    </Button>
  </div>;
}
