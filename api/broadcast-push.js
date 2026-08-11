const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { title, body } = req.body || {};
  if (!body) return res.status(400).json({ error: 'body requis' });

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('affiliate_id, subscription');

  if (error) return res.status(500).json({ error: error.message });

  let sent = 0;
  await Promise.all((subs || []).map(async (row) => {
    try {
      await webpush.sendNotification(
        row.subscription,
        JSON.stringify({ title: title || 'AffiniX', body })
      );
      sent++;
    } catch (e) {
      // abonnement probablement expiré, on ignore
    }
  }));

  return res.status(200).json({ ok: true, sent });
};
