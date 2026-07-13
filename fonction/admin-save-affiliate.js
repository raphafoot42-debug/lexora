/* ===== NETLIFY FUNCTION : admin-save-affiliate.js ===== */
/* Crée un nouvel affilié OU modifie un affilié existant (si "id" est fourni).
   Protégé par le token admin. Les slugs BlueAffiliates sont extraits du path
   du lien (ex: "fFGJHaD6" dans https://blue2affiliates.com/g/fFGJHaD6).

   Variables d'environnement Netlify nécessaires :
   - ADMIN_TOKEN_SECRET
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY
*/

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
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

// Extrait le code court d'un lien BlueAffiliates (dernier segment du path).
function extractTrackingSlug(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : null;
  } catch (err) {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    // FIX B : STRIPE_SECRET_KEY n'est plus requise (les liens ne sont pas Stripe).
    if (!ADMIN_TOKEN_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error("Variables d'environnement manquantes");
      return { statusCode: 500, body: "Server misconfiguration" };
    }

    const authHeader = event.headers.authorization || event.headers.Authorization;
    const token = authHeader ? authHeader.replace("Bearer ", "") : null;
    if (!verifyToken(token, ADMIN_TOKEN_SECRET)) {
      return { statusCode: 401, body: "Unauthorized" };
    }

    const { id, prenom, password, linkRoulette, linkDirect, commissionAmount, manager } = JSON.parse(event.body);

    if (!prenom || !linkRoulette || !linkDirect || commissionAmount === undefined || commissionAmount === null || !manager) {
      return { statusCode: 400, body: "Champs manquants (prenom, linkRoulette, linkDirect, commissionAmount, manager requis)" };
    }
    if (!["noe", "raphael"].includes(manager)) {
      return { statusCode: 400, body: "manager doit être 'noe' ou 'raphael'" };
    }
    if (!id && !password) {
      return { statusCode: 400, body: "Mot de passe requis pour créer un nouvel affilié" };
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // FIX B : plus d'appel Stripe (resolveStripeLinkId était mort de toute façon).
    const trackingSlugRoulette = extractTrackingSlug(linkRoulette);
    const trackingSlugDirect = extractTrackingSlug(linkDirect);

    const row = {
      prenom,
      link_roulette: linkRoulette,
      link_direct: linkDirect,
      tracking_slug_roulette: trackingSlugRoulette,
      tracking_slug_direct: trackingSlugDirect,
      commission_amount: Number(commissionAmount),
      manager,
    };

    if (password) {
      row.password_hash = await bcrypt.hash(password, 10);
    }

    let result;
    if (id) {
      result = await supabaseAdmin.from("affiliates").update(row).eq("id", id).select().single();
    } else {
      result = await supabaseAdmin.from("affiliates").insert(row).select().single();
    }

    if (result.error) {
      console.error("Erreur enregistrement affilié :", result.error);
      if (result.error.code === "23505") {
        return { statusCode: 409, body: "Ce prénom est déjà utilisé par un autre affilié" };
      }
      return { statusCode: 500, body: "Failed to save affiliate" };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, affiliate: result.data }),
    };
  } catch (err) {
    console.error("Erreur admin-save-affiliate.js :", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
