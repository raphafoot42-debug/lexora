const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT=path.join(__dirname,'..');
const D=path.join(ROOT,'downloads');
const WORK=path.join(ROOT,'work');
const ASSETS=path.join(WORK,'assets');
const SCENES=path.join(ROOT,'videos','scenes');
const OUT=path.join(ROOT,'videos','sp-studio-final.mp4');

for(const d of [WORK,ASSETS,SCENES]) fs.mkdirSync(d,{recursive:true});

function run(cmd,args,timeout=180000){
  const r=spawnSync(cmd,args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:12*1024*1024});
  if(r.error) throw r.error;
  if(r.status!==0) throw new Error(`${cmd} a échoué (${r.status}). ${(r.stderr||r.stdout||'').slice(-7000)}`);
  return r.stdout||'';
}
function duration(file){
  return Number(run('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',file],30000).trim());
}
function ffprobeJson(file){
  return JSON.parse(run('ffprobe',['-v','error','-show_entries','format=duration,size:stream=index,codec_type,codec_name,width,height,duration','-of','json',file],30000));
}
function escDraw(text){
  return String(text||'')
    .replace(/\\/g,'\\\\')
    .replace(/:/g,'\\:')
    .replace(/'/g,"\\'")
    .replace(/,/g,'\\,')
    .replace(/;/g,'\\;')
    .replace(/\n/g,' ');
}
function wrapCaption(text, max=34){
  const words=String(text||'').trim().split(/\s+/);
  const lines=[]; let line='';
  for(const word of words){
    const test=line ? `${line} ${word}` : word;
    if(test.length>max && line){ lines.push(line); line=word; }
    else line=test;
  }
  if(line) lines.push(line);
  return lines.slice(0,2).join('\\n');
}
function findFont(){
  const wd=process.env.WINDIR;
  const candidates=wd?[
    path.join(wd,'Fonts','segoeui.ttf'),
    path.join(wd,'Fonts','arial.ttf'),
    path.join(wd,'Fonts','calibri.ttf')
  ]:[];
  return candidates.find(fs.existsSync)||null;
}
function cropScaleFilter(){
  return 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:(iw-1080)/2:(ih-1920)/2,setsar=1,format=yuv420p';
}
function validRange(start,end,total){
  let s=Math.max(0,Number(start??0));
  let e=Math.min(total,Number(end??(s+2.2)));
  if(!Number.isFinite(e)||e<=s) e=Math.min(total,s+2.2);
  if(e-s<1.4) e=Math.min(total,s+1.8);
  return {s,e};
}
function readPlan(){
  return JSON.parse(fs.readFileSync(path.join(D,'storyboard.json'),'utf8'));
}
function extractSessionSegment(session,scene,index,total){
  const srcRange=validRange(scene.sourceStart,scene.sourceEnd,total);
  const target=path.join(ASSETS,`scene-${String(index).padStart(2,'0')}.mp4`);
  const want=Math.max(1.8,Math.min(5.8,Number(scene.duration)||3));
  // Use the real session segment. Slightly extend the source selection when possible.
  const s=Math.max(0,srcRange.s-0.15);
  const t=Math.min(total,Math.max(srcRange.e,s+want));
  const vf=cropScaleFilter();
  run('ffmpeg',['-y','-ss',s.toFixed(3),'-i',session,'-t',(t-s).toFixed(3),'-an','-vf',vf,'-r','30','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p',target],120000);
  return {file:target,duration:duration(target)};
}
function stillSegment(image,scene,index){
  const target=path.join(ASSETS,`scene-${String(index).padStart(2,'0')}-still.mp4`);
  const dur=Math.max(1.8,Math.min(5.5,Number(scene.duration)||3));
  const font=findFont();
  const vf=[cropScaleFilter()];
  if(font && scene.caption){
    const ff=font.replace(/\\/g,'/').replace(/:/g,'\\:');
    const text=escDraw(scene.caption);
    vf.push(`drawtext=fontfile='${ff}':text='${text}':fontcolor=white:fontsize=42:borderw=2:bordercolor=black@0.55:x=76:y=1540:line_spacing=8`);
  }
  run('ffmpeg',['-y','-loop','1','-i',image,'-t',dur.toFixed(3),'-an','-vf',vf.join(','),'-r','30','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p',target],120000);
  return {file:target,duration:duration(target)};
}
function makeCaptionOverlay(text,dur,idx){
  const out=path.join(ASSETS,`cap-${idx}.txt`);
  fs.writeFileSync(out,String(text||''),'utf8');
  return out;
}
function renderSceneWithCaption(input,dur,caption,idx){
  const target=path.join(ASSETS,`render-${String(idx).padStart(2,'0')}.mp4`);
  const font=findFont();
  let vf=[cropScaleFilter()];
  if(font && caption){
    const ff=font.replace(/\\/g,'/').replace(/:/g,'\\:');
    const txt=escDraw(wrapCaption(caption));
    const y=Math.max(1260, 1680 - (String(caption).split(/\s+/).length>8?90:0));
    // Clean subtitle treatment: one style, no card, no oversized words.
    vf.push(`drawtext=fontfile='${ff}':text='${txt}':fontcolor=white:fontsize=38:line_spacing=8:borderw=3:bordercolor=black@0.48:x=(w-text_w)/2:y=${y}:alpha='if(lt(t,0.16),t/0.16,if(gt(t,${Math.max(0.25,dur-0.20).toFixed(2)}),(${dur.toFixed(2)}-t)/0.20,1))'`);
  }
  run('ffmpeg',['-y','-i',input,'-t',dur.toFixed(3),'-vf',vf.join(','),'-an','-r','30','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',target],120000);
  return target;
}
function writeMusic(seconds){
  const file=path.join(ASSETS,'music.wav');
  const sr=48000;
  const total=Math.max(18,Math.min(24,Math.ceil(seconds+0.6)));
  const n=sr*total;
  const fd=fs.openSync(file,'w');
  const header=Buffer.alloc(44);
  header.write('RIFF',0); header.writeUInt32LE(36+n*4,4); header.write('WAVE',8);
  header.write('fmt ',12); header.writeUInt32LE(16,16); header.writeUInt16LE(1,20); header.writeUInt16LE(2,22);
  header.writeUInt32LE(sr,24); header.writeUInt32LE(sr*4,28); header.writeUInt16LE(4,32); header.writeUInt16LE(16,34);
  header.write('data',36); header.writeUInt32LE(n*4,40); fs.writeSync(fd,header);

  const chords=[
    [261.63,329.63,392.00], // C
    [196.00,246.94,293.66], // G
    [220.00,277.18,329.63], // Am
    [174.61,220.00,261.63]  // F
  ];
  const bar=2.0;
  const chunk=8192, buf=Buffer.alloc(chunk*4);
  let pos=0;
  while(pos<n){
    const frames=Math.min(chunk,n-pos);
    for(let i=0;i<frames;i++){
      const t=(pos+i)/sr;
      const chord=chords[Math.floor(t/bar)%chords.length];
      const phase=(t%bar)/bar;
      const attack=Math.min(1,phase*6);
      const release=Math.min(1,(1-phase)*8);
      const env=attack*release;
      let v=0;
      for(const f of chord){
        v += 0.0105*Math.sin(2*Math.PI*f*t) + 0.004*Math.sin(2*Math.PI*2*f*t);
      }
      // Very soft rhythmic pluck, kept low enough to sit behind dialogue.
      const eighth=(t%(bar/4))/(bar/4);
      const pEnv=Math.exp(-8*eighth);
      const pluckFreq=chord[Math.floor((t/(bar/4))%3)];
      v += 0.006*pEnv*Math.sin(2*Math.PI*pluckFreq*2*t);
      // subtle high-frequency motion
      v += 0.0015*pEnv*Math.sin(2*Math.PI*880*t);

      const fadeIn=Math.min(1,t/0.9), fadeOut=Math.min(1,(total-t)/1.2);
      v*=env*fadeIn*fadeOut;
      v=Math.max(-0.92,Math.min(0.92,v));
      const left=Math.round(v*32767);
      const right=Math.round((v*0.96)*32767);
      buf.writeInt16LE(left,i*4); buf.writeInt16LE(right,i*4+2);
    }
    fs.writeSync(fd,buf,0,frames*4);
    pos+=frames;
  }
  fs.closeSync(fd);
  return file;
}
function concatWithXfade(clips){
  if(clips.length===1){ fs.copyFileSync(clips[0],path.join(WORK,'visual.mp4')); return path.join(WORK,'visual.mp4'); }
  const args=['-y'];
  clips.forEach(f=>args.push('-i',f));
  const pieces=[];
  for(let i=0;i<clips.length;i++) pieces.push(`[${i}:v]format=yuv420p[v${i}]`);
  let last='v0';
  let offset=0;
  for(let i=1;i<clips.length;i++){
    const d=Math.min(0.18,Math.max(0.08,Math.min(duration(clips[i-1]),duration(clips[i]))/4));
    offset += duration(clips[i-1]) - d;
    const out=`x${i}`;
    pieces.push(`[${last}][v${i}]xfade=transition=fade:duration=${d.toFixed(3)}:offset=${offset.toFixed(3)}[${out}]`);
    last=out;
  }
  pieces.push(`[${last}]format=yuv420p[vout]`);
  args.push('-filter_complex',pieces.join(';'),'-map','[vout]','-r','30','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',path.join(WORK,'visual.mp4'));
  run('ffmpeg',args,240000);
  return path.join(WORK,'visual.mp4');
}
function mixAudio(visual,music,seconds){
  const tmp=path.join(WORK,'mixed.mp4');
  run('ffmpeg',['-y','-i',visual,'-i',music,'-filter_complex',`[1:a]volume=0.08[m]`,'-map','0:v:0','-map','[m]','-t',seconds.toFixed(3),'-c:v','copy','-c:a','aac','-b:a','128k','-movflags','+faststart',tmp],180000);
  fs.copyFileSync(tmp,OUT);
}
function main(){
  run('ffmpeg',['-version'],30000); run('ffprobe',['-version'],30000);
  const plan=readPlan();
  const session=path.join(ROOT,'videos','session.webm');
  const total=fs.existsSync(session)?duration(session):0;
  if(!total) throw new Error('Session navigateur introuvable ou vide.');

  for(const f of fs.readdirSync(ASSETS)) fs.rmSync(path.join(ASSETS,f),{force:true});
  for(const f of fs.readdirSync(WORK)) if(f!=='assets') fs.rmSync(path.join(WORK,f),{force:true});

  const rendered=[];
  for(let i=0;i<plan.scenes.length;i++){
    const s=plan.scenes[i];
    let clip=null;
    if(Number.isFinite(s.sourceStart) && Number.isFinite(s.sourceEnd) && s.sourceEnd>s.sourceStart+0.7){
      try { clip=extractSessionSegment(session,s,i+1,total); } catch(e) { console.warn(`Fallback scène ${s.key}: ${e.message}`); }
    }
    if(!clip){
      const fallback=path.join(ROOT,'captures', i===0?'01-hero.png':i===3?'04-result.png':i===4?'05-proof.png':'06-cta.png');
      if(!fs.existsSync(fallback)) throw new Error(`Aucune source pour la scène ${s.key}.`);
      clip=stillSegment(fallback,s,i+1);
    }
    const captioned=renderSceneWithCaption(clip.file,clip.duration,s.caption,i+1);
    rendered.push(captioned);
  }

  const visual=concatWithXfade(rendered);
  const visualDur=duration(visual);
  const music=writeMusic(visualDur);
  mixAudio(visual,music,visualDur);

  const meta=ffprobeJson(OUT);
  const finalDur=Number(meta.format?.duration||0);
  const manifest={
    schemaVersion:5,
    createdAt:new Date().toISOString(),
    url:JSON.parse(fs.readFileSync(path.join(D,'site-analysis.json'),'utf8')).url,
    style:plan.style,
    output:'/videos/sp-studio-final.mp4',
    scenes:plan.scenes.map((s,i)=>({key:s.key,caption:s.caption,duration:duration(rendered[i]),sourceStart:s.sourceStart,sourceEnd:s.sourceEnd})),
    audio:{music:true,narration:false},
    durations:{visual:visualDur,final:finalDur},
    design:{
      vertical:'1080x1920',
      continuousSession:true,
      sessionSource:'videos/session.webm',
      directCaption:true,
      giantTextCards:false,
      debugLabels:false,
      transitions:'short-dissolve'
    },
    qualityTarget:{minSeconds:12,maxSeconds:30,idealMinSeconds:18,idealMaxSeconds:22}
  };
  fs.writeFileSync(path.join(D,'render-manifest.json'),JSON.stringify(manifest,null,2),'utf8');
  console.log(`Vidéo finale créée : ${OUT}`);
  console.log(`Durée : ${finalDur.toFixed(2)} s`);

  run('node',[path.join(__dirname,'quality-gate.js')],30000);
}
main();
