/* ===== NETLIFY FUNCTION : admin-stats.js ===== */
/* Retourne les statistiques globales, tous affiliés confondus :
   total des visites, total des ventes, total dû aux affiliés (commissions),
   total encaissé par l'entreprise (montant des ventes moins commissions),
   ainsi qu'une répartition jour par jour pour le graphique de la vue
   d'ensemble admin.
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

    // Ventes : jamais de .order() ici pour ne pas dépendre d'une colonne de
    // date qui pourrait manquer (cf. le bug déjà rencontré sur "sales").
    const { data: sales, error: salesError } = await supabaseAdmin
      .from("sales")
      .select("*");

    if (salesError) {
      console.error("Erreur chargement ventes (global) :", salesError);
      return { statusCode: 500, body: "Failed to load sales" };
    }

    // Visites : non bloquant, comme pour affiliate-me.js.
    let visits = [];
    try {
      const { data: visitsData, error: visitsError } = await supabaseAdmin
        .from("visits")
        .select("*");
      if (!visitsError && visitsData) {
        visits = visitsData;
      } else if (visitsError) {
        console.warn("Visites non disponibles (global) :", visitsError.message);
      }
    } catch (visitsErr) {
      console.warn("Erreur chargement visites (ignorée, global) :", visitsErr.message);
    }

    const totalVisits = visits.length;
    const totalSales = sales.length;
    const totalOwed = sales.reduce((sum, s) => sum + Number(s.commission || 0), 0);
    const totalRevenue = sales.reduce(
      (sum, s) => sum + (Number(s.amount || 0) - Number(s.commission || 0)),
      0
    );

    // Répartition par jour (utilisée pour le graphique à 4 métriques).
    // Défensif : si created_at manque sur une ligne, elle est simplement
    // ignorée du détail par jour (mais reste comptée dans les totaux ci-dessus).
    const dayMap = {};
    function ensureDay(key) {
      if (!dayMap[key]) {
        dayMap[key] = { date: key, visits: 0, sales: 0, owed: 0, revenue: 0 };
      }
      return dayMap[key];
    }
    visits.forEach((v) => {
      const raw = v.created_at;
      if (!raw) return;
      const key = new Date(raw).toISOString().slice(0, 10);
      ensureDay(key).visits += 1;
    });
    sales.forEach((s) => {
      const raw = s.created_at;
      if (!raw) return;
      const key = new Date(raw).toISOString().slice(0, 10);
      const day = ensureDay(key);
      day.sales += 1;
      day.owed += Number(s.commission || 0);
      day.revenue += Number(s.amount || 0) - Number(s.commission || 0);
    });

    const daily = Object.values(dayMap).sort((a, b) => (a.date < b.date ? -1 : 1));

    return {
      statusCode: 200,
      body: JSON.stringify({
        totals: { totalVisits, totalSales, totalOwed, totalRevenue },
        daily,
      }),
    };
  } catch (err) {
    console.error("Erreur admin-stats.js :", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
