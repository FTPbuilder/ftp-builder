// Actions Strava appelées par l'app (JWT Supabase requis) :
//  { action: "exchange", code }  -> connecte le compte Strava
//  { action: "sync", days? }     -> rapatrie les sorties vélo des N derniers jours
//  { action: "disconnect" }      -> révoque et supprime les tokens
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { admin, tokenRequest, accessTokenFor, ingestActivity, ensureSubscription, cors, json } from "../_shared/strava.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Non connecté" }, 401);
    const db = admin();
    const body = await req.json().catch(() => ({}));

    if (body.action === "exchange") {
      if (!body.code) return json({ error: "code manquant" }, 400);
      const t = await tokenRequest({ grant_type: "authorization_code", code: body.code });
      if (body.scope && !String(body.scope).includes("activity:read")) return json({ error: "Autorise l'accès aux activités sur Strava (case « Voir les données de vos activités »)" }, 400);
      const { error } = await db.from("strava_tokens").upsert({
        user_id: user.id, athlete_id: t.athlete.id, access_token: t.access_token, refresh_token: t.refresh_token,
        expires_at: new Date(t.expires_at * 1000).toISOString(), scope: body.scope ?? null,
      }, { onConflict: "user_id" });
      if (error) throw error;
      let webhook: unknown = null; try { webhook = await ensureSubscription(); } catch (e) { webhook = { subscribed: false, error: String(e) }; }
      return json({ connected: true, athlete: { id: t.athlete.id, firstname: t.athlete.firstname }, webhook });
    }

    if (body.action === "sync") {
      const tk = await accessTokenFor(db, { user_id: user.id });
      if (!tk) return json({ error: "Strava non connecté" }, 400);
      const days = Math.min(Math.max(Number(body.days) || 14, 1), 120);
      const after = Math.floor(Date.now() / 1000) - days * 86400;
      const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=60`, { headers: { Authorization: `Bearer ${tk.token}` } });
      if (!r.ok) throw new Error(`liste Strava ${r.status}`);
      const list = await r.json();
      const { data: known } = await db.from("strava_inbox").select("strava_id").eq("user_id", user.id);
      const seen = new Set((known ?? []).map((k) => Number(k.strava_id)));
      let added = 0;
      for (const a of list) {
        if (seen.has(a.id)) continue;
        const res = await ingestActivity(db, tk.token, user.id, a.id);
        if ((res as { ok?: boolean }).ok) added++;
      }
      return json({ added });
    }

    if (body.action === "disconnect") {
      const tk = await accessTokenFor(db, { user_id: user.id });
      if (tk) await fetch("https://www.strava.com/oauth/deauthorize", { method: "POST", headers: { Authorization: `Bearer ${tk.token}` } });
      await db.from("strava_tokens").delete().eq("user_id", user.id);
      return json({ connected: false });
    }
    if (body.action === "webhook") return json(await ensureSubscription());
    return json({ error: "action inconnue" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
