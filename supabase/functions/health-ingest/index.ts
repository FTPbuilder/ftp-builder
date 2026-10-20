// Réception des données Apple Santé envoyées par le Raccourci iOS.
// Authentification : en-tête "Authorization: Bearer ftpb_…" (clé générée dans l'app, seul le hash est stocké).
// Corps JSON, au choix :
//   { "kind":"daily",   "date":"2026-10-20", "hrv":52, "rhr":"48", "weight":"81,2 kg", ... }
//   { "kind":"sleep",   "start":"…", "end":"…", "stage":"Profond", "source":"Apple Watch" }
//   { "kind":"workout", "start":"…", "end":"…", "type":"Course à pied", "distance":"10,2 km", "energy":"650 kcal", "avg_hr":152, "source":"Strava" }
// Les valeurs peuvent être des nombres ou du texte français ("42,5 ms") : on extrait le nombre.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const TZ = "Europe/Paris";
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

async function sha256(t: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v).split("\n")[0].replace(/ | /g, " ").replace(/(\d)\s+(?=\d{3}\b)/g, "$1").replace(",", ".");
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}
// Durées type "1 h 05 min", "45 min", "3600" (s), "01:05:00"
function durMin(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v > 600 ? v / 60 : v;
  const s = String(v);
  const hms = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (hms) return hms[3] ? (+hms[1] * 60 + +hms[2] + +hms[3] / 60) : (+hms[1] + +hms[2] / 60);
  const h = s.match(/(\d+[.,]?\d*)\s*h/i), m = s.match(/(\d+[.,]?\d*)\s*min/i), sec = s.match(/(\d+[.,]?\d*)\s*s(ec)?\b/i);
  if (h || m) return (h ? num(h[1])! * 60 : 0) + (m ? num(m[1])! : 0);
  if (sec) return num(sec[1])! / 60;
  return num(s);
}
const MONTHS: Record<string, number> = { janv: 1, jan: 1, févr: 2, fevr: 2, fév: 2, feb: 2, mars: 3, mar: 3, avr: 4, apr: 4, mai: 5, may: 5, juin: 6, jun: 6, juil: 7, jul: 7, août: 8, aout: 8, aug: 8, sept: 9, sep: 9, oct: 10, nov: 11, déc: 12, dec: 12 };
// ISO 8601 de préférence ; accepte aussi "20 oct. 2026 à 07:12"
function date(v: unknown): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime()) && /\d{4}-\d{2}-\d{2}/.test(s)) return d;
  const m = s.toLowerCase().match(/(\d{1,2})\s+([a-zéû]+)\.?\s+(\d{4})(?:\D+(\d{1,2})[:h](\d{2}))?/);
  if (m && MONTHS[m[2].replace(".", "")]) {
    const mo = MONTHS[m[2].replace(".", "")];
    // heure locale Paris -> UTC (approximation via l'offset du jour)
    const local = Date.UTC(+m[3], mo - 1, +m[1], +(m[4] ?? 0), +(m[5] ?? 0));
    const off = tzOffsetMin(new Date(local));
    return new Date(local - off * 60000);
  }
  return isNaN(d.getTime()) ? null : d;
}
function tzOffsetMin(d: Date) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const g = (t: string) => +p.find((x) => x.type === t)!.value;
  return (Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute")) - d.getTime()) / 60000;
}
const parisDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

// clés quotidiennes acceptées (alias FR/EN -> nom canonique)
const ALIASES: Record<string, string> = {
  hrv: "hrv", vfc: "hrv", rhr: "rhr", fc_repos: "rhr", resting_hr: "rhr", walking_hr: "walking_hr", fc_marche: "walking_hr",
  vo2max: "vo2max", vo2: "vo2max", resp_rate: "resp_rate", frequence_respiratoire: "resp_rate", spo2: "spo2", oxygene: "spo2",
  steps: "steps", pas: "steps", active_kcal: "active_kcal", energie_active: "active_kcal", basal_kcal: "basal_kcal",
  exercise_min: "exercise_min", minutes_exercice: "exercise_min", stand_h: "stand_h", heures_debout: "stand_h",
  weight: "weight", poids: "weight", body_fat: "body_fat", masse_grasse: "body_fat", lean_mass: "lean_mass", masse_maigre: "lean_mass",
  bmi: "bmi", imc: "bmi", muscle_mass: "muscle_mass", bone_mass: "bone_mass", water_pct: "water_pct",
  systolic: "systolic", diastolic: "diastolic", wrist_temp: "wrist_temp", mindful_min: "mindful_min", distance_km: "distance_km",
  hr_max: "hr_max", hr_avg: "hr_avg",
};

