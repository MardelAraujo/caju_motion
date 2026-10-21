---
"@caju-motion/voice": minor
"@caju-motion/cli": minor
---

Voz local e gratuita com o VoiceStudio (API compatível com a da OpenAI, porta 3900), agora o provedor padrão do `caju tts` (`--model` escolhe o engine, `--voice` o perfil, `--seed` fixa a fala). Se o VoiceStudio estiver fechado, o comando explica como abrir ou trocar de provedor, sem cair sozinho num provedor pago. Novos: `caju voices` (engines e perfis), `caju transcribe` (fala existente → words.json + SRT, com `--captions`), `transcription()`/`voiceStudioStt()`/`openAiStt()` no pacote e o VoiceStudio no `caju doctor`.
