/* ===== NETLIFY FUNCTION : admin-add-link.js ===== */
/* Ajoute un Payment Link Stripe au pool (table referral_links).
   Protégé par le token admin émis par admin-auth.js.
   Utilise la clé service_role Supabase (jamais exposée côté client).

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

    const payload = verifyToken(token, ADMIN_TOKEN_SECRET);
    if (!payload) {
      return { statusCode: 401, body: "Unauthorized" };
    }

    const { stripePaymentLinkId, url } = JSON.parse(event.body);

    if (!stripePaymentLinkId || !url) {
      return { statusCode: 400, body: "Missing fields (stripePaymentLinkId, url)" };
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { error } = await supabaseAdmin
      .from("referral_links")
      .insert({ stripe_payment_link_id: stripePaymentLinkId, url, assigned_to: null });

    if (error) {
      console.error("Erreur ajout lien :", error);
      return { statusCode: 500, body: "Failed to add link" };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("Erreur admin-add-link.js :", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
