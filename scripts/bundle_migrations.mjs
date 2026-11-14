import fs from 'fs';
import path from 'path';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const outputFile = path.join(process.cwd(), 'supabase', '_bundle.sql');

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

console.log('Bundling migrations:', files);

let combinedSql = `-- =========================================================================
-- HireFlow Full Database Schema Bundle
-- Generated: ${new Date().toISOString()}
-- For Supabase Project: dewcnqoreuhnrmvswxuf (Tokyo, ap-northeast-1)
-- =========================================================================\n\n`;

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  combinedSql += `-- -------------------------------------------------------------------------\n`;
  combinedSql += `-- MIGRATION: ${file}\n`;
  combinedSql += `-- -------------------------------------------------------------------------\n\n`;
  combinedSql += content.trim() + '\n\n';
}

fs.writeFileSync(outputFile, combinedSql, 'utf8');
console.log(`✅ Successfully generated bundle at: ${outputFile} (${Math.round(combinedSql.length / 1024)} KB)`);