type SleepSeg = { start_at: string; end_at: string; stage: string; source: string };
function stageOf(s: string) {
  const t = s.toLowerCase();
  if (t.includes("lit") || t.includes("bed")) return "inbed";
  if (t.includes("profond") || t.includes("deep")) return "deep";
  if (t.includes("paradox") || t.includes("rem")) return "rem";
  if (t.includes("essentiel") || t.includes("core") || t.includes("léger") || t.includes("leger") || t.includes("light")) return "core";
  if (t.includes("éveil") || t.includes("eveil") || t.includes("awake")) return "awake";
  if (t.includes("endormi") || t.includes("asleep") || t.includes("sommeil")) return "asleep";
  return "asleep";
}
function unionMin(iv: [number, number][]) {
  iv.sort((a, b) => a[0] - b[0]); let tot = 0, cs = -1, ce = -1;
  for (const [s, e] of iv) { if (s > ce) { if (ce > cs) tot += ce - cs; cs = s; ce = e; } else ce = Math.max(ce, e); }
  if (ce > cs) tot += ce - cs; return Math.round(tot / 60000);
}
// recalcule la nuit qui se termine le jour J (12 h la veille -> 18 h le jour J, heure de Paris)
async function rebuildNight(user_id: string, night: string) {
  const end = date(`${night}T18:00:00+00:00`)!; const start = new Date(end.getTime() - 30 * 3600000);
  const { data } = await db.from("health_sleep_seg").select("*").eq("user_id", user_id).gte("end_at", start.toISOString()).lte("end_at", end.toISOString());
  const segs = (data ?? []) as SleepSeg[];
  if (!segs.length) return;
  const bySrc: Record<string, SleepSeg[]> = {};
  for (const s of segs) (bySrc[s.source] ||= []).push(s);
  const summaries = Object.entries(bySrc).map(([source, list]) => {
    const m = (st: string) => unionMin(list.filter((x) => x.stage === st).map((x) => [Date.parse(x.start_at), Date.parse(x.end_at)]));
    const core = m("core"), deep = m("deep"), rem = m("rem"), plain = m("asleep");
    const asleep = core + deep + rem > 0 ? core + deep + rem : plain;
    const times = list.map((x) => [Date.parse(x.start_at), Date.parse(x.end_at)]).flat();
    return { source, in_bed_min: m("inbed") || null, asleep_min: asleep, core_min: core || null, deep_min: deep || null, rem_min: rem || null, awake_min: m("awake") || null,
      bed_start: new Date(Math.min(...times)).toISOString(), bed_end: new Date(Math.max(...times)).toISOString(),
      score: asleep + (/(watch|apple)/i.test(source) ? 10000 : 0) + (deep + rem > 0 ? 5000 : 0) };
  });
  summaries.sort((a, b) => b.score - a.score);
  const { score: _s, ...best } = summaries[0];
  await db.from("health_sleep").upsert({ user_id, night, ...best, updated_at: new Date().toISOString() });
}

const PRIORITY = (src: string) => /garmin|connect/i.test(src) ? 3 : /watch|apple|forme|fitness/i.test(src) ? 2 : /strava/i.test(src) ? 1 : 0;

