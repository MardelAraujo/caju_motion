---
title: '@caju-motion/player'
description: Embuta um vídeo Caju Motion (project.json) em qualquer app React com o componente <Player> - controles, áudio, componentes próprios, faixa de reprodução, loop e API imperativa via ref.
---

# `@caju-motion/player`

O `<Player>` toca um `project.json` dentro do seu app React, com o mesmo renderer do Studio e do `caju render`. Nada é codificado: os quadros são desenhados ao vivo como DOM, então a preview bate com o export.

```bash
npm install @caju-motion/player react react-dom
```

```tsx
import { Player } from '@caju-motion/player';
import project from './projects/meu-video/project.json';

export function Hero() {
  return <Player project={project} assetBase="/videos/meu-video/" controls loop autoPlay initiallyMuted />;
}
```

O player ocupa a largura do elemento pai e mantém a proporção do vídeo. Para uma caixa fixa, passe um `style` com `width` e `height` (ex.: 360 × 640). O vídeo é encaixado (contain) e centralizado.

## Assets

O `src` dos assets no `project.json` é relativo (`assets/images/logo.png`). Diga ao player onde eles são servidos:

| Prop | URL usada para cada asset |
|---|---|
| `assetBase="/videos/x/"` | `/videos/x/` + `asset.src` (cada trecho do caminho codificado) |
| `resolveAsset={(asset) => url}` | o que você retornar; tem prioridade sobre `assetBase` |
| nenhum | `asset.src` como está |

Copie a pasta `assets/` do projeto para os arquivos estáticos do app (ex.: `public/videos/x/assets/`) e aponte o `assetBase` para a pasta de cima.

## Componentes próprios

Passe as definições `defineComponent` usadas pelo projeto. Elas valem só para este player, então dois players na mesma página podem usar componentes diferentes.

```tsx
import * as components from './components/Counter';
<Player project={project} components={Object.values(components)} />
```

## Props

| Prop | Padrão | |
|---|---|---|
| `project` | — | o objeto do `project.json` (qualquer versão de schema conhecida; é migrado e validado) |
| `assetBase`, `resolveAsset` | — | veja [Assets](#assets) |
| `components` | `[]` | definições `defineComponent` para clipes `component` |
| `controls` | `false` | play/pausa, barra de busca, tempo, mudo |
| `autoPlay` | `false` | o navegador bloqueia autoplay com som até um clique; combine com `initiallyMuted` |
| `loop` | `false` | volta para `inFrame` depois de `outFrame` |
| `inFrame`, `outFrame` | vídeo inteiro | frames tocados (inclusivo) |
| `initialFrame` | `inFrame` | |
| `playbackRate` | `1` | |
| `initiallyMuted`, `initialVolume` | `false`, `1` | |
| `clickToPlay` | `controls` | clicar no vídeo alterna play/pausa |
| `keyboard` | `true` | com o player em foco: Espaço alterna, ←/→ andam um frame (Shift: um segundo) |
| `style`, `className` | — | na caixa externa |
| `onPlay`, `onPause`, `onEnded`, `onFrameUpdate(frame)` | — | `onEnded` dispara depois de `onPause` quando a reprodução chega em `outFrame` sem `loop` |
| `onError(mensagem)` | — | projeto inválido; o player mostra o erro do schema em vez de quebrar |

## API via ref

```tsx
import { useRef } from 'react';
import { Player, type PlayerRef } from '@caju-motion/player';

const ref = useRef<PlayerRef>(null);
<Player ref={ref} project={project} />;

ref.current?.seekTo(90);
ref.current?.play();
```

| Método | |
|---|---|
| `play()`, `pause()`, `toggle()` | `play()` no fim recomeça de `inFrame` |
| `seekTo(frame)` | limitado a `inFrame`–`outFrame` |
| `getCurrentFrame()`, `isPlaying()` | |
| `mute()`, `unmute()`, `isMuted()` | |
| `setVolume(0–1)`, `getVolume()` | multiplica o volume de cada clipe |
| `getContainer()` | o `div` externo (ex.: para tela cheia) |

## Observações

- Requer React 19.
- As trilhas de áudio tocam em elementos `<audio>` sincronizados ao frame. Para áudio exato por frame, gere um arquivo com [`caju render`](../guide/rendering).
- O player roda no navegador. No render do servidor ele sai oculto, e o vídeo aparece depois da hidratação, quando ele mede a própria caixa.
