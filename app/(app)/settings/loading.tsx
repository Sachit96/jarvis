import { LoadingState } from "@/components/shared/loading-state";

/** Shown while this module's data is in flight. */
export default function Loading() {
  return <LoadingState kpis={0} panels={3} />;
}
