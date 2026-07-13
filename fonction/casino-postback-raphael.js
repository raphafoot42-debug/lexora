/* ===== NETLIFY FUNCTION : casino-postback.js ===== */
/* Reçoit les notifications "postback" (S2S) envoyées automatiquement par
   BlueAffiliates à chaque dépôt confirmé sur l'un des liens d'un affilié.

   Variables d'environnement Netlify nécessaires :
   - BLUEAFFILIATES_HMAC_SECRET
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY
   - SITE_URL
*/

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const MIN_AMOUNT_EUR = 20;
const DEPOSIT_EVENTS = ["deposit", "ftd"];
const VISIT_EVENTS = ["registration"];
const MANAGER_POOL_TOTAL_EUR = 80;

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

  if (transactionId.startsWith("test-")) {
    console.log("Postback de test reçu, accusé de réception sans enregistrement.");
    return { statusCode: 200, body: "OK" };
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const matchValue = campaignSlug || sub1;
    let affiliate = null;

    if (matchValue) {
      // FIX A : on inclut tracking_slug_roulette et tracking_slug_direct dans le SELECT,
      // sinon affiliate.tracking_slug_direct est toujours undefined et link_type
      // tombe toujours sur "roulette".
      const { data, error } = await supabaseAdmin
        .from("affiliates")
        .select("id, prenom, commission_amount, statut, manager, tracking_slug_roulette, tracking_slug_direct")
        .or(`tracking_slug_roulette.eq.${matchValue},tracking_slug_direct.eq.${matchValue}`)
        .maybeSingle();

      if (!error && data && data.statut !== "suspendu") {
        affiliate = data;
      }
    }

    if (!affiliate) {
      console.warn("Postback reçu mais aucun affilié ne correspond à :", matchValue);
    }

    // ===== Événement "registration" = une VISITE =====
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
  source: "registration",              
});

      return { statusCode: 200, body: "OK" };
    }

    // ===== Événement "deposit"/"ftd" = une VENTE =====
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
    const managerCommission = affiliate ? Math.max(MANAGER_POOL_TOTAL_EUR - commission, 0) : 0;

    const { data: sale, error: saleError } = await supabaseAdmin
      .from("sales")
      .insert({
        affiliate_id: affiliate ? affiliate.id : null,
        amount: amountPaidEur,
        commission,
        manager: affiliate ? affiliate.manager : null,
        manager_commission: managerCommission,
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
          toEmail: process.env.NOTIFY_TO_EMAIL,
        }),
      });
    }

    return { statusCode: 200, body: "OK" };
  } catch (err) {
    console.error("Erreur casino-postback.js :", err);
    return { statusCode: 200, body: "OK (error logged)" };
  }
};
