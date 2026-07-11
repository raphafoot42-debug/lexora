/* ===== NETLIFY FUNCTION : admin-toggle-user.js ===== */
/* Suspend ou réactive un compte utilisateur.
   Protégé par le token admin émis par admin-auth.js (jamais de check en dur).
   Utilise la clé service_role Supabase (jamais exposée côté client) pour
   pouvoir modifier n'importe quelle ligne de "users", RLS ou pas.

   Variables d'environnement Netlify nécessaires :
   - ADMIN_TOKEN_SECRET     (même valeur que dans admin-auth.js, pour vérifier la signature)
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY   (clé service_role, jamais la clé anon)
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
  if (!payload.exp || Date.now() > payload.exp) return null; // token expiré
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

    const payload = verifyToken(token, ADMIN_TOKEN_SECRET);
    if (!payload) {
      return { statusCode: 401, body: "Unauthorized" };
    }

    const { userId, newStatus } = JSON.parse(event.body);

    if (!userId || !["actif", "suspendu"].includes(newStatus)) {
      return { statusCode: 400, body: "Missing or invalid fields (userId, newStatus)" };
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { error } = await supabaseAdmin
      .from("users")
      .update({ statut: newStatus })
      .eq("id", userId);

    if (error) {
      console.error("Erreur mise à jour statut :", error);
      return { statusCode: 500, body: "Failed to update user status" };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, userId, newStatus }),
    };
  } catch (err) {
    console.error("Erreur admin-toggle-user.js :", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
