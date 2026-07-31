import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/database.types";

type Deal = Database["public"]["Tables"]["deals"]["Row"];
type Contact = Database["public"]["Tables"]["contacts"]["Row"];
type PipelineStage = Database["public"]["Tables"]["pipeline_stages"]["Row"];

function money(n: number) {
  return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function LatestDealCard({
  deal,
  contact,
  stage,
}: {
  deal: Deal | null;
  contact: Contact | null;
  stage: PipelineStage | null;
}) {
  return (
    <Card>
      <p className="text-label uppercase tracking-wide text-muted-foreground">Latest Deal</p>
      {!deal ? (
        <p className="mt-3 text-body text-muted-foreground">No deals yet.</p>
      ) : (
        <div className="mt-3 space-y-2.5">
          <div className="flex items-center justify-between text-body">
            <span className="text-muted-foreground">Client</span>
            <span className="max-w-[60%] truncate text-right font-medium text-foreground">
              {deal.title || contact?.contact_person || "Untitled deal"}
            </span>
          </div>
          <div className="flex items-center justify-between text-body">
            <span className="text-muted-foreground">Value</span>
            <span className="font-mono font-medium text-cat-business">{money(deal.value)}</span>
          </div>
          <div className="flex items-center justify-between text-body">
            <span className="text-muted-foreground">Stage</span>
            <span
              className={`rounded-full px-2 py-0.5 text-caption font-medium ${
                stage?.is_won ? "bg-success/15 text-success" : "bg-cat-business/15 text-cat-business"
              }`}
            >
              {stage?.name ?? "Unknown"}
            </span>
          </div>
        </div>
      )}
      <Link href="/business/pipeline" className="mt-4 inline-flex items-center gap-1 text-caption font-medium text-brand hover:underline">
        View All Deals
        <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
      </Link>
    </Card>
  );
}
