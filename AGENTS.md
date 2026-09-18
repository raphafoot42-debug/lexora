# SP Studio — instructions for Jules

## Mission
Audit and harden this project into a reliable local product-demo video generator. The product accepts a real website URL, explores and interacts with the target website, captures a coherent product demonstration, plans a short vertical video, renders it, and runs a quality gate before publishing the MP4.

## Non-negotiable principles
- The target URL must be the source of the captured product footage. Never capture SP Studio's own localhost UI as the demo footage.
- Use one coherent browser session for the target site whenever possible; avoid disconnected opens/films/closes that create jarring cuts.
- Prefer real interactions and real resulting UI states over generic text cards.
- Never expose internal labels such as HOOK, PROMESSE, CTA, STORYBOARD, DEBUG, SP STUDIO, SCENE, or analysis metadata in the final video.
- No stretched, skewed, tiny, rotated, or badly cropped UI. The product must be legible in 9:16.
- Audio and video timing must be coherent. No narration that ends far before the video.
- Do not rely on Linux-only fonts, shell syntax, paths, or binaries; the target runtime is Windows + PowerShell 7.
- FFmpeg commands must be robust on the Windows build installed by the user.
- Fail closed: if the target site was not actually captured, or the final render fails quality checks, do not call the video “ready”.

## Required audit
Inspect every source file and test script. Identify and fix:
1. Browser navigation, selectors, disabled controls, dynamic rendering, popups, cookie banners, SPA route changes, and target-vs-localhost capture mistakes.
2. Form filling and submit logic, including React/Vue/vanilla input event handling.
3. Continuous capture strategy and scene extraction.
4. Storyboard generation and whether it is actually based on observed target-site content/actions.
5. 9:16 framing, zooming, crop math, orientation, whitespace, readability, and motion.
6. Typography and FFmpeg drawtext/font handling on Windows.
7. Music generation and mixing, including escaping/filter syntax.
8. Voice generation. Windows SAPI/TTS is only a fallback; the architecture must allow a neural TTS provider without rewriting the renderer.
9. Voice/video synchronization, duration policy, silence padding, ducking, and muxing.
10. Output validation with ffprobe/ffmpeg.
11. Error handling, timeouts, partial files, stale output, concurrent jobs, and clean retries.
12. PowerShell installer/start/stop/diagnostic scripts.
13. Security: validate URLs, avoid arbitrary command injection, sanitize filenames, and never log secrets.
14. Portability and dependency installation.

## Testing requirements
- Run npm install / npm ci as appropriate.
- Run syntax checks for every JS file.
- Run unit/smoke tests for form interaction.
- Run a smoke test on a real reachable website or an existing local fixture if network access is unavailable.
- Run an actual render smoke test and inspect output metadata with ffprobe.
- Verify duration, resolution 1080x1920 (or an explicitly supported equivalent), video/audio streams, and that the final MP4 opens successfully.
- Add automated assertions that fail when the target capture is localhost/SP Studio instead of the requested target URL.
- Add automated assertions that fail when the final video is mostly blank/static for no valid reason.

## Final deliverable
Do not stop after listing bugs. Implement the fixes, add/adjust tests, and leave the repository in a buildable, runnable state. Update README and changelog with the real changes and exact Windows commands.

## Voice requirements
Design voice as a provider interface. Keep a local Windows fallback for offline testing, but support a realistic neural TTS provider through environment variables. Do not hard-code API keys. Preserve original script content and provide timing metadata when possible.

## UX goal
The final result should feel like a human-made product demo for TikTok: hook, genuine interaction, visible result, concise benefit, clear CTA. Avoid template-heavy “AI slop” aesthetics.
