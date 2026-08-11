const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, code, ref } = req.body || {};
  if (!name || !code) {
    return res.status(400).json({ error: 'Nom et code obligatoires' });
  }

  const { data: row, error: readErr } = await supabase
    .from('app_db')
    .select('data')
    .eq('id', 1)
    .maybeSingle();

  if (readErr) return res.status(500).json({ error: readErr.message });

  const db = (row && row.data) ? row.data : { affiliates: [], pendingSignups: [] };
  db.affiliates = db.affiliates || [];
  db.pendingSignups = db.pendingSignups || [];

  const codeTaken =
    db.affiliates.some(a => (a.code || '').toLowerCase() === code.toLowerCase()) ||
    db.pendingSignups.some(p => (p.code || '').toLowerCase() === code.toLowerCase());

  if (codeTaken) {
    return res.status(400).json({ error: 'Ce code d\'accès est déjà pris, choisis-en un autre.' });
  }

  const request = {
    id: 'sig_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name,
    code,
    ref: ref || '',
    requestedAt: new Date().toISOString(),
  };
  db.pendingSignups.unshift(request);

  const { error: writeErr } = await supabase
    .from('app_db')
    .upsert({ id: 1, data: db, updated_at: new Date().toISOString() });

  if (writeErr) return res.status(500).json({ error: writeErr.message });

  return res.status(200).json({ request });
};
