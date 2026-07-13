/* ===== NETLIFY FUNCTION : affiliate-me.js ===== */
/* Retourne le profil, les liens, les ventes et les stats de l'affilié
   actuellement connecté (via son token émis par affiliate-login.js).

   Variables d'environnement Netlify nécessaires :
   - ADMIN_TOKEN_SECRET
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY
*/

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

function verifyToken(token, secret) {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expectedSignature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  if (!payload.exp || Date.now() > payload.exp) return null;
  if (payload.role !== "affiliate") return null;

  return payload;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    if (!ADMIN_TOKEN_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error("Variables d'environnement manquantes");
      return { statusCode: 500, body: "Server misconfiguration" };
    }

    const authHeader = event.headers.authorization || event.headers.Authorization;
    const token = authHeader ? authHeader.replace("Bearer ", "") : null;
    const payload = verifyToken(token, ADMIN_TOKEN_SECRET);

    if (!payload) {
      return { statusCode: 401, body: "Unauthorized" };
    }
     
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
     
const { data: affiliate, error: profileError } = await supabaseAdmin
  .from("affiliates")
  .select("id, prenom, link_roulette, link_direct, tracking_slug_roulette, tracking_slug_direct, commission_amount, statut, created_at")
  .eq("id", payload.affiliateId)
  .single();

    if (profileError || !affiliate) {
      return { statusCode: 404, body: "Affiliate not found" };
    }

    if (affiliate.statut === "suspendu") {
      return { statusCode: 403, body: "Compte suspendu" };
    }

    const { data: sales, error: salesError } = await supabaseAdmin
      .from("sales")
      .select("*")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false });

    if (salesError) {
      console.error("Erreur chargement ventes :", salesError);
      return { statusCode: 500, body: "Failed to load sales" };
    }

    const { data: visits, error: visitsError } = await supabaseAdmin
      .from("visits")
      .select("id, created_at, link_type")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false });

    if (visitsError) {
      console.error("Erreur chargement visites :", visitsError);
    }

    // FIX C : on renvoie aussi totalVisits + conversionRate (en % avec 1 décimale),
    // pour que le front n'ait pas à les recalculer et que ces stats soient
    // disponibles côté serveur (cohérence avec admin-manager-dashboard.js).
    const totalSales = sales.length;
    const totalEarnings = sales.reduce((sum, s) => sum + Number(s.commission || 0), 0);
    const totalVisits = (visits || []).length;
    const conversionRate = totalVisits > 0
      ? Math.round((totalSales / totalVisits) * 1000) / 10
      : 0;

    return {
      statusCode: 200,
      body: JSON.stringify({
        affiliate,
        stats: { totalSales, totalEarnings, totalVisits, conversionRate },
        sales,
        visits: visits || [],
      }),
    };
  } catch (err) {
    console.error("Erreur affiliate-me.js :", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
