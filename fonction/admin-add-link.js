/* ===== NETLIFY FUNCTION : admin-add-link.js ===== */
/* Ajoute plusieurs Payment Links Stripe au pool en une fois (copier-coller en bloc).
   Pour chaque URL collée, on interroge l'API Stripe (liste des Payment Links du
   compte) pour retrouver automatiquement l'ID Stripe correspondant — pas besoin
   de le saisir à la main.
   Protégé par le token admin émis par admin-auth.js.

   Variables d'environnement Netlify nécessaires :
   - ADMIN_TOKEN_SECRET
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY
   - STRIPE_SECRET_KEY
*/

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");

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

// Récupère TOUS les Payment Links du compte Stripe (avec pagination),
// pour pouvoir faire correspondre chaque URL collée à son ID Stripe.
async function fetchAllPaymentLinks(stripe) {
  const all = [];
  let startingAfter;

  do {
    const page = await stripe.paymentLinks.list({ limit: 100, starting_after: startingAfter });
    all.push(...page.data);
    startingAfter = page.has_more ? page.data[page.data.length - 1].id : undefined;
  } while (startingAfter);

  return all;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

    if (!ADMIN_TOKEN_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY || !STRIPE_SECRET_KEY) {
      console.error("Variables d'environnement manquantes");
      return { statusCode: 500, body: "Server misconfiguration" };
    }

    const authHeader = event.headers.authorization || event.headers.Authorization;
    const token = authHeader ? authHeader.replace("Bearer ", "") : null;

    const payload = verifyToken(token, ADMIN_TOKEN_SECRET);
    if (!payload) {
      return { statusCode: 401, body: "Unauthorized" };
    }

    const { urls } = JSON.parse(event.body);

    if (!Array.isArray(urls) || urls.length === 0) {
      return { statusCode: 400, body: "Missing field: urls (array)" };
    }

    const cleanUrls = urls
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (cleanUrls.length === 0) {
      return { statusCode: 400, body: "No valid URLs provided" };
    }

    const stripe = Stripe(STRIPE_SECRET_KEY);
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const stripeLinks = await fetchAllPaymentLinks(stripe);
    const urlToId = new Map(stripeLinks.map((link) => [link.url, link.id]));

    const toInsert = [];
    const notFound = [];

    cleanUrls.forEach((url) => {
      const stripeId = urlToId.get(url);
      if (stripeId) {
        toInsert.push({ stripe_payment_link_id: stripeId, url, assigned_to: null });
      } else {
        notFound.push(url);
      }
    });

    if (toInsert.length > 0) {
      const { error } = await supabaseAdmin
        .from("referral_links")
        .upsert(toInsert, { onConflict: "stripe_payment_link_id", ignoreDuplicates: true });

      if (error) {
        console.error("Erreur ajout liens :", error);
        return { statusCode: 500, body: "Failed to add links" };
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        added: toInsert.length,
        notFound, // URLs collées qui ne correspondent à aucun Payment Link Stripe existant
      }),
    };
  } catch (err) {
    console.error("Erreur admin-add-link.js :", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
