const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateTargetDomain } = require('./domain-validation');

const ROOT = path.join(__dirname, '..');
const CAPTURES = path.join(ROOT, 'captures');
const SCENES = path.join(ROOT, 'videos', 'scenes');
const DOWNLOADS = path.join(ROOT, 'downloads');
const VIDEOS = path.join(ROOT, 'videos');

for (const d of [CAPTURES, SCENES, DOWNLOADS, VIDEOS]) fs.mkdirSync(d, { recursive: true });

function arg(name, fallback='') {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i+1] : fallback;
}
function clean(v,max=30000) { return String(v||'').replace(/\s+/g,' ').trim().slice(0,max); }
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }
function resetDir(dir) {
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir,f), {recursive:true,force:true});
}
function norm(text) { return clean(text,500).toLowerCase(); }

function likelyQuestion(meta) {
  const t = norm([meta.label, meta.placeholder, meta.name, meta.id, meta.aria].join(' '));
  if (/email|e-mail|mot de passe|password|téléphone|phone|code|adresse postale/.test(t)) return 'ignore';
  if (/prénom|prenom|first name|nom/.test(t)) return 'name';
  if (/idée|idee|projet|concept|description|décris|decris|message|objectif|business|produit/.test(t)) return 'idea';
  return meta.tag === 'textarea' ? 'idea' : 'text';
}

function valueFor(kind) {
  if (kind === 'name') return 'Alex';
  if (kind === 'idea') return 'Une application qui aide les artisans à trouver leurs premiers clients.';
  return 'Je veux transformer cette idée en projet concret.';
}

async function visibleFields(page) {
  return page.evaluate(() => {
    const visible = el => {
      const s=getComputedStyle(el), r=el.getBoundingClientRect();
      return s.display!=='none' && s.visibility!=='hidden' && Number(s.opacity||1)>.03 && r.width>0 && r.height>0;
    };
    return [...document.querySelectorAll('input,textarea,[contenteditable="true"]')]
      .filter(visible).map(el=>{
        const id=el.id||'';
        const labelEl=id?document.querySelector(`label[for="${CSS.escape(id)}"]`):null;
        return {
          tag:el.tagName.toLowerCase(),
          type:el.getAttribute('type')||'',
          name:el.getAttribute('name')||'',
          id,
          placeholder:el.getAttribute('placeholder')||'',
          aria:el.getAttribute('aria-label')||'',
          label:labelEl?.innerText||'',
          value:el.value||el.textContent||''
        };
      });
  });
}

async function visibleButtons(page) {
  return page.evaluate(() => {
    const visible = el => {
      const s=getComputedStyle(el), r=el.getBoundingClientRect();
      return s.display!=='none' && s.visibility!=='hidden' && Number(s.opacity||1)>.03 && r.width>0 && r.height>0;
    };
    const txt = el => (el.innerText || el.textContent || '').replace(/\s+/g,' ').trim();
    return [...document.querySelectorAll('button,[role="button"],a')]
      .filter(visible).map(el=>({text:txt(el), aria:el.getAttribute('aria-label')||'', href:el.getAttribute('href')||''}))
      .filter(x=>x.text||x.aria).slice(0,120);
  });
}

function buttonScore(x) {
  const t = norm([x.text, x.aria].join(' '));
  let s = 0;
  if (/analyser|analyse|commencer|démarrer|demarrer|lancer|continuer|suivant|générer|generer|obtenir|tester|essayer|voir|découvrir|decouvrir/.test(t)) s += 20;
  if (/connexion|login|contact|affiliation|tarif|prix|mentions|politique|admin/.test(t)) s -= 20;
  if (t.length >= 2 && t.length < 70) s += 2;
  return s;
}

function inputSelector(meta) {
  if (meta.id) return `#${meta.id.replace(/([\\.#:[\\],])/g,'\\$1')}`;
  if (meta.name) return `[name="${String(meta.name).replace(/([\\"\\])/g,'\\$1')}"]`;
  if (meta.placeholder) return `[placeholder="${String(meta.placeholder).replace(/([\\"\\])/g,'\\$1')}"]`;
  return null;
}

