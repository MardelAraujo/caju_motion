---
"@caju-motion/renderer": minor
"@caju-motion/cli": minor
---

O renderer passa a desenhar `transitionIn/Out` e `animationIn/Out/Loop` (fade, slide, rise, drop, zoom, pop, blur, spin, wipe, iris; loops pulse, float, wiggle, breathe, spin), `effects[]` como filtros CSS animáveis por keyframe, clipes `effect` (vinheta, faixas de cinema, cor, flash, granulado) e clipes `adjustment`, que filtram tudo o que está abaixo. A saída espelha a entrada (mesmo lado, easing espelhado). O `caju check` ganhou lint com códigos estáveis (`CAJU_UNKNOWN_TRANSITION`, `CAJU_MOTION_OVERLAP`…).
