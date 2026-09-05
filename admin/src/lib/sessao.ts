/* Sessão do painel — substitui o Supabase Auth.
   O token vem de POST /api/admin/login e fica no localStorage. */

export type Usuario = { id: string; email: string };
export type Sessao = { token: string; user: Usuario };

const CHAVE = 'aion.admin.sessao';

export function lerSessao(): Sessao | null {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return null;
    const s = JSON.parse(cru) as Sessao;
    if (!s?.token || !s?.user?.id) return null;
    if (expirado(s.token)) {
      localStorage.removeItem(CHAVE);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function gravarSessao(s: Sessao | null) {
  try {
    if (s) localStorage.setItem(CHAVE, JSON.stringify(s));
    else localStorage.removeItem(CHAVE);
  } catch {
    /* navegador sem storage: a sessão dura só a aba */
  }
}

/** Lê o "exp" do token sem validar assinatura (quem valida é o servidor). */
function expirado(token: string): boolean {
  try {
    const parte = token.split('.')[1];
    if (!parte) return true;
    const json = JSON.parse(atob(parte.replace(/-/g, '+').replace(/_/g, '/')));
    return !json.exp || json.exp < Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

export async function entrar(email: string, password: string): Promise<Sessao> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Não foi possível entrar.');
  const s: Sessao = { token: json.token, user: json.user };
  gravarSessao(s);
  return s;
}
