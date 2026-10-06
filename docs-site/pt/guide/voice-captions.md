---
title: Locução e legendas
description: Gere a locução com texto para fala (OpenAI, ElevenLabs ou uma voz provisória grátis), obtenha o tempo de cada palavra e adicione legendas como clipes de texto editáveis - pela CLI, de arquivos SRT/VTT ou no video.ts.
---

# Locução e legendas

O `@caju-motion/voice` transforma um roteiro em arquivo de locução mais o tempo de cada palavra, e transforma esses tempos em legendas. As legendas são clipes de texto comuns numa trilha "Legendas", então dá para mudar o estilo ou corrigir no Studio.

## Pela CLI

```bash
# voz provisória grátis (um tom suave + tempos estimados) para montar o vídeo primeiro
npx caju tts meu-video --text "Todo vídeo começa com uma ideia. O Caju transforma código em vídeo."

# a voz de verdade, quando o roteiro estiver fechado
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
| `placeholder` (padrão) | — | estimado | grátis; um tom com a duração da fala (~14 caracteres/s) |
| `openai` | `OPENAI_API_KEY` | exato (o áudio é transcrito com o Whisper por palavra e alinhado ao seu roteiro) | `--voice alloy\|nova\|…`, `--model gpt-4o-mini-tts`; uma chamada extra de transcrição |
| `elevenlabs` | `ELEVENLABS_API_KEY` | exato (alinhamento por caractere do `/with-timestamps`) | `--voice <voice_id>`, `--model eleven_multilingual_v2` |

Coloque as chaves num arquivo `.env` na pasta onde você roda o `caju` (`OPENAI_API_KEY=sk-...`, uma por linha). A CLI lê esse arquivo a cada comando, uma variável definida no terminal tem prioridade, e o `caju doctor` mostra quais provedores estão configurados sem exibir a chave. Projetos criados pelo `create-caju` já ignoram o `.env` no git. As chaves de API são suas, e os custos também. O Caju só chama o provedor quando você roda `caju tts`, nunca no `caju build`, `check` ou `render`.

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
import { voiceover, openAiTts, addVoiceover, addCaptions } from '@caju-motion/voice';

const vo = await voiceover({ projectDir, name: 'vo-01', text, provider: openAiTts({ voice: 'nova' }) });
project = addCaptions(addVoiceover(project, vo), vo.cues);
```

| Export | |
|---|---|
| `voiceover({ projectDir, name, text, provider, voice?, speed?, instructions?, language?, force? })` | grava o áudio, o `words.json` e o `.srt`; devolve `{ audioSrc, durationSec, words, cues, timed, cached }` |
| `openAiTts(opts)`, `elevenLabsTts(opts)`, `placeholderTts()` | provedores; para criar o seu, implemente `{ id, synthesize(req) }` |
| `wordsToCues(words, { maxChars, maxDurationSec, maxGapSec })` | agrupa palavras em linhas de legenda (quebra em fim de frase, pausa e tamanho) |
| `estimateWords(texto, durationSec)`, `alignScript(roteiro, palavrasComTempo)` | tempos quando o provedor não dá; texto do roteiro com os tempos da transcrição |
| `parseSubtitles(srtOuVtt)`, `toSrt(cues)`, `toVtt(cues)`, `readCaptions(arquivo)` | arquivos de legenda |
| `addVoiceover(projeto, vo, opts)`, `addCaptions(projeto, cues, opts)` | editam um `project.json` (devolvem um objeto novo) |
