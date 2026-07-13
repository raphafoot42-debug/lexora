/* ===== NETLIFY FUNCTION : go.js =====
   Route publique /go/:slug : log une visite (source=click) puis 302 → URL BA.
*/
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { statusCode: 500, body: "Server misconfiguration" };
  }

  // /go/<slug>  ou  ?slug=xxx en fallback
  const afterGo = (event.path || "").split("/go/")[1] || "";
  const slug = decodeURIComponent(
    (afterGo || (event.queryStringParameters || {}).slug || "")
      .split("?")[0]
      .split("/")[0]
      .trim()
  );
  if (!slug) return { statusCode: 400, body: "Missing slug" };

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select("id, statut, tracking_slug_roulette, tracking_slug_direct, link_roulette, link_direct")
    .or(`tracking_slug_roulette.eq.${slug},tracking_slug_direct.eq.${slug}`)
    .maybeSingle();

  if (!affiliate || affiliate.statut === "suspendu") {
    return { statusCode: 404, body: "Unknown link" };
  }

  const isDirect  = slug === affiliate.tracking_slug_direct;
  const targetUrl = isDirect ? affiliate.link_direct : affiliate.link_roulette;
  if (!targetUrl) return { statusCode: 500, body: "Target URL missing" };

  // insertion best-effort — on ne bloque JAMAIS la redirection
  try {
    const ip  = (event.headers["x-forwarded-for"] || "").split(",")[0].trim() || null;
    const ua  = event.headers["user-agent"] || null;
    const ref = event.headers["referer"] || event.headers["referrer"] || null;

    await supabaseAdmin.from("visits").insert({
      affiliate_id: affiliate.id,
      referral_code: slug,
      link_type: isDirect ? "direct" : "roulette",
      source: "click",
      ip, user_agent: ua, referer: ref,
    });
  } catch (e) {
    console.error("visit insert failed:", e);
  }

  return {
    statusCode: 302,
    headers: { Location: targetUrl, "Cache-Control": "no-store" },
    body: "",
  };
};
