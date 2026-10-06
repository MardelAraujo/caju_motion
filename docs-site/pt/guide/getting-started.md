---
title: Primeiros passos
description: Crie um projeto Caju Motion, abra o Caju Studio, gere um vídeo a partir de código e renderize em MP4.
---

# Primeiros passos

Do zero ao MP4 em poucos minutos: crie o projeto, abra o Studio, gere por código, renderize.

## Requisitos

| Ferramenta | Versão | Para quê |
|---|---|---|
| Node.js | ≥ 20.11 (22 LTS recomendado) | CLI, Studio, `video.ts` |
| npm | ≥ 10 | pacotes / workspaces |
| Chrome ou Edge | recente | Studio e o navegador headless do `caju render` (ou `CAJU_BROWSER_PATH`) |
| FFmpeg + ffprobe | ≥ 6, opcional | o render usa um FFmpeg embutido; o do sistema ajuda a [preparar assets](./assets) |

Rode `npx caju doctor` para conferir o ambiente (veja a [CLI](../reference/cli#doctor)).

## 1. Crie um projeto

::: info Chega com o primeiro release
O `create-caju` e os pacotes `caju` estão prontos no repositório, mas **ainda não estão no npm**. Até o primeiro release, use o caminho [a partir do código-fonte](#a-partir-do-codigo-fonte) abaixo: os comandos são os mesmos, com o prefixo `npm run caju --`.
:::

```bash
npm create caju@latest meu-video
cd meu-video
```

O scaffolder pergunta o template e se deve instalar as [skills de agente](./ai-agents). Pule as perguntas com flags:

```bash
npm create caju@latest meu-video -- --template reel-legendado --yes
```

| Template | O que vem |
|---|---|
| `blank` (padrão) | Um reel 9:16 mínimo, para começar do zero |
| `reel-legendado` | 9:16 com título, legendas cronometradas pela locução e tarja de nome |
| `explainer-16x9` | Cenas 16:9 com texto, formas e um contador animado (`CountUp`) |
| `data-video` | 4:5 com gráfico de barras (`BarChart`) lido de um JSON |
| `audiograma` | 1:1 para podcast, com onda animada (`Waveform`) e áudio opcional |

| Flag | Efeito |
|---|---|
| `-t`, `--template <nome>` | escolhe o template sem perguntar |
| `-y`, `--yes` | sem perguntas: pasta `meu-video`, template `blank`, instala dependências e skills |
| `--no-install` | não instala as dependências |
| `--skills` / `--no-skills` | instala (ou não) as skills de agente |
| `--pm <nome>` | `npm`, `pnpm`, `yarn` ou `bun` (padrão: o que chamou o `create`) |

## 2. Abra o Caju Studio

```bash
npx caju studio            # http://localhost:3700
```

O Studio lista os projetos de `projects/`. Mova e corte clipes, edite textos e cores, ajuste volume e fades, arraste [componentes](./components) da aba **Componentes** e exporte. Veja [Caju Studio](./studio).

## 3. Escreva o vídeo em código (opcional)

Crie `projects/<id>/video.ts` e gere:

```ts
// projects/ola/video.ts
import { defineProject } from '@caju-motion/sdk';

export default defineProject(
  { id: 'ola', name: 'Olá', format: 'reel-9x16', background: '#171512', duration: 90 },
  (p) => {
    const { width, height } = p.settings;
    p.scene('intro', 'Intro', 0, 90, (s) => {
      s.text('Olá, Caju', { size: 120, weight: 800, color: '#F6B73C' },
             { id: 'titulo', x: width / 2, y: height / 2, enter: { at: 0, rise: 40 } });
    });
  },
);
```

```bash
npx caju build ola         # video.ts → projects/ola/project.json
npx caju check ola         # valida: schema, assets no disco, componentes, determinismo
```

Rodar `caju build` de novo regenera só os clipes que vieram do código e **preserva tudo o que foi feito no Studio**. Veja [Vídeo por código](./video-by-code).

## 4. Renderize

```bash
npx caju render ola        # → projects/ola/renders/ola-<timestamp>.mp4
npx caju still ola --frame 45 --out quadro.png
```

Ou clique em **Exportar** no Studio. Formatos, qualidade e verificação: [Render](./rendering).

## A partir do código-fonte {#a-partir-do-codigo-fonte}

Funciona hoje, antes do release no npm.

```bash
git clone https://github.com/MardelAraujo/caju_motion.git
cd caju_motion
npm install
npm run studio                                   # Studio em http://localhost:3700 (projetos em ./projects)
npm run caju -- new meu-video --format reel-9x16 # projeto vazio
npm run caju -- build exemplo-codigo             # exemplo por código → project.json
npm run build -w @caju-motion/studio             # uma vez, antes do primeiro render
npm run caju -- render exemplo-codigo            # → projects/exemplo-codigo/renders/*.mp4
npm run check                                    # typecheck + lint de determinismo + testes + fixtures
```

Todo comando aceita `--dir <pastaDeProjetos>` para trabalhar em outra pasta.

## Próximos passos

- [Estrutura do projeto](./project-structure): onde fica cada arquivo.
- [Conceitos](./concepts): `project.json`, frames, trilhas e clipes, `origin`.
- [Agentes de IA](./ai-agents): deixe o Claude Code criar vídeos para você.
