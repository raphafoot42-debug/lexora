const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { code } = req.query || {};
  if (!code) return res.status(400).json({ error: 'code manquant' });

  const { data, error } = await supabase
    .from('postback_daily_stats')
    .select('date, clicks, signups, ftd, deposits, revenue')
    .eq('code', code)
    .order('date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Format attendu par index.html : { dailyStats: [{date, clicks, signups, ftd, deposits, revenue}, ...] }
  return res.status(200).json({ dailyStats: data || [] });
};
