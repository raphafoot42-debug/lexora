/* ===== NETLIFY FUNCTION : casino-postback.js ===== */
/* Reçoit les notifications "postback" (S2S) envoyées automatiquement par
   BlueAffiliates à chaque dépôt confirmé sur l'un des liens d'un affilié.
   Remplace stripe-webhook.js pour tout ce qui passe par le site casino.

   Sécurité :
   - Vérifie la signature HMAC-SHA256 ({sig}) avant de faire confiance aux données
   - Si signature invalide : répond 200 (pour éviter des tentatives de renvoi
     inutiles côté BlueAffiliates) mais N'ENREGISTRE RIEN
   - Déduplique via {transaction_id} : un même événement reçu deux fois n'est
     traité qu'une seule fois
   - Ignore les transactions de test ("test-...") : accusé de réception, mais
     aucune vente réelle enregistrée

   Traitement :
   - On ne traite QUE les événements "deposit" ou "ftd" (premier dépôt) comme
     déclencheurs de commission — les autres events (registration, qualification,
     commission_paid) sont accusés mais ignorés pour l'instant
   - On identifie l'affilié via {campaign_slug} (le code court du lien utilisé),
     en le comparant aux liens enregistrés dans affiliates
   - Montant minimum de 20€ avant de déclencher une commission (même règle que
     pour Stripe)

   Variables d'environnement Netlify nécessaires :
   - BLUEAFFILIATES_HMAC_SECRET   (donné par BlueAffiliates à la création du postback)
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY
   - SITE_URL
*/

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const MIN_AMOUNT_EUR = 20;
const DEPOSIT_EVENTS = ["deposit", "ftd"];
const VISIT_EVENTS = ["registration"];

function rfc3986(str) {
  return encodeURIComponent(str).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function verifySignature(params, receivedSig, secret) {
  if (!receivedSig || receivedSig.length !== 64) return false;

  const canonical = Object.keys(params)
    .filter((k) => k !== "sig")
    .sort()
    .map((k) => rfc3986(k) + "=" + rfc3986(params[k] ?? ""))
    .join("&");

  const expected = crypto.createHmac("sha256", secret).update(canonical, "utf8").digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(receivedSig);
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

exports.handler = async (event) => {
  // BlueAffiliates envoie du GET, ou du POST en x-www-form-urlencoded (mêmes
  // données dans les deux cas). On accepte les deux.
  let params = {};
  if (event.httpMethod === "GET") {
    params = event.queryStringParameters || {};
  } else if (event.httpMethod === "POST") {
    const body = new URLSearchParams(event.body || "");
    body.forEach((value, key) => (params[key] = value));
  } else {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const BLUEAFFILIATES_HMAC_SECRET = process.env.BLUEAFFILIATES_HMAC_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const SITE_URL = process.env.SITE_URL;

  if (!BLUEAFFILIATES_HMAC_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SITE_URL) {
    console.error("Variables d'environnement manquantes");
    return { statusCode: 500, body: "Server misconfiguration" };
  }

  // ===== Vérification de la signature : obligatoire, jamais de bypass =====
  const isValidSignature = verifySignature(params, params.sig, BLUEAFFILIATES_HMAC_SECRET);
  if (!isValidSignature) {
    console.warn("Postback reçu avec signature invalide, ignoré (mais accusé de réception).");
    return { statusCode: 200, body: "OK" };
  }

  const {
    event: eventType,
    transaction_id: transactionId,
    campaign_slug: campaignSlug,
    amount,
    sub1,
  } = params;

  if (!transactionId) {
    return { statusCode: 200, body: "OK" };
  }

  // Transactions de test envoyées depuis le bouton "Test" du dashboard BlueAffiliates
  if (transactionId.startsWith("test-")) {
    console.log("Postback de test reçu, accusé de réception sans enregistrement.");
    return { statusCode: 200, body: "OK" };
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Identification de l'affilié via le code court du lien (campaign_slug),
    // ou à défaut sub1 si Julien l'a configuré manuellement sur le lien.
    const matchValue = campaignSlug || sub1;
    let affiliate = null;

    if (matchValue) {
      const { data, error } = await supabaseAdmin
        .from("affiliates")
        .select("id, prenom, commission_amount, statut")
        .or(`tracking_slug_roulette.eq.${matchValue},tracking_slug_direct.eq.${matchValue}`)
        .maybeSingle();

      if (!error && data && data.statut !== "suspendu") {
        affiliate = data;
      }
    }

    if (!affiliate) {
      console.warn("Postback reçu mais aucun affilié ne correspond à :", matchValue);
    }

    // ===== Événement "registration" = une VISITE (inscription sur le casino) =====
    if (VISIT_EVENTS.includes(eventType)) {
      const { data: existingVisit } = await supabaseAdmin
        .from("visits")
        .select("id")
        .eq("external_transaction_id", transactionId)
        .maybeSingle();

      if (existingVisit) {
        return { statusCode: 200, body: "OK (already processed)" };
      }

      await supabaseAdmin.from("visits").insert({
        affiliate_id: affiliate ? affiliate.id : null,
        referral_code: matchValue || "unknown",
        external_transaction_id: transactionId,
        link_type: matchValue === (affiliate && affiliate.tracking_slug_direct) ? "direct" : "roulette",
      });

      return { statusCode: 200, body: "OK" };
    }

    // ===== Événement "deposit"/"ftd" = une VENTE (commission) =====
    if (!DEPOSIT_EVENTS.includes(eventType)) {
      return { statusCode: 200, body: "OK (event ignored)" };
    }

    const { data: existingSale } = await supabaseAdmin
      .from("sales")
      .select("id")
      .eq("external_transaction_id", transactionId)
      .maybeSingle();

    if (existingSale) {
      return { statusCode: 200, body: "OK (already processed)" };
    }

    const amountPaidEur = amount ? parseFloat(amount) : 0;
    if (amountPaidEur < MIN_AMOUNT_EUR) {
      console.warn(`Dépôt (${amountPaidEur}€) inférieur au minimum requis, ignoré :`, transactionId);
      return { statusCode: 200, body: "OK (amount below minimum)" };
    }

    const commission = affiliate ? Number(affiliate.commission_amount) : 0;

    const { data: sale, error: saleError } = await supabaseAdmin
      .from("sales")
      .insert({
        affiliate_id: affiliate ? affiliate.id : null,
        amount: amountPaidEur,
        commission,
        external_transaction_id: transactionId,
      })
      .select()
      .single();

    if (saleError) {
      console.error("Erreur enregistrement vente (postback) :", saleError);
      return { statusCode: 200, body: "OK (internal error logged)" };
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

    return { statusCode: 200, body: "OK" };
  } catch (err) {
    console.error("Erreur casino-postback.js :", err);
    // On répond quand même 200 pour éviter des retries en boucle côté BlueAffiliates
    return { statusCode: 200, body: "OK (error logged)" };
  }
};
