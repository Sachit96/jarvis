import { createClient } from "@/lib/supabase/server";
import { getVoiceDashboardData } from "@/lib/db/queries/voice";
import { VoiceModeClient } from "@/components/voice/voice-mode-client";

export const dynamic = "force-dynamic";

export default async function VoicePage() {
  const supabase = await createClient();
  const data = await getVoiceDashboardData(supabase);
  return <VoiceModeClient data={data} />;
}
