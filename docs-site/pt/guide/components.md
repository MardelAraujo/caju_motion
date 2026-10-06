---
title: Componentes
description: Componentes React animados no Caju Motion - defineComponent, props zod que viram controles no inspetor do Studio, hot reload e uso no Studio, no video.ts e no JSON.
---

# Componentes

Quando keyframes não bastam (contadores, gráficos, tarjas, texto cinético, gráficos de dados), escreva um **componente**: uma função React guiada só pelo frame atual.

- Ele aparece na aba **Componentes** do Caju Studio e pode ser usado no `video.ts`.
- As props são um schema zod; o inspetor do Studio as edita automaticamente.
- O mesmo código renderiza na preview e no `caju render`.

## Onde ficam

- Um arquivo por componente (ou `<Pasta>/index.tsx`) em **`components/`**, ao lado da pasta de projetos. Mude com `--components <pasta>`.
- O Studio compila a pasta com esbuild e **recarrega ao salvar**. Um erro de compilação aparece no Studio e a última versão boa continua funcionando.
- O `caju check` compila a pasta, roda a lint de determinismo e aponta clipes que usam componente inexistente.

## Anatomia

```tsx
// components/Selo.tsx
import { Easing, interpolate, spring, useFrame, useVideoConfig } from '@caju-motion/core';
import { defineComponent } from '@caju-motion/renderer';
import { z } from 'zod';

const schema = z.object({
  text: z.string().default('Novo').describe('Texto'),
  color: z.string().describe('color').default('#F6B73C'), // .describe('color') → seletor de cor
  size: z.number().min(24).max(400).default(96).describe('Tamanho'), // min/max → slider
  rounded: z.boolean().default(true).describe('Arredondado'),
  align: z.enum(['left', 'center', 'right']).default('center').describe('Alinhamento'),
});
type Props = z.infer<typeof schema>;

function Selo({ text, color, size, rounded, align }: Props) {
  const frame = useFrame(); // relativo ao início do clipe
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const y = interpolate(frame, [0, 12], [30, 0], { easing: Easing.softOut });
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center' }}>
      <span style={{ background: color, color: '#171512', fontFamily: "'Plus Jakarta Sans', sans-serif",
                     fontWeight: 800, fontSize: size, padding: '0.2em 0.6em', borderRadius: rounded ? '999px' : 0,
                     opacity: enter, transform: `translateY(${y}px) scale(${0.8 + 0.2 * enter})` }}>
        {text}
      </span>
    </div>
  );
}

export default defineComponent({
  name: 'Selo',           // id único gravado no project.json (props.component)
  label: 'Selo',          // nome exibido no Studio
  description: 'Selo com entrada em mola.',
  schema,
  width: 800,             // caixa padrão (px do projeto)
  height: 240,
  durationInFrames: 90,   // duração padrão ao adicionar no Studio
  component: Selo,
});
```

## `defineComponent(config)`

| Campo | Tipo | Notas |
|---|---|---|
| `name` | `string` | **obrigatório**, global, gravado em `clip.props.component`. Renomear quebra clipes existentes (o `caju check` aponta) |
| `component` | componente React | **obrigatório** |
| `label` | `string?` | título do card na aba Componentes (padrão: `name`) |
| `description` | `string?` | descrição do card |
| `schema` | objeto zod? | schema das props; valores inválidos ou ausentes voltam ao padrão |
| `defaultProps` | `object?` | mesclado por cima dos padrões do schema |
| `width`, `height` | `number?` | caixa padrão em px do projeto (padrão: o quadro inteiro) |
| `durationInFrames` | `number?` | duração padrão ao arrastar para a timeline |

O componente **preenche a caixa do clipe**: use `width: '100%'; height: '100%'`. Posição, escala, rotação, opacidade e keyframes vêm do clipe, como em qualquer elemento. Um nome de componente desconhecido mostra um placeholder visível, nunca quebra.

## Props → inspetor

| zod | Controle no Studio |
|---|---|
| `z.string()` | campo de texto |
| `z.string().describe('color')` | seletor de cor |
| `z.number().min(a).max(b)` | slider |
| `z.number()` | campo numérico |
| `z.boolean()` | chave liga/desliga |
| `z.enum([...])` | opções |
| outros tipos | campo JSON |

Outros textos em `.describe('…')` viram o rótulo do campo.

## Usando um componente

**No Studio:** aba Componentes → clique ou arraste o card para a timeline e edite as props no painel direito.

**No `video.ts`:**

```ts
s.component('Selo', { text: 'Novo' }, { id: 'selo', y: 400, at: [0, 60] });
```

**No `project.json`** (numa trilha `overlay` ou `text`):

```json
{ "id": "selo", "type": "component", "start": 0, "duration": 60,
  "transform": { "x": 540, "y": 400 },
  "props": { "component": "Selo", "text": "Novo", "width": 800, "height": 240 } }
```

## Regras

- **Determinístico:** os pixels dependem só de `(props, frame)`. Nada de `Math.random`, `Date`, timers, transições/animações CSS ou `Intl`. Não acumule estado entre frames com `useState`/`useEffect`; calcule a partir do frame (o `spring()` é analítico por isso). Veja [Conceitos](./concepts#determinismo).
- **Dados:** não faça fetch no render. Passe os dados nas props pelo `video.ts`, ou segure o render com `delayRender` e um cache no módulo.
- **Fontes:** use as famílias que o Studio carrega: `'Plus Jakarta Sans'`, `'Red Hat Display'`.
- **Dependências:** `zod` e seus helpers entram no bundle do componente. `react`, `@caju-motion/core` e `@caju-motion/renderer` vêm do Studio, numa cópia única compartilhada. Não importe bibliotecas de UI que tragam o próprio React.
- **Autoteste:** renderize o mesmo frame duas vezes e fora de ordem (120 → 30 → 120); o resultado tem que ser idêntico.

A API do runtime (`useFrame`, `interpolate`, `spring`, `Sequence`…) está em [@caju-motion/core](../reference/core).
