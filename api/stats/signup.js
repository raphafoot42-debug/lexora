// POST /api/signup -> crée une demande d'inscription en attente de
// validation par l'admin (utilisé par le lien de parrainage).

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const DB_KEY = "affinix_db";

async function readDb() {
  const r = await fetch(`${KV_URL}/get/${DB_KEY}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  const data = await r.json();
  return data.result ? JSON.parse(data.result) : {};
}
async function writeDb(db) {
  await fetch(`${KV_URL}/set/${DB_KEY}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "text/plain" },
    body: JSON.stringify(db)
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: "Base de données non configurée (variables KV manquantes)." });
  }

  const { name, code, ref } = req.body || {};
  if (!name || !code) {
    return res.status(400).json({ error: "Nom et code obligatoires." });
  }

  try {
    const db = await readDb();
    db.pendingSignups = db.pendingSignups || [];
    db.affiliates = db.affiliates || [];
    const exists =
      db.affiliates.some(a => (a.code || "").toLowerCase() === code.toLowerCase()) ||
      db.pendingSignups.some(p => (p.code || "").toLowerCase() === code.toLowerCase());
    if (exists) {
      return res.status(400).json({ error: "Ce code d'accès est déjà pris." });
    }
    const request = {
      id: "req_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name,
      code,
      ref: ref || "",
      requestedAt: new Date().toISOString()
    };
    db.pendingSignups.unshift(request);
    await writeDb(db);
    return res.status(200).json({ request });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur." });
  }
}
