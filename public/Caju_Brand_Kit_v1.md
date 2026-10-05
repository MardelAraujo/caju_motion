# Caju — Brand Kit v1.0

## 1. Visão Geral da Marca

### Marca-mãe
**Caju**

### Produto principal
**Caju Motion**

### Editor
**Caju Studio**

### Posicionamento
Ferramenta criativa para produzir motion graphics através da combinação de **código + interface visual**.

### Tagline principal
> **Code it. Then move it.**

### Essência da marca
A identidade do Caju deve transmitir quatro ideias principais:

| Pilar | Tradução visual |
|---|---|
| Código | precisão, grids, tipografia, interfaces |
| Motion | curvas, fluxo, transições, gradientes |
| Brasil | calor, caju, tons naturais, personalidade |
| Criatividade | formas orgânicas, composição menos corporativa |

### Direção conceitual
A marca não deve parecer uma empresa alimentícia.  
O caju funciona como **metáfora visual brasileira**, não como ilustração literal de fruta.

A direção visual combina:

- brasilidade sem caricatura;
- tecnologia sem frieza;
- criatividade sem excesso;
- motion sem aparência genérica de SaaS;
- formas orgânicas com interfaces precisas.

---

# 2. Sistema de Logo

O sistema de identidade possui três assinaturas principais.

## 2.1. Logo principal — Caju Motion

**Símbolo + `caju motion`**

### Usos recomendados
- headers;
- landing page;
- documentação;
- peças institucionais;
- apresentações;
- telas de autenticação;
- materiais de marketing;
- splash screens.

---

## 2.2. Símbolo

O símbolo é formado por uma forma orgânica inspirada no caju com um **play vazado** em seu interior.

### Usos recomendados
- favicon;
- app icon;
- avatar;
- watermark;
- loading;
- player;
- botão de render;
- splash screen;
- estados de marca reduzida.

### Regra obrigatória
O triângulo central do play **não recebe preenchimento branco**.

Ele deve ser realmente:

- vazado;
- transparente;
- recortado da forma externa.

Isso permite que o fundo da aplicação apareça através do símbolo.

---

## 2.3. Wordmark

```text
caju motion
```

### Hierarquia
- `caju`: maior peso visual;
- `motion`: mais leve.

Isso reforça a leitura:

**caju** = marca  
**motion** = produto / categoria

---

# 3. Tipografia

## 3.1. Família principal

### Plus Jakarta Sans

A família principal da marca e da interface será **Plus Jakarta Sans**.

Ela funciona bem porque é:

- geométrica;
- moderna;
- amigável;
- suficientemente expressiva;
- compatível com as formas orgânicas da marca;
- adequada para produto digital.

---

## 3.2. Pesos do Wordmark

| Elemento | Peso |
|---|---:|
| `caju` | ExtraBold / 800 |
| `motion` | Regular / 400 |
| Caju Studio | 700 + 400 |
| Caju Render | 700 + 400 |

### Tracking sugerido
Para o wordmark:

```css
caju {
  letter-spacing: -0.02em;
}
```

O `motion` pode utilizar tracking neutro ou levemente positivo.

---

## 3.3. Pesos de Interface

| Aplicação | Peso |
|---|---:|
| Display | 700 |
| H1 | 700 |
| H2 | 650–700 |
| H3 | 600 |
| Body | 400 |
| Label | 500 |
| Button | 600 |
| Caption | 400 |

---

## 3.4. Tipografia para código

### JetBrains Mono

Utilizar **JetBrains Mono** para:

- editor de código;
- snippets;
- terminal;
- propriedades técnicas;
- expressões;
- valores de código;
- documentação técnica.

Isso cria separação visual entre:

**interface** e **código**.

---

# 4. Paleta Core

A paleta principal da marca utiliza tons quentes inspirados no caju e na castanha.

| Token | Nome | HEX | Papel |
|---|---|---|---|
| `caju-400` | Caju Gold | `#F6B73C` | destaque principal |
| `caju-500` | Cashew | `#D99432` | dourado / castanha |
| `caju-700` | Roasted | `#9A5B1F` | profundidade |
| `orange-500` | Caju Orange | `#F47B35` | ação |
| `red-500` | Caju Red | `#E94B35` | energia |
| `cream-50` | Cream | `#FFF8E9` | fundo claro |
| `ink-950` | Ink | `#171512` | fundo escuro |
| `graphite-900` | Graphite | `#24211D` | superfícies dark |

