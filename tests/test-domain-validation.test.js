const assert = require('assert');
const { validateTargetDomain } = require('../src/domain-validation');

assert.strictEqual(
  validateTargetDomain('https://spark-idea-two.vercel.app', 'https://spark-idea-two.vercel.app/demo'),
  true
);

assert.throws(
  () => validateTargetDomain('https://spark-idea-two.vercel.app', 'http://localhost:3000/'),
  /Capture localhost interdite/
);

assert.strictEqual(
  validateTargetDomain('http://localhost:3000', 'http://localhost:3000/app'),
  true
);

console.log('test-domain-validation.test.js: OK');
