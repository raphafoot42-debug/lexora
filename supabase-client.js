/* ===== SUPABASE-CLIENT.JS ===== */
/* Initialisation Supabase partagée entre toutes les pages.
   Charge le SDK Supabase via CDN AVANT ce script :
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   <script src="supabase-client.js"></script>

   IMPORTANT : seule la clé "anon" (publique) est utilisée ici.
   La clé "service_role" (SUPABASE_SERVICE_KEY) ne doit JAMAIS être
   exposée côté client : elle reste uniquement dans les Netlify Functions. */

const SUPABASE_URL = "https://eztncphrjbpvcutstvvz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Ow2A8ccvhpxPlC9X1E27yQ_SIWh--u7";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------- Helpers Auth réutilisables ---------- */

async function getCurrentSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error("Erreur récupération session :", error);
    return null;
  }
  return data.session;
}

async function getCurrentUserProfile() {
  const session = await getCurrentSession();
  if (!session) return null;

  const { data, error } = await supabaseClient
    .from("users")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error) {
    console.error("Erreur récupération profil :", error);
    return null;
  }
  return data;
}

async function requireAuth(redirectTo = "signup.html") {
  const session = await getCurrentSession();
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  return session;
}

async function logout(redirectTo = "index.html") {
  await supabaseClient.auth.signOut();
  window.location.href = redirectTo;
}
