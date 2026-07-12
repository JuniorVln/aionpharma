/**
 * Monta a pasta `public/` para deploy Vercel:
 * - loja (HTML/CSS/JS/assets)
 * - admin build em public/admin/
 * As funções em /api ficam na raiz do projeto (fora do public).
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public');

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  mkdirp(dest);
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyDir(from, to);
    else copyFile(from, to);
  }
}

console.log('Building admin…');
execSync('npm run build --prefix admin', { stdio: 'inherit' });

console.log('Staging public/…');
rmrf(PUBLIC);
mkdirp(PUBLIC);

// Storefront
const rootFiles = fs.readdirSync(ROOT).filter((n) => {
  if (n.endsWith('.html') || n.endsWith('.css') || n === 'script.js') return true;
  return false;
});
for (const f of rootFiles) copyFile(path.join(ROOT, f), path.join(PUBLIC, f));

for (const dir of ['assets']) {
  copyDir(path.join(ROOT, dir), path.join(PUBLIC, dir));
}

// Admin bundle → /admin
copyDir(path.join(ROOT, 'admin', 'dist'), path.join(PUBLIC, 'admin'));

console.log('public/ ready');