### Regra de identidade
O amarelo sozinho **não é a identidade da marca**.

A assinatura visual é construída pela progressão:

**castanha → dourado → laranja → vermelho do caju**

---

# 5. Gradiente Oficial

## 5.1. Caju Gradient

```css
--gradient-caju: linear-gradient(
  135deg,
  #D99432 0%,
  #F6B73C 35%,
  #F47B35 68%,
  #E94B35 100%
);
```

### Progressão visual
**Cashew → Gold → Orange → Red**

---

## 5.2. Usos recomendados

O gradiente oficial deve ser reservado para elementos de destaque:

- logo principal;
- CTA principal;
- seleção da timeline;
- indicadores ativos;
- progress bar;
- renderização;
- playhead;
- highlights;
- tela inicial;
- splash;
- peças de marketing;
- animações institucionais.

### Evitar
Não utilizar o gradiente em excesso em:

- textos longos;
- grandes áreas de background;
- todos os cards;
- todos os botões;
- todos os componentes.

O gradiente deve continuar parecendo **especial**.

---

# 6. Paleta Soft / Editorial

A paleta pastel funciona como uma camada secundária da identidade.

Ela pode ser usada em:

- marketing;
- landing pages;
- documentação;
- onboarding;
- apresentações;
- peças editoriais;
- impressos;
- ilustrações.

| Token | HEX |
|---|---|
| `soft-gold` | `#F8D58E` |
| `soft-apricot` | `#F7B37A` |
| `soft-orange` | `#F99A6B` |
| `soft-coral` | `#E77D6B` |
| `soft-terracotta` | `#C86B59` |
| `soft-cream` | `#FFF8EE` |
| `soft-beige` | `#EADBCB` |
| `soft-charcoal` | `#2E2A26` |

---

# 7. Light Theme

O modo claro deve evitar branco clínico.

A base visual deve continuar quente.

| Token semântico | Valor |
|---|---|
| `background` | `#FFF8E9` |
| `surface` | `#FFFCF6` |
| `surface-elevated` | `#FFFFFF` |
| `surface-muted` | `#F7EFE2` |
| `text-primary` | `#171512` |
| `text-secondary` | `#625B52` |
| `text-muted` | `#8B8175` |
| `border` | `#E9DDCB` |
| `border-strong` | `#DCCDB8` |
| `accent` | `#F6B73C` |
| `accent-hover` | `#F47B35` |

### Direção
A interface clara deve parecer:

- quente;
- premium;
- suave;
- limpa;
- tecnológica sem ser fria.

---

# 8. Dark Theme

O modo dark é a base principal do **Caju Studio**.

| Token semântico | Valor |
|---|---|
| `background` | `#171512` |
| `surface` | `#1E1B17` |
| `surface-elevated` | `#24211D` |
| `surface-hover` | `#2D2924` |
| `text-primary` | `#FFF8E9` |
| `text-secondary` | `#C9C0B5` |
| `text-muted` | `#8F877E` |
| `border` | `#39342E` |
| `border-strong` | `#49423A` |
| `accent` | `#F6B73C` |
| `accent-secondary` | `#F47B35` |

### Regra importante
Evitar preto absoluto:

```css
#000000
```

Utilizar preferencialmente:

```css
#171512
```

Isso deixa a interface:

- menos agressiva;
- mais sofisticada;
- mais quente;
- mais coerente com a marca.

---

# 9. Border Radius

A linguagem do Caju deve ser claramente arredondada.

O arredondamento não deve ficar restrito aos botões.

Ele precisa aparecer em:

- cards;
- painéis;
- modais;
- inputs;
- menus;
- dropdowns;
- canvas;
- containers;
- previews;
- heroes.

## 9.1. Tokens de Radius

```css
--radius-xs: 8px;
--radius-sm: 12px;
--radius-md: 16px;
--radius-lg: 24px;
--radius-xl: 32px;
--radius-2xl: 40px;
--radius-3xl: 48px;
--radius-pill: 999px;
```

---

## 9.2. Aplicação recomendada

| Componente | Radius |
|---|---:|
| Input pequeno | 12px |
| Button | 14–16px |
| Dropdown | 16px |
| Card | 24px |
| Panel | 28–32px |
| Modal | 32px |
| Canvas container | 32px |
| Marketing card | 40px |
| Hero blocks | 40–48px |
| Pills / chips | 999px |

### Hierarquia visual
A progressão ideal:

