/* ===== PRIVACY.JS ===== */
/* Bouton flottant "Flouter" présent sur toutes les pages. Une fois activé,
   floute instantanément tout élément marqué de la classe "sensitive-blur"
   (mentions du casino, liens, noms de plateforme, etc.), pour pouvoir
   montrer l'écran à quelqu'un sans rien révéler. Un second clic défloute.
   L'état n'est PAS mémorisé après fermeture de l'onglet, par sécurité
   (on repart toujours flouté par défaut à l'ouverture). */

(function () {
  const PRIVACY_CLASS = "privacy-mode";

  function createToggleButton() {
    const btn = document.createElement("button");
    btn.id = "privacyToggleBtn";
    btn.className = "privacy-toggle-btn";
    btn.innerHTML = "🙈 <span>Flouter</span>";
    btn.addEventListener("click", togglePrivacy);
    document.body.appendChild(btn);
    return btn;
  }

  function updateButtonLabel(btn, isActive) {
    btn.innerHTML = isActive ? "👁️ <span>Afficher</span>" : "🙈 <span>Flouter</span>";
    btn.classList.toggle("active", isActive);
  }

  function togglePrivacy() {
    const isActive = document.body.classList.toggle(PRIVACY_CLASS);
    const btn = document.getElementById("privacyToggleBtn");
    updateButtonLabel(btn, isActive);
  }

  function initPrivacyToggle() {
    const btn = createToggleButton();
    // Par défaut, on démarre flouté (sécurité par défaut).
    document.body.classList.add(PRIVACY_CLASS);
    updateButtonLabel(btn, true);
  }

  document.addEventListener("DOMContentLoaded", initPrivacyToggle);
})();
