---
"@caju-motion/media": minor
"@caju-motion/voice": minor
"@caju-motion/cli": minor
"@caju-motion/sdk": minor
---

Novo `@caju-motion/media` (probe sem ffprobe, miniaturas, formas de onda, proxies de edição via `caju media`, e decode exato por quadro com WebCodecs em `@caju-motion/media/web`) e novo `@caju-motion/voice` (TTS com OpenAI, ElevenLabs ou voz provisória, tempos por palavra e legendas: `caju tts`, `caju captions`, `s.captions`). O Studio usa os proxies na preview e as formas de onda do cache; `measureMedia` não precisa mais de ffprobe.
