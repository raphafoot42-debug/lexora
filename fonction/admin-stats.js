/* ===== NETLIFY FUNCTION : admin-stats.js ===== */
/* Statistiques globales, tous affiliés confondus, pour la vue d'ensemble
   en haut de admin.html (visites, ventes, montant dû, revenu, graphique
   par jour sur les 90 derniers jours).
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

const DAYS_WINDOW = 90;

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

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const since = new Date();
    since.setDate(since.getDate() - DAYS_WINDOW);

    const [{ data: visits, error: visitsError }, { data: sales, error: salesError }] = await Promise.all([
      supabaseAdmin.from("visits").select("created_at").gte("created_at", since.toISOString()),
      supabaseAdmin.from("sales").select("created_at, amount, commission").gte("created_at", since.toISOString()),
    ]);

    if (visitsError || salesError) {
      console.error("Erreur chargement stats globales :", visitsError || salesError);
      return { statusCode: 500, body: "Failed to load stats" };
    }

    // Totaux (toutes périodes confondues, pas seulement la fenêtre de 90 jours,
    // pour ne pas sous-compter les chiffres affichés en haut)
    const { count: totalVisitsAllTime } = await supabaseAdmin
      .from("visits")
      .select("*", { count: "exact", head: true });
    const { data: allSales } = await supabaseAdmin.from("sales").select("amount, commission");

    const totalSales = allSales ? allSales.length : 0;
    const totalOwed = allSales ? allSales.reduce((sum, s) => sum + Number(s.commission || 0), 0) : 0;
    const totalRevenue = allSales ? allSales.reduce((sum, s) => sum + Number(s.amount || 0), 0) : 0;

    // Série journalière sur la fenêtre de 90 jours (pour le graphique)
    const dayMap = {};
    for (let i = DAYS_WINDOW - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { date: key, visits: 0, sales: 0, owed: 0, revenue: 0 };
    }

    (visits || []).forEach((v) => {
      const key = new Date(v.created_at).toISOString().slice(0, 10);
      if (dayMap[key]) dayMap[key].visits += 1;
    });

    (sales || []).forEach((s) => {
      const key = new Date(s.created_at).toISOString().slice(0, 10);
      if (dayMap[key]) {
        dayMap[key].sales += 1;
        dayMap[key].owed += Number(s.commission || 0);
        dayMap[key].revenue += Number(s.amount || 0);
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        totals: {
          totalVisits: totalVisitsAllTime || 0,
          totalSales,
          totalOwed,
          totalRevenue,
        },
        daily: Object.values(dayMap),
      }),
    };
  } catch (err) {
    console.error("Erreur admin-stats.js :", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
