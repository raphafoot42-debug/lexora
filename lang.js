/* ===== LANG.JS ===== */
/* Dictionnaire FR/EN centralisé, utilisé sur toutes les pages.
   Usage: <span data-i18n="hero.title"></span>
   La langue choisie est sauvegardée en localStorage sous la clé "site_lang" */

const I18N = {
  fr: {
    "nav.login": "Connexion",
    "nav.signup": "S'inscrire",

    "hero.badge_prefix": "Programme d'",
    "hero.badge_accent": "affiliation",
    "hero.big_title": "Programme d'affiliation",
    "hero.tagline": "Partage ton lien. Gagne 40€ par vente.",
    "hero.subtitle":
      "Rejoins le programme d'affiliation : partage ton lien personnel, et touche 40€ à chaque personne qui passe par toi et valide un paiement.",
    "hero.cta_primary": "Se connecter",
    "hero.cta_secondary": "Voir comment ça marche",

    "steps.title": "Comment ça marche",
    "steps.1.title": "1. Inscris-toi",
    "steps.1.desc": "Crée ton compte en quelques secondes et reçois ton lien d'affiliation personnel.",
    "steps.2.title": "2. Partage ton lien",
    "steps.2.desc": "Envoie ton lien à ton réseau, sur les réseaux sociaux, par message, où tu veux.",
    "steps.3.title": "3. Sois payé",
    "steps.3.desc": "Dès qu'une vente est validée via ton lien, tu touches 40€. Le paiement est fait manuellement, rapidement, après chaque vente confirmée.",

    "features.title": "Pourquoi participer",
    "features.1.title": "40€ par vente",
    "features.1.desc": "Un montant fixe et clair à chaque vente réalisée grâce à ton lien.",
    "features.2.title": "Lien personnel",
    "features.2.desc": "Un lien unique généré automatiquement à ton inscription.",
    "features.3.title": "Suivi en temps réel",
    "features.3.desc": "Visites, inscriptions, ventes et gains, visibles depuis ton tableau de bord.",
    "features.4.title": "Paiement rapide",
    "features.4.desc": "Chaque vente confirmée déclenche une notification pour un paiement rapide.",
    "features.5.title": "Aucune limite",
    "features.5.desc": "Autant de ventes que tu veux, autant de fois 40€.",
    "features.6.title": "Simple et transparent",
    "features.6.desc": "Tu vois exactement combien tu as gagné, et sur quelle vente.",

    "referral.title": "Le programme en un coup d'œil",
    "referral.amount_label": "Par vente confirmée",
    "referral.amount_value": "40€",
    "referral.desc":
      "Chaque personne qui achète via ton lien d'affiliation te fait gagner 40€, versés manuellement après validation du paiement.",

    "footer.admin": "Admin",

    "auth.login_title": "Connexion",
    "auth.prenom": "Prénom",
    "auth.password": "Mot de passe",
    "auth.login_btn": "Se connecter",
    "auth.no_signup": "Les comptes sont créés uniquement par l'administrateur.",
    "auth.error_generic": "Une erreur est survenue. Réessaie.",

    "dash.nav.dashboard": "Dashboard",
    "dash.nav.overview": "Vue d'ensemble",
    "dash.nav.referral": "Mes liens",
    "dash.nav.report": "Report",
    "dash.nav.analytics": "Analyse",
    "dash.nav.profile": "Mon profil",
    "dash.stats.sales": "Ventes",
    "dash.stats.earnings": "Gains",
    "dash.stats.commission": "Commission par vente",
    "dash.stats.visits": "Visites",
    "dash.stats.conversion": "Taux de conversion",
    "dash.dashboard.title": "Dashboard",
    "dash.dashboard.subtitle": "Vue d'ensemble",
    "dash.dashboard.activity": "Activité par jour",
    "dash.dashboard.nodata": "Pas encore de données sur cette période.",
    "dash.link.roulette_title": "Lien Roulette",
    "dash.link.roulette_desc": "Ce lien affiche une roulette avec un bonus au client, pour mieux convertir.",
    "dash.link.direct_title": "Lien Direct",
    "dash.link.direct_desc": "Ce lien envoie le client directement vers le paiement, sans étape supplémentaire.",
    "dash.links.table_link": "Lien",
    "dash.links.table_desc": "Description",
    "dash.links.table_actions": "Actions",
    "dash.referral.copy": "Copier",
    "dash.referral.copied": "Copié !",
    "dash.analytics.date": "Date",
    "dash.analytics.sales": "Ventes",
    "dash.analytics.earnings": "Gains",
    "dash.report.title": "Report",
    "dash.report.subtitle": "Le détail de ton activité",
    "dash.profile.title": "Mon profil",
    "dash.profile.firstname": "Prénom",
    "dash.profile.status": "Statut",
    "dash.profile.status_actif": "Actif",
    "dash.profile.status_suspendu": "Suspendu",
    "dash.profile.commission": "Commission par vente",
    "dash.profile.change_password": "Changer de mot de passe",
    "dash.profile.new_password": "Nouveau mot de passe",
    "dash.profile.confirm_password": "Confirmer le mot de passe",
    "dash.profile.save": "Enregistrer",
    "dash.profile.saving": "Enregistrement...",
    "dash.profile.saved": "Mot de passe mis à jour !",
    "dash.profile.error_mismatch": "Les mots de passe ne correspondent pas.",
    "dash.profile.error_length": "Le mot de passe doit faire au moins 6 caractères.",
    "dash.profile.error_generic": "Une erreur est survenue. Réessaie.",
    "dash.settings.logout": "Se déconnecter",

    "admin.tab.admin": "Admin",
    "admin.tab.noe": "Noé",
    "admin.tab.raphael": "Raphaël",
    "admin.users.email": "Email",
    "admin.users.link": "Lien attribué",
    "admin.users.status": "Statut",
    "admin.users.suspend": "Suspendre",
    "admin.users.reactivate": "Réactiver",
    "admin.add_link": "Ajouter un lien au pool",
  },

  en: {
    "nav.login": "Log in",
    "nav.signup": "Sign up",

    "hero.badge_prefix": "Referral",
    "hero.badge_accent": "program",
    "hero.big_title": "Referral program",
    "hero.tagline": "Share your link. Earn 40€ per sale.",
    "hero.subtitle":
      "Join the referral program: share your personal link, and earn 40€ for every person who comes through you and completes a payment.",
    "hero.cta_primary": "Log in",
    "hero.cta_secondary": "See how it works",

    "steps.title": "How it works",
    "steps.1.title": "1. Sign up",
    "steps.1.desc": "Create your account in seconds and get your personal referral link.",
    "steps.2.title": "2. Share your link",
    "steps.2.desc": "Send your link to your network, on social media, by message, wherever you want.",
    "steps.3.title": "3. Get paid",
    "steps.3.desc": "As soon as a sale is confirmed through your link, you earn 40€. Payment is made manually, quickly, after each confirmed sale.",

    "features.title": "Why join",
    "features.1.title": "40€ per sale",
    "features.1.desc": "A fixed, clear amount for every sale made through your link.",
    "features.2.title": "Personal link",
    "features.2.desc": "A unique link generated automatically when you sign up.",
    "features.3.title": "Real-time tracking",
    "features.3.desc": "Visits, signups, sales and earnings, visible from your dashboard.",
    "features.4.title": "Fast payment",
    "features.4.desc": "Every confirmed sale triggers a notification for fast payment.",
    "features.5.title": "No limit",
    "features.5.desc": "As many sales as you want, as many times 40€.",
    "features.6.title": "Simple and transparent",
    "features.6.desc": "You see exactly how much you've earned, and on which sale.",

    "referral.title": "The program at a glance",
    "referral.amount_label": "Per confirmed sale",
    "referral.amount_value": "€40",
    "referral.desc":
      "Everyone who buys through your referral link earns you 40€, paid manually after payment is confirmed.",

    "footer.admin": "Admin",

    "auth.login_title": "Log in",
    "auth.prenom": "First name",
    "auth.password": "Password",
    "auth.login_btn": "Log in",
    "auth.no_signup": "Accounts are created by the administrator only.",
    "auth.error_generic": "Something went wrong. Try again.",

    "dash.nav.dashboard": "Dashboard",
    "dash.nav.overview": "Overview",
    "dash.nav.referral": "My links",
    "dash.nav.report": "Report",
    "dash.nav.analytics": "Analytics",
    "dash.nav.profile": "My profile",
    "dash.stats.sales": "Sales",
    "dash.stats.earnings": "Earnings",
    "dash.stats.commission": "Commission per sale",
    "dash.stats.visits": "Visits",
    "dash.stats.conversion": "Conversion rate",
    "dash.dashboard.title": "Dashboard",
    "dash.dashboard.subtitle": "Overview",
    "dash.dashboard.activity": "Daily activity",
    "dash.dashboard.nodata": "No data yet for this period.",
    "dash.link.roulette_title": "Roulette Link",
    "dash.link.roulette_desc": "This link shows a bonus wheel to the customer, for better conversion.",
    "dash.link.direct_title": "Direct Link",
    "dash.link.direct_desc": "This link sends the customer straight to payment, no extra step.",
    "dash.links.table_link": "Link",
    "dash.links.table_desc": "Description",
    "dash.links.table_actions": "Actions",
    "dash.referral.copy": "Copy",
    "dash.referral.copied": "Copied!",
    "dash.analytics.date": "Date",
    "dash.analytics.sales": "Sales",
    "dash.analytics.earnings": "Earnings",
    "dash.report.title": "Report",
    "dash.report.subtitle": "The detail of your activity",
    "dash.profile.title": "My profile",
    "dash.profile.firstname": "First name",
    "dash.profile.status": "Status",
    "dash.profile.status_actif": "Active",
    "dash.profile.status_suspendu": "Suspended",
    "dash.profile.commission": "Commission per sale",
    "dash.profile.change_password": "Change password",
    "dash.profile.new_password": "New password",
    "dash.profile.confirm_password": "Confirm password",
    "dash.profile.save": "Save",
    "dash.profile.saving": "Saving...",
    "dash.profile.saved": "Password updated!",
    "dash.profile.error_mismatch": "Passwords don't match.",
    "dash.profile.error_length": "Password must be at least 6 characters.",
    "dash.profile.error_generic": "Something went wrong. Try again.",
    "dash.settings.logout": "Log out",

    "admin.tab.admin": "Admin",
    "admin.tab.noe": "Noé",
    "admin.tab.raphael": "Raphaël",
    "admin.users.email": "Email",
    "admin.users.link": "Assigned link",
    "admin.users.status": "Status",
    "admin.users.suspend": "Suspend",
    "admin.users.reactivate": "Reactivate",
    "admin.add_link": "Add a link to the pool",
  },
};

const LANG_STORAGE_KEY = "site_lang";

function getCurrentLang() {
  return localStorage.getItem(LANG_STORAGE_KEY) || "fr";
}

function setCurrentLang(lang) {
  if (!I18N[lang]) return;
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  applyI18n();
  updateLangButtons();
}

function t(key) {
  const lang = getCurrentLang();
  return (I18N[lang] && I18N[lang][key]) || (I18N.fr[key]) || key;
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    el.setAttribute("placeholder", t(key));
  });
}

function updateLangButtons() {
  const lang = getCurrentLang();
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
  });
}

function initLangSelector() {
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => setCurrentLang(btn.getAttribute("data-lang")));
  });
  applyI18n();
  updateLangButtons();
}

document.addEventListener("DOMContentLoaded", initLangSelector);
