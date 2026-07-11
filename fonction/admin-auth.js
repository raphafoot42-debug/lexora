/* ===== NETLIFY FUNCTION : admin-auth.js ===== */
/* Vérifie le mot de passe admin envoyé depuis admin.html.
   Le mot de passe attendu vit UNIQUEMENT dans la variable d'environnement
   Netlify ADMIN_PASSWORD — jamais en dur dans le code.

   En cas de succès, renvoie un token de session signé (durée limitée)
   que le front stocke en sessionStorage et renvoie dans le header
   Authorization pour les actions sensibles (ex: admin-toggle-user.js).

   Variable d'environnement Netlify nécessaire :
   - ADMIN_PASSWORD
   - ADMIN_TOKEN_SECRET   (chaîne aléatoire longue, sert à signer le token)
*/

const crypto = require("crypto");

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2h de session admin

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
    const { password } = JSON.parse(event.body);

    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET;

    if (!ADMIN_PASSWORD || !ADMIN_TOKEN_SECRET) {
      console.error("Variables d'environnement manquantes (ADMIN_PASSWORD / ADMIN_TOKEN_SECRET)");
      return { statusCode: 500, body: "Server misconfiguration" };
    }

    if (!password) {
      return { statusCode: 400, body: "Missing password" };
    }

    // Comparaison en temps constant pour éviter les attaques par timing
    const provided = Buffer.from(password);
    const expected = Buffer.from(ADMIN_PASSWORD);

    const isValid =
      provided.length === expected.length &&
      crypto.timingSafeEqual(provided, expected);

    if (!isValid) {
      return { statusCode: 401, body: "Invalid password" };
    }

    const token = signToken({ role: "admin", exp: Date.now() + TOKEN_TTL_MS }, ADMIN_TOKEN_SECRET);

    return {
      statusCode: 200,
      body: JSON.stringify({ token }),
    };
  } catch (err) {
    console.error("Erreur admin-auth.js :", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