async function getFieldLocator(page, meta, fallbackIndex=0) {
  // Prefer robust semantic locators; fall back to the current visible-field index.
  try {
    if (meta.placeholder) {
      const loc = page.getByPlaceholder(meta.placeholder, { exact: true }).first();
      if (await loc.count().catch(()=>0)) return loc;
    }
  } catch {}
  try {
    if (meta.label) {
      const loc = page.getByLabel(meta.label, { exact: true }).first();
      if (await loc.count().catch(()=>0)) return loc;
    }
  } catch {}
  const sel = inputSelector(meta);
  if (sel) {
    const loc = page.locator(sel).first();
    if (await loc.count().catch(()=>0)) return loc;
  }
  return page.locator('input:visible,textarea:visible,[contenteditable="true"]:visible').nth(fallbackIndex);
}

async function setFieldValue(page, loc, value) {
  // First try Playwright fill (fires input/change cleanly for native fields).
  try { await loc.fill(value,{timeout:3000}); } catch {}
  await sleep(250);

  // Some custom/controlled forms react better to real keyboard input.
  const current = await loc.inputValue().catch(async()=>await loc.textContent().catch(()=>'')||'');
  if (String(current).trim() !== String(value).trim()) {
    try {
      await loc.click({timeout:2000});
      await loc.press(process.platform==='darwin'?'Meta+A':'Control+A').catch(()=>{});
      await loc.pressSequentially(value,{delay:24,timeout:4000});
    } catch {}
  }
  // Final DOM event nudge for controlled inputs.
  await loc.evaluate((el, v) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto,'value')?.set;
    if (setter) setter.call(el,v); else el.value=v;
    el.dispatchEvent(new Event('input',{bubbles:true,composed:true}));
    el.dispatchEvent(new Event('change',{bubbles:true,composed:true}));
    el.dispatchEvent(new Event('blur',{bubbles:true,composed:true}));
  }, value).catch(()=>{});
  await sleep(550);
}

async function bestEnabledAction(page) {
  const buttons = await visibleButtons(page);
  const scored = buttons.map((b,i)=>({b,i,score:buttonScore(b)})).sort((a,b)=>b.score-a.score);
  for(const item of scored){
    if(item.score<=0) continue;
    const all = page.locator('button:visible,[role="button"]:visible,a:visible');
    // Use the text/aria on the real DOM element instead of trusting an index
    // from a filtered list; filtered and raw lists can otherwise drift.
    const candidates = all.filter({hasText:item.b.text||item.b.aria||''});
    const count = await candidates.count().catch(()=>0);
    for(let j=0;j<count;j++){
      const loc=candidates.nth(j);
      const disabled=await loc.isDisabled().catch(()=>false);
      if(!disabled && await loc.isVisible().catch(()=>false)) return {loc,label:item.b.text||item.b.aria||'Action',score:item.score};
    }
  }
  return null;
}

async function collectFacts(page) {
  return page.evaluate(() => {
    const visible = el => {
      const s=getComputedStyle(el), r=el.getBoundingClientRect();
      return s.display!=='none' && s.visibility!=='hidden' && Number(s.opacity||1)>.03 && r.width>0 && r.height>0;
    };
    const txt = el => (el.innerText || el.textContent || '').replace(/\s+/g,' ').trim();
    const els = sel => [...document.querySelectorAll(sel)].filter(visible);
    return {
      title: document.title,
      url: location.href,
      h1: els('h1').map(txt).filter(Boolean).slice(0,10),
      headings: els('h1,h2,h3').map(txt).filter(Boolean).slice(0,80),
      buttons: els('button,[role="button"],a').map(el=>({text:txt(el),aria:el.getAttribute('aria-label')||''})).filter(x=>x.text||x.aria).slice(0,120),
      inputs: els('input,textarea,[contenteditable="true"]').map(el=>({
        tag:el.tagName.toLowerCase(), type:el.getAttribute('type')||'', name:el.getAttribute('name')||'', id:el.id||'',
        placeholder:el.getAttribute('placeholder')||'', aria:el.getAttribute('aria-label')||'', value:el.value||el.textContent||''
      })).slice(0,50),
      visibleText: (document.body.innerText||'').replace(/\s+/g,' ').trim().slice(0,50000),
      viewport:{width:innerWidth,height:innerHeight}
    };
  });
}

