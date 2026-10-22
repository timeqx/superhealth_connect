"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Toast } from "radix-ui";
import { X } from "lucide-react";

type Notice = { id: number; message: string; error: boolean };
const SnackbarContext = createContext<(message: string, error?: boolean) => void>(() => {});
export const useSnackbar = () => useContext(SnackbarContext);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const notify = useCallback((message: string, error = false) => {
    setNotices(previous => [...previous.slice(-2), { id: Date.now() + Math.random(), message, error }]);
  }, []);
  return <SnackbarContext.Provider value={notify}>
    <Toast.Provider duration={7000} swipeDirection="left">
      {children}
      {notices.map(notice => <Toast.Root className="snackbar" data-error={notice.error} key={notice.id} onOpenChange={open => {
        if (!open) setNotices(current => current.filter(item => item.id !== notice.id));
      }}>
        <Toast.Description>{notice.message}</Toast.Description>
        <Toast.Close className="snackbar-close" aria-label="Dismiss notification"><X size={18} /></Toast.Close>
      </Toast.Root>)}
      <Toast.Viewport className="snackbar-viewport" />
    </Toast.Provider>
  </SnackbarContext.Provider>;
}
