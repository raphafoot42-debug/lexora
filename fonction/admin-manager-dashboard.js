/* ===== NETLIFY FUNCTION : admin-manager-dashboard.js ===== */
/* Retourne les statistiques AGRÉGÉES de tous les affiliés gérés par un manager
   (Noé ou Raphaël) : total visites, total ventes, taux de conversion, total
   des gains du manager (part 80€ − commission de l'affilié, sur toutes les
   ventes de tous ses clients), + un graphique par jour.
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

    const { manager } = JSON.parse(event.body);
    if (!["noe", "raphael"].includes(manager)) {
      return { statusCode: 400, body: "manager doit être 'noe' ou 'raphael'" };
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Tous les affiliés de ce manager
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from("affiliates")
      .select("id, prenom, commission_amount, statut, link_roulette, link_direct, created_at")
      .eq("manager", manager)
      .order("created_at", { ascending: false });

    if (clientsError) {
      console.error("Erreur chargement clients :", clientsError);
      return { statusCode: 500, body: "Failed to load clients" };
    }

    const clientIds = clients.map((c) => c.id);

    if (clientIds.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          clients: [],
          stats: { totalVisits: 0, totalSales: 0, totalEarnings: 0, conversionRate: 0 },
          daily: [],
        }),
      };
    }

    // 2. Visites et ventes de TOUS ces clients réunis
    const { data: visits, error: visitsError } = await supabaseAdmin
      .from("visits")
      .select("created_at")
      .in("affiliate_id", clientIds);

    const { data: sales, error: salesError } = await supabaseAdmin
      .from("sales")
      .select("created_at, commission, amount, manager_commission")
      .in("affiliate_id", clientIds);

    if (visitsError || salesError) {
      console.error("Erreur chargement stats manager :", visitsError || salesError);
      return { statusCode: 500, body: "Failed to load stats" };
    }

    const totalVisits = visits ? visits.length : 0;
    const totalSales = sales ? sales.length : 0;
    // totalOwed = ce qu'on doit verser aux affiliés (commission), totalRevenue = ce que les clients ont payé (le "prix")
    const totalOwed = sales ? sales.reduce((sum, s) => sum + Number(s.commission || 0), 0) : 0;
    const totalRevenue = sales ? sales.reduce((sum, s) => sum + Number(s.amount || 0), 0) : 0;
    const totalEarnings = sales ? sales.reduce((sum, s) => sum + Number(s.manager_commission || 0), 0) : 0;
    const conversionRate = totalVisits > 0 ? (totalSales / totalVisits) * 100 : 0;

    // 3. Série journalière (90 derniers jours) pour le graphique
    const dayMap = {};
    for (let i = DAYS_WINDOW - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { date: key, visits: 0, sales: 0, owed: 0, revenue: 0, earnings: 0 };
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
        dayMap[key].earnings += Number(s.manager_commission || 0);
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        clients,
        stats: { totalVisits, totalSales, totalOwed, totalRevenue, totalEarnings, conversionRate, totalAffiliates: clients.length },
        daily: Object.values(dayMap),
      }),
    };
  } catch (err) {
    console.error("Erreur admin-manager-dashboard.js :", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
