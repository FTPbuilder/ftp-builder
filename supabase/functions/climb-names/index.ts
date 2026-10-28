// Noms des ascensions (JWT Supabase requis) via Photon (géocodeur OpenStreetMap de komoot), interrogé côté serveur.
//  POST { climbs: [{ key, s:[lat,lon], e:[lat,lon], path?:[[lat,lon]…] }] } -> { queued: n } tout de suite ;
//  les noms sont calculés en tâche de fond et écrits dans la table climb_names (l'app les lit, même si elle a été fermée entre-temps).
// Règles (façon ClimbFinder) : col franchi au sommet ; sinon station de ski au sommet ; col franchi plus bas sur la montée ;
// sommet nommé ; lieu-dit (« Montée vers … »). Puis « depuis » la ville ou le village du départ.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const UA = "FTPBuilder/1.0 (https://ftpbuilder.github.io/ftp-builder/)";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
type P = [number, number];
type F = { name: string; key: string; value: string; city?: string; p: P; d: number };
const km = (a: P, b: P) => Math.hypot((b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180) * 111.32, (b[0] - a[0]) * 110.54);

let lastCall = 0;
async function photon(p: P, radiusKm: number, tags: string[]): Promise<F[]> {
  const gap = Date.now() - lastCall; if (gap < 1000) await wait(1000 - gap); // usage raisonnable : une requête par seconde
  lastCall = Date.now();
  const q = new URLSearchParams({ lat: String(p[0]), lon: String(p[1]), radius: String(radiusKm), limit: "20", lang: "fr" });
  for (const t of tags) q.append("osm_tag", t);
  for (let k = 0; k < 3; k++) {
    const r = await fetch(`https://photon.komoot.io/reverse?${q}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) }).catch(() => null);
    if (r?.ok) {
      const j = await r.json();
      return (j.features ?? []).map((f: any) => { const c = f.geometry?.coordinates ?? []; const pp: P = [c[1], c[0]];
        return { name: f.properties?.name, key: f.properties?.osm_key, value: f.properties?.osm_value, city: f.properties?.city, p: pp, d: km(p, pp) }; })
        .filter((f: F) => f.name && f.p[0] != null).sort((a: F, b: F) => a.d - b.d);
    }
    await wait(1500 * (k + 1)); // 503 / 429 : on patiente puis on réessaie
  }
  throw new Error("photon indisponible");
}

async function nameOf(c: { s: P; e: P; path?: P[] }) {
  const passTags = ["mountain_pass", "natural:saddle"];
  const around = await photon(c.e, 2.5, [...passTags, "landuse:winter_sports", "natural:peak", "place"]); // une seule requête au sommet
  const isPass = (f: F) => f.key === "mountain_pass" || (f.key === "natural" && f.value === "saddle");
  const passTop = around.find((f) => isPass(f) && f.d <= 1) ?? null;
  let top: string | null = null;
  if (passTop && passTop.d <= 0.1) top = passTop.name; // on franchit le col pile au sommet
  if (!top) { const ski = around.find((f) => f.key === "landuse" && f.value === "winter_sports" && f.d <= 1.5); if (ski) top = ski.name; } // arrivée en station (Hautacam…)
  const isCol = (n: string) => /^(col|pas|port|puerto|passo|colla|collado|coll|colláu|portillo|sella|forcla|cou)\b/i.test(n);
  if (!top && passTop && passTop.d <= 1 && isCol(passTop.name)) top = passTop.name;
  if (!top && c.path?.length) for (const pt of c.path.slice(4, 8).reverse()) { // col franchi plus bas (la montée continue au-delà)
    const f = (await photon(pt, 0.8, passTags))[0]; if (f && f.d <= 0.8) { top = f.name; break; }
  }
  if (!top && passTop && passTop.d <= 1) top = passTop.name;
  if (!top) { const pk = around.find((f) => f.key === "natural" && f.value === "peak" && f.d <= 0.8); if (pk) top = pk.name; }
  let hamlet: string | null = null;
  if (!top) { const pl = around.find((f) => f.key === "place"); if (pl) { hamlet = pl.name; top = `Montée vers ${pl.name}`; } }
  if (!top) return "";
  const towns = await photon(c.s, 5, ["place:city", "place:town", "place:village"]);
  const from = towns[0]?.name ?? (await photon(c.s, 1, []))[0]?.city ?? null;
  return from && from !== top && from !== hamlet ? `${top} depuis ${from}` : top;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Non connecté" }, 401);
    const body = await req.json().catch(() => ({}));
    const list = (Array.isArray(body.climbs) ? body.climbs : []).filter((c: any) => c?.key && c?.s && c?.e).slice(0, 12);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const work = (async () => {
      for (const c of list) {
        let name: string | null = null, error: string | null = null;
        try { name = await nameOf(c); } catch (e) { error = String((e as Error).message ?? e); }
        await db.from("climb_names").upsert({ user_id: user.id, key: c.key, name, error, updated_at: new Date().toISOString() });
      }
    })();
    // @ts-ignore EdgeRuntime existe dans l'environnement Supabase
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work); else await work;
    return json({ queued: list.length });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