**controle 14 → card 24 → painel 32 → hero 40/48**

---

# 10. Containers

## 10.1. Painel principal

```css
.panel {
  border-radius: 32px;
  border: 1px solid var(--border);
  background: var(--surface);
}
```

## 10.2. Cards internos

```css
.card {
  border-radius: 24px;
}
```

## 10.3. Elementos menores

```css
.control {
  border-radius: 14px;
}
```

### Regra
A interface deve evitar excesso de caixas visualmente independentes.

Os containers devem parecer parte de um sistema contínuo.

---

# 11. Sombras

A identidade deve evitar sombras pesadas.

## 11.1. Light

```css
--shadow-sm:
  0 2px 8px rgba(23, 21, 18, 0.05);

--shadow-md:
  0 8px 24px rgba(23, 21, 18, 0.08);

--shadow-lg:
  0 24px 64px rgba(23, 21, 18, 0.12);
```

---

## 11.2. Dark

No dark mode, priorizar:

- diferença de superfície;
- borda;
- elevação sutil.

```css
--shadow-dark:
  0 16px 48px rgba(0, 0, 0, 0.28);
```

---

# 12. Elementos Gráficos

A anatomia do símbolo fornece a base do sistema gráfico.

As curvas do Caju podem ser ampliadas, recortadas e transformadas em:

- backgrounds;
- máscaras;
- transições;
- wipes;
- ondas;
- frames;
- divisores;
- elementos de composição;
- motion paths.

### Estrutura visual
Uma linguagem recorrente pode seguir:

**curva larga → abertura → contra-curva → expansão**

Isso conecta diretamente a identidade ao universo de motion.

---

# 13. Motion Language

Motion não é apenas uma feature do produto.

Ele faz parte da identidade da marca.

## 13.1. Curva principal

```css
--ease-caju:
  cubic-bezier(0.22, 1, 0.36, 1);
```

### Direção
Evitar animações excessivamente:

- elásticas;
- caricatas;
- aceleradas;
- chamativas.

Preferir:

- movimentos fluidos;
- desaceleração natural;
- suavidade;
- sensação premium.

---

## 13.2. Durações

```css
--motion-fast: 120ms;
--motion-base: 220ms;
--motion-medium: 360ms;
--motion-slow: 600ms;
--motion-brand: 800ms;
```

### Uso recomendado
UI comum:

**120–360 ms**

Movimentos institucionais:

**600–900 ms**

---

# 14. Animação da Logo

A animação institucional do símbolo pode seguir esta lógica:

1. a curva do caju aparece incompleta;
2. a forma cresce;
3. a curva começa a se fechar;
4. o vazio interno se transforma no `▶`;
5. o play avança alguns pixels;
6. o movimento inicia a transição para o produto.

### Narrativa visual

```text
curva → caju → play → movimento
```

Essa animação pode ser utilizada em:

- splash screen;
- abertura de vídeos;
- loading;
- renderização;
- eventos;
- peças sociais;
- onboarding.

---

# 15. Caju Studio — Direção de Interface

O editor deve utilizar aproximadamente esta distribuição de cor:

```text
75% neutros
15% superfícies secundárias
10% Caju
```

### Regra
O gradiente não deve dominar o produto.

O software precisa parecer profissional antes de parecer colorido.

---

## 15.1. Mapeamento de cores

| Elemento | Cor |
|---|---|
| Fundo principal | Ink |
| Sidebar | Graphite |
| Canvas | quase preto |
| Texto | Cream |
| Item selecionado | Caju Gold |
| Playhead | Caju Orange |
| Render / Progress | Caju Gradient |
| Selection outline | Caju Gold |
| CTA principal | Caju Gradient |

---

# 16. Estados de Componentes

## 16.1. Primary

```css
background: var(--gradient-caju);
color: #171512;
```

---

## 16.2. Secondary Dark

```css
background: #24211D;
border: 1px solid #39342E;
color: #FFF8E9;
```

---

## 16.3. Secondary Light

```css
background: #FFFFFF;
border: 1px solid #E9DDCB;
color: #171512;
```

---

## 16.4. Selected

```css
border: 1px solid #F6B73C;
box-shadow: 0 0 0 3px rgba(246, 183, 60, 0.12);
```

---

# 17. Design Tokens

## 17.1. Core

