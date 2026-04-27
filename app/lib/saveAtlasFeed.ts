import { supabase } from "@/app/lib/supabaseClient";

export async function saveAtlasFeed(feedType: string, payload: any) {
  const today = new Date().toISOString().split("T")[0];

  const { error } = await supabase.from("atlas_feeds").upsert({
    id: `${feedType}_${today}`,
    feed_type: feedType,
    sport: payload?.sport ?? payload?.topSignal?.sport ?? null,
    feed_date: today,
    payload,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error(`Supabase save error for ${feedType}:`, error);
  }
}