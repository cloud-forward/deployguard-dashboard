import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const generatedDir = path.resolve('src/api/generated');

const responseAliasPattern =
  /export type (\w+Response\d+) = \{\n\s+data: ([^\n]+)\n\s+status: \d+\n\}/g;
const responseWrapperPattern =
  /export type (\w+Response(?:Success|Error)) = \(([\s\S]*?)\) & \{\n\s+headers: Headers;\n\};\n;?/g;

const getFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return getFiles(fullPath);
      }

      if (entry.isFile() && fullPath.endsWith('.ts')) {
        return [fullPath];
      }

      return [];
    }),
  );

  return files.flat();
};

const normalizeGeneratedFile = async (filePath) => {
  const original = await readFile(filePath, 'utf8');
  const normalized = original
    .replace(responseAliasPattern, 'export type $1 = $2')
    .replace(responseWrapperPattern, 'export type $1 = ($2);')
    .replace(/\n;\n/g, '\n\n');

  if (normalized !== original) {
    await writeFile(filePath, normalized);
  }
};

const generatedDirStats = await stat(generatedDir).catch(() => null);

if (!generatedDirStats?.isDirectory()) {
  process.exit(0);
}

const files = await getFiles(generatedDir);
await Promise.all(files.map(normalizeGeneratedFile));
