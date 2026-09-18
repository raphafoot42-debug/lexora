const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'videos', 'sp-studio-final.mp4');

function runNode(script, args) {
  const r = spawnSync(process.execPath, [path.join(ROOT, script), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300000
  });
  if (r.status !== 0) {
    throw new Error(`Execution of ${script} failed (${r.status}): ${(r.stderr || r.stdout || '').slice(-2000)}`);
  }
  return r.stdout;
}

function probe(args) {
  const r = spawnSync('ffprobe', args, { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'ffprobe failed').slice(0, 2000));
  return JSON.parse(r.stdout.trim());
}

(async () => {
  console.log('--- Lancement du test End-to-End SP Studio ---');

  console.log('1. Exécution de analyser-site.js...');
  runNode('src/analyser-site.js', ['--url', 'https://spark-idea-two.vercel.app', '--title', 'Test SP Studio']);

  const analysisPath = path.join(ROOT, 'downloads', 'site-analysis.json');
  assert.strictEqual(fs.existsSync(analysisPath), true, 'site-analysis.json doit être créé');
  const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
  assert.strictEqual(analysis.url, 'https://spark-idea-two.vercel.app');
  assert.ok(analysis.timeline.length > 0, 'In un enregistrement timeline doit exister');

  console.log('2. Exécution de agent-planner.js...');
  runNode('src/agent-planner.js', []);

  const storyboardPath = path.join(ROOT, 'downloads', 'storyboard.json');
  assert.strictEqual(fs.existsSync(storyboardPath), true, 'storyboard.json doit être créé');

  console.log('3. Exécution de generer-video.js...');
  runNode('src/generer-video.js', []);

  console.log('4. Inspection du fichier vidéo produit avec ffprobe...');
  assert.strictEqual(fs.existsSync(OUT), true, 'Le fichier vidéo final sp-studio-final.mp4 doit exister');

  const meta = probe(['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height', '-of', 'json', OUT]);
  const videoStream = meta.streams.find(s => s.codec_type === 'video');
  const audioStream = meta.streams.find(s => s.codec_type === 'audio');
  const duration = Number(meta.format.duration);

  assert.ok(videoStream, 'Un flux vidéo doit être présent');
  assert.strictEqual(videoStream.width, 1080, 'La largeur doit être de 1080px');
  assert.strictEqual(videoStream.height, 1920, 'La hauteur doit être de 1920px (9:16)');
  assert.ok(audioStream, 'Un flux audio doit être présent');
  assert.ok(duration >= 12 && duration <= 30, `La durée (${duration}s) doit être comprise entre 12s et 30s`);

  const qualityPath = path.join(ROOT, 'downloads', 'quality-report.json');
  assert.strictEqual(fs.existsSync(qualityPath), true, 'quality-report.json doit être généré');
  const quality = JSON.parse(fs.readFileSync(qualityPath, 'utf8'));
  assert.strictEqual(quality.ok, true, `Quality gate doit être OK. Échecs: ${(quality.failures || []).join(' | ')}`);

  console.log('--- TEST END-TO-END REUSSI AVEC SUCCES ---');
  console.log(`Vidéo: ${OUT} (${videoStream.width}x${videoStream.height}, ${duration.toFixed(2)}s, Audio: ${audioStream.codec_name})`);
})().catch(e => {
  console.error('ÉCHEC DU TEST END-TO-END:', e.stack || e);
  process.exit(1);
});
