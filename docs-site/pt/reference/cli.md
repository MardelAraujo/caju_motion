---
title: CLI
description: Referência do comando caju - studio, new, build, check, render, still, doctor e skills add - com todas as flags, mais o create-caju.
---

# CLI

O comando `caju` vem do `@caju-motion/cli` (`caju-motion` é um alias). O pacote curto `caju` faz `npx caju <comando>` funcionar sem instalar nada.

::: info Chega com o primeiro release
Os pacotes ainda não estão no npm. No checkout do repositório, rode os mesmos comandos como `npm run caju -- <comando>` (e `npm run studio` para o Studio em modo de desenvolvimento).
:::

```text
caju <comando> [args] [--flags]
caju --help | -h
caju --version | -v
```

## Comandos

| Comando | O que faz |
|---|---|
| `caju studio` | abre o Caju Studio no navegador |
| `caju new <id>` | cria um projeto vazio |
| `caju build [ids...]` | gera o `project.json` a partir do `video.ts`, preservando as edições do Studio |
| `caju check [ids...]` | valida projetos: schema, assets no disco, componentes, determinismo |
| `caju render <id>` | exporta vídeo (Chromium + FFmpeg) |
| `caju still <id> --frame <n>` | exporta um quadro como imagem |
| `caju doctor` | confere o ambiente |
| `caju skills add` | instala as skills de agente |

### `caju studio`

```bash
caju studio [--dir projects] [--port 3700] [--open] [--components <pasta>]
```

| Flag | Padrão | Significado |
|---|---|---|
| `--dir` | `projects` | pasta de projetos |
| `--port` | `3700` | porta HTTP |
| `--open` | desligado | abre o navegador |
| `--components` | `<dir>/../components` | pasta de componentes |
| `--dev` | desligado | modo de desenvolvimento do Studio, com Vite/HMR (só no repositório) |

### `caju new`

```bash
caju new <id> [--format reel-9x16] [--dir projects]
```

Cria `<dir>/<id>/project.json` e `assets/`. `--format`: `reel-9x16` (padrão), `feed-4x5`, `square-1x1`, `landscape-16x9`. Desnecessário em projetos por código: o `caju build` cria o arquivo.

### `caju build`

```bash
caju build [ids...] [--dir projects] [--force] [--dry-run]
```

Roda `<dir>/<id>/video.ts` (`defineProject`) e mescla no `project.json`. Sem ids, gera todos os projetos que têm `video.ts`.

| Flag | Significado |
|---|---|
| `--dry-run` | mostra o que mudaria, sem gravar |
| `--force` | regenera mesmo com clipes de código editados no Studio (o código vence; o arquivo anterior vai para `.caju/history/`) |

Veja [Vídeo por código](../guide/video-by-code) e [mesclagem](../guide/studio#conflicts).

### `caju check`

```bash
caju check [ids...] [--dir projects] [--components <pasta>]
```

Valida todos os projetos (ou os ids dados): as [regras do schema](./project-json#regras-de-validacao), assets no disco, componentes que existem e compilam, e a lint de determinismo em `components/`. Sai com código diferente de zero se houver erros.

### `caju media`

```bash
caju media [ids...] [--dir projects] [--proxies auto|all] [--force] [--dry-run]
```

Lê todos os assets (duração, tamanho, fps, áudio, hash do conteúdo), grava o que mudou em `asset.meta` no `project.json` (com histórico) e gera miniaturas, formas de onda e, com `--proxies`, proxies de edição em `.caju/media/`. Veja [`@caju-motion/media`](./media).

### `caju tts`

```bash
caju tts <id> --text "..." | --script roteiro.txt [--provider placeholder|openai|elevenlabs] [--voice v] [--model m]
              [--name locucao] [--start s] [--speed 1] [--language pt] [--no-captions] [--files-only] [--force]
```

Gera a locução, põe numa trilha "Locução" e cria as legendas numa trilha "Legendas". O provedor padrão é o `placeholder` (grátis, tempos estimados). Mesmo texto e voz reaproveitam o arquivo. Veja [Locução e legendas](../guide/voice-captions).

### `caju captions`

```bash
caju captions <id> --from legenda.srt|.vtt|.words.json [--offset s]
```

Importa legendas como clipes de texto editáveis (substituindo as importadas antes do mesmo arquivo).

### `caju render`

```bash
caju render <id> [--out arquivo] [--format mp4-h264] [--resolution 1080] [--fps 30] [--quality high]
                 [--no-audio] [--concurrency 2] [--serve-url <url>] [--components <pasta>] [--dir projects]
```

| Flag | Valores | Padrão |
|---|---|---|
| `--out`, `-o` | caminho de saída | `<projeto>/renders/<id>-<timestamp>.<ext>` |
| `--format` | `mp4-h264`, `mp4-h265`, `mov-prores`, `webm-vp9`, `gif`, `png-seq` | `mp4-h264` |
| `--resolution` | lado menor: `720`, `1080`, `1440`, `2160` | nativa (a maior ≤ projeto) |
| `--fps` | inteiro 1–120 | fps do projeto |
| `--quality` | `draft`, `good`, `high`, `max` | `high` |
| `--no-audio` | — | com áudio |
| `--concurrency` | páginas do navegador em paralelo, `1`–`2` | 2 |
| `--serve-url` | URL de um Studio aberto para reaproveitar | servidor interno |

### `caju still`

```bash
caju still <id> --frame <n> [--out quadro.png] [--resolution 1080] [--serve-url <url>] [--dir projects]
```

### `caju doctor` {#doctor}

```bash
caju doctor [--dir projects] [--components <pasta>]
```

Diagnostica o ambiente e mostra uma dica para cada problema: Node.js, npm, FFmpeg e um navegador Chromium para o render, o build do Studio, as pastas de projetos e de componentes, permissão de escrita, espaço em disco e memória. Sai com código diferente de zero quando uma verificação falha (avisos não contam). Rode primeiro quando algo não sobe.

### `caju skills add`

```bash
caju skills add [--target <pasta>] [--agents claude|all]
```

| Flag | Padrão | Significado |
|---|---|---|
| `--target` | `.` | pasta do projeto; as skills vão para `<target>/.claude/skills/` |
| `--agents` | `claude` | `all` também mantém um bloco marcado em `<target>/AGENTS.md`, lido por outros agentes (Codex, Cursor, Gemini…) |

Veja [Agentes de IA](../guide/ai-agents).

## `create-caju`

```bash
npm create caju@latest [pasta] [-- opções]
```

| Flag | Significado |
|---|---|
| `-t`, `--template <nome>` | `blank` (padrão), `reel-legendado`, `explainer-16x9`, `data-video`, `audiograma` |
| `-y`, `--yes` | sem perguntas: pasta `meu-video`, template `blank`, instala dependências e skills |
| `--no-install` | não instala as dependências |
| `--skills` / `--no-skills` | instala (ou não) as skills de agente |
| `--pm <nome>` | `npm`, `pnpm`, `yarn` ou `bun` (padrão: o que chamou o `create`) |

## Variáveis de ambiente

| Variável | Efeito |
|---|---|
| `CAJU_BROWSER_PATH` | executável do Chromium/Chrome/Edge usado no render |
| `CAJU_FFMPEG_PATH` | executável do FFmpeg usado no render (padrão: embutido) |
| `OPENAI_API_KEY` | chave do `caju tts --provider openai` |
| `ELEVENLABS_API_KEY` | chave do `caju tts --provider elevenlabs` |
