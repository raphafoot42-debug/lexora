// AffiniX — serveur de synchronisation
// ======================================
// Ce petit serveur stocke la base de données AffiniX (sous-affiliés, stats,
// paramètres…) dans un fichier JSON sur le disque, et l'expose via une API
// simple que le site (index.html) interroge pour rester synchronisé sur
// tous les appareils.
//
// Variables d'environnement à configurer sur Render (ou ton hébergeur) :
//   ADMIN_API_KEY   -> la clé secrète (doit être IDENTIQUE à SYNC_API_KEY
//                      dans index.html). Sers-toi de la même valeur des
//                      deux côtés.
//   PORT            -> fournie automatiquement par Render, rien à faire.

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "5mb" }));

// CORS ouvert (le site est public de toute façon ; seule l'écriture est
// protégée par la clé API).
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";
const DATA_FILE = path.join(__dirname, "data", "db.json");

// S'assure que le dossier/fichier de données existe.
function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "null", "utf8");
}
function readDb() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
function writeDb(db) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

function requireApiKey(req, res, next) {
  const key = req.header("x-api-key") || "";
  if (!ADMIN_API_KEY || key !== ADMIN_API_KEY) {
    return res.status(401).json({ error: "Clé API invalide ou manquante." });
  }
  next();
}

// --- Base de données partagée ---------------------------------------

// Lecture publique : n'importe quel appareil (admin ou membre) peut
// récupérer l'état actuel pour rester à jour.
app.get("/api/db", (req, res) => {
  const db = readDb();
  res.json({ db });
});

// Écriture : réservée à l'admin (clé API obligatoire). Le site pousse ici
// l'intégralité de la base à chaque modification (nouveau sous-affilié,
// message, etc.).
app.post("/api/db", requireApiKey, (req, res) => {
  writeDb(req.body);
  res.json({ ok: true });
});

// --- Inscriptions publiques (auto-signup via lien de parrainage) ----

app.post("/api/signup", (req, res) => {
  const { name, code, ref } = req.body || {};
  if (!name || !code) {
    return res.status(400).json({ error: "Nom et code obligatoires." });
  }
  const db = readDb() || {};
  db.pendingSignups = db.pendingSignups || [];
  const exists =
    (db.affiliates || []).some(a => (a.code || "").toLowerCase() === code.toLowerCase()) ||
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
  writeDb(db);
  res.json({ request });
});

// --- Stats automatiques par sous-affilié (à brancher sur les postbacks
// du casino plus tard). Pour l'instant, renvoie une liste vide plutôt que
// de planter, pour que le bouton "Synchroniser" du site ne génère pas
// d'erreur tant que l'intégration casino n'est pas branchée ici.
app.get("/api/stats/:code", (req, res) => {
  res.json({ dailyStats: [] });
});

// --- Notifications push (désactivées pour l'instant : le site gère
// l'absence de configuration sans planter).
app.get("/api/vapid-public-key", (req, res) => {
  res.json({ publicKey: null });
});
app.post("/api/push-subscribe", (req, res) => {
  res.json({ ok: true });
});
app.post("/api/broadcast-push", requireApiKey, (req, res) => {
  res.json({ ok: true, sent: 0 });
});

app.get("/", (req, res) => {
  res.send("AffiniX sync server ✔");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("AffiniX server listening on port " + PORT);
});
