---
title: Vídeo por código
description: Escreva um vídeo Caju em TypeScript com defineProject (video.ts) e caju build - cenas, elementos, entrada/saída, áudio, componentes e a referência completa da API.
---

# Vídeo por código

Um projeto pode ser escrito em TypeScript: `projects/<id>/video.ts` exporta (default) um `defineProject(...)`, e o `caju build <id>` o transforma em `project.json`. Cada elemento vira um **clipe separado e editável** no Studio.

```bash
npx caju build <id> [--dry-run] [--force] [--dir projects]
```

- O nome da pasta precisa ser igual ao `id` do `defineProject`.
- Não rode `caju new` antes: o `caju build` cria o `project.json`.
- O `video.ts` roda com `tsx`; não há etapa de compilação.
- Valide depois: `npx caju check <id>`.

## Exemplo completo

```ts
// projects/promo/video.ts
import { defineProject } from '@caju-motion/sdk';

export default defineProject(
  { id: 'promo', name: 'Promo', format: 'reel-9x16', background: '#171512', duration: 300 },
  (p) => {
    const { width, height } = p.settings;
    const vo1 = { durationSec: 3.4 }; // medido com measureMedia() ou ffprobe
    p.asset({ id: 'vo-01', kind: 'audio', name: 'Locução 1', src: 'assets/audio/vo/vo-01.wav', meta: vo1 });
    p.asset({ id: 'mus-bed', kind: 'audio', name: 'Trilha', src: 'assets/audio/music/mus-bed.mp3', meta: { durationSec: 30 } });
    p.asset({ id: 'logo', kind: 'image', name: 'Logo', src: 'assets/images/logo.svg', meta: { width: 600, height: 180 } });

    p.tracks(['Fundo']); // trilhas nomeadas, de baixo para cima

    // fundo do vídeo inteiro: cena própria + trilha nomeada
    p.scene('bg', 'Fundo', 0, 300, (s) => {
      s.rect(width, height, { fill: '#171512' },
             { id: 'fundo', x: width / 2, y: height / 2, locked: true, exit: false, track: 'Fundo' });
    }, { marker: false });

    p.scene('abertura', 'Abertura', 0, 150, (s) => {
      s.image('logo', 600, 180, { id: 'logo', x: width / 2, y: 520, enter: { at: 0, dur: 15, pop: true } });
      s.text('Code it.\nThen move it.', { size: 110, weight: 800, color: '#FFF8E9' },
             { id: 'titulo', x: width / 2, y: 960, enter: { at: 12, dur: 18, rise: 40 } });
    }, { exit: 12 });

    p.scene('numero', 'Número', 150, 300, (s) => {
      // componente React de components/
      s.component('CountUp', { from: 0, to: 87, suffix: '%' }, { id: 'contador', y: 820, at: [0, 120] });
    });

    // áudio: o prefixo do id escolhe a trilha (vo- → "locucao", mus- → audio-mus-N, sfx-, amb-)
    p.audioClip('vo-01', 15, Math.ceil(vo1.durationSec * 30), 'Locução 1', { id: 'vo-01-clip', fadeOut: 3 });
    p.audioClip('mus-bed', 0, 20, 'Trilha (intro)', { id: 'mus-bed-a', volume: 0.6, fadeIn: 10, fadeOut: 8 });
    p.audioClip('mus-bed', 12, 288, 'Trilha (sob a voz)', { id: 'mus-bed-b', trimIn: 12, volume: 0.2, fadeIn: 8, fadeOut: 45 });
  },
);
```

::: tip Dê um `id` estável a cada elemento
O `caju build` casa os clipes por id para saber o que mudou no Studio. Ids automáticos (`<cena>-<n>-<tipo>`) mudam quando você insere elementos.
:::

## `defineProject(meta, build)`

| Campo de `meta` | Tipo | Notas |
|---|---|---|
| `id` | `string` | igual ao nome da pasta |
| `name` | `string?` | nome exibido (padrão: `id`) |
| `format` | `FormatId` | `reel-9x16`, `feed-4x5`, `square-1x1`, `landscape-16x9`; define tamanho e fps |
| `background` | `string?` | cor hex (padrão `#000000`) |
| `duration` | `number?` | frames; omita para terminar no último clipe |

`build(p)` pode ser `async`, por exemplo para medir mídias com `measureMedia(arquivo)` (usa ffprobe):

```ts
import { defineProject, measureMedia } from '@caju-motion/sdk';

export default defineProject({ id: 'vo', format: 'reel-9x16' }, async (p) => {
  const vo = await measureMedia('projects/vo/assets/audio/vo/vo-01.wav');
  // vo = { durationSec, width?, height?, fps?, hasAudio, hasVideo }
  const frames = Math.ceil(vo.durationSec! * p.settings.fps);
  // ...
});
```

