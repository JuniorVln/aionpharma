/* ================================================================
   Acesso ao Postgres do HQ (VPS) — substitui o Supabase.

   Implementa o mesmo formato de chamada do supabase-js
   (from().select().eq()... devolvendo { data, error }) para que as
   rotas existentes continuem iguais. Trocamos o motor, não as queries.
   ================================================================ */

import pg from 'pg';

let pool = null;

export function getPool() {
  if (pool) return pool;
  const bruta = process.env.DATABASE_URL;
  if (!bruta) throw new Error('DATABASE_URL não configurada.');

  // O sslmode dentro da URL faz o node-postgres exigir uma CA pública e
  // ignorar a opção ssl abaixo. Tiramos da string e controlamos aqui:
  // a conexão continua criptografada (o servidor só aceita TLS), sem
  // validar a cadeia — o certificado do nosso Postgres é próprio.
  const connectionString = bruta.replace(/([?&])sslmode=[^&]*(&|$)/, (_m, a, b) => (b ? a : ''));

  pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
  return pool;
}

const ident = (s) => '"' + String(s).replace(/"/g, '""') + '"';

/* Descobre a coluna que liga duas tabelas, para os selects aninhados
   no estilo PostgREST: select('*, influencers(id, nome)'). */
const fkCache = new Map();
async function acharFk(tabela, relacionada) {
  const chave = tabela + '->' + relacionada;
  if (fkCache.has(chave)) return fkCache.get(chave);
  const { rows } = await getPool().query(
    `select kcu.column_name as coluna, ccu.column_name as destino
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu
         on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
       join information_schema.constraint_column_usage ccu
         on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_schema = 'public'
        and tc.table_name = $1
        and ccu.table_name = $2
      limit 1`,
    [tabela, relacionada]
  );
  const fk = rows[0] || null;
  fkCache.set(chave, fk);
  return fk;
}

/* Separa "*, influencers(id, nome)" em colunas simples + relações. */
function parseSelect(texto) {
  const t = (texto || '*').trim();
  const colunas = [];
  const relacoes = [];
  let buf = '';
  let nivel = 0;
  for (const ch of t + ',') {
    if (ch === '(') nivel++;
    if (ch === ')') nivel--;
    if (ch === ',' && nivel === 0) {
      const parte = buf.trim();
      buf = '';
      if (!parte) continue;
      const m = parte.match(/^([a-zA-Z0-9_]+)\s*\((.*)\)$/s);
      if (m) {
        relacoes.push({
          tabela: m[1],
          campos: m[2].split(',').map((c) => c.trim()).filter(Boolean),
        });
      } else {
        colunas.push(parte);
      }
      continue;
    }
    buf += ch;
  }
  return { colunas: colunas.length ? colunas : ['*'], relacoes };
}

class Query {
  constructor(tabela) {
    this.tabela = tabela;
    this.filtros = [];
    this.ordens = [];
    this._select = null;
    this._limite = null;
    this._modo = 'select';
    this._payload = null;
    this._onConflict = null;
    this._unico = null; // 'single' | 'maybe'
    this._devolver = false;
  }

  select(cols) {
    this._select = cols || '*';
    this._devolver = true;
    return this;
  }
  insert(valores) { this._modo = 'insert'; this._payload = valores; return this; }
  update(valores) { this._modo = 'update'; this._payload = valores; return this; }
  upsert(valores, opts) {
    this._modo = 'upsert';
    this._payload = valores;
    this._onConflict = (opts && opts.onConflict) || null;
    return this;
  }
  delete() { this._modo = 'delete'; return this; }

  eq(col, val) { this.filtros.push({ col, op: '=', val }); return this; }
  neq(col, val) { this.filtros.push({ col, op: '<>', val }); return this; }
  gt(col, val) { this.filtros.push({ col, op: '>', val }); return this; }
  gte(col, val) { this.filtros.push({ col, op: '>=', val }); return this; }
  lt(col, val) { this.filtros.push({ col, op: '<', val }); return this; }
  lte(col, val) { this.filtros.push({ col, op: '<=', val }); return this; }
  is(col, val) { this.filtros.push({ col, op: 'is', val }); return this; }
  in(col, vals) { this.filtros.push({ col, op: 'in', val: vals }); return this; }
  ilike(col, val) { this.filtros.push({ col, op: 'ilike', val }); return this; }
  like(col, val) { this.filtros.push({ col, op: 'like', val }); return this; }
  match(obj) { for (const [c, v] of Object.entries(obj || {})) this.eq(c, v); return this; }

  order(col, opts) { this.ordens.push({ col, asc: !(opts && opts.ascending === false) }); return this; }
  limit(n) { this._limite = n; return this; }
  single() { this._unico = 'single'; return this; }
  maybeSingle() { this._unico = 'maybe'; return this; }

  _where(params) {
    if (!this.filtros.length) return '';
    const partes = this.filtros.map((f) => {
      if (f.op === 'in') {
        const lista = (f.val || []).map((v) => { params.push(v); return '$' + params.length; });
        return lista.length ? ident(f.col) + ' in (' + lista.join(',') + ')' : 'false';
      }
      if (f.op === 'is') {
        const alvo = f.val === null ? 'null' : f.val ? 'true' : 'false';
        return ident(f.col) + ' is ' + alvo;
      }
      params.push(f.val);
      return ident(f.col) + ' ' + f.op + ' $' + params.length;
    });
    return ' where ' + partes.join(' and ');
  }

  async _sql() {
    const params = [];

    if (this._modo === 'select') {
      const { colunas, relacoes } = parseSelect(this._select || '*');
      const campos = [];
      for (const c of colunas) campos.push(c === '*' ? ident(this.tabela) + '.*' : ident(c));
      for (const rel of relacoes) {
        const fk = await acharFk(this.tabela, rel.tabela);
        if (!fk) { campos.push('null as ' + ident(rel.tabela)); continue; }
        const sub = rel.campos.length && rel.campos[0] !== '*'
          ? 'json_build_object(' + rel.campos.map((c) => "'" + c + "', r." + ident(c)).join(', ') + ')'
          : 'to_jsonb(r)';
        campos.push(
          '(select ' + sub + ' from ' + ident(rel.tabela) + ' r where r.' + ident(fk.destino) +
          ' = ' + ident(this.tabela) + '.' + ident(fk.coluna) + ') as ' + ident(rel.tabela)
        );
      }
      let sql = 'select ' + campos.join(', ') + ' from ' + ident(this.tabela) + this._where(params);
      if (this.ordens.length) {
        sql += ' order by ' + this.ordens.map((o) => ident(o.col) + (o.asc ? ' asc' : ' desc')).join(', ');
      }
      if (this._limite) sql += ' limit ' + Number(this._limite);
      return { sql, params };
    }

    if (this._modo === 'insert' || this._modo === 'upsert') {
      const linhas = Array.isArray(this._payload) ? this._payload : [this._payload];
      const cols = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
      const valores = linhas.map(
        (l) => '(' + cols.map((c) => { params.push(l[c] === undefined ? null : l[c]); return '$' + params.length; }).join(', ') + ')'
      );
      let sql = 'insert into ' + ident(this.tabela) + ' (' + cols.map(ident).join(', ') + ') values ' + valores.join(', ');
      if (this._modo === 'upsert') {
        const chaves = (this._onConflict || cols[0]).split(',').map((c) => c.trim());
        const alvo = chaves.map(ident).join(', ');
        const atualiza = cols.filter((c) => !chaves.includes(c));
        sql += ' on conflict (' + alvo + ') do ' + (atualiza.length
          ? 'update set ' + atualiza.map((c) => ident(c) + ' = excluded.' + ident(c)).join(', ')
          : 'nothing');
      }
      if (this._devolver) sql += ' returning *';
      return { sql, params };
    }

    if (this._modo === 'update') {
      const cols = Object.keys(this._payload || {});
      const sets = cols.map((c) => { params.push(this._payload[c]); return ident(c) + ' = $' + params.length; });
      let sql = 'update ' + ident(this.tabela) + ' set ' + sets.join(', ') + this._where(params);
      if (this._devolver) sql += ' returning *';
      return { sql, params };
    }

    if (this._modo === 'delete') {
      let sql = 'delete from ' + ident(this.tabela) + this._where(params);
      if (this._devolver) sql += ' returning *';
      return { sql, params };
    }

    throw new Error('modo não suportado: ' + this._modo);
  }

  /* torna a query "thenable": await na query já executa, como no supabase-js */
  then(resolve, reject) {
    return this._executar().then(resolve, reject);
  }

  async _executar() {
    try {
      const { sql, params } = await this._sql();
      const { rows } = await getPool().query(sql, params);
      if (this._unico) {
        if (rows.length === 0) {
          if (this._unico === 'maybe') return { data: null, error: null };
          return { data: null, error: { message: 'Nenhuma linha encontrada', code: 'PGRST116' } };
        }
        return { data: rows[0], error: null };
      }
      return { data: rows, error: null, count: rows.length };
    } catch (e) {
      return { data: null, error: { message: e.message, code: e.code || 'DB_ERROR' } };
    }
  }
}

/** Cliente com a mesma cara do supabase-js, mas falando com o nosso Postgres. */
export function getDb() {
  return {
    from(tabela) { return new Query(tabela); },
    async rpc(nome, params) {
      try {
        const p = params || {};
        const chaves = Object.keys(p);
        const args = chaves.map((k, i) => ident(k) + ' => $' + (i + 1));
        const { rows } = await getPool().query(
          'select * from ' + ident(nome) + '(' + args.join(', ') + ')',
          chaves.map((k) => p[k])
        );
        const primeiro = rows[0];
        const valor = primeiro && Object.keys(primeiro).length === 1 ? Object.values(primeiro)[0] : rows;
        return { data: valor === undefined ? null : valor, error: null };
      } catch (e) {
        return { data: null, error: { message: e.message, code: e.code || 'DB_ERROR' } };
      }
    },
  };
}

export default { getDb, getPool };
