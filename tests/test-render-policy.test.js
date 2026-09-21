const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const generator = fs.readFileSync(path.join(ROOT, 'src', 'generer-video.js'), 'utf8');
const planner = fs.readFileSync(path.join(ROOT, 'src', 'agent-planner.js'), 'utf8');
const analyser = fs.readFileSync(path.join(ROOT, 'src', 'analyser-site.js'), 'utf8');

assert.ok(generator.includes('refuse de fabriquer une scène artificielle'));
assert.ok(!generator.includes('stillSegment(image,scene,index)'));
assert.ok(planner.includes('realProductOnly: true'));
assert.ok(planner.includes('noSyntheticStillFallback: true'));
assert.ok(analyser.includes('validateTargetDomain(url, page.url())'));
assert.ok(analyser.includes('actionLocator(page, item.b)'));

console.log('test-render-policy.test.js: OK');
