// GET /api/stats/:code -> statistiques automatiques (inscriptions, FTD,
// dépôts) importées depuis les postbacks du casino pour ce code affilié.
// Pour l'instant, renvoie une liste vide (aucune intégration casino
// branchée ici) — à compléter plus tard sans casser le reste du site.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  res.status(200).json({ dailyStats: [] });
}
