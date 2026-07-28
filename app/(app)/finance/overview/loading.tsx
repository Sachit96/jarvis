import { Skeleton } from "@/components/ui/skeleton";

export default function FinanceOverviewLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-28" />
      </div>
      <Skeleton className="h-8 w-72 rounded-lg" />

      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="col-span-3 h-24 rounded-2xl sm:col-span-1" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-24 rounded-2xl" />

      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
