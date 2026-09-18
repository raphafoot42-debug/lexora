SP Studio V14
============

Objectif
--------
Créer une vidéo produit courte et crédible à partir d'une URL, sans demander à l'utilisateur de fournir des captures ou six vidéos préparées à la main.

Pipeline
--------
1. Playwright ouvre le site avec un vrai viewport mobile.
2. Une seule session navigateur continue est enregistrée.
3. Le moteur explore le parcours utilisateur et tente de remplir les champs de manière adaptative.
4. Le moteur marque les moments utiles de cette session.
5. Un storyboard court est construit à partir des moments réellement observés.
6. FFmpeg extrait les portions vidéo de la session au lieu de recréer le montage à partir d'images fixes.
7. Les textes sont courts, alignés, cohérents et placés directement sur l'image; pas de grandes cartes "HOOK/CTA".
8. Une musique légère est générée en PCM par Node, puis mixée à faible volume.
9. Un contrôle qualité vérifie le format, la durée et la présence audio.

Voix
----
V14 ne force pas une voix Windows dans le rendu. Le script de narration est écrit dans downloads/voiceover-script.txt pour un futur branchement vers une voix neuronale réaliste.

Important
---------
La V14 doit être testée sur la vraie machine Windows avec le vrai site cible. Le build Linux ne peut pas valider les interactions réseau de la machine utilisateur.


V17 : le contrôle qualité accepte les formats courts 12–30 s ; 18–22 s reste la cible idéale et produit un avertissement seulement.
