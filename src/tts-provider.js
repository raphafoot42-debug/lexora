const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const https = require('https');

/**
 * Base TTS Provider Interface
 */
class TTSProvider {
  constructor(name = 'base') {
    this.name = name;
  }

  async synthesize(text, outputPath) {
    throw new Error('synthesize() non implémenté.');
  }
}

/**
 * OpenAI Neural TTS Provider
 */
class OpenAITTSProvider extends TTSProvider {
  constructor(apiKey = process.env.OPENAI_API_KEY, voice = process.env.OPENAI_VOICE || 'nova') {
    super('openai');
    this.apiKey = apiKey;
    this.voice = voice;
  }

  async synthesize(text, outputPath) {
    if (!this.apiKey) {
      return { success: false, provider: this.name, isNeural: true, message: 'OPENAI_API_KEY manquante.' };
    }

    return new Promise((resolve) => {
      const payload = JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: this.voice,
        response_format: 'mp3'
      });

      const req = https.request('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 20000
      }, (res) => {
        if (res.statusCode !== 200) {
          let errData = '';
          res.on('data', chunk => errData += chunk);
          res.on('end', () => resolve({
            success: false, provider: this.name, isNeural: true,
            message: `API OpenAI TTS code ${res.statusCode}: ${errData.slice(0, 300)}`
          }));
          return;
        }

        const fileStream = fs.createWriteStream(outputPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close(() => resolve({
            success: true, provider: this.name, isNeural: true, filePath: outputPath
          }));
        });
      });

      req.on('error', (err) => resolve({
        success: false, provider: this.name, isNeural: true, message: err.message
      }));
      req.write(payload);
      req.end();
    });
  }
}

/**
 * ElevenLabs Neural TTS Provider
 */
class ElevenLabsProvider extends TTSProvider {
  constructor(apiKey = process.env.ELEVENLABS_API_KEY, voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM') {
    super('elevenlabs');
    this.apiKey = apiKey;
    this.voiceId = voiceId;
  }

  async synthesize(text, outputPath) {
    if (!this.apiKey) {
      return { success: false, provider: this.name, isNeural: true, message: 'ELEVENLABS_API_KEY manquante.' };
    }

    return new Promise((resolve) => {
      const payload = JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      });

      const req = https.request(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 20000
      }, (res) => {
        if (res.statusCode !== 200) {
          let errData = '';
          res.on('data', chunk => errData += chunk);
          res.on('end', () => resolve({
            success: false, provider: this.name, isNeural: true,
            message: `API ElevenLabs TTS code ${res.statusCode}: ${errData.slice(0, 300)}`
          }));
          return;
        }

        const fileStream = fs.createWriteStream(outputPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close(() => resolve({
            success: true, provider: this.name, isNeural: true, filePath: outputPath
          }));
        });
      });

      req.on('error', (err) => resolve({
        success: false, provider: this.name, isNeural: true, message: err.message
      }));
      req.write(payload);
      req.end();
    });
  }
}

/**
 * Windows SAPI / Local System TTS Provider
 */
class WindowsSAPIProvider extends TTSProvider {
  constructor() {
    super('windows-sapi');
  }

  async synthesize(text, outputPath) {
    if (process.platform !== 'win32') {
      return { success: false, provider: this.name, isNeural: false, message: 'Windows SAPI uniquement sous Windows.' };
    }

    const cleanText = text.replace(/'/g, "''").replace(/\r?\n/g, ' ');
    const psScript = `
      Add-Type -AssemblyName System.Speech;
      $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
      $synth.SetOutputToWaveFile('${outputPath.replace(/'/g, "''")}');
      $synth.Speak('${cleanText}');
      $synth.Dispose();
    `;

    const res = spawnSync('powershell', ['-NoProfile', '-Command', psScript], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15000
    });

    if (res.status === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 100) {
      return { success: true, provider: this.name, isNeural: false, filePath: outputPath };
    }

    return {
      success: false,
      provider: this.name,
      isNeural: false,
      message: (res.stderr || res.stdout || 'PowerShell SAPI failed').slice(0, 500)
    };
  }
}

/**
 * Silent Fallback Audio Provider
 */
class SilentFallbackProvider extends TTSProvider {
  constructor() {
    super('silent-fallback');
  }

  async synthesize(text, outputPath) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
    const durationSec = Math.max(1.8, Math.min(8.0, words / 2.8));
    const sampleRate = 48000;
    const numSamples = Math.ceil(sampleRate * durationSec);
    const numChannels = 1;
    const bytesPerSample = 2;
    const dataSize = numSamples * numChannels * bytesPerSample;

    const buffer = Buffer.alloc(44 + dataSize);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
    buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    fs.writeFileSync(outputPath, buffer);
    return {
      success: true,
      provider: this.name,
      isNeural: false,
      filePath: outputPath,
      duration: durationSec,
      message: 'Silence généré à la durée estimée.'
    };
  }
}

function readLocalConfig() {
  const cfgPath = path.join(__dirname, '..', 'config.json');
  if (fs.existsSync(cfgPath)) {
    try { return JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
  }
  return {};
}

function getTTSProvider() {
  const cfg = readLocalConfig();
  const preferred = (process.env.TTS_PROVIDER || cfg.ttsProvider || cfg.TTS_PROVIDER || '').toLowerCase();
  const openaiKey = process.env.OPENAI_API_KEY || cfg.openaiApiKey || cfg.OPENAI_API_KEY;
  const elevenKey = process.env.ELEVENLABS_API_KEY || cfg.elevenlabsApiKey || cfg.ELEVENLABS_API_KEY;
  const elevenVoice = process.env.ELEVENLABS_VOICE_ID || cfg.elevenlabsVoiceId || cfg.ELEVENLABS_VOICE_ID || undefined;
  const openaiVoice = process.env.OPENAI_VOICE || cfg.openaiVoice || undefined;

  if (preferred === 'openai' || (openaiKey && !openaiKey.includes('COLLE_TA_CLE') && preferred !== 'none')) {
    return new OpenAITTSProvider(openaiKey, openaiVoice || process.env.OPENAI_VOICE || 'nova');
  }
  if (preferred === 'elevenlabs' || (elevenKey && !elevenKey.includes('COLLE_TA_CLE') && preferred !== 'none')) {
    return new ElevenLabsProvider(elevenKey, elevenVoice || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM');
  }
  if (preferred === 'windows' || (process.platform === 'win32' && preferred !== 'none')) {
    return new WindowsSAPIProvider();
  }

  return new SilentFallbackProvider();
}

module.exports = {
  TTSProvider,
  OpenAITTSProvider,
  ElevenLabsProvider,
  WindowsSAPIProvider,
  SilentFallbackProvider,
  getTTSProvider
};
