// Outils Strava partagés (tokens, récupération d'activité + flux)
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

export const admin = (): SupabaseClient =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const CID = () => Deno.env.get("STRAVA_CLIENT_ID")!;
const SECRET = () => Deno.env.get("STRAVA_CLIENT_SECRET")!;

export async function tokenRequest(body: Record<string, string>) {
  const r = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CID(), client_secret: SECRET(), ...body }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Strava token: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

// Renvoie un access token valide pour l'utilisateur (rafraîchi si besoin)
export async function accessTokenFor(db: SupabaseClient, where: { user_id?: string; athlete_id?: number }) {
  let q = db.from("strava_tokens").select("*");
  q = where.user_id ? q.eq("user_id", where.user_id) : q.eq("athlete_id", where.athlete_id!);
  const { data: t, error } = await q.maybeSingle();
  if (error) throw error;
  if (!t) return null;
  if (new Date(t.expires_at).getTime() - Date.now() > 120_000) return { token: t.access_token as string, user_id: t.user_id as string };
  const j = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh_token });
  await db.from("strava_tokens").update({
    access_token: j.access_token, refresh_token: j.refresh_token, expires_at: new Date(j.expires_at * 1000).toISOString(),
  }).eq("user_id", t.user_id);
  return { token: j.access_token as string, user_id: t.user_id as string };
}

const RIDES = new Set(["Ride", "VirtualRide", "EBikeRide", "GravelRide", "MountainBikeRide"]);

// Récupère une activité + ses flux et la dépose dans strava_inbox (vélo uniquement)
export async function ingestActivity(db: SupabaseClient, token: string, user_id: string, stravaId: number) {
  const h = { Authorization: `Bearer ${token}` };
  const ar = await fetch(`https://www.strava.com/api/v3/activities/${stravaId}`, { headers: h });
  if (!ar.ok) throw new Error(`activity ${stravaId}: ${ar.status}`);
  const a = await ar.json();
  if (!RIDES.has(a.sport_type) && !RIDES.has(a.type)) return { skipped: true };
  const sr = await fetch(`https://www.strava.com/api/v3/activities/${stravaId}/streams?keys=time,watts,heartrate,cadence&key_by_type=true`, { headers: h });
  const streams = sr.ok ? await sr.json() : null;
  const activity = {
    id: a.id, name: a.name, sport_type: a.sport_type, start_date: a.start_date, start_date_local: a.start_date_local,
    moving_time: a.moving_time, elapsed_time: a.elapsed_time, distance: a.distance, trainer: a.trainer,
    average_watts: a.average_watts, weighted_average_watts: a.weighted_average_watts, max_watts: a.max_watts, device_watts: a.device_watts,
    average_heartrate: a.average_heartrate, max_heartrate: a.max_heartrate, average_cadence: a.average_cadence,
  };
  const compact = streams ? {
    time: streams.time?.data ?? null, watts: streams.watts?.data ?? null,
    heartrate: streams.heartrate?.data ?? null, cadence: streams.cadence?.data ?? null,
  } : null;
  const { error } = await db.from("strava_inbox").upsert(
    { user_id, strava_id: a.id, activity, streams: compact, imported: false },
    { onConflict: "user_id,strava_id", ignoreDuplicates: true },
  );
  if (error) throw error;
  return { ok: true };
}

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
export const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