## API do projeto `p`

| Membro | Efeito |
|---|---|
| `p.settings` | `{ format, width, height, fps, duration }` do formato |
| `p.sec(segundos)` | segundos → frames inteiros (`Math.round`) |
| `p.asset({ id, kind, name?, src, meta })` | registra um asset; devolve o id |
| `p.tracks(['a', 'b'])` | declara trilhas nomeadas, de baixo para cima (abaixo de todas as camadas sem nome) |
| `p.scene(id, rótulo, from, to, s => …, { exit = 10, marker = true })` | janela absoluta `[from, to)`; cria o marcador `m-<id>`, salvo com `marker: false` |
| `p.marker(id, frame, rótulo)` | marcador `m-<id>` (ids são globais) |
| `p.audioClip(assetId, start, duration, nome, { id, volume = 1, fadeIn = 0, fadeOut = 0, trimIn = 0 })` | frames absolutos. **Sempre passe `id`** em áudio que não é locução: o padrão é `vo-<assetId>` |
| `p.component(nome, props, el)` | clipe de componente com tempos absolutos (`el.at`, padrão: o vídeo inteiro), numa trilha "Componentes" |

## API da cena `s`

Dentro de uma cena, os tempos são **relativos ao início da cena**.

| Membro | Notas |
|---|---|
| `s.text(texto, estilo, el)` | `estilo`: `{ size, weight? = 400, font? = 'Plus Jakarta Sans' ou 'Red Hat Display', color?, align?, spacing?, lh? = 1.15, bg? }`. `align` também define a âncora (left → `x` é a borda esquerda) |
| `s.rect(w, h, { fill?, stroke?, sw?, ellipse? }, el)` | forma (`ellipse: true` para círculos) |
| `s.image(assetId, w, h, el)` | o asset precisa estar registrado antes |
| `s.component(nome, props, el)` | componente próprio; `x`/`y` padrão no centro do quadro; `el.width`/`el.height` definem a caixa |
| `s.from`, `s.to`, `s.duration`, `s.id` | limites da cena |

### Opções do elemento `el`

| Opção | Significado |
|---|---|
| `id` | id estável do clipe (recomendado) |
| `x`, `y` | posição da âncora em px do projeto |
| `at: [a, b]` | janela do clipe dentro da cena. Padrão `[enter.at ?? 0, fim da cena]` |
| `enter: { at, dur = 18, rise?, dx?, pop?, easing = 'softOut' }` | opacidade 0 → 1, mais `y + rise → y`, `x + dx → x` e escala `× 0.6 → 1` com `backOut` quando `pop` |
| `exit` | frames de fade-out no fim da cena, ou `false`. Padrão: o `exit` da cena |
| `kf: { 'transform.x': [[frame, valor, easing?], …] }` | keyframes extras, frames relativos à **cena** |
| `track` | trilha nomeada (declarada com `p.tracks`). Sobreposições transbordam para "nome 2" |
| `name`, `anchorX`, `anchorY`, `scale`, `rotation`, `opacity`, `flipX`, `blend`, `locked` | campos do clipe |

## Trilhas geradas

De baixo para cima:

1. `main` (vazia).
2. Trilhas nomeadas, na ordem de `p.tracks()`.
3. Camadas visuais sem nome `camada-N`: a N-ésima forma/imagem/componente de cada cena divide a camada N.
4. Camadas de texto sem nome `texto-N`.
5. Áudio: `locucao`, depois `audio-<prefixo>-<n>`.

**Um elemento que atravessa várias cenas precisa de trilha nomeada**, senão colide com a camada da cena seguinte.

## Regerar depois de editar no Studio

O `caju build` mescla em vez de sobrescrever:

| Clipe | Resultado |
|---|---|
| Feito no Studio | preservado |
| Do código, intocado | substituído pela nova versão |
| Do código, editado no Studio | **conflito**: nada é gravado, o diff é exibido |

Use `--dry-run` para simular e `--force` para o código vencer (o arquivo anterior vai para `.caju/history/`). Veja [Caju Studio](./studio#conflicts).

## Outros exports do SDK

| Export | Uso |
|---|---|
| `measureMedia(arquivo)` | wrapper do ffprobe (duração, tamanho, fps, faixas de áudio/vídeo); respeita `FFPROBE_PATH` |
| `buildProject(def)` | roda uma definição e devolve o `Project` validado |
| `buildProjectDir(dir, opts)` | o que o `caju build` faz, por código |
| `ProjectBuilder`, `guardOverwrite` | scripts avulsos legados (`scripts/examples/builder.ts`) que gravam o `project.json` sozinhos |
