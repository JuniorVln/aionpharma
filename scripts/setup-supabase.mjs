/**
 * Setup Supabase — espera login REAL (sidebar "SQL Editor") e então:
 * - coleta anon + service_role
 * - executa schema.sql
 * - grava .env
 *
 * Uso: node scripts/setup-supabase.mjs
 * Ou com keys já conhecidas:
 *   node scripts/setup-supabase.mjs --anon=eyJ... --service=eyJ...
 * (ainda abre o browser só para rodar o SQL, ou use --sql-only com MANAGEMENT token)
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
const SCREENSHOT_DIR = path.join(ROOT, 'scripts', '.supabase-setup');

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...rest] = a.replace(/^--/, '').split('=');
      return [k, rest.join('=') || true];
    })
);

const cometExe = path.join(
  process.env.LOCALAPPDATA || '',
  'Perplexity',
  'Comet',
  'Application',
  'comet.exe'
);

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
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const p = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true }).catch(() => {});
  console.log('screenshot:', p);
}

/** Considera logado só se a sidebar do dashboard existir. */
async function isDashboardReady(page) {
  const url = page.url();
  if (/sign-in|login|authorize/i.test(url)) return false;
  const text = await page.locator('body').innerText().catch(() => '');
  if (/welcome back|sign in to your account|continue with github/i.test(text)) return false;
  // Marcadores reais do dashboard
  if (/sql editor|table editor|authentication|project settings/i.test(text) && url.includes(PROJECT_REF)) {
    return true;
  }
  // Link/nav
  if (await page.getByRole('link', { name: /sql editor/i }).count()) return true;
  return false;
}

async function ensureLoggedIn(page) {
  const deadline = Date.now() + 10 * 60 * 1000;
  let announced = false;
  while (Date.now() < deadline) {
    if (await isDashboardReady(page)) {
      console.log('Dashboard autenticado:', page.url());
      return;
    }
    if (!announced) {
      console.log('\n========================================');
      console.log(' FAÇA LOGIN no Comet que abriu agora');
      console.log(' (GitHub / e-mail / SSO)');
      console.log(' Depois o script continua sozinho.');
      console.log('========================================\n');
      announced = true;
    }
    console.log('…aguardando login', page.url().slice(0, 90));
    await shot(page, 'waiting-login');
    await page.waitForTimeout(5000);
  }
  throw new Error('Timeout login 10 min');
}

async function collectKeys(page) {
  const urls = [
    `https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api-keys`,
    `https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api`,
    `https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api-keys/legacy`,
  ];

  let anonKey = '';
  let serviceKey = '';

  for (const url of urls) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2500);
    if (!(await isDashboardReady(page))) continue;

    // Clica em Legacy se existir
    for (const label of [/legacy api keys/i, /legacy/i, /reveal/i, /show/i]) {
      const el = page.getByRole('button', { name: label }).or(page.getByRole('tab', { name: label }));
      const c = await el.count();
      for (let i = 0; i < Math.min(c, 6); i++) {
        await el.nth(i).click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(400);
      }
    }

    await shot(page, 'keys-' + url.split('/').pop());

    const text = await page.locator('body').innerText();
    for (const jwt of extractJwts(text)) {
      const role = roleOf(jwt);
      console.log('found', role, jwt.slice(0, 22) + '…');
      if (role === 'anon') anonKey = jwt;
      if (role === 'service_role') serviceKey = jwt;
    }

    // value attrs
    const nodes = page.locator('[value*="eyJ"], input, code');
    const n = await nodes.count();
    for (let i = 0; i < Math.min(n, 40); i++) {
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
    timeout: 60000,
  });
  await ensureLoggedIn(page);
  await page.waitForTimeout(3000);
  await shot(page, 'sql-editor');

  // Espera Monaco ou qualquer editor
  const ready = await Promise.race([
    page.waitForSelector('.monaco-editor', { timeout: 45000 }).then(() => 'monaco'),
    page.waitForSelector('textarea.inputarea', { timeout: 45000 }).then(() => 'textarea'),
  ]).catch(() => null);

  if (!ready) throw new Error('SQL Editor não carregou');

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

  await page.waitForTimeout(500);
  await shot(page, 'sql-filled');

  const runBtn = page.getByRole('button', { name: /^run$/i });
  if (await runBtn.count()) await runBtn.first().click();
  else await page.keyboard.press('Control+Enter');

  await page.waitForTimeout(7000);
  await shot(page, 'sql-result');
  const tail = (await page.locator('body').innerText()).slice(-2500);
  console.log('SQL result tail:', tail.slice(0, 400).replace(/\s+/g, ' '));
  return !/error:|syntax error|failed to run/i.test(tail);
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
  console.log('OK: .env + admin/.env gravados');
}

async function main() {
  let anonKey = typeof args.anon === 'string' ? args.anon : '';
  let serviceKey = typeof args.service === 'string' ? args.service : '';

  console.log('Projeto', PROJECT_REF);

  const userData = path.join(process.env.TEMP || '.', `aion-sb-${Date.now()}`);
  const context = await chromium.launchPersistentContext(userData, {
    executablePath: fs.existsSync(cometExe) ? cometExe : undefined,
    headless: false,
    viewport: { width: 1440, height: 920 },
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = context.pages()[0] || (await context.newPage());

  await page.goto(`https://supabase.com/dashboard/project/${PROJECT_REF}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await ensureLoggedIn(page);

  if (!anonKey || !serviceKey) {
    const keys = await collectKeys(page);
    anonKey = anonKey || keys.anonKey;
    serviceKey = serviceKey || keys.serviceKey;
  }

  const sqlOk = await runSql(page);
  console.log('SQL ok?', sqlOk);

  if (anonKey && serviceKey) writeEnvs(anonKey, serviceKey);
  else {
    console.log('\nCole no chat as keys (Settings → API Keys → Legacy):');
    console.log('  anon + service_role');
  }

  console.log('\nAbra Auth → Users e crie o admin (e-mail/senha) se ainda não existir.');
  await page.goto(`https://supabase.com/dashboard/project/${PROJECT_REF}/auth/users`, {
    waitUntil: 'domcontentloaded',
  }).catch(() => {});
  console.log('Browser fica aberto 90s para você criar o usuário admin…');
  await page.waitForTimeout(90000);
  await context.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
