const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = path.join(ROOT, 'downloads');

function clean(v, max = 4000) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function has(t, re) { return re.test(String(t || '').toLowerCase()); }
function markFirst(marks, name) { return marks.find(x => x.name === name) || null; }
function markLast(marks, ...names) {
  for (let i = marks.length - 1; i >= 0; i--) if (names.includes(marks[i].name)) return marks[i];
  return null;
}
function withRange(mark, fallbackDuration = 2.4) {
  if (!mark) return null;
  const start = Number(mark.time);
  const end = Number(mark.end);
  if (!Number.isFinite(start)) return null;
  return {
    sourceStart: start,
    sourceEnd: Number.isFinite(end) && end > start ? end : start + fallbackDuration
  };
}

const auditPath = path.join(D, 'site-analysis.json');
if (!fs.existsSync(auditPath)) throw new Error('site-analysis.json introuvable.');
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
const marks = Array.isArray(audit.timeline) ? audit.timeline : [];
const siteText = clean([
  audit.initial?.visibleText,
  audit.finalFacts?.visibleText,
  ...(audit.initial?.h1 || []),
  ...(audit.initial?.headings || []),
  ...(audit.finalFacts?.headings || [])
].join(' '), 40000);

const proof = [
  has(siteText, /gratuit|free/) ? 'Gratuit' : '',
  has(siteText, /sans inscription|without signing up|no sign.?up/) ? 'Sans inscription' : '',
  has(siteText, /sans.*carte|aucune.*carte|carte bancaire|no credit card/) ? 'Sans carte bancaire' : ''
].filter(Boolean);

const resultText = clean(audit.finalFacts?.visibleText || '', 12000);
const hasPlanResult = has(resultText, /plan|résultat|resultat|schéma|schema|actions|assistant|progression/);

const candidates = [
  { key: 'hook', type: 'hero', mark: markFirst(marks, 'hero'), caption: 'Tu as une idée, mais tu ne sais pas par où commencer ?', duration: 2.4 },
  { key: 'demo', type: 'demo', mark: markFirst(marks, 'fill-idea') || markFirst(marks, 'fill-name'), caption: 'Décris simplement ton projet.', duration: 3.4 },
  { key: 'action', type: 'action', mark: markFirst(marks, 'click'), caption: 'Lance l’analyse.', duration: 2.2 },
  { key: 'result', type: 'result', mark: markFirst(marks, 'result') || markFirst(marks, 'state-changed'), caption: hasPlanResult ? 'Voici le résultat.' : 'Voici ce que le produit affiche.', duration: 4.2 },
  { key: 'proof', type: 'proof', mark: markFirst(marks, 'proof'), caption: proof.length ? proof.join(' • ') : '', duration: 2.0 },
  { key: 'cta', type: 'cta', mark: markLast(marks, 'cta'), caption: 'Transforme ton idée en projet.', duration: 2.6 }
];

const scenes = candidates
  .filter(s => s.mark && withRange(s.mark))
  .map(s => ({
    key: s.key,
    type: s.type,
    caption: clean(s.caption, 120),
    duration: s.duration,
    ...withRange(s.mark, s.duration)
  }))
  .filter(s => s.caption || s.key === 'demo' || s.key === 'result');

if (scenes.length < 3) {
  throw new Error(`Storyboard insuffisant : seulement ${scenes.length} moments observables. SP Studio refuse de fabriquer des scènes artificielles.`);
}

const totalPlanned = scenes.reduce((sum, s) => sum + s.duration, 0);
const script = scenes.map(s => s.caption).filter(Boolean);

const plan = {
  schemaVersion: 5,
  mode: 'observed-product-demo',
  style: clean(audit.style || 'Dynamique', 60),
  targetUrl: audit.url,
  scenes,
  narration: {
    enabled: true,
    lines: script
  },
  rules: {
    targetSeconds: Math.max(18, Math.min(24, totalPlanned)),
    minSeconds: 12,
    maxSeconds: 28,
    oneContinuousSession: true,
    realProductOnly: true,
    noSyntheticStillFallback: true,
    noGiantTextCards: true,
    noDebugLabels: true,
    captionsMaxWords: 10
  }
};

fs.writeFileSync(path.join(D, 'storyboard.json'), JSON.stringify(plan, null, 2), 'utf8');
fs.writeFileSync(path.join(D, 'voiceover-script.txt'), script.join('\n\n'), 'utf8');
console.log(`Storyboard prêt. ${scenes.length} scènes observées. Durée visée : ${plan.rules.targetSeconds.toFixed(1)} s.`);
