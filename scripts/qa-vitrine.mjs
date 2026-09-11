import { chromium } from 'playwright';
import fs from 'fs';

const OUT = process.env.QA_OUT || './_qa';
const senha = fs.readFileSync(process.env.TEMP + '/qa-vitrine.txt', 'utf8').split('\n')[0];
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();

// 1) Home — o bloco de destaque agora vem da API
await page.goto('https://www.aionpharma.ind.br/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const destaque = page.locator('#featured-product');
await destaque.scrollIntoViewIfNeeded();
await page.waitForTimeout(1200);
await destaque.screenshot({ path: `${OUT}/home-destaque.png` });
console.log('titulo:', (await page.locator('#destaque-titulo').innerText()).replace(/\n/g, ' | '));
console.log('preco:', await page.locator('#destaque-preco').innerText());
console.log('beneficios:', await page.locator('#destaque-beneficios .benefit-item').count());

// catálogo da home (nomes corrigidos)
await page.locator('#products').scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
await page.locator('#products').screenshot({ path: `${OUT}/home-produtos.png` });

// 2) Painel
await page.goto('https://www.aionpharma.ind.br/admin/', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'qa-vitrine@aionpharma.local');
await page.fill('input[type=password]', senha);
await page.click('button[type=submit]');
await page.waitForTimeout(2500);
await page.goto('https://www.aionpharma.ind.br/admin/#/vitrine', { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/painel-destaque.png`, fullPage: true });
await page.click('text=Produtos (');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/painel-produtos.png`, fullPage: true });
// abre a edição do primeiro produto
await page.locator('table.table tbody tr').first().locator('text=Editar').click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/painel-produto-edicao.png`, fullPage: true });

// 3) Mobile
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mp = await mob.newPage();
await mp.goto('https://www.aionpharma.ind.br/', { waitUntil: 'networkidle' });
await mp.waitForTimeout(2500);
await mp.locator('#featured-product').scrollIntoViewIfNeeded();
await mp.waitForTimeout(1000);
await mp.locator('#featured-product').screenshot({ path: `${OUT}/mobile-destaque.png` });
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log('overflow horizontal mobile:', overflow);

await browser.close();
console.log('screenshots em', OUT);
