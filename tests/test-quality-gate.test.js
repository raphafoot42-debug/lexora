const assert = require('assert');

function checkCaptionQuality(captions) {
  const failures = [];
  for (const cap of captions) {
    if (/\b(HOOK|PROMESSE|CTA|STORYBOARD|DEBUG|SP STUDIO|SCENE_\d+)\b/i.test(cap)) {
      failures.push(`Texte technique/debug: ${cap}`);
    }
  }
  return failures;
}

assert.deepStrictEqual(checkCaptionQuality(['Tu as une idée', 'Voilà le résultat']), []);
assert.strictEqual(checkCaptionQuality(['[HOOK] Découvre la solution', 'CTA : clique ici']).length, 2);

console.log('test-quality-gate.test.js: OK');
