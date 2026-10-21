---
"@caju-motion/schema": minor
"@caju-motion/audio": minor
"@caju-motion/renderer": minor
"@caju-motion/voice": minor
---

Mixagem: keyframes de `audio.volume` (rampa linear no export, também na prévia), ducking real com `settings.audio.ducking` (a música abaixa sob as trilhas `role: "voice"`, via `sidechaincompress`) e loudness final com `settings.audio.loudness` (`loudnorm`, padrão -14 LUFS / -1 dBTP). A trilha "Locução" criada pelo `caju tts` já nasce com `role: "voice"`.
