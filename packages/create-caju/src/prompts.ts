/**
 * Perguntas interativas mínimas (node:readline, sem dependências). Só usadas com TTY e sem --yes.
 */
import { createInterface, type Interface } from 'node:readline/promises';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
export const c = { bold: paint(1), dim: paint(2), red: paint(31), green: paint(32), yellow: paint(33), cyan: paint(36) };

export type Prompter = {
  text(message: string, initial: string): Promise<string>;
  select<T extends string>(message: string, options: { value: T; label: string; hint?: string }[], initial: T): Promise<T>;
  confirm(message: string, initial: boolean): Promise<boolean>;
  close(): void;
};

export function createPrompter(): Prompter {
  const rl: Interface = createInterface({ input: process.stdin, output: process.stdout });
  rl.on('SIGINT', () => {
    rl.close();
    console.log(`\n${c.dim('cancelado')}`);
    process.exit(130);
  });
  return {
    async text(message, initial) {
      const answer = (await rl.question(`${c.cyan('?')} ${c.bold(message)} ${c.dim(`(${initial})`)} `)).trim();
      return answer || initial;
    },
    async select(message, options, initial) {
      console.log(`${c.cyan('?')} ${c.bold(message)}`);
      options.forEach((o, i) => {
        const mark = o.value === initial ? c.cyan('›') : ' ';
        console.log(`  ${mark} ${i + 1}. ${o.label}${o.hint ? c.dim(` — ${o.hint}`) : ''}`);
      });
      const def = options.findIndex((o) => o.value === initial) + 1;
      for (;;) {
        const answer = (await rl.question(`  número ou nome ${c.dim(`(${def})`)} `)).trim();
        if (!answer) return initial;
        const byIndex = options[Number(answer) - 1];
        const byName = options.find((o) => o.value === answer);
        if (/^\d+$/.test(answer) && byIndex) return byIndex.value;
        if (byName) return byName.value;
        console.log(c.yellow(`  opção inválida: ${answer}`));
      }
    },
    async confirm(message, initial) {
      const answer = (await rl.question(`${c.cyan('?')} ${c.bold(message)} ${c.dim(initial ? '(S/n)' : '(s/N)')} `)).trim().toLowerCase();
      if (!answer) return initial;
      return ['s', 'sim', 'y', 'yes'].includes(answer);
    },
    close() {
      rl.close();
    },
  };
}
