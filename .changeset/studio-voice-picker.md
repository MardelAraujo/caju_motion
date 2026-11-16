---
"@caju-motion/voice": minor
"@caju-motion/cli": minor
"@caju-motion/studio": minor
"@caju-motion/server": patch
---

Painel Voz do Studio: escolha de voz com descrição e amostra (as amostras prontas da ElevenLabs são grátis; nas outras, uma frase curta é gerada uma vez e reaproveitada), modelo por provedor e campo para a chave da OpenAI/ElevenLabs, testada no provedor e gravada no `.env` local (só aceita pedidos do próprio computador). Novos no pacote: `OPENAI_VOICES`, `elevenLabsVoices()`, `checkApiKey()`; rotas `GET /api/voice/voices`, `POST /api/voice/preview` e `PUT /api/voice/keys`.
