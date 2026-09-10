/* ================================================================
   GET /api/b2b/pf-pedidos — histórico da conta PF logada
   A situação vem da Olist/Tiny na hora da consulta: o pedido muda de
   estado lá (pago, enviado, cancelado) e copiar isso para cá criaria
   duas verdades. Se o Tiny não responder, devolvemos o que temos
   gravado com situacao null em vez de derrubar a página.
   ================================================================ */

import { getDb } from '../db.js';
import { obterPedido } from '../tiny.js';
import { contaPfDaRequisicao } from '../pf.js';

const LIMITE = 20;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const conta = await contaPfDaRequisicao(req);
  if (!conta) return res.status(401).json({ error: 'Sessão expirada. Entre de novo.' });

  try {
    const db = getDb();
    const { data, error } = await db
      .from('pf_orders')
      .select('*')
      .eq('account_id', conta.id)
      .order('created_at', { ascending: false })
      .limit(LIMITE);
    if (error) throw new Error(`pf_orders: ${error.message}`);

    const pedidos = await Promise.all(
      (data || []).map(async (p) => {
        const base = {
          pedidoId: p.pedido_id,
          numero: p.pedido_numero || p.pedido_id,
          data: p.created_at,
          valorItens: Number(p.valor_itens || 0),
          valorFrete: Number(p.valor_frete || 0),
          total: Number(p.valor_itens || 0) + Number(p.valor_frete || 0),
          situacao: null,
        };
        try {
          // obterPedido já devolve `retorno.pedido` desembrulhado.
          const pedido = await obterPedido(p.pedido_id);
          if (pedido) {
            base.situacao = pedido.situacao || null;
            base.rastreamento = pedido.codigo_rastreamento || '';
          }
        } catch {
          // Situação indisponível agora — o histórico continua legível.
        }
        return base;
      })
    );

    return res.status(200).json({ pedidos });
  } catch (err) {
    console.error('[/api/b2b/pf-pedidos]', err.message);
    return res.status(502).json({ error: 'Falha ao buscar seus pedidos', detail: err.message });
  }
}
