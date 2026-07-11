/* ===== NETLIFY FUNCTION : affiliate-change-password.js ===== */
/* Permet à un affilié connecté de changer SON PROPRE mot de passe.
   Protégé par son token (rôle "affiliate"), jamais d'accès aux autres comptes.

   Variables d'environnement Netlify nécessaires :
   - ADMIN_TOKEN_SECRET
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY
*/

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

const MIN_PASSWORD_LENGTH = 6;

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

    const { newPassword } = JSON.parse(event.body);
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      return { statusCode: 400, body: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const password_hash = await bcrypt.hash(newPassword, 10);

    const { error } = await supabaseAdmin
      .from("affiliates")
      .update({ password_hash })
      .eq("id", payload.affiliateId);

    if (error) {
      console.error("Erreur changement mot de passe :", error);
      return { statusCode: 500, body: "Failed to update password" };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("Erreur affiliate-change-password.js :", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
