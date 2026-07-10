/* ===== NETLIFY FUNCTION : stripe-webhook.js ===== */
/* Reçoit la confirmation de paiement Stripe (événement checkout.session.completed).
   1. Vérifie la signature Stripe (sécurité, évite les faux webhooks)
   2. Retrouve l'affilié via le code de parrainage mis en metadata par stripe-checkout.js
   3. Enregistre la vente dans "sales" avec commission FIXE = 40€
   4. Appelle notify.js pour prévenir ton pote par email

   AUCUN paiement automatique n'est déclenché ici. C'est uniquement :
   confirmation -> enregistrement -> notification.

   Variables d'environnement Netlify nécessaires :
   - STRIPE_SECRET_KEY
   - STRIPE_WEBHOOK_SECRET
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY   (clé service_role, jamais la clé anon)
   - SITE_URL               (pour appeler notify.js en interne)
*/

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const FIXED_COMMISSION_EUR = 40;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const SITE_URL = process.env.SITE_URL;

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SITE_URL) {
    console.error("Variables d'environnement manquantes");
    return { statusCode: 500, body: "Server misconfiguration" };
  }

  const stripe = Stripe(STRIPE_SECRET_KEY);
  let stripeEvent;

  try {
    const signature = event.headers["stripe-signature"];
    stripeEvent = stripe.webhooks.constructEvent(event.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Signature Stripe invalide :", err.message);
    return { statusCode: 400, body: `Webhook signature verification failed` };
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    // On ignore proprement les autres types d'événements
    return { statusCode: 200, body: "Ignored (not checkout.session.completed)" };
  }

  const session = stripeEvent.data.object;
  const referralCode = session.metadata && session.metadata.referral_code;
  const amountPaidEur = session.amount_total ? session.amount_total / 100 : null;

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    let referrer = null;

    if (referralCode) {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id, email, code_parrainage")
        .eq("code_parrainage", referralCode)
        .single();

      if (error) {
        console.warn("Code de parrainage introuvable pour cette vente :", referralCode);
      } else {
        referrer = data;
      }
    }

    // On enregistre la vente même sans parrain identifié (vente directe),
    // mais la commission n'a de sens que si un referrer existe.
    const { data: sale, error: saleError } = await supabaseAdmin
      .from("sales")
      .insert({
        referrer_id: referrer ? referrer.id : null,
        amount: amountPaidEur,
        commission: referrer ? FIXED_COMMISSION_EUR : 0,
        stripe_session_id: session.id,
      })
      .select()
      .single();

    if (saleError) {
      console.error("Erreur enregistrement vente :", saleError);
      return { statusCode: 500, body: "Failed to record sale" };
    }

    // Notification à ton pote UNIQUEMENT s'il y a un affilié à payer
    if (referrer) {
      await fetch(`${SITE_URL}/.netlify/functions/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliateEmail: referrer.email,
          affiliateReferralCode: referrer.code_parrainage,
          saleAmount: amountPaidEur,
          commission: FIXED_COMMISSION_EUR,
          saleId: sale.id,
        }),
      });
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error("Erreur stripe-webhook.js :", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
