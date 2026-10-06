import { defineConfig, type DefaultTheme } from 'vitepress';

/**
 * Caju Motion docs (VitePress). English at `/`, Português at `/pt/`.
 * `DOCS_BASE` overrides the base path (GitHub Pages project site: `/caju_motion/`).
 */
const base = (process.env.DOCS_BASE ?? '/caju_motion/').replace(/\/?$/, '/');
const REPO = 'https://github.com/MardelAraujo/caju_motion';

function sidebarEn(): DefaultTheme.Sidebar {
  return [
    {
      text: 'Introduction',
      items: [
        { text: 'Getting started', link: '/guide/getting-started' },
        { text: 'Project structure', link: '/guide/project-structure' },
        { text: 'Concepts', link: '/guide/concepts' },
        { text: 'Caju vs. Remotion', link: '/guide/comparison' },
      ],
    },
    {
      text: 'Guides',
      items: [
        { text: 'Video by code', link: '/guide/video-by-code' },
        { text: 'Components', link: '/guide/components' },
        { text: 'Animation', link: '/guide/animation' },
        { text: 'Assets', link: '/guide/assets' },
        { text: 'Audio', link: '/guide/audio' },
        { text: 'Caju Studio', link: '/guide/studio' },
        { text: 'Rendering', link: '/guide/rendering' },
        { text: 'Using AI agents', link: '/guide/ai-agents' },
      ],
    },
    {
      text: 'Reference',
      items: [
        { text: 'CLI', link: '/reference/cli' },
        { text: '@caju-motion/core', link: '/reference/core' },
        { text: 'project.json schema', link: '/reference/project-json' },
        { text: 'Formats & safe areas', link: '/reference/formats' },
      ],
    },
    {
      text: 'Project',
      items: [
        { text: 'Roadmap', link: '/roadmap' },
        { text: 'License', link: '/license' },
        { text: 'Contributing', link: '/contributing' },
      ],
    },
  ];
}

function sidebarPt(): DefaultTheme.Sidebar {
  return [
    {
      text: 'Introdução',
      items: [
        { text: 'Primeiros passos', link: '/pt/guide/getting-started' },
        { text: 'Estrutura do projeto', link: '/pt/guide/project-structure' },
        { text: 'Conceitos', link: '/pt/guide/concepts' },
        { text: 'Caju vs. Remotion', link: '/pt/guide/comparison' },
      ],
    },
    {
      text: 'Guias',
      items: [
        { text: 'Vídeo por código', link: '/pt/guide/video-by-code' },
        { text: 'Componentes', link: '/pt/guide/components' },
        { text: 'Animação', link: '/pt/guide/animation' },
        { text: 'Assets', link: '/pt/guide/assets' },
        { text: 'Áudio', link: '/pt/guide/audio' },
        { text: 'Caju Studio', link: '/pt/guide/studio' },
        { text: 'Render', link: '/pt/guide/rendering' },
        { text: 'Agentes de IA', link: '/pt/guide/ai-agents' },
      ],
    },
    {
      text: 'Referência',
      items: [
        { text: 'CLI', link: '/pt/reference/cli' },
        { text: '@caju-motion/core', link: '/pt/reference/core' },
        { text: 'Schema do project.json', link: '/pt/reference/project-json' },
        { text: 'Formatos e safe areas', link: '/pt/reference/formats' },
      ],
    },
    {
      text: 'Projeto',
      items: [
        { text: 'Roadmap', link: '/pt/roadmap' },
        { text: 'Licença', link: '/pt/license' },
        { text: 'Como contribuir', link: '/pt/contributing' },
      ],
    },
  ];
}

export default defineConfig({
  base,
  title: 'Caju Motion',
  description: 'Code it. Then move it. Video by code and by a visual timeline, on the same project.json.',
  cleanUrls: true,
  lastUpdated: false,
  appearance: 'dark',
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: `${base}favicon.png` }],
    ['meta', { name: 'theme-color', content: '#171512' }],
    ['meta', { property: 'og:image', content: `${base}logo-512.png` }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
      },
    ],
  ],
  themeConfig: {
    logo: { src: '/logo.png', alt: 'Caju Motion' },
    siteTitle: 'caju motion',
    socialLinks: [{ icon: 'github', link: REPO }],
    search: {
      provider: 'local',
      options: {
        locales: {
          pt: {
            translations: {
              button: { buttonText: 'Buscar', buttonAriaLabel: 'Buscar' },
              modal: {
                noResultsText: 'Nenhum resultado para',
                resetButtonTitle: 'Limpar busca',
                footer: { selectText: 'selecionar', navigateText: 'navegar', closeText: 'fechar' },
              },
            },
          },
        },
      },
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: '© 2026 Caju',
    },
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
          { text: 'Reference', link: '/reference/cli', activeMatch: '/reference/' },
          { text: 'Roadmap', link: '/roadmap' },
          { text: 'v0.2', items: [{ text: 'Changelog / releases', link: `${REPO}/releases` }, { text: 'Contributing', link: '/contributing' }] },
        ],
        sidebar: sidebarEn(),
        editLink: { pattern: `${REPO}/edit/main/docs-site/:path`, text: 'Edit this page on GitHub' },
      },
    },
    pt: {
      label: 'Português',
      lang: 'pt-BR',
      link: '/pt/',
      description: 'Code it. Then move it. Vídeo por código e por timeline visual, no mesmo project.json.',
      themeConfig: {
        nav: [
          { text: 'Guia', link: '/pt/guide/getting-started', activeMatch: '/pt/guide/' },
          { text: 'Referência', link: '/pt/reference/cli', activeMatch: '/pt/reference/' },
          { text: 'Roadmap', link: '/pt/roadmap' },
          { text: 'v0.2', items: [{ text: 'Releases', link: `${REPO}/releases` }, { text: 'Como contribuir', link: '/pt/contributing' }] },
        ],
        sidebar: sidebarPt(),
        editLink: { pattern: `${REPO}/edit/main/docs-site/:path`, text: 'Editar esta página no GitHub' },
        outline: { label: 'Nesta página' },
        docFooter: { prev: 'Anterior', next: 'Próxima' },
        darkModeSwitchLabel: 'Aparência',
        lightModeSwitchTitle: 'Mudar para o tema claro',
        darkModeSwitchTitle: 'Mudar para o tema escuro',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Voltar ao topo',
        langMenuLabel: 'Idioma',
        footer: { message: 'Distribuído sob a licença MIT.', copyright: '© 2026 Caju' },
      },
    },
  },
});
