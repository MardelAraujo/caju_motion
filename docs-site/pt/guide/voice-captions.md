---
title: Locução e legendas
description: Gere a locução com texto para fala (VoiceStudio, local e grátis, por padrão; OpenAI, ElevenLabs ou uma voz provisória), transcreva fala gravada, obtenha o tempo de cada palavra e adicione legendas como clipes de texto editáveis - pela CLI, de arquivos SRT/VTT ou no video.ts.
---

# Locução e legendas

O `@caju-motion/voice` transforma um roteiro em arquivo de locução mais o tempo de cada palavra, e transforma esses tempos em legendas. As legendas são clipes de texto comuns numa trilha "Legendas", então dá para mudar o estilo ou corrigir no Studio.

## Pela CLI

```bash
# voz de verdade, local e grátis, com o VoiceStudio aberto (o provedor padrão)
npx caju tts meu-video --text "Todo vídeo começa com uma ideia. O Caju transforma código em vídeo." --language pt
npx caju voices                                     # engines e perfis de voz disponíveis
npx caju tts meu-video --script roteiro.txt --model omnivoice --voice <perfil> --seed 7 --language pt

# voz provisória grátis (um tom suave + tempos estimados), sem o VoiceStudio
npx caju tts meu-video --text "Todo vídeo começa com uma ideia." --provider placeholder

# vozes pagas na nuvem
OPENAI_API_KEY=sk-... npx caju tts meu-video --script roteiro.txt --provider openai --voice nova --language pt
ELEVENLABS_API_KEY=... npx caju tts meu-video --script roteiro.txt --provider elevenlabs --voice <voice_id>
```

O `caju tts` grava no projeto:

| Arquivo | Conteúdo |
|---|---|
| `assets/audio/vo/<nome>.mp3` (ou `.wav`) | a locução (`--name`, padrão `locucao`) |
| `assets/data/<nome>.words.json` | o roteiro, o provedor e o início/fim de cada palavra |
| `assets/data/<nome>.srt` | as legendas, para YouTube, Instagram ou qualquer editor |

Ele também põe o áudio como clipe numa trilha "Locução" (`--start <s>` para começar depois) e um clipe de texto por linha de legenda numa trilha "Legendas" (`--no-captions` para pular). Rodar de novo (por exemplo, para corrigir uma palavra) atualiza o clipe da locução sem desfazer o que você editou no Studio: trilha, posição, volume e fades ficam, e só a duração acompanha o áudio novo. As legendas são refeitas onde a locução está de fato. Várias locuções (`--name vo-01`, `--name vo-02`…) que se sobrepõem no tempo vão para trilhas "Locução" separadas.

**Você nunca paga duas vezes pela mesma fala.** A chave do cache é provedor + voz + velocidade + estilo + texto. Rodar de novo com os mesmos valores reaproveita o arquivo. Mudar o texto ou a voz gera outro, e `--force` sempre gera.

### Provedores

| `--provider` | Chave | Tempo das palavras | Observações |
|---|---|---|---|
| `voicestudio` (padrão) | — | exato (o VoiceStudio transcreve o áudio gerado localmente com o WhisperX e alinha ao seu roteiro) | grátis, roda no seu computador; `--model <engine>` (`omnivoice` padrão, `cosyvoice`, `voxcpm2`, `kittentts`…), `--voice <id ou nome do perfil>`, `--seed <n>`; até 4096 caracteres por pedido |
| `placeholder` | — | estimado | grátis; um tom com a duração da fala (~14 caracteres/s) |
| `openai` | `OPENAI_API_KEY` | exato (o áudio é transcrito com o Whisper por palavra e alinhado ao seu roteiro) | `--voice alloy\|nova\|…`, `--model gpt-4o-mini-tts`; uma chamada extra de transcrição |
| `elevenlabs` | `ELEVENLABS_API_KEY` | exato (alinhamento por caractere do `/with-timestamps`) | `--voice <voice_id>`, `--model eleven_multilingual_v2` |

### VoiceStudio (local e grátis)

