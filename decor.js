/* ===== DECOR.JS ===== */
/* Particules lumineuses discrètes dessinées sur un <canvas class="bg-particles">.
   Les couleurs suivent automatiquement le thème actif (relit les CSS vars
   --accent-1 / --accent-2 à chaque frame, donc réagit en live si le thème change).
   À charger sur toutes les pages, après le HTML du .bg-decor. */

(function () {
  function initParticles() {
    const canvas = document.querySelector(".bg-particles");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let particles = [];
    let width, height;

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }

    function getAccentColor(varName, fallback) {
      const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      return value || fallback;
    }

    function createParticles() {
      const count = Math.min(55, Math.floor((width * height) / 22000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.6 + 0.6,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        alpha: Math.random() * 0.5 + 0.2,
        pulseSpeed: Math.random() * 0.015 + 0.005,
        pulsePhase: Math.random() * Math.PI * 2,
      }));
    }

    function tick(time) {
      ctx.clearRect(0, 0, width, height);

      const accent1 = getAccentColor("--accent-1", "#22d3ee");

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const pulse = Math.sin(time * p.pulseSpeed + p.pulsePhase) * 0.3 + 0.7;
        const alpha = p.alpha * pulse;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(accent1, alpha);
        ctx.shadowBlur = 8;
        ctx.shadowColor = hexToRgba(accent1, alpha);
        ctx.fill();
      });

      requestAnimationFrame(tick);
    }

    function hexToRgba(hex, alpha) {
      const clean = hex.replace("#", "");
      const bigint = parseInt(clean, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    resize();
    createParticles();
    requestAnimationFrame(tick);

    window.addEventListener("resize", () => {
      resize();
      createParticles();
    });
  }

  document.addEventListener("DOMContentLoaded", initParticles);
})();
