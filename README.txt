SP Studio V18
============

Objectif
--------
Créer automatiquement une courte vidéo produit verticale à partir d'une URL réelle, en montrant le produit réel plutôt qu'un template artificiel.

Pipeline
--------
1. Playwright ouvre l'URL cible dans une session mobile continue.
2. Le moteur vérifie à chaque étape que la page observée reste sur le domaine demandé.
3. Les champs visibles pertinents sont remplis et le moteur attend un vrai CTA actif ; aucun bouton désactivé n'est forcé.
4. Les moments réellement observés sont marqués dans la session.
5. Le storyboard utilise uniquement des plages vidéo observées.
6. FFmpeg extrait ces portions de la session et les assemble en 1080x1920.
7. Les captions restent courtes et intégrées à l'image ; aucun label interne de debug n'est rendu.
8. Une musique PCM légère est générée localement et mixée avec la narration lorsqu'un fournisseur TTS est disponible.
9. Le quality gate vérifie cible, session récente, résolution, durée, audio, synchronisation, texte interdit, écran noir et plans figés trop longs.
10. Si une scène réelle n'est pas disponible, le rendu échoue au lieu d'inventer une scène avec une image fixe.

Voix
----
Le moteur possède une interface TTS. Les fournisseurs OpenAI/ElevenLabs peuvent être activés par variables d'environnement. Windows SAPI reste un fallback local pour les tests. Aucun secret ne doit être commité.

Windows
-------
Runtime cible : Windows + PowerShell 7, Node 20+ / 24.x, Playwright et FFmpeg.

Installation
------------
1. Exécuter INSTALL-SP-Studio.ps1.
2. Vérifier `node --version`, `npm --version`, `ffmpeg -version` et `ffprobe -version`.
3. Lancer `node .\src\serveur.js`.
4. Ouvrir http://localhost:3000.

Tests
-----
`npm test` lance les tests de validation. Le test E2E réel nécessite Playwright installé et un accès au site cible.