O [VoiceStudio](https://github.com/debpalash/VoiceStudio) é um estúdio de voz gratuito e de código aberto (texto para fala, clonagem de voz, desenho de voz, transcrição) que roda no seu computador, com uma API compatível com a da OpenAI na porta 3900. O Caju só conversa com ele por HTTP; instale e abra à parte:

| Sistema | Instalação |
|---|---|
| Windows | `irm https://voicestudio.sh/install \| iex` no PowerShell, ou o `.exe` dos Releases do projeto |
| macOS / Linux | o instalador do README do projeto |
| Docker | `ghcr.io/debpalash/voicestudio` |

Uma GPU (NVIDIA CUDA ou Apple MPS) é recomendada; na CPU funciona, só que mais devagar. O `caju doctor` mostra se ele está respondendo, com os engines e perfis de voz, e o `caju voices` lista os dois. Os perfis de voz (`--voice`) são criados, clonados ou desenhados no app do VoiceStudio; sem `--voice`, vale a voz padrão do engine. O `--seed` faz a mesma fala sair igual quando gerada de novo.

- `VOICESTUDIO_URL`: o endereço (padrão `http://127.0.0.1:3900`).
- `VOICESTUDIO_API_KEY`: só quando o servidor não está no seu computador.
- Roteiros com mais de 4096 caracteres: divida em vários `--name` (um por cena).
- A qualidade em português depende do engine (o VoiceStudio lista `pt`, sem pt-BR separado). Ouça uma amostra curta, escolha o engine e o perfil de voz e depois fixe com `--seed`.

Se o VoiceStudio estiver fechado, o `caju tts` para com uma mensagem explicando como abrir ou usar `--provider placeholder|openai|elevenlabs`. Ele nunca cai sozinho num provedor pago.

### Chaves de API (OpenAI, ElevenLabs)

Coloque as chaves num arquivo `.env` na pasta onde você roda o `caju` (`OPENAI_API_KEY=sk-...`, uma por linha). A CLI lê esse arquivo a cada comando, uma variável definida no terminal tem prioridade, e o `caju doctor` mostra quais provedores estão configurados sem exibir a chave. Projetos criados pelo `create-caju` já ignoram o `.env` no git. As chaves de API são suas, e os custos também. O Caju só chama o provedor quando você roda `caju tts` ou `caju transcribe`, nunca no `caju build`, `check` ou `render`.

### Transcrever fala gravada

Para um talking head, uma entrevista ou uma locução que você gravou, o `caju transcribe` tira as legendas da própria fala:

```bash
npx caju transcribe meu-video --from assets/video/fala.mp4 --language pt             # grava os arquivos
npx caju transcribe meu-video --from assets/video/fala.mp4 --language pt --captions  # e põe os clipes de legenda
```

Ele extrai a fala com o FFmpeg e transcreve (`--provider voicestudio`, o padrão, local e grátis, ou `openai`, pago, com `OPENAI_API_KEY`) em `assets/data/<nome>.words.json` e `assets/data/<nome>.srt` (`--name`, padrão o nome do arquivo). Mesmo arquivo + provedor + idioma reaproveita o resultado; `--force` transcreve de novo. O `--captions` põe um clipe de texto por linha na trilha "Legendas" (`--offset <s>` se a mídia não começa no 0). Num projeto com `video.ts`, ele só grava os arquivos: leia com `readCaptions` (abaixo).

### Importar legendas

```bash
npx caju captions meu-video --from legenda.srt            # ou .vtt, ou um .words.json
npx caju captions meu-video --from legenda.srt --offset 0.5
```

## No `video.ts`

Gere a voz uma vez pela CLI (`npx caju tts meu-video --script roteiro.txt`). Num projeto com `video.ts`, o `caju tts` só grava os arquivos e não mexe no `project.json`, porque é o seu código que decide onde a voz e as legendas entram. Depois leia os tempos no código e deixe que eles conduzam as cenas:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineProject } from '@caju-motion/sdk';
import { readCaptions } from '@caju-motion/voice';

export default defineProject({ id: 'meu-video', format: 'reel-9x16' }, async (p) => {
  const words = fileURLToPath(new URL('./assets/data/locucao.words.json', import.meta.url));
  const cues = await readCaptions(words);
  const { durationSec } = JSON.parse(readFileSync(words, 'utf8'));
  const end = p.sec(durationSec + 1);

  p.asset({ id: 'locucao', kind: 'audio', src: 'assets/audio/vo/locucao.mp3', meta: { durationSec } });
  p.tracks(['Legendas']);
  p.scene('reel', 'Reel', 0, end, (s) => {
    s.captions(cues, { size: 54, weight: 800, color: '#FFFFFF', bg: '#000000B3' }, { x: 540, y: 1500, track: 'Legendas' });
  });
  p.audioClip('locucao', 0, p.sec(durationSec), 'Locução');
});
```

O `s.captions(cues, estilo, opções)` cria um clipe de texto por linha. Os tempos são em segundos desde o início da cena (`offsetSec` desloca todos), e as linhas nunca se sobrepõem. Use `pop: false` para tirar a entrada com "pop".

## API

```ts
import { voiceover, voiceStudioTts, addVoiceover, addCaptions } from '@caju-motion/voice';

const vo = await voiceover({ projectDir, name: 'vo-01', text, provider: voiceStudioTts({ engine: 'omnivoice', seed: 7 }) });
project = addCaptions(addVoiceover(project, vo), vo.cues);
```

| Export | |
|---|---|
| `voiceover({ projectDir, name, text, provider, voice?, speed?, instructions?, language?, force? })` | grava o áudio, o `words.json` e o `.srt`; devolve `{ audioSrc, durationSec, words, cues, timed, cached }` |
| `voiceStudioTts({ engine?, voice?, seed?, baseUrl?, apiKey? })`, `openAiTts(opts)`, `elevenLabsTts(opts)`, `placeholderTts()` | provedores; para criar o seu, implemente `{ id, synthesize(req) }` |
| `providerByName(nome, { voice?, model?, seed? })`, `DEFAULT_PROVIDER` | provedor pelo nome da CLI (`'voicestudio'` é o padrão) |
| `transcription({ projectDir, name, file, provider, language?, force? })` | transcreve um áudio/vídeo em `words.json` + `.srt`; devolve `{ wordsSrc, srtSrc, durationSec, words, cues, text, cached }` |
| `voiceStudioStt(opts)`, `openAiStt(opts)`, `sttByName(nome)` | provedores de transcrição (`{ id, transcribe(req) }`) |
| `voiceStudioVoices()`, `voiceStudioUrl()` | engines e perfis de voz do VoiceStudio; o endereço em uso |
| `wordsToCues(words, { maxChars, maxDurationSec, maxGapSec })` | agrupa palavras em linhas de legenda (quebra em fim de frase, pausa e tamanho) |
| `estimateWords(texto, durationSec)`, `alignScript(roteiro, palavrasComTempo)` | tempos quando o provedor não dá; texto do roteiro com os tempos da transcrição |
| `parseSubtitles(srtOuVtt)`, `toSrt(cues)`, `toVtt(cues)`, `readCaptions(arquivo)` | arquivos de legenda |
| `addVoiceover(projeto, vo, opts)`, `addCaptions(projeto, cues, opts)` | editam um `project.json` (devolvem um objeto novo) |
