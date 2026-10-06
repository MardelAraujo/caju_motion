/**
 * `npm create caju@latest [pasta]` — cria um projeto de vídeo Caju Motion a partir de um template.
 * Veja `create-caju --help`.
 */
import { main } from './main';

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: Error) => {
    console.error(`erro: ${err.message}`);
    process.exit(1);
  },
);
