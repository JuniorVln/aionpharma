import { chromium } from 'playwright';

const BASE = 'https://www.aionpharma.ind.br';
const PAGINAS = ['/', '/produtos', '/produto', '/b2b', '/conta', '/contato', '/sobre', '/blog', '/entrega', '/trocas'];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });

for (const rota of PAGINAS) {
  const page = await ctx.newPage();
  const erros = [];
  const falhas = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text().slice(0, 120)); });
  page.on('response', (r) => { if (r.status() >= 400) falhas.push(`${r.status()} ${r.url().replace(BASE, '')}`); });
  await page.goto(BASE + rota, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2500);
  const semAlt = await page.evaluate(() => [...document.images].filter((i) => !i.alt).length);
  const quebradas = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
  const titulo = await page.title();
  const h1 = await page.evaluate(() => document.querySelector('h1')?.innerText?.slice(0, 60) || '(sem h1)');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`\n== ${rota}`);
  console.log('  title:', titulo.slice(0, 80));
  console.log('  h1:', h1.replace(/\n/g, ' '));
  console.log('  overflow:', overflow, '| img sem alt:', semAlt, '| img quebrada:', quebradas.length);
  if (quebradas.length) console.log('   quebradas:', quebradas.slice(0, 5).map((u) => u.replace(BASE, '')));
  if (erros.length) console.log('  console:', [...new Set(erros)].slice(0, 4));
  if (falhas.length) console.log('  http>=400:', [...new Set(falhas)].slice(0, 6));
  await page.close();
}

// mobile: overflow em cada página
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
console.log('\n== overflow mobile');
for (const rota of PAGINAS) {
  const p = await mob.newPage();
  await p.goto(BASE + rota, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(1500);
  const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`  ${rota.padEnd(20)} ${o}`);
  await p.close();
}

await browser.close();
