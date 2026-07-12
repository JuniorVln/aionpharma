import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';

type Influencer = { id: string; nome: string; instagram: string | null };
type Coupon = {
  id: string;
  codigo: string;
  desconto_percent: number;
  valido_de: string | null;
  valido_ate: string | null;
  ativo: boolean;
  usos: number;
  influencer_id: string | null;
  influencers: Influencer | null;
};

const empty = {
  codigo: '',
  desconto_percent: '10',
  valido_de: '',
  valido_ate: '',
  influencer_id: '',
  ativo: true,
};

function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string) {
  if (!v) return null;
  return new Date(v).toISOString();
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [c, i] = await Promise.all([
      apiFetch('/api/admin/coupons'),
      apiFetch('/api/admin/influencers'),
    ]);
    setCoupons(c.coupons || []);
    setInfluencers((i.influencers || []).filter((x: Influencer & { ativo?: boolean }) => x.ativo !== false));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  function startEdit(c: Coupon) {
    setEditingId(c.id);
    setForm({
      codigo: c.codigo,
      desconto_percent: String(c.desconto_percent),
      valido_de: toLocalInput(c.valido_de),
      valido_ate: toLocalInput(c.valido_ate),
      influencer_id: c.influencer_id || '',
      ativo: c.ativo,
    });
  }

  function reset() {
    setEditingId(null);
    setForm(empty);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const payload = {
      codigo: form.codigo.trim().toUpperCase(),
      desconto_percent: Number(form.desconto_percent),
      valido_de: fromLocalInput(form.valido_de),
      valido_ate: fromLocalInput(form.valido_ate),
      influencer_id: form.influencer_id || null,
      ativo: form.ativo,
    };
    try {
      if (editingId) {
        await apiFetch('/api/admin/coupons', {
          method: 'PATCH',
          body: JSON.stringify({ id: editingId, ...payload }),
        });
      } else {
        await apiFetch('/api/admin/coupons', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setBusy(false);
    }
  }

  async function toggleAtivo(c: Coupon) {
    try {
      await apiFetch('/api/admin/coupons', {
        method: 'PATCH',
        body: JSON.stringify({ id: c.id, ativo: !c.ativo }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Cupons</h1>
          <p className="muted">Crie códigos personalizados para influencers</p>
        </div>
      </header>

      <div className="grid-2">
        <form className="panel form-panel" onSubmit={onSubmit}>
          <h2>{editingId ? 'Editar cupom' : 'Novo cupom'}</h2>
          <label>
            Código*
            <input
              required
              placeholder="MARIA10"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
            />
          </label>
          <label>
            Desconto (%)*
            <input
              required
              type="number"
              min={1}
              max={100}
              step={0.5}
              value={form.desconto_percent}
              onChange={(e) => setForm({ ...form, desconto_percent: e.target.value })}
            />
          </label>
          <label>
            Influencer
            <select
              value={form.influencer_id}
              onChange={(e) => setForm({ ...form, influencer_id: e.target.value })}
            >
              <option value="">— Sem vínculo —</option>
              {influencers.map((inf) => (
                <option key={inf.id} value={inf.id}>
                  {inf.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="row-2">
            <label>
              Válido de
              <input
                type="datetime-local"
                value={form.valido_de}
                onChange={(e) => setForm({ ...form, valido_de: e.target.value })}
              />
            </label>
            <label>
              Válido até
              <input
                type="datetime-local"
                value={form.valido_ate}
                onChange={(e) => setForm({ ...form, valido_ate: e.target.value })}
              />
            </label>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            Ativo
          </label>
          {error && <p className="error">{error}</p>}
          <div className="row-actions">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Salvando…' : editingId ? 'Atualizar' : 'Criar cupom'}
            </button>
            {editingId && (
              <button type="button" className="btn-ghost" onClick={reset}>
                Cancelar
              </button>
            )}
          </div>
        </form>

        <div className="panel">
          <h2>Lista</h2>
          {coupons.length === 0 ? (
            <p className="muted">Nenhum cupom ainda.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>%</th>
                  <th>Influencer</th>
                  <th>Usos</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/cupons/${c.id}`} className="code-link">
                        {c.codigo}
                      </Link>
                    </td>
                    <td>{Number(c.desconto_percent)}%</td>
                    <td>{c.influencers?.nome || '—'}</td>
                    <td>{c.usos}</td>
                    <td>
                      <span className={c.ativo ? 'badge ok' : 'badge off'}>
                        {c.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="td-actions">
                      <button type="button" className="btn-link" onClick={() => startEdit(c)}>
                        Editar
                      </button>
                      <button type="button" className="btn-link" onClick={() => toggleAtivo(c)}>
                        {c.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
