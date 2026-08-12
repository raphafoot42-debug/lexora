// GET  /api/db  -> renvoie { db } (lecture publique)
// POST /api/db  -> enregistre la base complète dans Supabase (nécessite x-api-key)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: "Supabase non configuré (variables manquantes)." });
  }

  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json"
  };

  if (req.method === "GET") {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_db?id=eq.1&select=data`, { headers });
      const rows = await r.json();
      const db = Array.isArray(rows) && rows[0] ? rows[0].data : null;
      return res.status(200).json({ db });
    } catch (e) {
      return res.status(500).json({ error: "Erreur de lecture." });
    }
  }

  if (req.method === "POST") {
    const key = req.headers["x-api-key"] || "";
    if (!ADMIN_API_KEY || key !== ADMIN_API_KEY) {
      return res.status(401).json({ error: "Clé API invalide ou manquante." });
    }
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_db`, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify([{ id: 1, data: req.body, updated_at: new Date().toISOString() }])
      });
      if (!r.ok) {
        const errText = await r.text();
        return res.status(500).json({ error: "Erreur Supabase : " + errText });
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Erreur d'écriture." });
    }
  }

  res.status(405).end();
}
