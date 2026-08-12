const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_TYPES = ['register', 'ftd', 'deposit', 'cpa', 'ngr'];

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function pick(obj, names) {
  for (const n of names) {
    if (obj[n] !== undefined && obj[n] !== null && obj[n] !== '') return obj[n];
  }
  return undefined;
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const params = { ...(req.query || {}), ...(req.body || {}) };

  const key = pick(params, ['key', 'apikey', 'api_key']);
  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const type = String(pick(params, ['type']) || '').toLowerCase();
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'type invalide (register, ftd, deposit, cpa, ngr)' });
  }

  const code = pick(params, ['code', 'subid', 'sub_id', 'affid', 'aff_id', 'clickid', 'click_id']);
  if (!code) return res.status(400).json({ error: 'code (identifiant affilié) manquant' });

  const amount = Number(pick(params, ['amount', 'sum', 'value', 'ngr_amount', 'cpa_amount'])) || 0;
  const today = new Date().toISOString().slice(0, 10);

  await supabase.from('postback_log').insert({
    code: String(code),
    type,
    amount,
    raw: params,
    received_at: new Date().toISOString(),
  });

  const { data: existing, error: readErr } = await supabase
    .from('postback_daily_stats')
    .select('*')
    .eq('code', code)
    .eq('date', today)
    .maybeSingle();

  if (readErr) return res.status(500).json({ error: readErr.message });

  const row = existing || { code: String(code), date: today, clicks: 0, signups: 0, ftd: 0, deposits: 0, revenue: 0 };

  if (type === 'register') row.signups = (row.signups || 0) + 1;
  if (type === 'ftd') { row.ftd = (row.ftd || 0) + 1; row.deposits = (row.deposits || 0) + amount; row.revenue = (row.revenue || 0) + amount; }
  if (type === 'deposit') { row.deposits = (row.deposits || 0) + amount; row.revenue = (row.revenue || 0) + amount; }
  if (type === 'cpa') row.revenue = (row.revenue || 0) + amount;
  if (type === 'ngr') row.revenue = (row.revenue || 0) + amount;

  const { error: writeErr } = await supabase
    .from('postback_daily_stats')
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'code,date' });

  if (writeErr) return res.status(500).json({ error: writeErr.message });

  return res.status(200).json({ ok: true });
};