async function addCursor(page) {
  await page.addStyleTag({content:`
    .__sp_cursor{position:fixed;z-index:2147483647;width:16px;height:16px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 2px rgba(0,0,0,.32),0 2px 8px rgba(0,0,0,.25);pointer-events:none;transform:translate(-50%,-50%);opacity:.92;transition:transform .06s linear}
    .__sp_click{position:fixed;z-index:2147483646;width:34px;height:34px;border:2px solid rgba(255,255,255,.9);border-radius:50%;pointer-events:none;transform:translate(-50%,-50%) scale(.4);opacity:0}
    .__sp_click.show{animation:spclick .48s ease-out}
    @keyframes spclick{0%{opacity:.9;transform:translate(-50%,-50%) scale(.4)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.35)}}
  `});
  await page.evaluate(() => {
    const c=document.createElement('div'); c.className='__sp_cursor'; c.id='__sp_cursor';
    const r=document.createElement('div'); r.className='__sp_click'; r.id='__sp_click';
    document.body.append(c,r);
    addEventListener('mousemove',e=>{c.style.left=e.clientX+'px';c.style.top=e.clientY+'px';},{passive:true});
    addEventListener('click',e=>{
      r.style.left=e.clientX+'px';r.style.top=e.clientY+'px';r.classList.remove('show'); void r.offsetWidth; r.classList.add('show');
    },{passive:true});
  });
}

async function focus(locator) {
  try { await locator.scrollIntoViewIfNeeded({timeout:2500}); } catch {}
  try { await locator.focus({timeout:1500}); } catch {}
}

async function screenshot(page,name) {
  await page.screenshot({path:path.join(CAPTURES,name), animations:'disabled'}).catch(()=>{});
}

async function hashBody(page) {
  const txt=await page.locator('body').innerText().catch(()=>'');
  return crypto.createHash('sha1').update(clean(txt,100000)).digest('hex');
}

