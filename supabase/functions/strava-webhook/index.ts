// Webhook Strava (public, sans JWT) :
//  GET  : validation de l'abonnement (hub.challenge) avec STRAVA_VERIFY_TOKEN
//  POST : événement -> nouvelle activité rapatriée dans strava_inbox, désautorisation -> tokens supprimés
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { admin, accessTokenFor, ingestActivity, verifyToken } from "../_shared/strava.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const ok = url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === await verifyToken();
    if (!ok) return new Response("forbidden", { status: 403 });
    return new Response(JSON.stringify({ "hub.challenge": url.searchParams.get("hub.challenge") }), { headers: { "Content-Type": "application/json" } });
  }
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const ev = await req.json().catch(() => null);
  // Strava exige une réponse < 2 s : on répond tout de suite et on traite en tâche de fond
  const work = (async () => {
    if (!ev) return;
    const db = admin();
    try {
      if (ev.object_type === "athlete" && ev.updates?.authorized === "false") {
        await db.from("strava_tokens").delete().eq("athlete_id", ev.owner_id);
        return;
      }
      if (ev.object_type === "activity" && (ev.aspect_type === "create" || ev.aspect_type === "update")) {
        const tk = await accessTokenFor(db, { athlete_id: ev.owner_id });
        if (!tk) return;
        await ingestActivity(db, tk.token, tk.user_id, ev.object_id);
      }
      if (ev.object_type === "activity" && ev.aspect_type === "delete") {
        await db.from("strava_inbox").delete().eq("strava_id", ev.object_id).eq("imported", false);
      }
    } catch (e) { console.error("webhook", e); }
  })();
  // @ts-ignore EdgeRuntime existe dans l'environnement Supabase
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work); else await work;
  return new Response("ok");
});
