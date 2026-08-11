const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { affiliateId, subscription } = req.body || {};
  if (!affiliateId || !subscription) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      affiliate_id: affiliateId,
      subscription,
      updated_at: new Date().toISOString(),
    });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
};
