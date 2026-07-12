/**
 * Conecta no Comet já aberto (CDP :9222) e configura o projeto Supabase.
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
  const p = path.join(SHOT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true }).catch(() => {});
  console.log('shot', name);
}

async function collectKeys(page) {
  const urls = [
    `https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api-keys`,
    `https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api`,
  ];
  let anonKey = '';
  let serviceKey = '';

  for (const url of urls) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(3000);
    await shot(page, 'keys-' + url.split('/').pop());

    // Legacy tab / reveal
    for (const name of [/legacy api keys/i, /legacy/i, /reveal/i, /show secret/i, /show/i]) {
      const btns = page.getByRole('button', { name }).or(page.getByRole('tab', { name }));
      const c = await btns.count();
      for (let i = 0; i < Math.min(c, 8); i++) {
        await btns.nth(i).click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(500);
      }
    }
    await page.waitForTimeout(1000);

    const text = await page.locator('body').innerText();
    for (const jwt of extractJwts(text)) {
      const role = roleOf(jwt);
      console.log('JWT', role, jwt.slice(0, 24) + '…');
      if (role === 'anon') anonKey = jwt;
      if (role === 'service_role') serviceKey = jwt;
    }

    const nodes = page.locator('input, code, pre, [value*="eyJ"]');
    const n = await nodes.count();
    for (let i = 0; i < Math.min(n, 50); i++) {
      const v =
        (await nodes.nth(i).getAttribute('value').catch(() => '')) ||
        (await nodes.nth(i).innerText().catch(() => ''));
      for (const jwt of extractJwts(v || '')) {
        const role = roleOf(jwt);
        if (role === 'anon') anonKey = jwt;
        if (role === 'service_role') serviceKey = jwt;
      }
    }
    if (anonKey && serviceKey) break;
  }
  return { anonKey, serviceKey };
}

async function runSql(page) {
  await page.goto(`https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForTimeout(4000);
  await shot(page, 'sql-before');

  await page.waitForSelector('.monaco-editor', { timeout: 60000 });

  const setOk = await page.evaluate((sql) => {
    const models = window.monaco?.editor?.getModels?.() || [];
    if (models[0]) {
      models[0].setValue(sql);
      return true;
    }
    return false;
  }, SCHEMA);

  if (!setOk) {
    await page.locator('.monaco-editor').first().click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(SCHEMA);
  }

  await page.waitForTimeout(800);
  await shot(page, 'sql-filled');

  const runBtn = page.getByRole('button', { name: /^run$/i });
  if (await runBtn.count()) await runBtn.first().click();
  else await page.keyboard.press('Control+Enter');

  await page.waitForTimeout(8000);
  await shot(page, 'sql-result');
  const tail = (await page.locator('body').innerText()).slice(-3000);
  console.log('SQL tail:', tail.slice(0, 500).replace(/\s+/g, ' '));
  const failed = /error:|syntax error|failed to run|permission denied/i.test(tail);
  return !failed;
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
  console.log('Conectando no Comet CDP :9222…');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = await context.newPage();

  // Confirma sessão
  await page.goto(`https://supabase.com/dashboard/project/${PROJECT_REF}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForTimeout(2500);
  await shot(page, 'home');
  const body = await page.locator('body').innerText();
  if (/sign in to your account|welcome back/i.test(body) && !/sql editor|table editor/i.test(body)) {
    throw new Error('Sessão não detectada nesta aba CDP — confirme o login no Comet');
  }
  console.log('Sessão OK');

  const { anonKey, serviceKey } = await collectKeys(page);
  const sqlOk = await runSql(page);
  console.log('SQL ok?', sqlOk);

  if (anonKey && serviceKey) writeEnvs(anonKey, serviceKey);
  else console.log('Keys não lidas — rode de novo ou cole anon/service_role no chat');

  // Vai para Auth users para o user ver
  await page.goto(`https://supabase.com/dashboard/project/${PROJECT_REF}/auth/users`, {
    waitUntil: 'domcontentloaded',
  }).catch(() => {});
  await shot(page, 'auth-users');

  await page.close().catch(() => {});
  // Não fecha o browser do usuário
  console.log('Done (Comet permanece aberto).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
