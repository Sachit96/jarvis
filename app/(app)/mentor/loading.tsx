import { Skeleton } from "@/components/ui/skeleton";

export default function MentorLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-20" />
      </div>
      <Skeleton className="h-8 w-64 rounded-lg" />
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
