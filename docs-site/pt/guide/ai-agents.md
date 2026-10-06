---
title: Agentes de IA
description: Deixe o Claude Code e outros agentes de código criarem vídeos Caju - instale as Agent Skills com caju skills add, o que cada skill cobre e o llms.txt para qualquer LLM.
---

# Agentes de IA

O Caju Motion foi pensado para um agente de código ir de um briefing a um vídeo renderizado: o documento é JSON simples com schema rígido, o `caju check` dá erros precisos e as [regras de mesclagem](./studio#conflicts) protegem as edições feitas no Studio.

## Instale as skills

O Caju traz **Agent Skills** (uma pasta por skill, com um `SKILL.md` e arquivos de regras carregados sob demanda) para o Claude Code e agentes compatíveis.

```bash
npx caju skills add                      # em ./.claude/skills/
npx caju skills add --target <pasta>     # em outro projeto
npx caju skills add --agents all         # também aponta outros agentes para elas via AGENTS.md
```

| Flag | Efeito |
|---|---|
| `--target <pasta>` | projeto onde instalar (padrão: a pasta atual); as skills vão para `<pasta>/.claude/skills/` |
| `--agents claude` | só Claude Code (padrão) |
| `--agents all` | também mantém um bloco marcado no `AGENTS.md` listando as skills, para agentes que o leem (Codex, Cursor, Gemini…) |

O `npm create caju@latest` também oferece instalá-las (`--skills`). No checkout do repositório: `npm run skills:install`.

::: info Chega com o primeiro release
O `npx caju …` funciona quando os pacotes estiverem no npm. Até lá, use `npm run caju -- skills add` dentro de um checkout.
:::

## O que as skills cobrem

| Skill | Papel |
|---|---|
| `caju-best-practices` | Roteador + regras de ouro + fluxo ponta a ponta. O agente carrega esta primeiro |
| `caju-setup` | Instalação, ambiente, diagnóstico de Node/FFmpeg/porta/navegador |
| `caju-assets` | Estrutura de pastas, formatos, tamanhos, registro de assets |
| `caju-audio` | Trilhas de áudio, loudness, fades, ducking, tempo pela locução |
| `caju-authoring` | `project.json` e `video.ts` (`defineProject`), keyframes, layout, safe areas |
| `caju-components` | Componentes React determinísticos com `@caju-motion/core` |
| `caju-studio` | Convivência com pessoas no Studio sem perder edições |
| `caju-render` | Configurações de exportação e verificação do resultado |

As skills são em inglês (os agentes rendem melhor assim) e cada uma tem uma tabela **Availability** que separa o que existe hoje do que está planejado, para o agente nunca rodar um comando que ainda não existe. Todo JSON de projeto das skills é validado pelo schema no CI.

## Regras de ouro que o agente segue

1. **O documento é a verdade.** Valide com `caju check` após cada mudança.
2. **Tempo é frame inteiro** em `settings.fps`.
3. **Só determinístico:** nada de `Math.random`, `Date`, timers ou transições CSS no código de render.
4. **Nunca destruir edições do Studio:** compare `meta.updatedAt` com `meta.createdAt`; use o `caju build`, que mescla.
5. **Assets dentro da pasta do projeto,** com `src` relativo.
6. **Verifique, não chute:** corrija todo erro do validador antes de dar o trabalho por pronto.

## Exemplos de pedidos

- "Crie um reel 9:16 de 20 segundos anunciando nosso lançamento. Use `assets/images/logo.svg` e a locução em `assets/audio/vo/`. Cronometre as cenas pela narração."
- "Adicione um componente de gráfico de barras animado para estes dados JSON e use na cena 3."
- "Mudei o título de lugar no Studio. Gere o vídeo de novo a partir do `video.ts` sem perder minhas mudanças."
- "Renderize para o feed do Instagram e confira o loudness."

## llms.txt

Para qualquer LLM (sem skills), este site publica:

| Arquivo | Conteúdo |
|---|---|
| [`llms.txt`](https://mardelaraujo.github.io/caju_motion/llms.txt) | índice de todas as páginas, com uma linha de descrição |
| [`llms-full.txt`](https://mardelaraujo.github.io/caju_motion/llms-full.txt) | toda a documentação em inglês mais as skills completas, num único Markdown |

Cole o `llms-full.txt` num chat, ou aponte sua ferramenta para ele, para dar ao modelo o framework inteiro de uma vez.
