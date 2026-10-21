---
"@caju-motion/cli": minor
"@caju-motion/renderer": minor
"@caju-motion/renderer-node": minor
"@caju-motion/media": minor
"@caju-motion/sdk": patch
---

Ferramentas para agentes gerarem e revisarem vídeos:
- `caju snapshot` (contact sheet de quadros-chave e cortes, numa sessão só do navegador; `renderStills`)
- `caju catalog` (poses, loops, efeitos, sobreposições, componentes e templates, com busca)
- `caju capture` (site → screenshots, cores, fontes, textos e imagens; `captureSite`)
- `caju beats` (BPM, batidas e compassos; `analyzeBeats`/`detectBeats`)
- lint de leitura no `caju check`: `CAJU_OFFSCREEN`, `CAJU_UNSAFE_AREA`, `CAJU_TEXT_TOO_SMALL`, `CAJU_LOW_CONTRAST`, `CAJU_EMPTY_FRAME`
- `--json` em check, doctor, snapshot, catalog, voices, beats e capture.
