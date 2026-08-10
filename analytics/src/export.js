import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function exportNdjson(tables, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  const exported = {};
  for (const [tableName, rows] of Object.entries(tables)) {
    const filePath = path.join(outputDirectory, `${tableName}.ndjson`);
    const contents = rows.map((row) => JSON.stringify(row)).join('\n');
    await writeFile(filePath, contents ? `${contents}\n` : '', 'utf8');
    exported[tableName] = { filePath, rowCount: rows.length };
  }
  return exported;
}

