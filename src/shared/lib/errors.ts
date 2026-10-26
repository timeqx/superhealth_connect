const messages: Record<string, string> = {
  UNAUTHENTICATED: "Your session has ended. Sign in and try again.",
  FORBIDDEN:
    "Your account cannot perform this action. Check your account review status or contact staff.",
  VALIDATION_ERROR:
    "Check the details and try again. A reason is required for staff arrival overrides.",
  SLOT_FULL:
    "This session is full. Choose another session; your existing appointment has not changed.",
  SLOT_CLOSED:
    "This session is closed or outside the permitted date. Refresh availability.",
  INVALID_TRANSITION:
    "This record has already moved to another state. Refresh to see its current status.",
  DUPLICATE_REQUEST:
    "You already have a request for this session. Check your appointments.",
  CONFLICT:
    "This record changed or the desk is busy. Refresh before making another change.",
  NOT_CONFIGURED:
    "Online accounts are temporarily unavailable. Please try again later.",
};
export function safeError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  for (const [code, text] of Object.entries(messages))
    if (message.includes(code)) return text;
  return "We couldn’t save this change. Your entries are still here. Try again, or refresh to check whether it was saved.";
}
export type ActionResult = {
  ok: boolean;
  message: string;
  redirectTo?: string;
};
