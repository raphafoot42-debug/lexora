/* ===== NETLIFY FUNCTION : stripe-webhook.js ===== */
/* Reçoit la confirmation de paiement Stripe (événement checkout.session.completed),
   déclenché quand un client paie sur un Stripe Payment Link existant
   (le paiement ne se fait pas sur notre site, mais directement chez Stripe).
   1. Vérifie la signature Stripe (sécurité, évite les faux webhooks)
   2. Retrouve l'affilié via l'ID du Payment Link utilisé (session.payment_link),
      en cherchant dans referral_links quel affilié y est assigné
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

  // ===== FIABILITÉ 100% : double vérification avant toute action =====
  // 1. La signature Stripe a déjà été vérifiée plus haut (constructEvent échoue sinon)
  // 2. On vérifie explicitement que le paiement est bien marqué "payé" par Stripe
  // 3. On revérifie le montant réellement encaissé (pas une valeur qu'on suppose)
  // Si l'une de ces conditions ne colle pas, on n'enregistre rien et on ne notifie rien.
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

  // Quand un client paie via un Stripe Payment Link, Stripe indique dans
  // l'événement QUEL Payment Link a été utilisé (session.payment_link).
  // C'est CE identifiant qui permet de retrouver l'affilié, pas une metadata
  // qu'on aurait créée nous-mêmes (le paiement se fait sur un lien Stripe
  // déjà existant, pas via une session créée par notre propre code).
  const stripePaymentLinkId = session.payment_link;

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    let referrer = null;

    if (stripePaymentLinkId) {
      const { data: linkRow, error: linkError } = await supabaseAdmin
        .from("referral_links")
        .select("assigned_to")
        .eq("stripe_payment_link_id", stripePaymentLinkId)
        .single();

      if (linkError || !linkRow || !linkRow.assigned_to) {
        console.warn("Payment Link non assigné à un affilié :", stripePaymentLinkId);
      } else {
        const { data: userRow, error: userError } = await supabaseAdmin
          .from("users")
          .select("id, email, code_parrainage")
          .eq("id", linkRow.assigned_to)
          .single();

        if (!userError) referrer = userRow;
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
