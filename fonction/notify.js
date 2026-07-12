/* ===== NETLIFY FUNCTION : notify.js ===== */
/* Remplace l'ancien sms-notify.js.
   Envoie un EMAIL à ton pote via Resend (https://resend.com) au lieu d'un SMS.
   Déclenché UNIQUEMENT par stripe-webhook.js après une vente confirmée.
   Ne fait AUCUN paiement automatique : c'est juste une notification.

   Variables d'environnement Netlify à ajouter :
   - RESEND_API_KEY        (clé API depuis resend.com/api-keys)
   - NOTIFY_FROM_EMAIL     (adresse expéditrice validée sur Resend, ex: notif@tondomaine.fr)
   - NOTIFY_TO_EMAIL       (adresse email de ton pote)
*/

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { affiliatePrenom, saleAmount, commission, saleId, toEmail } = JSON.parse(event.body);

    if (!affiliatePrenom || !saleId) {
      return { statusCode: 400, body: "Missing required fields (affiliatePrenom, saleId)" };
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = process.env.NOTIFY_FROM_EMAIL;
    // Si un email cible précis est fourni (côté Noé ou côté Raphaël), on l'utilise.
    // Sinon on retombe sur l'adresse par défaut (compatibilité avec l'ancien flux Stripe).
    const TO_EMAIL = toEmail || process.env.NOTIFY_TO_EMAIL;

    if (!RESEND_API_KEY || !FROM_EMAIL || !TO_EMAIL) {
      console.error("Variables d'environnement manquantes (RESEND_API_KEY / NOTIFY_FROM_EMAIL / NOTIFY_TO_EMAIL)");
      return { statusCode: 500, body: "Server misconfiguration" };
    }

    const fixedCommission = commission || 0;

    const subject = `Nouvelle vente confirmée — ${fixedCommission}€ à payer à ${affiliatePrenom}`;
    const html = `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <h2>Nouvelle vente confirmée ✅</h2>
        <p><strong>Affilié :</strong> ${affiliatePrenom}</p>
        <p><strong>Montant payé par le client :</strong> ${saleAmount ? saleAmount + "€" : "N/A"}</p>
        <p><strong>Commission à verser manuellement :</strong> ${fixedCommission}€</p>
        <p><strong>ID vente :</strong> ${saleId}</p>
        <hr />
        <p style="color:#888; font-size:13px;">
          Ceci est une notification automatique. Le paiement des ${fixedCommission}€ à l'affilié
          doit être effectué manuellement, ce mail ne déclenche aucun virement.
        </p>
      </div>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: TO_EMAIL,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Erreur Resend :", errText);
      return { statusCode: 502, body: "Failed to send notification email" };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error("Erreur notify.js :", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
