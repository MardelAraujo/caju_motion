---
title: CLI
description: Referência do comando caju - studio, new, build, check, render, still, snapshot, capture, beats, catalog, comandos de voz, doctor e skills add - com todas as flags, mais o create-caju.
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
| `caju check [ids...]` | valida projetos: schema, assets no disco, componentes, determinismo, lint `CAJU_*` |
| `caju render <id>` | exporta vídeo (Chromium + FFmpeg) |
| `caju still <id> --frame <n>` | exporta um quadro como imagem |
| `caju snapshot <id>` | renderiza quadros-chave numa folha de contato para revisão |
| `caju capture <url>` | captura um site e extrai cores, fontes, textos e imagens |
| `caju beats <audio>` | estima BPM, batidas e tempos fortes de uma música |
| `caju catalog` | lista transições, loops, efeitos, sobreposições, componentes e templates |
| `caju tts <id>` | gera a locução e as legendas |
| `caju voices` | lista os engines e perfis de voz do VoiceStudio |
| `caju transcribe <id>` | transcreve fala gravada em legendas |
| `caju captions <id>` | importa legendas SRT/VTT/words.json |
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
caju check [ids...] [--dir projects] [--components <pasta>] [--json]
```

Valida todos os projetos (ou os ids dados): as [regras do schema](./project-json#regras-de-validacao), assets no disco, componentes que existem e compilam, e a lint de determinismo em `components/`. Sai com código diferente de zero se houver erros.

Também mostra avisos `CAJU_*` para o que é válido mas não vai sair como esperado: nomes de movimento desconhecidos, entrada + saída maiores que o clipe, âncoras fora do quadro, texto na área insegura, texto pequeno ou com pouco contraste, trechos sem nada na tela. Lista completa: [Animação → avisos do lint](../guide/animation#avisos-do-lint). `--json` imprime erros e avisos como dados.

### `caju media`

```bash
caju media [ids...] [--dir projects] [--proxies auto|all] [--force] [--dry-run]
```

Lê todos os assets (duração, tamanho, fps, áudio, hash do conteúdo), grava o que mudou em `asset.meta` no `project.json` (com histórico) e gera miniaturas, formas de onda e, com `--proxies`, proxies de edição em `.caju/media/`. Veja [`@caju-motion/media`](./media).

### `caju tts`

```bash
caju tts <id> --text "..." | --script roteiro.txt [--provider voicestudio|placeholder|openai|elevenlabs] [--voice v]
              [--model m] [--seed n] [--name locucao] [--start s] [--speed 1] [--language pt] [--no-captions]
              [--files-only] [--force]
```

Gera a locução, põe numa trilha "Locução" e cria as legendas numa trilha "Legendas". O provedor padrão é o `voicestudio`: o [VoiceStudio](https://github.com/debpalash/VoiceStudio), grátis e local, que você instala e abre à parte (tempo exato de cada palavra). O `--model` escolhe o engine (`omnivoice` por padrão, `cosyvoice`, `voxcpm2`, `kittentts`…), o `--voice` um perfil de voz (id ou nome) do app, e o `--seed` faz a fala sair igual de novo; no máximo 4096 caracteres por `--name`. Se o VoiceStudio estiver fechado, o comando explica como abrir e nunca troca para um provedor pago. O `placeholder` é grátis, com tempos estimados; `openai` e `elevenlabs` pedem chave de API. Mesmo texto e voz reaproveitam o arquivo. Veja [Locução e legendas](../guide/voice-captions).

### `caju voices`

```bash
caju voices [--json]
```

Lista os engines (`--model`) e os perfis de voz (`--voice`) do VoiceStudio em `VOICESTUDIO_URL`. Os perfis são criados, clonados ou desenhados no app do VoiceStudio.

### `caju transcribe`

```bash
caju transcribe <id> --from video.mp4|audio.wav [--provider voicestudio|openai] [--model m] [--language pt]
                [--name n] [--captions] [--offset s] [--force]
```

Extrai a fala de um áudio ou vídeo existente com o FFmpeg e transcreve em `assets/data/<nome>.words.json` e `.srt` (`--name`, padrão o nome do arquivo). O resultado fica em cache por conteúdo do arquivo + provedor + idioma (`--force` refaz). O `--captions` também põe os clipes de legenda na trilha "Legendas", deslocados por `--offset`; num projeto com `video.ts`, só grava os arquivos. O provedor padrão é o VoiceStudio (local, grátis); `openai` usa o Whisper e a `OPENAI_API_KEY`.

### `caju captions`

```bash
caju captions <id> --from legenda.srt|.vtt|.words.json [--offset s]
```

Importa legendas como clipes de texto editáveis (substituindo as importadas antes do mesmo arquivo).

### `caju snapshot`

```bash
caju snapshot <id> [--frames 0,45,90] [--at-cuts] [--cols 4] [--resolution 540] [--out arquivo.png]
                   [--json] [--serve-url <url>] [--components <pasta>] [--dir projects]
