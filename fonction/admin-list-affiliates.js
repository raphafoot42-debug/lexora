/* ===== NETLIFY FUNCTION : admin-list-affiliates.js ===== */
/* Retourne la liste de tous les affiliés (pour le tableau dans admin.html).
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
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
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

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: affiliates, error } = await supabaseAdmin
      .from("affiliates")
      .select("id, prenom, link_roulette, link_direct, commission_amount, statut, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur liste affiliés :", error);
      return { statusCode: 500, body: "Failed to list affiliates" };
    }

    return { statusCode: 200, body: JSON.stringify({ affiliates }) };
  } catch (err) {
    console.error("Erreur admin-list-affiliates.js :", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
