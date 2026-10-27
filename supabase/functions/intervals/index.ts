// Liaison Intervals.icu (JWT Supabase requis). La clé API reste côté serveur.
//  { action:"connect", apiKey }            -> vérifie la clé, enregistre le compte
//  { action:"sync", days? }                -> activités (vélo avec puissance -> ext_inbox ; autres sports -> health_workouts) + wellness
//  { action:"push", events:[…], remove:[…] } -> envoie/maj des séances planifiées dans le calendrier Intervals (-> Garmin Connect)
//  { action:"disconnect" }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const BASE = "https://intervals.icu/api/v1";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

async function icu(key: string, path: string, init: RequestInit = {}) {
  const r = await fetch(BASE + path, { ...init, headers: { Authorization: "Basic " + btoa("API_KEY:" + key), "User-Agent": "Mozilla/5.0 (FTP Builder)", Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) } });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Intervals ${r.status} ${txt.slice(0, 160)}`);
  try { return JSON.parse(txt); } catch { return txt; }
}
const day = (d: Date) => d.toISOString().slice(0, 10);
// vitesses en m/s chez Intervals -> km/h ; dénivelé positif en m
const kmh = (v: unknown) => (v != null && Number(v) > 0 ? +(Number(v) * 3.6).toFixed(1) : null);
const elev = (a: Record<string, unknown>) => { const v = a.total_elevation_gain ?? a.icu_elevation_gain; return v != null && Number(v) >= 0 ? Math.round(Number(v)) : null; };
const RIDES = /^(Ride|VirtualRide|GravelRide|MountainBikeRide|EBikeRide|TrackRide)$/;
const TYPES: Record<string, string> = { Ride: "Vélo", VirtualRide: "Vélo (home trainer)", GravelRide: "Gravel", MountainBikeRide: "VTT", Run: "Course à pied", TrailRun: "Trail", VirtualRun: "Course (tapis)", Swim: "Natation", OpenWaterSwim: "Natation eau libre", Walk: "Marche", Hike: "Randonnée", WeightTraining: "Renforcement musculaire", Workout: "Séance", Yoga: "Yoga", Rowing: "Aviron", Tennis: "Tennis", Soccer: "Football", Crossfit: "Crossfit", Elliptical: "Elliptique" };

function streamsOf(raw: unknown) {
  const out: Record<string, unknown[] | null> = { time: null, watts: null, heartrate: null, cadence: null };
  if (Array.isArray(raw)) for (const s of raw as { type: string; data: unknown[] }[]) { if (s.type in out) out[s.type] = s.data; }
  else if (raw && typeof raw === "object") for (const k of Object.keys(out)) { const v = (raw as Record<string, { data?: unknown[] } | unknown[]>)[k]; out[k] = Array.isArray(v) ? v : (v as { data?: unknown[] })?.data ?? null; }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Non connecté" }, 401);
    const body = await req.json().catch(() => ({}));

    if (body.action === "connect") {
      const key = String(body.apiKey ?? "").trim();
      if (key.length < 10) return json({ error: "Clé API invalide" }, 400);
      const ath = await icu(key, "/athlete/0");
      const ride = (ath.sportSettings ?? []).find((s: { types?: string[] }) => (s.types ?? []).includes("Ride"));
      await db.from("intervals_accounts").upsert({ user_id: user.id, athlete_id: String(ath.id), athlete_name: ath.name ?? null, api_key: key });
      return json({ connected: true, athlete: { id: ath.id, name: ath.name, ftp: ride?.ftp ?? null, lthr: ride?.lthr ?? null, max_hr: ride?.max_hr ?? null, weight: ath.icu_weight ?? ath.weight ?? null } });
    }

    const { data: acc } = await db.from("intervals_accounts").select("*").eq("user_id", user.id).maybeSingle();
    if (body.action === "disconnect") { await db.from("intervals_accounts").delete().eq("user_id", user.id); return json({ connected: false }); }
    if (!acc) return json({ error: "Intervals.icu non connecté" }, 400);
    const key = acc.api_key as string;

    if (body.action === "sync") {
      const days = Math.min(Math.max(Number(body.days) || 30, 1), 180);
      const oldest = day(new Date(Date.now() - days * 864e5)), newest = day(new Date(Date.now() + 864e5));
      const acts = await icu(key, `/athlete/0/activities?oldest=${oldest}&newest=${newest}`) as Record<string, unknown>[];
      const { data: known } = await db.from("ext_inbox").select("ext_id").eq("user_id", user.id).eq("source", "intervals");
      const seen = new Set((known ?? []).map((k) => k.ext_id));
      let rides = 0, others = 0, skipped = 0;
      for (const a of acts) {
        const id = String(a.id); const type = String(a.type ?? "");
        const start = String(a.start_date ?? a.start_date_local ?? "");
        if (!start || (a.source === "STRAVA" && !a.moving_time)) { skipped++; continue; } // activités Strava : non exposées par l'API
        const watts = (a.icu_average_watts ?? a.average_watts) as number | undefined;
        if (RIDES.test(type) && watts && a.device_watts !== false) {
          if (seen.has(id)) continue;
          let st = null; try { st = streamsOf(await icu(key, `/activity/${id}/streams.json?types=time,watts,heartrate,cadence`)); } catch { /* résumé seul */ }
          const activity = { id, name: a.name, type, start_date: start, start_date_local: a.start_date_local, moving_time: a.moving_time, elapsed_time: a.elapsed_time, distance: a.distance, trainer: a.trainer,
            average_watts: watts, weighted_average_watts: a.icu_weighted_avg_watts ?? a.weighted_average_watts, average_heartrate: a.average_heartrate, max_heartrate: a.max_heartrate, training_load: a.icu_training_load, device_watts: true,
            total_elevation_gain: elev(a), average_speed: a.average_speed ?? null, max_speed: a.max_speed ?? null };
          await db.from("ext_inbox").upsert({ user_id: user.id, source: "intervals", ext_id: id, activity, streams: st, imported: false }, { onConflict: "user_id,source,ext_id", ignoreDuplicates: true });
          rides++;
        } else {
          const s = new Date(start.endsWith("Z") || /[+-]\d\d:\d\d$/.test(start) ? start : start + "Z");
          const row = { user_id: user.id, start_at: s.toISOString(), end_at: a.elapsed_time ? new Date(s.getTime() + Number(a.elapsed_time) * 1000).toISOString() : null,
            type: TYPES[type] ?? type, duration_min: a.moving_time ? Number(a.moving_time) / 60 : null, distance_km: a.distance ? Number(a.distance) / 1000 : null,
            energy_kcal: (a.calories as number) ?? null, avg_hr: (a.average_heartrate as number) ?? null, source: "Intervals.icu",
            indoor: RIDES.test(type) ? (type === "VirtualRide" || a.trainer === true) : null,
            elevation_m: elev(a), avg_speed_kmh: kmh(a.average_speed), max_speed_kmh: kmh(a.max_speed), updated_at: new Date().toISOString() };
          const { data: near } = await db.from("health_workouts").select("*").eq("user_id", user.id).gte("start_at", new Date(s.getTime() - 300000).toISOString()).lte("start_at", new Date(s.getTime() + 300000).toISOString());
          if (near && near.length) { const o = near[0]; const patch: Record<string, unknown> = {}; for (const k of ["duration_min", "distance_km", "energy_kcal", "avg_hr", "indoor", "elevation_m", "avg_speed_kmh", "max_speed_kmh"]) if (o[k] == null && (row as Record<string, unknown>)[k] != null) patch[k] = (row as Record<string, unknown>)[k]; if (Object.keys(patch).length) await db.from("health_workouts").update(patch).eq("user_id", user.id).eq("start_at", o.start_at); }
          else await db.from("health_workouts").upsert(row);
          others++;
        }
      }
      // wellness (VFC, FC repos, poids, sommeil…) : complète sans écraser Apple Santé
      let wcount = 0;
      try {
        const w = await icu(key, `/athlete/0/wellness?oldest=${oldest}&newest=${newest}`) as Record<string, unknown>[];
        const rows: Record<string, unknown>[] = [];
        const map: Record<string, string> = { hrv: "hrv", restingHR: "rhr", weight: "weight", vo2max: "vo2max", spO2: "spo2", respiration: "resp_rate", bodyFat: "body_fat", readiness: "icu_readiness", sleepScore: "sleep_score" };
        for (const d of w) for (const [k, m] of Object.entries(map)) if (d[k] != null && Number(d[k]) > 0) rows.push({ user_id: user.id, day: String(d.id).slice(0, 10), metric: m, value: Number(d[k]), updated_at: new Date().toISOString() });
        if (rows.length) { await db.from("health_daily").upsert(rows, { onConflict: "user_id,day,metric", ignoreDuplicates: true }); wcount = rows.length; }
        for (const d of w) if (d.sleepSecs && Number(d.sleepSecs) > 3600) await db.from("health_sleep").upsert({ user_id: user.id, night: String(d.id).slice(0, 10), source: "Intervals.icu", asleep_min: Math.round(Number(d.sleepSecs) / 60), updated_at: new Date().toISOString() }, { onConflict: "user_id,night", ignoreDuplicates: true });
      } catch { /* wellness facultatif */ }
      await db.from("intervals_accounts").update({ last_sync_at: new Date().toISOString() }).eq("user_id", user.id);
      return json({ rides, others, skipped, wellness: wcount, total: acts.length });
    }

    if (body.action === "push") {
      const events = (body.events ?? []).map((e: Record<string, unknown>) => ({ category: "WORKOUT", type: "Ride", start_date_local: `${e.date}T00:00:00`, name: e.name, description: e.description, external_id: e.external_id, moving_time: e.moving_time,
        ...(e.fit_base64 ? { filename: `${e.external_id}.fit`, file_contents_base64: e.fit_base64 } : {}) }));
      let created = 0, removed = 0;
      if (events.length) { const r = await icu(key, "/athlete/0/events/bulk?upsert=true", { method: "POST", body: JSON.stringify(events) }); created = Array.isArray(r) ? r.length : events.length; }
      if ((body.remove ?? []).length) { const r = await icu(key, "/athlete/0/events/bulk-delete", { method: "PUT", body: JSON.stringify(body.remove.map((x: string) => ({ external_id: x }))) }); removed = typeof r === "object" && r ? Number((r as Record<string, unknown>).eventsDeleted ?? body.remove.length) : body.remove.length; }
      return json({ created, removed });
    }
    return json({ error: "action inconnue" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
