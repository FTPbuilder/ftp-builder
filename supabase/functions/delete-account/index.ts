// Suppression du compte par l'utilisateur lui-même (JWT Supabase requis) :
//  1. révoque l'accès Strava et Intervals.icu (OAuth) côté services
//  2. supprime l'utilisateur auth : toutes les tables public.* référencent auth.users ON DELETE CASCADE
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
// autonome (pas d'import partagé) : déploiement simple
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Non connecté" }, 401);
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== "SUPPRIMER") return json({ error: "Confirmation manquante" }, 400);
    const db = admin();
    // révocations : best effort, la suppression continue même si un service ne répond pas
    try {
      const { data: t } = await db.from("strava_tokens").select("access_token,refresh_token,expires_at").eq("user_id", user.id).maybeSingle();
      if (t) {
        let token = t.access_token as string;
        if (new Date(t.expires_at).getTime() < Date.now() + 60_000) {
          const r = await fetch("https://www.strava.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ client_id: Deno.env.get("STRAVA_CLIENT_ID"), client_secret: Deno.env.get("STRAVA_CLIENT_SECRET"), grant_type: "refresh_token", refresh_token: t.refresh_token }) });
          if (r.ok) token = (await r.json()).access_token;
        }
        await fetch("https://www.strava.com/oauth/deauthorize", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      }
    } catch (e) { console.warn("strava deauthorize", e); }
    try {
      const { data: acc } = await db.from("intervals_accounts").select("api_key").eq("user_id", user.id).maybeSingle();
      if (acc && String(acc.api_key).startsWith("oauth:"))
        await fetch("https://intervals.icu/api/v1/disconnect-app", { method: "DELETE", headers: { Authorization: "Bearer " + String(acc.api_key).slice(6), "User-Agent": "Mozilla/5.0 (FTP Builder)" } });
    } catch (e) { console.warn("intervals disconnect", e); }
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return json({ deleted: true });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
