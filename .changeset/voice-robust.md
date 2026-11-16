---
"@caju-motion/voice": minor
"@caju-motion/cli": patch
"@caju-motion/studio": patch
---

Locução mais robusta: se o alinhamento das palavras (transcrição do áudio gerado) falhar, o áudio é mantido e as legendas usam tempos estimados, com aviso no `caju tts` e no Studio. Textos acima do limite do provedor (4096 caracteres no VoiceStudio e na OpenAI) são divididos em frases, gerados em partes e juntados num áudio só (`splitScript`, `TtsProvider.maxInput`). O idioma agora entra na chave de cache, e trocar de formato (ex.: `.wav` provisório → `.mp3`) apaga o áudio antigo da locução.