async function run() {
  const url = clean(arg('--url'),2000);
  const title = clean(arg('--title','Vidéo produit'),300);
  const style = clean(arg('--style','Dynamique'),80);
  const description = clean(arg('--description',''),30000);
  if(!url) throw new Error('URL manquante.');
  const u=new URL(url);
  if(!/^https?:$/.test(u.protocol)) throw new Error('URL http(s) requise.');

  resetDir(CAPTURES); resetDir(SCENES);
  for (const f of ['site-analysis.json','storyboard.json','quality-report.json','render-manifest.json','voiceover-script.txt']) {
    try { fs.rmSync(path.join(DOWNLOADS,f),{force:true}); } catch {}
  }

  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({
    viewport:{width:540,height:960},
    screen:{width:540,height:960},
    deviceScaleFactor:1,
    colorScheme:'dark',
    locale:'fr-FR',
    recordVideo:{dir:SCENES,size:{width:1080,height:1920}}
  });
  const page=await context.newPage();
  page.setDefaultTimeout(9000);
  page.setDefaultNavigationTimeout(60000);

  const runtimeErrors=[];
  page.on('pageerror',e=>runtimeErrors.push(`pageerror: ${e.message}`));
  page.on('requestfailed',r=>{
    if(!/favicon|analytics|doubleclick|google-analytics/i.test(r.url())) runtimeErrors.push(`requestfailed: ${r.url()}`);
  });

  const marks=[];
  const sessionStart=Date.now();
  const mark=(name,extra={})=>{
    marks.push({name,time:(Date.now()-sessionStart)/1000,...extra});
    console.log(`MILESTONE ${name} ${((Date.now()-sessionStart)/1000).toFixed(2)} s`);
  };

  let initial=null, finalFacts=null;
  const interactions=[];
  let lastHash='';

  try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    validateTargetDomain(url, page.url());
    await page.waitForSelector('body',{timeout:15000});
    await page.waitForFunction(()=>document.body?.innerText?.trim().length>30,null,{timeout:15000}).catch(()=>{});
    await page.waitForLoadState('networkidle',{timeout:9000}).catch(()=>{});
    await sleep(700);
    await addCursor(page);
    initial=await collectFacts(page);
    lastHash=await hashBody(page);
    mark('hero');
    await screenshot(page,'01-hero.png');

    // Adaptive user journey, up to 5 form/action steps.
    // IMPORTANT: never attempt to click a disabled button. If a framework-controlled
    // form does not react to fill(), retry with real typing + DOM events and wait
    // for the button to become enabled.
    for(let step=0; step<5; step++){
      const fields=await visibleFields(page);
      let filled=false;
      let attempted=0;

      // Important: fill ALL currently visible required-looking fields before
      // searching for an action. A multi-field form may keep its CTA disabled
      // until every required field has a value.
      for(let i=0;i<fields.length;i++){
        const meta=fields[i];
        const kind=likelyQuestion(meta);
        if(kind==='ignore') continue;
        const current=String(meta.value||'').trim();
        if(current) continue;
        const loc=await getFieldLocator(page,meta,i);
        try {
          if(await loc.isDisabled().catch(()=>false)) continue;
          attempted++;
          await focus(loc);
          const v=valueFor(kind);
          await setFieldValue(page,loc,v);
          const actual=await loc.inputValue().catch(async()=>await loc.textContent().catch(()=>''));
          if(String(actual||'').trim() !== String(v).trim()) {
            interactions.push({type:'fill-verify-failed',field:meta,kind,expected:v,actual});
            continue;
          }
          filled=true;
          interactions.push({type:'fill',field:meta,kind,example:v});
          mark(`fill-${kind}`,{step});
          await sleep(450);
        } catch(e) {
          interactions.push({type:'fill-failed',field:meta,kind,error:e.message});
        }
      }

      // Rescan after filling because some frameworks reveal additional fields.
      const remaining=await visibleFields(page);
      const emptyRequired=remaining.filter(meta=>likelyQuestion(meta)!=='ignore' && !String(meta.value||'').trim());
      if(filled || attempted>0) await screenshot(page,`step-${step+1}-filled.png`);

      // Wait a little for controlled state/validation to settle.
      let target=null;
      const waitStart=Date.now();
      while(Date.now()-waitStart<3500){
        target=await bestEnabledAction(page);
        if(target) break;
        await sleep(250);
      }

      if(!target){
        const disabledInfo=await page.locator('button:visible').evaluateAll(btns=>btns.map(b=>({text:(b.innerText||'').trim(),disabled:b.disabled}))).catch(()=>[]);
        const fieldInfo=await visibleFields(page);
        interactions.push({type:'no-enabled-action',step,filled,buttons:disabledInfo,fields:fieldInfo});
        await screenshot(page,`step-${step+1}-blocked.png`);
        // Try the simplest natural submit gesture once, but do not force-enable a disabled control.
        if(filled){
          try { await page.keyboard.press('Enter'); await sleep(900); } catch {}
          target=await bestEnabledAction(page);
        }
        if(!target) break;
      }

      const beforeUrl=page.url();
      const beforeHash=await hashBody(page);
      await focus(target.loc).catch(()=>{});
      mark('before-action',{step,label:target.label});
      await sleep(250);
      await target.loc.click({timeout:7000});
      interactions.push({type:'click',label:target.label,step});
      mark('click',{step,label:target.label});

      const startWait=Date.now();
      let changed=false;
      while(Date.now()-startWait<9000){
        const h=await hashBody(page).catch(()=>beforeHash);
        if(page.url()!==beforeUrl || h!==beforeHash){changed=true;break;}
        await sleep(350);
      }
      await page.waitForLoadState('networkidle',{timeout:4500}).catch(()=>{});
      await sleep(650);
      mark(changed?'state-changed':'state-unchanged',{step});
      await screenshot(page,`step-${step+1}-after.png`);

      const newFields=await visibleFields(page);
      const facts=await collectFacts(page);
      const text=norm(facts.visibleText);
      if(/plan|résultat|resultat|schéma|schema|actions|assistant|progression/.test(text)) {
        finalFacts=facts;
        mark('result');
        await screenshot(page,'04-result.png');
        break;
      }
      if(newFields.length>0 && changed) continue;
      if(!filled) break;
    }

    // If a result was not reached, scroll the strongest explanatory section into view.
    finalFacts=finalFacts || await collectFacts(page);
    const feature = page.locator('h2:visible,h3:visible').filter({hasText:/comment|fonctionne|idée|idee|analyse|schéma|schema|actions|assistant|progression/i}).first();
    if(await feature.count().catch(()=>0)){
      await feature.scrollIntoViewIfNeeded().catch(()=>{});
      await sleep(700);
      mark('proof');
      await screenshot(page,'05-proof.png');
    } else {
      await page.mouse.wheel(0,650).catch(()=>{});
      await sleep(700);
      mark('proof');
      await screenshot(page,'05-proof.png');
    }

    // Return to the public CTA in the same browser context (no new browser session).
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000}).catch(()=>{});
    await page.waitForSelector('body',{timeout:15000}).catch(()=>{});
    await sleep(750);
    const cta=await visibleButtons(page);
    const ct=cta.map((b,i)=>({b,i,score:buttonScore(b)})).sort((a,b)=>b.score-a.score)[0];
    if(ct && ct.score>0){
      const loc=page.locator('button:visible,[role="button"]:visible,a:visible').nth(ct.i);
      await focus(loc).catch(()=>{});
      await sleep(450);
      mark('cta',{label:ct.b.text||ct.b.aria});
      await screenshot(page,'06-cta.png');
    } else {
      mark('cta');
      await screenshot(page,'06-cta.png');
    }

    const facts=await collectFacts(page);
    if(!finalFacts) finalFacts=facts;

  } finally {
    const recorded=page.video();
    await page.close().catch(()=>{});
    await context.close().catch(()=>{});
    await browser.close().catch(()=>{});
    let raw=null;
    try { raw=await recorded.path(); } catch {}
    if(raw && fs.existsSync(raw)) fs.copyFileSync(raw,path.join(VIDEOS,'session.webm'));
  }

  // Close marks with end time
  const total = fs.existsSync(path.join(VIDEOS,'session.webm')) ? null : null;
  const timeline=[];
  const finalTime=(Date.now()-sessionStart)/1000;
  for(let i=0;i<marks.length;i++){
    const start=marks[i].time;
    const next=marks[i+1]?.time;
    timeline.push({...marks[i], end: next ?? Math.max(start+2.2, finalTime)});
  }

  const audit={
    schemaVersion:4,
    createdAt:new Date().toISOString(),
    url,title,style,description,
    initial,finalFacts,runtimeErrors,interactions,
    timeline,
    files:{session:'videos/session.webm',captures:'captures'}
  };
  fs.writeFileSync(path.join(DOWNLOADS,'site-analysis.json'),JSON.stringify(audit,null,2),'utf8');
  fs.writeFileSync(path.join(DOWNLOADS,'capture-timeline.json'),JSON.stringify({session:'videos/session.webm',marks},null,2),'utf8');

  console.log(`Exploration terminée. Marqueurs : ${marks.length}.`);
}

run().catch(e=>{ console.error(e.stack||e.message||e); process.exit(1); });
