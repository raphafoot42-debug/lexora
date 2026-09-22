SP Studio V18
============

Moteur autonome de génération de vidéos produit pour TikTok / Shorts / Reels.

Pipeline V18
------------
1. Validation stricte du domaine cible (interdiction de localhost sur URL distante).
2. Navigation Playwright adaptative avec gestion des popups de consentement et formulaires réactifs.
3. Enregistrement d'une session WebM continue.
4. Construction du storyboard basé uniquement sur les milestones réellement observés.
5. Génération de narration vocale neuronale via ElevenLabs ou OpenAI Audio (config.json).
6. Rendu vidéo local FFmpeg 1080x1920 avec sous-titres encadrés et audio-ducking.
7. Contrôle qualité automatisé (Quality Gate) validant le format 9:16, l'absence de trames noires et la synchronisation audio.

Configuration des clés (config.json)
------------------------------------
Créez un fichier `config.json` à la racine :

{
  "ttsProvider": "elevenlabs",
  "elevenlabsApiKey": "VOTRE_CLE_ELEVENLABS"
}

Lancement
---------
1. `npm install`
2. `npm start` (ou double-clic sur START-SP-Studio.ps1)
3. Ouvrez `http://localhost:3000`
