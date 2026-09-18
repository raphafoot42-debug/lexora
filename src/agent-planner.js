const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname,'..');
const D = path.join(ROOT,'downloads');

function clean(v,max=2000){return String(v||'').replace(/\s+/g,' ').trim().slice(0,max);}
function has(t,re){return re.test(String(t||'').toLowerCase());}

const auditPath=path.join(D,'site-analysis.json');
if(!fs.existsSync(auditPath)) throw new Error('site-analysis.json introuvable.');
const audit=JSON.parse(fs.readFileSync(auditPath,'utf8'));

const siteText=clean([
  audit.initial?.visibleText,
  audit.finalFacts?.visibleText,
  ...(audit.initial?.h1||[]),
  ...(audit.initial?.headings||[]),
  ...(audit.finalFacts?.headings||[])
].join(' '),40000);

const proof=[
  has(siteText,/gratuit|free/) ? 'Gratuit' : '',
  has(siteText,/sans inscription|without signing up|no sign.?up/) ? 'Sans inscription' : '',
  has(siteText,/sans.*carte|aucune.*carte|carte bancaire|no credit card/) ? 'Sans carte bancaire' : ''
].filter(Boolean).join(' • ');

const marks=Array.isArray(audit.timeline)?audit.timeline:[];
const pickFirst=(name)=>marks.find(x=>x.name===name)||null;
const pickLast=(...names)=>{
  for(let i=marks.length-1;i>=0;i--) if(names.includes(marks[i].name)) return marks[i];
  return null;
};

const headline = has(siteText,/idée|idee/) && has(siteText,/plan|action|lancer|projet/)
  ? 'Tu as une idée. Maintenant, montre-moi le plan.'
  : 'Une idée de projet ? Fais-la avancer.';

const scenes = [
  {key:'hook', type:'hero', from:pickFirst('hero'), caption:'Tu as une idée, mais tu ne sais pas par où commencer ?', duration:2.3},
  {key:'demo', type:'demo', from:pickFirst('fill-idea') || pickFirst('fill-name'), caption:'Décris simplement ton projet...', duration:3.9},
  {key:'action', type:'action', from:pickFirst('before-action') || pickFirst('click'), caption:'En un clic, Spark Idea résout ton blocage.', duration:2.3},
  {key:'result', type:'result', from:pickLast('result','state-changed','click'), caption:'Regarde : tu obtiens un plan d’action structuré.', duration:4.8},
  {key:'proof', type:'proof', from:pickFirst('proof'), caption:proof ? proof + ' • Prêt en secondes.' : 'Accès immédiat sans barrière.', duration:2.2},
  {key:'cta', type:'cta', from:pickLast('cta'), caption:'Plus d’excuse : transforme ton idée en projet !', duration:2.5}
];

const usable=scenes.map(s=>{
  const start=s.from?.time;
  const end=s.from?.end;
  return {...s, sourceStart:Number.isFinite(start)?start:null, sourceEnd:Number.isFinite(end)?end:null};
});

const script=[
  'Tu as une idée, mais tu ne sais pas par où commencer ?',
  'Décris simplement ton projet...',
  'En un clic, Spark Idea résout ton blocage.',
  'Regarde : tu obtiens un plan d’action structuré.',
  proof ? `C’est ${proof.toLowerCase()}, prêt en quelques secondes.` : 'Accès immédiat et sans barrière.',
  'Plus d’excuse : transforme ton idée en projet !'
];

const plan={
  schemaVersion:4,
  mode:'continuous-product-demo',
  style:clean(audit.style||'Dynamique',60),
  headline,
  scenes:usable,
  rules:{
    targetSeconds:20,
    minSeconds:12,
    maxSeconds:30,
    oneContinuousSession:true,
    noGiantTextCards:true,
    noDebugLabels:true,
    captionsMaxWords:10,
    voiceOptional:true
  }
};

fs.writeFileSync(path.join(D,'storyboard.json'),JSON.stringify(plan,null,2),'utf8');
fs.writeFileSync(path.join(D,'voiceover-script.txt'),script.join('\n\n'),'utf8');
console.log(`Storyboard prêt. ${usable.length} scènes. Mode : ${plan.mode}.`);
