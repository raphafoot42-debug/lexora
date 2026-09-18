const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT=path.join(__dirname,'..');
const OUT=path.join(ROOT,'videos','sp-studio-final.mp4');
const REPORT=path.join(ROOT,'downloads','quality-report.json');

function probe(args){
  const r=spawnSync('ffprobe',args,{encoding:'utf8',windowsHide:true});
  if(r.status!==0) throw new Error((r.stderr||r.stdout||'ffprobe failed').slice(0,4000));
  return r.stdout.trim();
}

const failures=[];
const warnings=[];
if(!fs.existsSync(OUT)) failures.push('Fichier vidéo final introuvable.');
else {
  try {
    const meta=JSON.parse(probe(['-v','error','-show_entries','format=duration,size:stream=codec_type,width,height,duration','-of','json',OUT]));
    const dur=Number(meta.format?.duration||0);
    const w=Number(meta.streams?.find(s=>s.codec_type==='video')?.width||0);
    const h=Number(meta.streams?.find(s=>s.codec_type==='video')?.height||0);
    const hasAudio=meta.streams?.some(s=>s.codec_type==='audio');
    if(w!==1080||h!==1920) failures.push(`Format invalide : ${w}x${h}`);
    if(dur<12||dur>30) failures.push(`Durée hors plage : ${dur.toFixed(2)} s.`);
    if(dur<18||dur>22) warnings.push(`Durée hors cible idéale 18–22 s : ${dur.toFixed(2)} s.`);
    if(!hasAudio) warnings.push('Pas de piste audio.');
    if(dur>26) warnings.push(`Vidéo assez longue : ${dur.toFixed(2)} s.`);
    fs.writeFileSync(REPORT,JSON.stringify({
      ok:failures.length===0,
      failures,warnings,
      createdAt:new Date().toISOString(),
      duration:dur,
      video:{width:w,height:h},
      audio:Boolean(hasAudio)
    },null,2),'utf8');
  } catch(e){ failures.push(e.message); }
}

if(!fs.existsSync(REPORT)) fs.writeFileSync(REPORT,JSON.stringify({ok:failures.length===0,failures,warnings},null,2),'utf8');
if(failures.length) { console.error(`Contrôle qualité : ECHEC - ${failures.join(' | ')}`); process.exit(1); }
console.log('Contrôle qualité : OK.');
