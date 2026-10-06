# components/

Componentes React animados do projeto. Cada arquivo `.tsx` aqui que exporta um
`defineComponent(...)` aparece na aba **Componentes** do Caju Studio e pode ser usado
no `video.ts` com `s.component('Nome', { ...props })`.

```tsx
import { interpolate, useFrame } from '@caju-motion/core';
import { defineComponent } from '@caju-motion/renderer';
import { z } from 'zod';

export default defineComponent({
  name: 'Pulso',
  schema: z.object({ color: z.string().describe('color').default('#F6B73C') }),
  width: 400,
  height: 400,
  component: ({ color }) => {
    const frame = useFrame();
    const s = interpolate(frame % 30, [0, 15, 30], [0.8, 1, 0.8]);
    return <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: color, transform: `scale(${s})` }} />;
  },
});
```

Regra de ouro: tudo o que aparece na tela deve depender só do frame (`useFrame()`),
nunca de `Math.random()`, `Date.now()` ou timers — o `caju check` acusa esses usos.
