import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * `.env` da pasta atual: `CHAVE=valor` por linha (`#` comenta, aspas opcionais, `export` opcional).
 * Nunca sobrescreve uma variável que já existe no ambiente (o terminal vence o arquivo).
 * Próprio em vez de `process.loadEnvFile` porque este só existe a partir do Node 20.12.
 */
export function parseDotEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of content.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2]!;
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, '\n');
    } else {
      value = value.replace(/\s+#.*$/, ''); // comentário no fim da linha
    }
    out[m[1]!] = value;
  }
  return out;
}

/** Carrega `<dir>/.env` em `env` (sem sobrescrever). Devolve as chaves carregadas. */
export function loadDotEnv(dir = process.cwd(), env: NodeJS.ProcessEnv = process.env): string[] {
  const file = path.join(dir, '.env');
  if (!existsSync(file)) return [];
  const loaded: string[] = [];
  for (const [k, v] of Object.entries(parseDotEnv(readFileSync(file, 'utf8')))) {
    if (env[k] !== undefined) continue;
    env[k] = v;
    loaded.push(k);
  }
  return loaded;
}
