import { parseArgs } from 'node:util';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
export function verificationOptions(name) {
  const { values } = parseArgs({
    options: {
      url: { type: 'string' },
      dist: { type: 'string', default: 'dist' },
      output: { type: 'string', default: `.cache/verification/${name}` },
    },
  });
  if (!values.url)
    throw new Error('Specify --url, e.g. http://127.0.0.1:4186/Alcemy-Sim1/');
  const parsed = new URL(values.url);
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    !parsed.pathname.endsWith('/') ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  )
    throw new Error(
      '--url must be an HTTP(S) application base URL ending in /, without credentials, query or fragment',
    );
  const output = resolve(values.output);
  mkdirSync(output, { recursive: true });
  return {
    url: parsed.href,
    origin: parsed.origin,
    dist: resolve(values.dist),
    output,
    commit: execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim(),
    executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  };
}
