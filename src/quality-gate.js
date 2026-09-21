const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { validateTargetDomain } = require('./domain-validation');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'videos', 'sp-studio-final.mp4');
const SESSION = path.join(ROOT, 'videos', 'session.webm');
const REPORT = path.join(ROOT, 'downloads', 'quality-report.json');
const ANALYSIS = path.join(ROOT, 'downloads', 'site-analysis.json');
const MANIFEST = path.join(ROOT, 'downloads', 'render-manifest.json');
const STORYBOARD = path.join(ROOT, 'downloads', 'storyboard.json');

function run(cmd, args, timeout = 60000) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 12 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || `${cmd} failed`).slice(-6000));
  return { stdout: r.stdout || '', stderr: r.stderr || '' };
}
function probe(file) {
  return JSON.parse(run('ffprobe', ['-v','error','-show_entries','format=duration,size:stream=index,codec_type,codec_name,width,height,duration','-of','json',file]).stdout);
}
function addFailure(message) { failures.push(message); }

const failures = [];
const warnings = [];
let report = { ok:false, failures, warnings, createdAt:new Date().toISOString() };

try {
  if (!fs.existsSync(ANALYSIS)) addFailure('Analyse du site absente.');
  if (!fs.existsSync(MANIFEST)) addFailure('Manifest de rendu absent.');
  if (!fs.existsSync(STORYBOARD)) addFailure('Storyboard absent.');
  if (!fs.existsSync(SESSION)) addFailure('Session navigateur absente : aucune preuve de capture récente.');
  if (!fs.existsSync(OUT)) addFailure('Fichier vidéo final introuvable.');

  let analysis = null;
  let manifest = null;
  let storyboard = null;
  if (fs.existsSync(ANALYSIS)) {
    try {
      analysis = JSON.parse(fs.readFileSync(ANALYSIS, 'utf8'));
      const actualUrl = analysis.finalFacts?.url || analysis.initial?.url || analysis.url;
      validateTargetDomain(analysis.url, actualUrl);
      if (!analysis.url || !actualUrl) addFailure('URL cible ou URL observée absente.');
      if (Array.isArray(analysis.runtimeErrors) && analysis.runtimeErrors.length > 8) {
        warnings.push(`Nombre élevé d'erreurs navigateur observées : ${analysis.runtimeErrors.length}.`);
      }
    } catch (err) { addFailure(`Validation cible échouée : ${err.message}`); }
  }
  if (fs.existsSync(MANIFEST)) {
    try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { addFailure(`Manifest invalide : ${e.message}`); }
  }
  if (fs.existsSync(STORYBOARD)) {
    try { storyboard = JSON.parse(fs.readFileSync(STORYBOARD, 'utf8')); } catch (e) { addFailure(`Storyboard invalide : ${e.message}`); }
  }

  if (analysis && fs.existsSync(SESSION)) {
    const analysisTime = Date.parse(analysis.createdAt || '') || 0;
    if (analysisTime && fs.statSync(SESSION).mtimeMs < analysisTime - 1000) {
      addFailure('La session vidéo est plus ancienne que l’analyse actuelle : capture potentiellement obsolète.');
    }
  }

  if (storyboard) {
    const forbidden = /\b(HOOK|PROMESSE|CTA|STORYBOARD|DEBUG|SP STUDIO|SCENE(?:_\d+)?)\b/i;
    for (const scene of storyboard.scenes || []) {
      if (forbidden.test(String(scene.caption || ''))) addFailure(`Texte interne détecté dans le storyboard : ${scene.caption}`);
      if (!Number.isFinite(Number(scene.sourceStart)) || !Number.isFinite(Number(scene.sourceEnd)) || Number(scene.sourceEnd) <= Number(scene.sourceStart)) {
        addFailure(`Scène sans plage observée valide : ${scene.key}`);
      }
    }
    if (storyboard.rules?.syntheticStillFallback) addFailure('Le storyboard autorise encore des scènes synthétiques.');
  }

  if (fs.existsSync(OUT)) {
    const meta = probe(OUT);
    const video = meta.streams?.find(s => s.codec_type === 'video');
    const audio = meta.streams?.find(s => s.codec_type === 'audio');
    const duration = Number(meta.format?.duration || 0);
    const audioDuration = Number(audio?.duration || 0);
    const w = Number(video?.width || 0);
    const h = Number(video?.height || 0);

    if (!video) addFailure('Flux vidéo absent.');
    if (w !== 1080 || h !== 1920) addFailure(`Format invalide : ${w}x${h}.`);
    if (!Number.isFinite(duration) || duration < 12 || duration > 28) addFailure(`Durée hors plage : ${duration.toFixed(2)} s.`);
    if (duration < 18 || duration > 24) warnings.push(`Durée hors cible idéale 18–24 s : ${duration.toFixed(2)} s.`);
    if (!audio) addFailure('Piste audio absente.');
    if (audio && Math.abs(audioDuration - duration) > 0.35) addFailure(`Audio désynchronisé : vidéo ${duration.toFixed(2)} s, audio ${audioDuration.toFixed(2)} s.`);

    if (analysis && manifest && manifest.url !== analysis.url) addFailure('Le manifest ne correspond pas à l’URL analysée.');
    if (manifest?.design?.syntheticStillFallback) addFailure('Le rendu déclare encore un fallback image fixe.');

    // Fail on clearly broken visual output: long black sections or long freezes.
    const black = run('ffmpeg', ['-hide_banner','-i',OUT,'-vf','blackdetect=d=2:pic_th=0.98:pix_th=0.05','-an','-f','null','-'], 90000).stderr;
    const freeze = run('ffmpeg', ['-hide_banner','-i',OUT,'-vf','freezedetect=n=-55dB:d=3','-an','-f','null','-'], 90000).stderr;
    const blackDurations = [...black.matchAll(/black_duration:([0-9.]+)/g)].map(m => Number(m[1])).filter(Number.isFinite);
    const freezeDurations = [...freeze.matchAll(/freeze_duration:([0-9.]+)/g)].map(m => Number(m[1])).filter(Number.isFinite);
    if (blackDurations.some(d => d >= 2.5)) addFailure('Séquence noire anormalement longue détectée.');
    if (freezeDurations.some(d => d >= 5)) warnings.push('Plan visuellement quasi immobile pendant plus de 5 s : vérifier le rendu produit.');

    report = {
      ok: failures.length === 0,
      failures,
      warnings,
      createdAt: new Date().toISOString(),
      duration,
      audioDuration,
      video: { width:w, height:h, codec:video?.codec_name || null },
      audio: { present:Boolean(audio), codec:audio?.codec_name || null },
      targetUrl: analysis?.url || null,
      observedUrl: analysis?.finalFacts?.url || analysis?.initial?.url || null,
      narration: Boolean(manifest?.audio?.narration)
    };
  }
} catch (err) {
  addFailure(err.message || String(err));
  report = { ok:false, failures, warnings, createdAt:new Date().toISOString() };
}

fs.mkdirSync(path.dirname(REPORT), { recursive:true });
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8');
if (failures.length) {
  console.error(`Contrôle qualité : ECHEC - ${failures.join(' | ')}`);
  process.exit(1);
}
console.log('Contrôle qualité : OK.');
