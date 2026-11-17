// Webhook Strava (public, sans JWT) :
//  GET  : validation de l'abonnement (hub.challenge) avec STRAVA_VERIFY_TOKEN
//  POST : événement -> nouvelle activité rapatriée dans strava_inbox, désautorisation -> tokens supprimés
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { admin, accessTokenFor, ingestActivity, verifyToken, rawInt } from "../_shared/strava.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const ok = url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === await verifyToken();
    if (!ok) return new Response("forbidden", { status: 403 });
    return new Response(JSON.stringify({ "hub.challenge": url.searchParams.get("hub.challenge") }), { headers: { "Content-Type": "application/json" } });
  }
  if (req.method !== "POST") return new Response("method", { status: 405 });
  // object_id / owner_id lus dans le texte brut : en 64 bits, JSON.parse les arrondirait (> 2^53)
  const raw = await req.text().catch(() => "");
  let ev: Record<string, any> | null = null; try { ev = JSON.parse(raw); } catch { ev = null; }
  const objectId = rawInt(raw, "object_id"), ownerId = rawInt(raw, "owner_id");
  // Strava exige une réponse < 2 s : on répond tout de suite et on traite en tâche de fond
  const work = (async () => {
    if (!ev || !ownerId) return;
    const db = admin();
    try {
      if (ev.object_type === "athlete" && ev.updates?.authorized === "false") {
        await db.from("strava_tokens").delete().eq("athlete_id", ownerId);
        return;
      }
      if (ev.object_type === "activity" && !objectId) return;
      if (ev.object_type === "activity" && (ev.aspect_type === "create" || ev.aspect_type === "update")) {
        const tk = await accessTokenFor(db, { athlete_id: ownerId });
        if (!tk) return;
        await ingestActivity(db, tk.token, tk.user_id, objectId!);
      }
      if (ev.object_type === "activity" && ev.aspect_type === "delete") {
        await db.from("strava_inbox").delete().eq("strava_id", objectId).eq("imported", false);
      }
    } catch (e) { console.error("webhook", e); }
  })();
  // @ts-ignore EdgeRuntime existe dans l'environnement Supabase
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work); else await work;
  return new Response("ok");
});
