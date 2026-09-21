const assert = require('assert');
const { validateTargetDomain } = require('../src/domain-validation');

assert.strictEqual(validateTargetDomain('https://spark-idea-two.vercel.app', 'https://spark-idea-two.vercel.app/demo'), true);
assert.strictEqual(validateTargetDomain('https://www.spark-idea-two.vercel.app', 'https://spark-idea-two.vercel.app/demo'), true);
assert.throws(() => validateTargetDomain('https://spark-idea-two.vercel.app', 'http://localhost:3000/'), /Capture hors cible/);
assert.throws(() => validateTargetDomain('https://spark-idea-two.vercel.app', 'https://example.com/'), /Capture hors cible/);
assert.strictEqual(validateTargetDomain('http://localhost:3000', 'http://localhost:3000/app'), true);
assert.throws(() => validateTargetDomain('http://localhost:3000', 'http://127.0.0.1:3000/app'), /Capture hors cible/);

console.log('test-domain-validation.test.js: OK');
