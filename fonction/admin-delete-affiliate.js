/* ===== NETLIFY FUNCTION : admin-delete-affiliate.js ===== */
/* Supprime définitivement un affilié. Protégé par le token admin.
   Les ventes déjà enregistrées restent en base (affiliate_id passe à NULL),
   pour ne pas perdre l'historique financier.

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

    const { id } = JSON.parse(event.body);
    if (!id) {
      return { statusCode: 400, body: "Missing field: id" };
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // On détache d'abord les ventes existantes pour garder l'historique
    await supabaseAdmin.from("sales").update({ affiliate_id: null }).eq("affiliate_id", id);
    await supabaseAdmin.from("visits").update({ affiliate_id: null }).eq("affiliate_id", id);

    const { error } = await supabaseAdmin.from("affiliates").delete().eq("id", id);

    if (error) {
      console.error("Erreur suppression affilié :", error);
      return { statusCode: 500, body: "Failed to delete affiliate" };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("Erreur admin-delete-affiliate.js :", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
