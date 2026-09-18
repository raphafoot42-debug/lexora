function validateTargetDomain(reqUrl, actualUrl) {
  if (!reqUrl) throw new Error('URL requise.');
  const reqHost = new URL(reqUrl).hostname.toLowerCase();
  const actHost = actualUrl ? new URL(actualUrl).hostname.toLowerCase() : reqHost;
  const isReqLocal = reqHost === 'localhost' || reqHost === '127.0.0.1' || reqHost === '::1';
  const isActLocal = actHost === 'localhost' || actHost === '127.0.0.1' || actHost === '::1';

  if (!isReqLocal && isActLocal) {
    throw new Error(`Capture localhost interdite : l'URL demandée est ${reqUrl} mais la page observée est ${actualUrl}.`);
  }
  return true;
}

module.exports = { validateTargetDomain };
