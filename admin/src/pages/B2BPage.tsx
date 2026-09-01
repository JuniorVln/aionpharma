import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';

type Conta = {
  id: string;
  cnpj: string;
  cnpj_formatado: string;
  razao_social: string;
  nome_fantasia: string | null;
  email: string;
  telefone: string | null;
  contato_nome: string | null;
  nivel: 'lojista' | 'distribuicao';
  ativo: boolean;
  cidade: string | null;
  uf: string | null;
  cnpj_situacao: string | null;
  cnpj_verificado: boolean;
  ultimo_login: string | null;
  created_at: string;
  pedidos: number;
  total_comprado: number;
};

const NIVEL_LABEL: Record<Conta['nivel'], string> = {
  lojista: 'Lojista',
  distribuicao: 'Distribuição',
};

const moeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

export default function B2BPage() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [busca, setBusca] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch('/api/admin/b2b');
    setContas(data.contas || []);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return contas;
    return contas.filter((c) =>
      [c.razao_social, c.nome_fantasia, c.cnpj, c.cnpj_formatado, c.email, c.cidade]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(q))
    );
  }, [contas, busca]);

  async function patch(id: string, corpo: Record<string, unknown>) {
    setBusyId(id);
    setError('');
    try {
      await apiFetch('/api/admin/b2b', {
        method: 'PATCH',
        body: JSON.stringify({ id, ...corpo }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar');
    } finally {
      setBusyId(null);
    }
  }

  async function resetarSenha(conta: Conta) {
    const senha = window.prompt(
      `Nova senha para ${conta.razao_social} (mínimo 8 caracteres).\nPasse a senha para o cliente e peça para trocar depois.`
    );
    if (!senha) return;
    if (senha.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    await patch(conta.id, { senha });
  }

  const totalAtivas = contas.filter((c) => c.ativo).length;
  const totalDistribuicao = contas.filter((c) => c.nivel === 'distribuicao').length;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Contas com CNPJ</h1>
          <p className="muted">
            {contas.length} conta(s) · {totalAtivas} ativa(s) · {totalDistribuicao} em Distribuição.
            O nível define a tabela de preço que o cliente enxerga na loja.
          </p>
        </div>
        <input
          className="search"
          placeholder="Buscar por CNPJ, razão social, e-mail…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </header>

      {error && <p className="error">{error}</p>}

      <div className="panel">
        {filtradas.length === 0 ? (
          <p className="muted">Nenhuma conta encontrada.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Contato</th>
                <th>Tabela</th>
                <th>Pedidos</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.razao_social}</strong>
                    <div className="muted small">{c.cnpj_formatado}</div>
                    <div className="muted small">
                      {[c.cidade, c.uf].filter(Boolean).join('/') || '—'}
                      {c.cnpj_situacao ? ` · ${c.cnpj_situacao}` : ''}
                    </div>
                  </td>
                  <td>
                    {c.contato_nome || '—'}
                    <div className="muted small">{c.email}</div>
                    {c.telefone && <div className="muted small">{c.telefone}</div>}
                  </td>
                  <td>
                    <select
                      value={c.nivel}
                      disabled={busyId === c.id}
                      onChange={(e) => patch(c.id, { nivel: e.target.value })}
                    >
                      <option value="lojista">{NIVEL_LABEL.lojista}</option>
                      <option value="distribuicao">{NIVEL_LABEL.distribuicao}</option>
                    </select>
                  </td>
                  <td>
                    {c.pedidos}
                    <div className="muted small">{moeda(c.total_comprado)}</div>
                  </td>
                  <td>
                    <span className={c.ativo ? 'badge ok' : 'badge off'}>
                      {c.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                    <div className="muted small">Cadastro {dataCurta(c.created_at)}</div>
                    <div className="muted small">Último acesso {dataCurta(c.ultimo_login)}</div>
                  </td>
                  <td className="td-actions">
                    <button
                      type="button"
                      className="btn-link"
                      disabled={busyId === c.id}
                      onClick={() => patch(c.id, { ativo: !c.ativo })}
                    >
                      {c.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      type="button"
                      className="btn-link"
                      disabled={busyId === c.id}
                      onClick={() => resetarSenha(c)}
                    >
                      Resetar senha
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
