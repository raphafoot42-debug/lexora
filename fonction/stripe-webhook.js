/* ===== NETLIFY FUNCTION : stripe-webhook.js ===== */
/* Reçoit la confirmation de paiement Stripe (événement checkout.session.completed),
   déclenché quand un client paie sur l'un des DEUX liens Stripe d'un affilié
   (lien "roulette" ou lien "direct"). Le paiement ne se fait pas sur notre site,
   mais directement chez Stripe.
   1. Vérifie la signature Stripe (sécurité, évite les faux webhooks)
   2. Double vérification : payment_status = "paid" ET montant >= 20€
   3. Retrouve l'affilié via l'ID du Payment Link utilisé (session.payment_link),
      en cherchant dans affiliates lequel des deux liens correspond
   4. Enregistre la vente dans "sales" avec la commission PERSONNALISÉE de cet affilié
      (définie par l'admin, ex: 35€, 40€, 75€... pas une valeur fixe)
   5. Appelle notify.js pour prévenir Julien par email

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
    return { statusCode: 400, body: "Webhook signature verification failed" };
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    return { statusCode: 200, body: "Ignored (not checkout.session.completed)" };
  }

  const session = stripeEvent.data.object;

  const MIN_AMOUNT_EUR = 20;
  const amountPaidEur = session.amount_total ? session.amount_total / 100 : 0;
  const isPaid = session.payment_status === "paid";

  if (!isPaid) {
    console.warn("Session reçue mais payment_status != paid, ignorée :", session.id);
    return { statusCode: 200, body: "Ignored (not paid)" };
  }

  if (amountPaidEur < MIN_AMOUNT_EUR) {
    console.warn(`Montant payé (${amountPaidEur}€) inférieur au minimum requis, ignoré :`, session.id);
    return { statusCode: 200, body: "Ignored (amount below minimum)" };
  }

  const stripePaymentLinkId = session.payment_link;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    let affiliate = null;

    if (stripePaymentLinkId) {
      const { data, error } = await supabaseAdmin
        .from("affiliates")
        .select("id, prenom, commission_amount, statut")
        .or(`stripe_link_id_roulette.eq.${stripePaymentLinkId},stripe_link_id_direct.eq.${stripePaymentLinkId}`)
        .single();

      if (error || !data) {
        console.warn("Payment Link non associé à un affilié :", stripePaymentLinkId);
      } else if (data.statut === "suspendu") {
        console.warn("Vente ignorée : affilié suspendu :", data.id);
      } else {
        affiliate = data;
      }
    }

    const commission = affiliate ? Number(affiliate.commission_amount) : 0;

    const { data: sale, error: saleError } = await supabaseAdmin
      .from("sales")
      .insert({
        affiliate_id: affiliate ? affiliate.id : null,
        amount: amountPaidEur,
        commission,
        stripe_session_id: session.id,
      })
      .select()
      .single();

    if (saleError) {
      console.error("Erreur enregistrement vente :", saleError);
      return { statusCode: 500, body: "Failed to record sale" };
    }

    if (affiliate) {
      await fetch(`${SITE_URL}/.netlify/functions/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliatePrenom: affiliate.prenom,
          saleAmount: amountPaidEur,
          commission,
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
