import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dist = resolve(import.meta.dirname, '../dist');

const visit = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(path);
      continue;
    }
    if (!entry.name.endsWith('.d.ts')) {
      continue;
    }

    const cjsPath = path.slice(0, -'.d.ts'.length) + '.d.cts';
    // Rewritten import suffixes no longer match the original declaration map.
    const declaration = readFileSync(path, 'utf8')
      .replace(/((?:from|import)\s*['"]\.{1,2}\/[^'"]+)\.js(['"])/g, '$1.cjs$2')
      .replace(/\n?\/\/# sourceMappingURL=.*$/m, '');

    writeFileSync(cjsPath, declaration);
  }
};

visit(dist);
