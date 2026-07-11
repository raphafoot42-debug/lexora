/* ===== NETLIFY FUNCTION : affiliate-login.js ===== */
/* Connexion de l'affilié : prénom (insensible à la casse) + mot de passe (exact).
   Pas d'auto-inscription : le compte doit avoir été créé au préalable par l'admin.
   Un compte suspendu ne peut pas se connecter.

   Variables d'environnement Netlify nécessaires :
   - ADMIN_TOKEN_SECRET   (même secret que pour les tokens admin, réutilisé ici
                           avec un rôle différent dans le token émis)
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY
*/

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12h de session affilié

function signToken(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
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

    const { prenom, password } = JSON.parse(event.body);
    if (!prenom || !password) {
      return { statusCode: 400, body: "Missing fields (prenom, password)" };
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Recherche insensible à la casse sur le prénom
    const { data: affiliate, error } = await supabaseAdmin
      .from("affiliates")
      .select("id, prenom, password_hash, statut")
      .ilike("prenom", prenom.trim())
      .single();

    if (error || !affiliate) {
      return { statusCode: 401, body: "Identifiants incorrects" };
    }

    if (affiliate.statut === "suspendu") {
      return { statusCode: 403, body: "Ce compte a été suspendu" };
    }

    // Mot de passe : comparaison EXACTE (sensible à la casse), gérée par bcrypt
    const passwordMatches = await bcrypt.compare(password, affiliate.password_hash);
    if (!passwordMatches) {
      return { statusCode: 401, body: "Identifiants incorrects" };
    }

    const token = signToken(
      { role: "affiliate", affiliateId: affiliate.id, exp: Date.now() + TOKEN_TTL_MS },
      ADMIN_TOKEN_SECRET
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ token, prenom: affiliate.prenom }),
    };
  } catch (err) {
    console.error("Erreur affiliate-login.js :", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
