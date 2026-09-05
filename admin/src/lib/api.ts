import { gravarSessao, lerSessao } from './sessao';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = lerSessao()?.token;
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...options, headers });
  const json = await res.json().catch(() => ({}));

  if (res.status === 401) {
    // token expirado ou inválido: derruba a sessão e manda logar de novo
    gravarSessao(null);
    if (typeof window !== 'undefined') window.location.reload();
    throw new Error('Sessão expirada. Entre novamente.');
  }
  if (!res.ok) {
    throw new Error(json.error || json.detail || `Erro ${res.status}`);
  }
  return json;
}