```css
:root {
  /* Brand */
  --caju-gold: #F6B73C;
  --caju-cashew: #D99432;
  --caju-roasted: #9A5B1F;
  --caju-orange: #F47B35;
  --caju-red: #E94B35;

  /* Neutrals */
  --caju-cream: #FFF8E9;
  --caju-ink: #171512;
  --caju-graphite: #24211D;

  /* Gradient */
  --caju-gradient:
    linear-gradient(
      135deg,
      #D99432 0%,
      #F6B73C 35%,
      #F47B35 68%,
      #E94B35 100%
    );

  /* Typography */
  --font-brand: "Plus Jakarta Sans", sans-serif;
  --font-ui: "Plus Jakarta Sans", sans-serif;
  --font-code: "JetBrains Mono", monospace;

  /* Radius */
  --radius-xs: 8px;
  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-xl: 32px;
  --radius-2xl: 40px;
  --radius-3xl: 48px;
  --radius-pill: 999px;

  /* Motion */
  --motion-fast: 120ms;
  --motion-base: 220ms;
  --motion-medium: 360ms;
  --motion-slow: 600ms;
  --motion-brand: 800ms;

  --ease-caju:
    cubic-bezier(0.22, 1, 0.36, 1);
}
```

---

## 17.2. Light Theme Tokens

```css
[data-theme="light"] {
  --bg: #FFF8E9;
  --surface: #FFFCF6;
  --surface-raised: #FFFFFF;
  --surface-muted: #F7EFE2;

  --text-primary: #171512;
  --text-secondary: #625B52;
  --text-muted: #8B8175;

  --border: #E9DDCB;
  --border-strong: #DCCDB8;

  --accent: #F6B73C;
  --accent-hover: #F47B35;
}
```

---

## 17.3. Dark Theme Tokens

```css
[data-theme="dark"] {
  --bg: #171512;
  --surface: #1E1B17;
  --surface-raised: #24211D;
  --surface-hover: #2D2924;

  --text-primary: #FFF8E9;
  --text-secondary: #C9C0B5;
  --text-muted: #8F877E;

  --border: #39342E;
  --border-strong: #49423A;

  --accent: #F6B73C;
  --accent-secondary: #F47B35;
}
```

---

# 18. Arquitetura Visual da Família

A identidade precisa escalar sem redesenhar a marca para cada produto.

| Produto | Nome visual |
|---|---|
| Marca | **caju** |
| Engine | **caju motion** |
| Editor | **caju studio** |
| Renderização | **caju render** |
| Runtime | **caju player** |
| Terminal | **caju cli** |
| Infraestrutura | **caju cloud** |

### Regra
A cor principal da marca não deve mudar completamente para cada produto.

O sistema Caju continua sempre reconhecível pelo eixo:

**Gold → Orange → Red**

Produtos podem receber uma **accent color secundária**, mas o símbolo principal continua consistente.

---

# 19. Tom Visual

## 19.1. A marca deve ser

- brasileira;
- quente;
- moderna;
- tecnológica;
- criativa;
- premium;
- orgânica;
- precisa;
- expressiva;
- amigável.

## 19.2. A marca não deve ser

- tropical caricata;
- food brand;
- excessivamente colorida;
- genérica;
- fria;
- corporativa demais;
- infantil;
- exageradamente futurista;
- dependente de roxo/azul típico de SaaS.

---

# 20. Regra Visual Central

A principal regra do sistema pode ser resumida em:

> **Warm outside. Precise inside.**

### Por fora
O Caju é:

- orgânico;
- brasileiro;
- quente;
- expressivo.

### Por dentro
O produto é:

- preciso;
- organizado;
- técnico;
- profissional;
- confiável.

Esse contraste é uma das principais forças da identidade.

---

# 21. Resumo Executivo

## Marca
**Caju**

## Produto
**Caju Motion**

## Editor
**Caju Studio**

## Tagline
**Code it. Then move it.**

## Fonte principal
**Plus Jakarta Sans**

## Fonte de código
**JetBrains Mono**

## Cor principal
`#F6B73C`

## Fundo dark
`#171512`

## Fundo light
`#FFF8E9`

## Gradiente principal

```css
linear-gradient(
  135deg,
  #D99432 0%,
  #F6B73C 35%,
  #F47B35 68%,
  #E94B35 100%
)
```

## Radius predominante
**24px – 32px**

## Hero Radius
**40px – 48px**

## Easing principal

```css
cubic-bezier(0.22, 1, 0.36, 1)
```

## Princípio visual
**Warm outside. Precise inside.**
