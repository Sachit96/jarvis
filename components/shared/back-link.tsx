import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The "up one level" link a detail page opens with.
 *
 * Detail pages had each written their own — same arrow, same words, three
 * different type sizes and two different hover colours. One component so a
 * course, a deal and a client all return the same way.
 */
export function BackLink({
  href,
  label,
  className,
}: {
  href: string;
  /** Where you land, not what you leave — "Clients", "Pipeline". */
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 text-caption text-foreground-tertiary transition-colors hover:text-foreground",
        className,
      )}
    >
      <ArrowLeft className="size-3.5" strokeWidth={2} />
      {label}
    </Link>
  );
}
