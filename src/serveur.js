const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const ROOT = path.join(__dirname, '..');
const jobs = new Map();

app.use(express.json({ limit: '3mb' }));
app.use(express.static(path.join(ROOT, 'src', 'interface')));
for (const d of ['captures', 'videos', 'downloads']) {
  app.use(`/${d}`, express.static(path.join(ROOT, d)));
}

function clean(value, max = 30000) {
  return String(value || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function runNode(script, args, onOutput) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: ROOT,
      env: process.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      const s = chunk.toString();
      stdout += s;
      if (onOutput) onOutput(s);
    });
    child.stderr.on('data', chunk => {
      const s = chunk.toString();
      stderr += s;
      if (onOutput) onOutput(s);
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error((stderr || stdout || `Processus terminé avec le code ${code}`).slice(0, 12000)));
    });
  });
}

async function pipeline(job, payload) {
  job.status = 'running';
  try {
    job.step = '1/3 — Explorer';
    job.message = 'Le navigateur utilise le site dans une session continue.';
    await runNode(
      path.join('src', 'analyser-site.js'),
      ['--url', payload.url, '--title', payload.title, '--style', payload.style, '--description', payload.description],
      s => { job.log = (job.log + s).slice(-15000); }
    );

    job.step = '2/3 — Construire';
    job.message = 'Le storyboard est construit à partir des moments réellement observés.';
    await runNode(path.join('src', 'agent-planner.js'), [], s => { job.log = (job.log + s).slice(-15000); });

    job.step = '3/3 — Rendre';
    job.message = 'Le montage utilise la session navigateur, des transitions sobres et une bande-son légère.';
    await runNode(path.join('src', 'generer-video.js'), [], s => { job.log = (job.log + s).slice(-15000); });

    const qualityPath = path.join(ROOT, 'downloads', 'quality-report.json');
    const quality = fs.existsSync(qualityPath) ? JSON.parse(fs.readFileSync(qualityPath, 'utf8')) : null;
    if (quality && !quality.ok) {
      throw new Error(`Contrôle qualité : ${quality.failures.join(' | ')}`);
    }

    job.status = 'done';
    job.step = 'Terminé';
    job.message = 'Vidéo générée.';
    job.result = {
      video: '/videos/sp-studio-final.mp4',
      storyboard: '/downloads/storyboard.json',
      analysis: '/downloads/site-analysis.json',
      quality: '/downloads/quality-report.json',
      script: '/downloads/voiceover-script.txt'
    };
  } catch (error) {
    job.status = 'error';
    job.step = 'Erreur';
    job.message = (error.message || 'Erreur de génération.').slice(0, 12000);
  }
}

app.post('/api/projet', (req, res) => {
  const url = clean(req.body.url, 2000);
  const title = clean(req.body.title, 300) || 'Vidéo produit';
  const style = clean(req.body.style, 60) || 'Dynamique';
  const description = clean(req.body.description, 30000);

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch {
    return res.status(400).json({ ok: false, error: 'URL invalide.' });
  }

  const running = [...jobs.values()].find(j => j.status === 'running');
  if (running) return res.status(409).json({ ok: false, error: 'Une génération est déjà en cours.', jobId: running.id });

  const id = crypto.randomUUID();
  const job = {
    id,
    status: 'queued',
    step: 'Préparation',
    message: 'Lancement…',
    log: '',
    startedAt: new Date().toISOString()
  };
  jobs.set(id, job);
  pipeline(job, { url, title, style, description }).catch(() => {});
  res.json({ ok: true, jobId: id });
});

app.get('/api/job/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job introuvable.' });
  res.json({ ok: true, job });
});

app.get('/api/fichiers', (req, res) => {
  const out = {};
  for (const d of ['captures', 'videos', 'downloads']) {
    const dir = path.join(ROOT, d);
    out[d] = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  }
  res.json(out);
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`SP Studio est disponible sur http://localhost:${PORT}`);
});
