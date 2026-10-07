import fs from 'node:fs';
import { execSync } from 'node:child_process';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const lines = envLocal.split('\n');
const env = { ...process.env };
for (const line of lines) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const k = match[1].trim();
    let v = match[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[k] = v;
  }
}

console.log('Pushing to DATABASE_URL:', env.DATABASE_URL);
execSync('npx prisma db push --skip-generate', { stdio: 'inherit', env });
console.log('Database push completed successfully!');