Deno.serve(async (req) => {
  if (req.method !== "POST") return out({ error: "POST attendu" }, 405);
  const auth = (req.headers.get("authorization") ?? req.headers.get("x-ftpb-token") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!auth.startsWith("ftpb_")) return out({ error: "Clé manquante" }, 401);
  const { data: tk } = await db.from("ingest_tokens").select("user_id").eq("token_hash", await sha256(auth)).maybeSingle();
  if (!tk) return out({ error: "Clé invalide : régénère-la dans l'app" }, 401);
  const user_id = tk.user_id as string;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return out({ error: "JSON invalide" }, 400); }
  const items = Array.isArray(body) ? body : Array.isArray(body.items) ? body.items as Record<string, unknown>[] : [body];
  const res = { daily: 0, sleep: 0, workout: 0, skipped: 0 };
  const nights = new Set<string>();

  for (const it of items) {
    const kind = String(it.kind ?? "daily").toLowerCase();
    if (kind === "daily") {
      const d = date(it.date) ?? new Date();
      const day = /^\d{4}-\d{2}-\d{2}$/.test(String(it.date ?? "")) ? String(it.date) : parisDay(d);
      const rows = [];
      for (const [k, v] of Object.entries(it)) {
        const key = ALIASES[k.toLowerCase()] ?? (/^[a-z0-9_]{1,32}$/.test(k) && !["kind", "date", "source"].includes(k) ? k : null);
        if (!key) continue;
        let n = num(v); if (n == null) continue;
        if ((key === "body_fat" || key === "spo2" || key === "water_pct") && n > 0 && n <= 1) n *= 100;
        if (n === 0 && ["hrv", "rhr", "weight", "vo2max", "spo2", "resp_rate", "body_fat", "walking_hr"].includes(key)) continue; // pas de mesure
        rows.push({ user_id, day, metric: key, value: n, updated_at: new Date().toISOString() });
      }
      if (rows.length) { await db.from("health_daily").upsert(rows); res.daily += rows.length; }
    } else if (kind === "sleep") {
      const s = date(it.start), e = date(it.end);
      if (!s || !e || e <= s) { res.skipped++; continue; }
      const stage = stageOf(String(it.stage ?? it.value ?? ""));
      await db.from("health_sleep_seg").upsert({ user_id, start_at: s.toISOString(), end_at: e.toISOString(), stage, source: String(it.source ?? "").slice(0, 60) });
      nights.add(parisDay(e)); // nuit rattachée au jour du réveil
      res.sleep++;
    } else if (kind === "workout") {
      const s = date(it.start); if (!s) { res.skipped++; continue; }
      const e = date(it.end);
      const duration = durMin(it.duration) ?? (e ? (e.getTime() - s.getTime()) / 60000 : null);
      const source = String(it.source ?? "").slice(0, 60);
      const row = { user_id, start_at: s.toISOString(), end_at: e?.toISOString() ?? null, type: String(it.type ?? "").slice(0, 60),
        duration_min: duration, distance_km: num(it.distance), energy_kcal: num(it.energy), avg_hr: num(it.avg_hr), source, updated_at: new Date().toISOString() };
      // doublons (même séance vue par Strava, Garmin Connect et la montre) : ±5 min
      const { data: near } = await db.from("health_workouts").select("start_at, source").eq("user_id", user_id)
        .gte("start_at", new Date(s.getTime() - 300000).toISOString()).lte("start_at", new Date(s.getTime() + 300000).toISOString());
      const dup = (near ?? []).find((n) => n.start_at !== row.start_at);
      if (dup) { // on garde la source prioritaire et on complète avec les champs de l'autre
        const { data: old } = await db.from("health_workouts").select("*").eq("user_id", user_id).eq("start_at", dup.start_at).single();
        const keepNew = PRIORITY(source) > PRIORITY(dup.source as string);
        const base: Record<string, unknown> = keepNew ? { ...row } : { ...old };
        const other: Record<string, unknown> = keepNew ? (old ?? {}) : row;
        for (const k of ["end_at", "type", "duration_min", "distance_km", "energy_kcal", "avg_hr"]) if (base[k] == null || base[k] === "") base[k] = other[k];
        base.updated_at = new Date().toISOString();
        if (keepNew) await db.from("health_workouts").delete().eq("user_id", user_id).eq("start_at", dup.start_at);
        await db.from("health_workouts").upsert(base);
        res.workout++; continue;
      }
      await db.from("health_workouts").upsert(row);
      res.workout++;
    } else res.skipped++;
  }
  for (const n of nights) await rebuildNight(user_id, n);
  await db.from("ingest_tokens").update({ last_used_at: new Date().toISOString() }).eq("user_id", user_id);
  return out({ ok: true, ...res });
});
