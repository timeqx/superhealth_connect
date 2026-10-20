"use client";
import type { ComponentProps } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;
export const SheetTitle = Dialog.Title;
export const SheetDescription = Dialog.Description;
export function SheetContent({ children, className, ...props }: ComponentProps<typeof Dialog.Content>) {
  return <Dialog.Portal>
    <Dialog.Overlay className="sheet-overlay" />
    <Dialog.Content className={cn("sheet-content", className)} {...props}>
      {children}
      <Dialog.Close className="sheet-close" aria-label="Close panel"><X size={20} /></Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>;
}
