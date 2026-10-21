---
"@caju-motion/sdk": patch
"@caju-motion/cli": patch
"@caju-motion/voice": patch
"@caju-motion/studio": patch
---

Correções achadas no teste ponta a ponta: no `video.ts`, `s.overlay` e `s.adjust` vão para trilhas de efeito acima dos textos (o ajuste passa a filtrar o texto também) e não herdam o fade de saída da cena; `caju snapshot` mostra o meio das cenas marcadas em vez do quadro em que elas começam; `caju tts`, `caju transcribe` e o Studio informam quantas legendas entraram de fato quando algumas são ignoradas por sobrepor outras.
