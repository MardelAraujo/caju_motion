---
title: Estrutura do projeto
description: As pastas que o Caju Motion espera - projetos, assets por tipo, componentes, renders e o cache .caju - e as convenções de nomes.
---

# Estrutura do projeto

Por padrão a CLI `caju` trabalha numa pasta `projects/` e procura componentes na pasta `components/` ao lado dela.

```text
meu-video/
  projects/
    promo/
      video.ts              defineProject() — fonte em código (opcional)
      project.json          fonte da verdade (gerada pelo código e/ou editada no Studio)
      assets/
        images/             png, jpg, webp, svg
        video/              mp4 (H.264, taxa de quadros constante)
        audio/
          vo/               locução, um arquivo por frase ou cena
          music/            trilha sonora
          sfx/              efeitos sonoros
          amb/              ambiente
        fonts/              woff2 (reservado, ainda não renderiza)
        data/               json/csv lidos pelo video.ts (não pelo renderer)
      renders/              saída do caju render (fora do git)
      .caju/
        history/            versões anteriores, gravadas a cada save do Studio e a cada caju build
        last-build.json     base para detectar edições do Studio — mantenha no git
  components/               defineComponent() — aparece na aba Componentes do Studio
```

| Flag | Muda |
|---|---|
| `--dir <pasta>` | a pasta de projetos (padrão `projects`) |
| `--components <pasta>` | a pasta de componentes (padrão `<dir>/../components`) |

## Convenções

- **Uma pasta por projeto.** O nome da pasta é o `id` do projeto; com `video.ts`, ele precisa ser igual ao `id` passado ao `defineProject`.
- **Os assets ficam dentro da pasta do projeto** e são referenciados por `src` relativo, com barras normais: `assets/images/logo.png`. Nada de caminho absoluto nem URL: o render funciona offline e é reproduzível.
- **Nomes de arquivo:** kebab-case minúsculo, ASCII, sem espaços (`logo-acme.svg`, `vo-03-precos.wav`). O render no Linux diferencia maiúsculas.
- **Ids são globais** no documento: assets, trilhas, clipes e marcadores dividem o mesmo espaço. Asset `vo-01`, clipe `vo-01-clip`.
- Arquivos enviados pelo Studio vão para `assets/` com nome sanitizado. Tudo bem.

## O que versionar

| Caminho | No git? |
|---|---|
| `video.ts`, `project.json`, `assets/`, `components/` | sim |
| `.caju/last-build.json` | **sim** — sem ele, edições do Studio em clipes de código não são detectadas num clone novo |
| `.caju/*` (histórico, cache), `renders/` | não |

Projetos antigos podem ter `.frame/` no lugar de `.caju/`; ele é lido como alternativa.
