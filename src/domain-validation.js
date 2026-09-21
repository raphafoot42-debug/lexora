function normalizeHostname(hostname) {
  return String(hostname || '').trim().toLowerCase().replace(/^www\./, '');
}

function isLocalHost(hostname) {
  const h = normalizeHostname(hostname);
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

function validateTargetDomain(reqUrl, actualUrl) {
  if (!reqUrl) throw new Error('URL requise.');
  const requested = new URL(reqUrl);
  if (!/^https?:$/.test(requested.protocol)) throw new Error('URL http(s) requise.');

  if (!actualUrl) return true;
  const actual = new URL(actualUrl);
  if (!/^https?:$/.test(actual.protocol)) {
    throw new Error(`Capture invalide : protocole inattendu (${actual.protocol}).`);
  }

  const reqHost = normalizeHostname(requested.hostname);
  const actHost = normalizeHostname(actual.hostname);
  const reqLocal = isLocalHost(reqHost);
  const actLocal = isLocalHost(actHost);

  if (reqLocal) {
    if (!actLocal || reqHost !== actHost) {
      throw new Error(`Capture hors cible : l'URL demandée est ${reqUrl} mais la page observée est ${actualUrl}.`);
    }
    return true;
  }

  if (actLocal || reqHost !== actHost) {
    throw new Error(`Capture hors cible : l'URL demandée est ${reqUrl} mais la page observée est ${actualUrl}.`);
  }
  return true;
}

module.exports = { validateTargetDomain, normalizeHostname, isLocalHost };
