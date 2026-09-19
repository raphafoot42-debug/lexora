const { chromium } = require('@playwright/test');

const url = process.argv[2] || 'https://spark-idea-two.vercel.app';

function kindFor(field) {
  const t = [field.placeholder, field.name, field.id, field.aria, field.label, field.type].join(' ').toLowerCase();
  if (/email|e-mail|mot de passe|password|téléphone|phone/.test(t)) return 'ignore';
  if (/prénom|prenom|first name|nom/.test(t)) return 'name';
  if (/idée|idee|projet|concept|description|décris|decris|message|objectif|business|produit/.test(t)) return 'idea';
  return field.tag === 'textarea' ? 'idea' : 'text';
}
function valueFor(kind) {
  if (kind === 'name') return 'Alex';
  if (kind === 'idea') return 'Une application qui aide les artisans à trouver leurs premiers clients.';
  return 'Je veux transformer cette idée en projet concret.';
}
async function fields(page) {
  return page.locator('input:visible,textarea:visible,[contenteditable="true"]:visible').evaluateAll(els => els.map(el => ({
    tag: el.tagName.toLowerCase(), type: el.type || '', name: el.name || '', id: el.id || '',
    placeholder: el.placeholder || '', aria: el.getAttribute('aria-label') || '', label: '',
    value: el.value || el.textContent || '', disabled: !!el.disabled
  })));
}

(async()=>{
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:540,height:960},locale:'fr-FR'});
  try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForSelector('input:visible,textarea:visible',{timeout:15000});

    const before = await page.locator('button:visible').evaluateAll(els=>els.map(e=>({text:(e.innerText||'').trim(),disabled:e.disabled})));
    const filled=[];

    // Fill every currently visible, non-ignored empty field.
    for (let pass=0; pass<4; pass++) {
      const fs = await fields(page);
      let did=false;
      for (let i=0;i<fs.length;i++) {
        const meta=fs[i];
        const kind=kindFor(meta);
        if (kind==='ignore' || meta.disabled || String(meta.value).trim()) continue;
        const loc=page.locator('input:visible,textarea:visible,[contenteditable="true"]:visible').nth(i);
        const v=valueFor(kind);
        await loc.click().catch(()=>{});
        await loc.press('Control+A').catch(()=>{});
        await loc.pressSequentially(v,{delay:20,timeout:5000}).catch(async()=>{ await loc.fill(v).catch(()=>{}); });
        await page.waitForTimeout(500);
        const actual=await loc.inputValue().catch(async()=>await loc.textContent().catch(()=>''));
        filled.push({index:i,kind,placeholder:meta.placeholder,expected:v,actual});
        did=true;
      }
      if (!did) break;
    }

    await page.waitForTimeout(1200);
    const afterFields = await fields(page);
    const after = await page.locator('button:visible').evaluateAll(els=>els.map(e=>({text:(e.innerText||'').trim(),disabled:e.disabled})));
    const enabledAction = after.find(x=>/analyser|analyse|commencer|continuer|lancer|générer|generer|suivant|tester|essayer/i.test(x.text) && !x.disabled) || null;

    console.log(JSON.stringify({url,before,filled,afterFields,after,enabledAction,ok:Boolean(enabledAction)},null,2));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
