---
title: Como contribuir
description: Como contribuir com o Caju Motion - estrutura do monorepo, a condição de export source, Studio e testes, lint de determinismo, changesets e documentação.
---

# Como contribuir

Issues e pull requests são bem-vindos no [GitHub](https://github.com/MardelAraujo/caju_motion).

## Preparando o ambiente

```bash
git clone https://github.com/MardelAraujo/caju_motion.git
cd caju_motion
npm install
npm run check      # typecheck + lint de determinismo + testes + fixtures: tem que passar
npm run studio     # Studio em modo de desenvolvimento (Vite/HMR) em http://localhost:3700
```

Node ≥ 20.11 (o CI usa 22). O CI roda em Windows e Linux.

## Monorepo

```text
packages/   schema · core · renderer · sdk · audio · renderer-node · server · studio · cli · skills · caju · create-caju
fixtures/   projetos mínimos válidos (o CI valida e renderiza)
projects/   projetos de exemplo locais
components/ componentes de exemplo (CountUp, LowerThird)
scripts/    lint de determinismo, mídias dos fixtures, builder legado, gerador do llms.txt
docs-site/  este site (VitePress)
```

| Pacote | Papel |
|---|---|
| `@caju-motion/schema` | `project.json` (zod), formatos + safe areas, configurações de exportação, migrações |
| `@caju-motion/core` | runtime de animação |
| `@caju-motion/renderer` | `ProjectRenderer` (documento + frame → DOM React), `defineComponent` |
| `@caju-motion/sdk` | `defineProject`, mesclagem do `caju build` |
| `@caju-motion/audio` | mixagem de áudio (filtergraph do FFmpeg) |
| `@caju-motion/renderer-node` | render Chromium headless → FFmpeg |
| `@caju-motion/server` | store local de projetos, API de assets, API de render, servidor do Studio em produção |
| `@caju-motion/studio` | o editor, publicado já compilado |
| `@caju-motion/cli` | o comando `caju` |
| `@caju-motion/skills` | Agent Skills |
| `caju`, `create-caju` | nome curto da CLI, scaffolder |

## A condição `source`

Os pacotes exportam o código TypeScript na condição de export `source`, e o `dist/` para o npm. O monorepo, os testes e o `npm run caju` usam `source` (`tsx --conditions=source`), então não é preciso compilar os pacotes para trabalhar neles. O `npm run build` gera o `dist/` com tsup.

## Scripts

| Script | Faz |
|---|---|
| `npm run caju -- <comando>` | a CLI a partir do código-fonte |
| `npm run studio` | Studio em modo de desenvolvimento |
| `npm run typecheck` | `tsc` |
| `npm run lint` | lint de determinismo (`scripts/lint-determinism.ts`) |
| `npm test` | vitest (`packages/*/src/**/*.test.ts(x)`) |
| `npm run check:fixtures` | `caju check` em `fixtures/projects` |
| `npm run check` | tudo acima |
| `npm run build` | compila todos os pacotes |

Os testes de integração de render precisam de Chrome e FFmpeg e são opcionais: `CAJU_RENDER_IT=1 npx vitest run packages/renderer-node --maxWorkers=1`.

## Regras

- **Determinismo:** nada de `Math.random`, `Date`, timers, animações CSS ou `Intl` no código de render. Use o `@caju-motion/core`.
- **Frames inteiros** em todo o documento.
- **Clean room:** nunca copie nem derive código do Remotion.
- Ao mudar um comando ou recurso, atualize a tabela **Availability** da skill correspondente em `packages/skills/skills/*/SKILL.md`; os exemplos JSON das skills são validados pelos testes.

## Changesets e releases

Toda mudança visível ao usuário ganha um changeset:

```bash
npm run changeset
```

Todos os pacotes `@caju-motion/*`, o `caju` e o `create-caju` são versionados **em lockstep**. O release é manual (GitHub Actions → **release**): com changesets pendentes ele abre um PR "Version Packages"; rodando de novo após o merge, publica no npm com provenance.

## Documentação

O site fica em `docs-site/` (inglês na raiz, português em `docs-site/pt/`). Mantenha os dois idiomas em sincronia, dê a cada página `title` e `description` no frontmatter e então:

```bash
npx tsx scripts/llms.ts            # regenera docs-site/public/llms.txt e llms-full.txt, valida as páginas
npx vitepress dev docs-site        # preview local
npx vitepress build docs-site      # falha com links quebrados
```
