/**
 * Após o build do Vite, promove admin/dist → admin/
 * para /admin servir o bundle (não o index.html fonte).
 */
import fs from 'fs';
import path from 'path';

const admin = path.resolve('admin');
const dist = path.join(admin, 'dist');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('admin/dist/index.html não encontrado — rode o build antes.');
  process.exit(1);
}

// Remove o index fonte (sombreava /admin no Vercel)
const srcIndex = path.join(admin, 'index.html');
if (fs.existsSync(srcIndex)) fs.unlinkSync(srcIndex);

for (const name of fs.readdirSync(dist)) {
  const from = path.join(dist, name);
  const to = path.join(admin, name);
  fs.rmSync(to, { recursive: true, force: true });
  fs.renameSync(from, to);
}

fs.rmSync(dist, { recursive: true, force: true });
console.log('Admin staged: /admin → bundle de produção');
