// POST /api/signup  -> enregistre une demande d'inscription en attente
// dans la base partagée Supabase (table app_db, colonne data.pendingSignups).
// Le front-end (submitSelfSignup) attend en retour : { request: {...} }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function uid(prefix) {
  return (prefix || "req") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: "Supabase non configuré (variables manquantes)." });
  }

  const { name, code, ref } = req.body || {};
  if (!name || !code || !String(name).trim() || !String(code).trim()) {
    return res.status(400).json({ error: "Nom et code d'accès sont obligatoires." });
  }

  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json"
  };

  try {
    // 1. Récupère la base actuelle
    const readRes = await fetch(`${SUPABASE_URL}/rest/v1/app_db?id=eq.1&select=data`, { headers });
    const rows = await readRes.json();
    const db = (Array.isArray(rows) && rows[0] && rows[0].data) || {
      affiliates: [], pendingSignups: []
    };
    if (!db.affiliates) db.affiliates = [];
    if (!db.pendingSignups) db.pendingSignups = [];

    // 2. Vérifie que le code n'est pas déjà pris
    const codeLower = String(code).trim().toLowerCase();
    const taken =
      db.affiliates.some(a => (a.code || "").toLowerCase() === codeLower) ||
      db.pendingSignups.some(p => (p.code || "").toLowerCase() === codeLower);
    if (taken) {
      return res.status(409).json({ error: "Ce code d'accès est déjà pris, choisis-en un autre." });
    }

    // 3. Construit et ajoute la nouvelle demande
    const request = {
      id: uid(),
      name: String(name).trim(),
      code: String(code).trim(),
      ref: ref ? String(ref).trim() : "",
      requestedAt: new Date().toISOString()
    };
    db.pendingSignups.unshift(request);

    // 4. Sauvegarde la base mise à jour
    const writeRes = await fetch(`${SUPABASE_URL}/rest/v1/app_db`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify([{ id: 1, data: db, updated_at: new Date().toISOString() }])
    });
    if (!writeRes.ok) {
      const errText = await writeRes.text();
      return res.status(500).json({ error: "Erreur Supabase : " + errText });
    }

    return res.status(200).json({ request });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur : " + (e && e.message ? e.message : String(e)) });
  }
}
