---
"@caju-motion/studio": minor
"@caju-motion/cli": minor
---

Painel "Voz" no Studio: gera a locução (VoiceStudio local por padrão, ou voz provisória/OpenAI/ElevenLabs) com legendas, opcionalmente no playhead, e cria legendas automáticas de qualquer áudio/vídeo do projeto. Rotas `GET /api/voice`, `POST /api/projects/:id/tts` e `POST /api/projects/:id/transcribe`, com a mesma checagem de versão do salvamento.
