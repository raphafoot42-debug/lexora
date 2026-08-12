// GET  /api/db  -> renvoie { db } (lecture publique, pour que chaque
//                  appareil récupère les données à jour)
// POST /api/db  -> enregistre la base complète (nécessite x-api-key)

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";
const DB_KEY = "affinix_db";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: "Base de données non configurée (variables KV manquantes)." });
  }

  if (req.method === "GET") {
    try {
      const r = await fetch(`${KV_URL}/get/${DB_KEY}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const data = await r.json();
      const db = data.result ? JSON.parse(data.result) : null;
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
      const body = req.body;
      await fetch(`${KV_URL}/set/${DB_KEY}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "text/plain" },
        body: JSON.stringify(body)
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Erreur d'écriture." });
    }
  }

  res.status(405).end();
}
