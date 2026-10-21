"use client";

import type { ReactNode } from "react";
import { Button } from "./button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "./sheet";

export function DetailDialog({ title, description, label, children }: {
  title: string;
  description: string;
  label: string;
  children: ReactNode;
}) {
  return <Sheet>
    <SheetTrigger asChild><Button variant="outline">{label}<span className="sr-only">: {title}</span></Button></SheetTrigger>
    <SheetContent className="detail-dialog">
      <SheetTitle>{title}</SheetTitle>
      <SheetDescription>{description}</SheetDescription>
      {children}
    </SheetContent>
  </Sheet>;
}