```

Renderiza quadros-chave numa única sessão do navegador e monta uma **folha de contato** para revisão: `projects/<id>/boards/snapshot.png` (padrão), mais `boards/snapshot.json` dizendo o frame, o tempo e o motivo de cada quadro. Os agentes abrem o PNG para revisar o próprio trabalho antes de perguntar a você.

| Flag | Padrão | Significado |
|---|---|---|
| `--frames` | frame 0, o meio de cada clipe das trilhas visuais (sem repetir), marcadores, último frame | frames exatos, separados por vírgula |
| `--at-cuts` | desligado | também captura corte − 3 e corte + 6 frames em cada fronteira entre clipes seguidos nas trilhas principal/sobreposição (0,1 s / 0,2 s a 30 fps) |
| `--cols` | `4` | quadros por linha |
| `--resolution` | `540` | lado menor de cada quadro, px |
| `--out` | `boards/snapshot.png` | caminho da folha (o `.json` vai ao lado) |
| `--json` | desligado | imprime a lista de quadros em JSON |

### `caju capture`

```bash
caju capture <url> --project <id> [--width 1440] [--height 900] [--dir projects]
```

Abre um site no navegador do render e grava em `projects/<id>/assets/capture/`:

| Arquivo | Conteúdo |
|---|---|
| `page.png` | captura da página inteira |
| `viewport.png` | a primeira tela (`--width` × `--height`) |
| `tokens.json` | `{ colors: [{ hex, role: background\|text\|accent, count }], fonts: [{ family, weights, role: heading\|body }], title, description }` |
| `text.txt` | texto visível, títulos primeiro |
| `images.json` | imagens grandes e candidatos a logo: `src`, `alt`, `width`, `height` |

Use as capturas e os tokens de marca reais no vídeo em vez de redesenhar o site.

### `caju beats`

```bash
caju beats <arquivo-de-audio> [--project <id>] [--out arquivo] [--dir projects]
```

Decodifica o áudio com o FFmpeg e estima o andamento e os tempos das batidas. Grava `assets/data/<nome>.beats.json` no projeto (ou `--out`):

```json
{ "bpm": 122, "beats": [0.49, 0.98, 1.47], "downbeats": [0.49, 2.46], "durationSec": 31.2, "confidence": 0.82 }
```

Tempos em segundos; o frame de uma batida é `Math.round(seg * fps)`. `confidence` baixa indica pulso fraco ou irregular.

### `caju catalog`

```bash
caju catalog [--query "texto"] [--kind transition|loop|effect|overlay|component|template] [--json]
```

Lista o que dá para usar por nome: poses embutidas (transições e animações de entrada/saída), loops, efeitos e sobreposições com rótulos e parâmetros, os seus componentes em `components/` e os templates do `create-caju`. `--query` busca em nomes, rótulos e descrições. Procure aqui antes de construir à mão um visual com nome.

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
caju doctor [--dir projects] [--components <pasta>] [--json]
```

Diagnostica o ambiente e mostra uma dica para cada problema: Node.js, npm, FFmpeg e um navegador Chromium para o render, o build do Studio, as pastas de projetos e de componentes, permissão de escrita, espaço em disco e memória, se o VoiceStudio (o provedor de voz) está respondendo, com os engines e perfis de voz, e quais chaves de voz paga estão definidas. Sai com código diferente de zero quando uma verificação falha (avisos não contam). Rode primeiro quando algo não sobe. `--json` imprime as verificações como dados.

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
| `VOICESTUDIO_URL` | endereço do VoiceStudio para `caju tts`, `caju voices` e `caju transcribe` (padrão `http://127.0.0.1:3900`) |
| `VOICESTUDIO_API_KEY` | chave do VoiceStudio, só quando o servidor não está no seu computador |
| `OPENAI_API_KEY` | chave do `caju tts --provider openai` e do `caju transcribe --provider openai` (também pode ficar num `.env` na pasta atual) |
| `ELEVENLABS_API_KEY` | chave do `caju tts --provider elevenlabs` |
