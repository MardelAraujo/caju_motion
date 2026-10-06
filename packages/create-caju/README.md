# create-caju

Cria um projeto de vídeo [Caju Motion](https://github.com/MardelAraujo/caju_motion) — vídeo por código + timeline visual (Caju Studio).

```bash
npm create caju@latest meu-video
cd meu-video
npm run dev          # abre o Caju Studio
```

Sem perguntas (CI): `npm create caju@latest meu-video -- --template reel-legendado --yes --no-install`

| Opção | |
|---|---|
| `-t, --template <nome>` | `blank`, `reel-legendado`, `explainer-16x9`, `data-video`, `audiograma` |
| `-y, --yes` | usa os padrões sem perguntar |
| `--no-install` | não instala as dependências |
| `--skills` / `--no-skills` | instala (ou não) as skills de agente (`caju skills add --agents all`) |
| `--pm <npm\|pnpm\|yarn\|bun>` | gerenciador de pacotes (padrão: o que chamou o create) |

## Templates

- **blank** — reel 9:16 mínimo.
- **reel-legendado** — 9:16 com título, legendas cronometradas pela locução e tarja de nome (`LowerThird`).
- **explainer-16x9** — cenas com texto, formas e contador animado (`CountUp`).
- **data-video** — 4:5 com gráfico de barras (`BarChart`) lido de `assets/data/vendas.json`.
- **audiograma** — 1:1 para podcast, com onda animada (`Waveform`) e áudio opcional.

## English

`npm create caju@latest my-video` scaffolds a Caju Motion project (code-first video + the Caju Studio timeline editor)
from one of the templates above. Use `--yes --no-install` for non-interactive runs.
