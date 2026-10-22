import { Skeleton } from "@/shared/ui/skeleton";

export default function AccountLoading() {
  return <div className="auth-loading" role="status" aria-label="Loading account form">
    <span className="sr-only">Loading account form…</span>
    <div className="auth-loading-content" aria-hidden="true">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <div className="auth-loading-field"><Skeleton className="h-3 w-24" /><Skeleton className="h-12 w-full" /></div>
      <div className="auth-loading-field"><Skeleton className="h-3 w-24" /><Skeleton className="h-12 w-full" /></div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-4 w-36" />
    </div>
  </div>;
}
