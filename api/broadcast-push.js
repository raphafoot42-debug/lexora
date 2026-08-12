const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const key = req.headers["x-api-key"] || "";
  if (!ADMIN_API_KEY || key !== ADMIN_API_KEY) {
    return res.status(401).json({ error: "Clé API invalide ou manquante." });
  }
  res.status(200).json({ ok: true, sent: 0 });
}
