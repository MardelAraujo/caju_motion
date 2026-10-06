---
title: Caju Studio
description: O Caju Studio, editor de timeline visual - o que ele edita, como o caju build mescla código e edições do Studio, conflitos, histórico e como trabalhar com o Studio aberto.
---

# Caju Studio

O Caju Studio é o editor de timeline visual. Ele abre o mesmo `project.json` que o código gera e salva de volta nele.

```bash
npx caju studio [--dir projects] [--port 3700] [--open]
```

Depois abra `http://localhost:3700`. O Studio lista todos os projetos da pasta.

## O que dá para editar

| Área | No Studio |
|---|---|
| Timeline | mover, cortar e dividir clipes numa timeline multi-trilha |
| Transformação | posição, escala, rotação, espelhar |
| Texto e cor | textos, fontes, cores (seletor RGB/alpha com conta-gotas no Chrome/Edge) |
| Formas | largura e altura |
| Clipe | opacidade, velocidade |
| Áudio | volume e fades |
| Componentes | props, num formulário gerado pelo schema zod do componente ([Componentes](./components)) |
| Projeto | formato e fundo |
| Exportação | o botão **Exportar** ([Render](./rendering)) |

**Ainda não:** edição de keyframes. Os keyframes existentes tocam, e arrastar um elemento desloca todos os seus keyframes de posição. Uma boa divisão: o código (ou um agente) escreve estrutura e animação; as pessoas ajustam posição, texto e tempo.

## Como as edições são rastreadas

- `origin: "code"` marca clipes do `video.ts`; `origin: "editor"` (padrão) marca clipes feitos no Studio.
- **Projeto editado por uma pessoa:** `meta.updatedAt` existe e `meta.createdAt` não existe ou é diferente. O Studio reescreve `updatedAt` a cada save; o `caju new` grava os dois com o mesmo valor; geradores não gravam nenhum.
- `.caju/history/*.json` guarda a versão anterior, gravada a cada save do Studio e a cada `caju build`.
- `.caju/last-build.json` guarda a saída bruta do último build: a base para detectar edições do Studio em clipes de código. **Versione no git.**

## Mesclagem: `caju build` {#conflicts}

Em projetos com `video.ts`, o `caju build <id>` roda o código e **mescla** com o que está no disco:

| Clipe | O que acontece |
|---|---|
| Criado no Studio (`origin: "editor"`) | **Preservado**. Fica na sua trilha, ou vai para uma nova trilha "Edições do Studio" se a trilha sumiu ou o espaço foi ocupado |
| Do código, intocado no Studio | Substituído pela nova versão gerada |
| Do código, **editado no Studio** (difere do `last-build.json`) | **Conflito**: nada é gravado; o diff é exibido (id do clipe + campos) |
| Do código, apagado no Studio | Conflito ("removido") |
| Criado ao dividir um clipe de código no Studio | Preservado como clipe do editor |

Assets, marcadores e trilhas criados no Studio também são preservados.

Com conflitos, escolha:

1. **Leve a mudança da pessoa para o `video.ts`** (mesmo valor, `id` estável) e gere de novo. Normalmente é o melhor.
2. `caju build <id> --force`: o código vence; o arquivo anterior vai para `.caju/history/`.
3. Deixe o projeto como está.

O `caju build --dry-run` mostra o que mudaria sem gravar. Sem `last-build.json` (clone novo ou primeiro build), edições em clipes de código não são detectadas: o build avisa e substitui, guardando uma cópia no histórico. Clipes do editor estão sempre seguros.

## Projetos sem `video.ts`

Em JSON escrito à mão ou scripts legados, prefira **edições cirúrgicas**: mude só os clipes ou campos envolvidos. Antes de regerar com um script avulso um projeto editado por uma pessoa, pergunte; o `guardOverwrite()` se recusa a sobrescrever sem `--force` e, com ele, faz backup em `<raiz>/.cache/backups/`.

## Com o Studio aberto

- O Studio confere o arquivo no disco a cada 4 s. Sem edições pendentes, recarrega sozinho; com edições pendentes, avisa ("o projeto mudou no disco") e a pessoa decide ao salvar.
- Evite reescrever o `project.json` enquanto alguém está editando.
- Arquivos de `components/` recarregam sem recarregar a página.

## Problemas comuns

| Sintoma | Solução |
|---|---|
| `EADDRINUSE` / porta 3700 ocupada | feche o outro Studio, ou `npx caju studio --port 3701` |
| Página em branco no primeiro acesso | as fontes seguram a primeira pintura; espere 2–3 s ou recarregue |
| Conta-gotas desabilitado | use Chrome ou Edge (API EyeDropper) |
