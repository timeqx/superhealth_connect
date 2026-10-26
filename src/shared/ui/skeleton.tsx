import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("skeleton", className)} {...props} />;
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="page-skeleton">
      <span className="sr-only">Loading your page…</span>
      <div aria-hidden="true" className="stack">
        <div className="stack">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-3/5 max-w-96" />
          <Skeleton className="h-4 w-4/5 max-w-lg" />
        </div>
        <div className="grid-two">
          <div className="card full">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="card full">
            <Skeleton className="size-12 rounded-xl" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-11 w-40" />
          </div>
        </div>
      </div>
    </div>
  );
}
