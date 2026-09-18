const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getTTSProvider, SilentFallbackProvider, OpenAITTSProvider, ElevenLabsProvider } = require('../src/tts-provider');

(async () => {
  const tmpOut = path.join(__dirname, 'tmp-tts-test.wav');
  try {
    const silentProvider = new SilentFallbackProvider();
    const res = await silentProvider.synthesize('Bonjour et bienvenue sur Spark Idea.', tmpOut);
    assert.strictEqual(res.success, true);
    assert.strictEqual(fs.existsSync(tmpOut), true);
    assert.ok(fs.statSync(tmpOut).size > 100);

    const openai = new OpenAITTSProvider('');
    const oRes = await openai.synthesize('Test', tmpOut);
    assert.strictEqual(oRes.success, false);
    assert.ok(oRes.message.includes('OPENAI_API_KEY'));

    const eleven = new ElevenLabsProvider('');
    const eRes = await eleven.synthesize('Test', tmpOut);
    assert.strictEqual(eRes.success, false);
    assert.ok(eRes.message.includes('ELEVENLABS_API_KEY'));

    const defaultProv = getTTSProvider();
    assert.ok(defaultProv);

    console.log('test-tts-provider.test.js: OK');
  } finally {
    if (fs.existsSync(tmpOut)) fs.rmSync(tmpOut, { force: true });
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
