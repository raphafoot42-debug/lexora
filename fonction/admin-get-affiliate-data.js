/* ===== NETLIFY FUNCTION : admin-get-affiliate-data.js ===== */
/* Retourne le profil + les ventes + les stats d'UN affilié précis.
   Utilisé par le bouton "Voir dashboard" dans admin.html.
   Protégé par le token admin.

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
  if (payload.role !== "admin") return null;

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
    if (!verifyToken(token, ADMIN_TOKEN_SECRET)) {
      return { statusCode: 401, body: "Unauthorized" };
    }

    const { affiliateId } = JSON.parse(event.body);
    if (!affiliateId) {
      return { statusCode: 400, body: "Missing field: affiliateId" };
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: affiliate, error: profileError } = await supabaseAdmin
      .from("affiliates")
      .select("id, prenom, link_roulette, link_direct, commission_amount, statut, created_at")
      .eq("id", affiliateId)
      .single();

    if (profileError || !affiliate) {
      return { statusCode: 404, body: "Affiliate not found" };
    }

    const { data: sales, error: salesError } = await supabaseAdmin
      .from("sales")
      .select("*")
      .eq("affiliate_id", affiliateId)
      .order("created_at", { ascending: false });

    if (salesError) {
      console.error("Erreur chargement ventes :", salesError);
      return { statusCode: 500, body: "Failed to load sales" };
    }

    const totalSales = sales.length;
    const totalEarnings = sales.reduce((sum, s) => sum + Number(s.commission || 0), 0);

    let visits = [];
    try {
      const { data: visitsData, error: visitsError } = await supabaseAdmin
        .from("visits")
        .select("*")
        .eq("referrer_id", affiliateId);
      if (!visitsError && visitsData) {
        visits = visitsData;
      } else if (visitsError) {
        console.warn("Visites non disponibles :", visitsError.message);
      }
    } catch (visitsErr) {
      console.warn("Erreur chargement visites (ignorée) :", visitsErr.message);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        affiliate,
        stats: { totalSales, totalEarnings },
        sales,
        visits,
      }),
    };
  } catch (err) {
    console.error("Erreur admin-get-affiliate-data.js :", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
