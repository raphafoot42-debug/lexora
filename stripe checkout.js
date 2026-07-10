/* ===== NETLIFY FUNCTION : stripe-checkout.js ===== */
/* Crée une VRAIE session de paiement Stripe (le client paie réellement).
   Montant minimum : 20€. Le code de parrainage (s'il existe) est attaché
   à la session en metadata, pour être récupéré par stripe-webhook.js
   une fois le paiement confirmé.

   AUCUN split automatique ici : l'argent part entièrement sur le compte
   Stripe principal (celui de ton pote). Les 40€ de commission sont
   versés manuellement par lui, après notification (voir notify.js).

   Variables d'environnement Netlify nécessaires :
   - STRIPE_SECRET_KEY
   - SITE_URL   (ex: https://tonsite.fr, pour les URLs de succès/annulation)
*/

const Stripe = require("stripe");

const MIN_AMOUNT_EUR = 20;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    const SITE_URL = process.env.SITE_URL;

    if (!STRIPE_SECRET_KEY || !SITE_URL) {
      console.error("Variables d'environnement manquantes (STRIPE_SECRET_KEY / SITE_URL)");
      return { statusCode: 500, body: "Server misconfiguration" };
    }

    const stripe = Stripe(STRIPE_SECRET_KEY);

    const { amount, referralCode } = JSON.parse(event.body);

    const amountNum = Number(amount);
    if (!amountNum || amountNum < MIN_AMOUNT_EUR) {
      return { statusCode: 400, body: `Amount must be at least ${MIN_AMOUNT_EUR}€` };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: "Paiement" },
            unit_amount: Math.round(amountNum * 100), // Stripe attend des centimes
          },
          quantity: 1,
        },
      ],
      metadata: {
        referral_code: referralCode || "",
      },
      success_url: `${SITE_URL}/merci.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/index.html`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error("Erreur stripe-checkout.js :", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
