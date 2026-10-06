/**
 * Compatibilidade: o construtor de projetos agora vive no `@caju-motion/sdk`.
 * Scripts antigos (inclusive fora do repositório) continuam importando daqui.
 * Para vídeos novos, prefira `defineProject` + `caju build` (merge com as edições do Studio).
 */
export {
  guardOverwrite,
  ProjectBuilder,
  SceneCtx,
  type ComponentOpts,
  type ElOpts,
  type KF,
  type TextStyle,
} from '../../packages/sdk/src/index';
