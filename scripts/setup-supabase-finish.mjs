/**
 * Continua setup: confirma Run query, pega Legacy keys, valida tabelas.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PROJECT_REF = 'sgcfoodrxqzqfhozibqj';
const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`;
const SCHEMA = fs.readFileSync(path.join(ROOT, 'supabase', 'schema.sql'), 'utf8');
const SHOT = path.join(ROOT, 'scripts', '.supabase-setup');

function roleOf(jwt) {
  try {
    return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).role || '';
  } catch {
    return '';
  }
}

function extractJwts(text) {
  return [...new Set(text.match(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g) || [])];
}

async function shot(page, name) {
  fs.mkdirSync(SHOT, { recursive: true });
  await page.screenshot({ path: path.join(SHOT, `${name}.png`), fullPage: true }).catch(() => {});
  console.log('shot', name);
}

function writeEnvs(anonKey, serviceKey) {
  const envPath = path.join(ROOT, '.env');
  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const upsert = (key, val) => {
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(env)) env = env.replace(re, `${key}=${val}`);
    else env = `${env.trimEnd()}\n${key}=${val}\n`;
  };
  upsert('SUPABASE_URL', PROJECT_URL);
  upsert('SUPABASE_ANON_KEY', anonKey);
  upsert('SUPABASE_SERVICE_ROLE_KEY', serviceKey);
  fs.writeFileSync(envPath, env);
  fs.writeFileSync(
    path.join(ROOT, 'admin', '.env'),
    `VITE_SUPABASE_URL=${PROJECT_URL}\nVITE_SUPABASE_ANON_KEY=${anonKey}\n`
  );
  fs.writeFileSync(
    path.join(ROOT, 'scripts', '.supabase-keys.json'),
    JSON.stringify({ url: PROJECT_URL, anon: anonKey, service_role: serviceKey }, null, 2)
  );
  console.log('Gravado .env + admin/.env');
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = await context.newPage();

  // ── 1) SQL com confirmação do modal ──
  console.log('SQL Editor…');
  await page.goto(`https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForTimeout(3500);
  await page.waitForSelector('.monaco-editor', { timeout: 60000 });

  await page.evaluate((sql) => {
    const models = window.monaco?.editor?.getModels?.() || [];
    if (models[0]) models[0].setValue(sql);
  }, SCHEMA);
  await page.waitForTimeout(500);

  // Clica Run
  const runBtn = page.getByRole('button', { name: /^run$/i });
  if (await runBtn.count()) await runBtn.first().click();
  else await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(1500);

  // Modal "Potential issue detected" → Run query
  const confirm = page.getByRole('button', { name: /run this query|run query/i });
  if (await confirm.count()) {
    console.log('Confirmando modal destructivo…');
    await confirm.first().click();
  } else {
    // fallback pelo texto do dialog
    const dialogRun = page.locator('button:has-text("Run query"), button:has-text("Run this query")');
    if (await dialogRun.count()) {
      await dialogRun.first().click();
    }
  }

  await page.waitForTimeout(8000);
  await shot(page, 'sql-confirmed');
  const sqlTail = (await page.locator('body').innerText()).slice(-2000);
  console.log('SQL result:', sqlTail.slice(0, 400).replace(/\s+/g, ' '));

  // ── 2) Legacy API keys ──
  console.log('Legacy API keys…');
  await page.goto(`https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api-keys`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForTimeout(2500);

  const legacyTab = page.getByRole('tab', { name: /legacy/i }).or(
    page.locator('button, a, [role="tab"]').filter({ hasText: /legacy/i })
  );
  if (await legacyTab.count()) {
    await legacyTab.first().click();
    await page.waitForTimeout(2000);
  } else {
    // click by text
    await page.getByText(/legacy anon.*service_role/i).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  await shot(page, 'legacy-keys');

  // Reveal / copy buttons
  const reveal = page.getByRole('button', { name: /reveal|show|copy/i });
  const rc = await reveal.count();
  for (let i = 0; i < Math.min(rc, 10); i++) {
    await reveal.nth(i).click({ timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(800);
  await shot(page, 'legacy-keys-revealed');

  let anonKey = '';
  let serviceKey = '';
  const text = await page.locator('body').innerText();
  for (const jwt of extractJwts(text)) {
    const role = roleOf(jwt);
    console.log('JWT', role, jwt.slice(0, 28) + '…');
    if (role === 'anon') anonKey = jwt;
    if (role === 'service_role') serviceKey = jwt;
  }

  // Also check input values / copy from DOM
  const all = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('input, textarea, code, pre, p, span, div').forEach((el) => {
      const v = el.getAttribute?.('value') || el.textContent || '';
      if (v.includes('eyJ') && v.length > 80) out.push(v.trim());
    });
    return out;
  });
  for (const chunk of all) {
    for (const jwt of extractJwts(chunk)) {
      const role = roleOf(jwt);
      if (role === 'anon') anonKey = jwt;
      if (role === 'service_role') serviceKey = jwt;
    }
  }

  if (anonKey && serviceKey) {
    writeEnvs(anonKey, serviceKey);
  } else {
    console.log('Keys ainda não encontradas. anon?', !!anonKey, 'service?', !!serviceKey);
  }

  // ── 3) Validar tabelas ──
  if (serviceKey) {
    const res = await fetch(`${PROJECT_URL}/rest/v1/coupons?select=id&limit=1`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    console.log('GET /coupons status:', res.status, await res.text().then((t) => t.slice(0, 200)));
  } else {
    // SQL check via editor
    await page.goto(`https://supabase.com/dashboard/project/${PROJECT_REF}/editor`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(3000);
    await shot(page, 'table-editor');
  }

  await page.close().catch(() => {});
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
