import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';

type Stats = {
  usos: number;
  usos_contador: number;
  receita_gerada: number;
  desconto_concedido: number;
};

type Redemption = {
  id: string;
  pedido_id: string;
  pedido_numero: string | null;
  email_cliente: string | null;
  valor_pedido: number;
  valor_desconto: number;
  created_at: string;
};

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function CouponStatsPage() {
  const { id } = useParams();
  const [coupon, setCoupon] = useState<{
    codigo: string;
    desconto_percent: number;
    influencers?: { nome: string } | null;
  } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/admin/coupons?id=${encodeURIComponent(id)}&stats=1`)
      .then((data) => {
        setCoupon(data.coupon);
        setStats(data.stats);
        setRedemptions(data.redemptions || []);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="page">
        <p className="error">{error}</p>
        <Link to="/cupons">← Voltar</Link>
      </div>
    );
  }

  if (!coupon || !stats) {
    return <div className="page muted">Carregando relatório…</div>;
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/cupons" className="back-link">
            ← Cupons
          </Link>
          <h1>{coupon.codigo}</h1>
          <p className="muted">
            {Number(coupon.desconto_percent)}% off
            {coupon.influencers?.nome ? ` · ${coupon.influencers.nome}` : ''}
          </p>
        </div>
      </header>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Usos</span>
          <strong className="stat-value">{stats.usos}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Receita gerada</span>
          <strong className="stat-value">{brl(stats.receita_gerada)}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Desconto concedido</span>
          <strong className="stat-value">{brl(stats.desconto_concedido)}</strong>
        </div>
      </div>

      <div className="panel">
        <h2>Pedidos com este cupom</h2>
        {redemptions.length === 0 ? (
          <p className="muted">Nenhum uso confirmado ainda.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Valor</th>
                <th>Desconto</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                  <td>{r.pedido_numero || r.pedido_id}</td>
                  <td>{r.email_cliente || '—'}</td>
                  <td>{brl(Number(r.valor_pedido))}</td>
                  <td>{brl(Number(r.valor_desconto))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
