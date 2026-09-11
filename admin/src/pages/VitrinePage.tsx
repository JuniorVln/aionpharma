import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { apiFetch } from '../lib/api';

type Destaque = {
  ativo: boolean;
  badge: string | null;
  titulo: string | null;
  tituloRealce: string | null;
  texto: string | null;
  beneficios: string[];
  sku: string | null;
  precoPrefixo: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  cta2Label: string | null;
  cta2Url: string | null;
  imagem: string | null;
  imagemUrl: string | null;
  temImagemPropria: boolean;
};

type Produto = {
  sku: string;
  idTiny: string;
  nomeSistema: string;
  preco: number;
  situacao: string;
  imagemSistema: string;
  nome: string;
  descricao: string;
  imagemUrl: string;
  temImagemPropria: boolean;
  imagemPropria: string;
  oculto: boolean;
  ordem: number | '';
};

const moeda = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Lê o arquivo escolhido e devolve o base64 puro (sem o prefixo data:). */
function lerArquivo(file: File): Promise<{ mime: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não consegui ler o arquivo.'));
    reader.onload = () => {
      const raw = String(reader.result || '');
      resolve({ mime: file.type, base64: raw.split(',').pop() || '' });
    };
    reader.readAsDataURL(file);
  });
}

export default function VitrinePage() {
  const [aba, setAba] = useState<'destaque' | 'produtos'>('destaque');
  const [destaque, setDestaque] = useState<Destaque | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Produto | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [busy, setBusy] = useState(false);
  const [carregando, setCarregando] = useState(true);

  async function load() {
    const d = await apiFetch('/api/admin/vitrine');
    setDestaque(d.destaque);
    setProdutos(d.produtos || []);
    setCarregando(false);
  }

  useEffect(() => {
    load().catch((e) => {
      setError(e.message);
      setCarregando(false);
    });
  }, []);

  const precoDoDestaque = useMemo(() => {
    if (!destaque?.sku) return null;
    const p = produtos.find((x) => x.sku === destaque.sku);
    return p ? p.preco : null;
  }, [destaque?.sku, produtos]);

  function mexer<K extends keyof Destaque>(campo: K, valor: Destaque[K]) {
    setDestaque((d) => (d ? { ...d, [campo]: valor } : d));
  }

  async function salvarDestaque(e: FormEvent) {
    e.preventDefault();
    if (!destaque) return;
    setBusy(true);
    setError('');
    setAviso('');
    try {
      await apiFetch('/api/admin/vitrine', {
        method: 'PUT',
        body: JSON.stringify({
          alvo: 'destaque',
          ativo: destaque.ativo,
          badge: destaque.badge,
          titulo: destaque.titulo,
          titulo_realce: destaque.tituloRealce,
          texto: destaque.texto,
          beneficios: destaque.beneficios,
          sku: destaque.sku,
          preco_prefixo: destaque.precoPrefixo,
          cta_label: destaque.ctaLabel,
          cta_url: destaque.ctaUrl,
          cta2_label: destaque.cta2Label,
          cta2_url: destaque.cta2Url,
          imagem_url: destaque.imagemUrl,
        }),
      });
      await load();
      setAviso('Destaque salvo. A home atualiza em até 5 minutos (o cache da página).');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setBusy(false);
    }
  }

  async function enviarImagem(alvo: string, file: File | null | undefined) {
    if (!file) return;
    setBusy(true);
    setError('');
    setAviso('');
    try {
      const { mime, base64 } = await lerArquivo(file);
      await apiFetch('/api/admin/vitrine', {
        method: 'POST',
        body: JSON.stringify({ alvo, mime, base64 }),
      });
      await load();
      setAviso('Foto enviada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar a foto');
    } finally {
      setBusy(false);
    }
  }

  async function tirarImagem(alvo: string) {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/admin/vitrine?imagem=${encodeURIComponent(alvo)}`, { method: 'DELETE' });
      await load();
      setAviso('Foto removida — volta a valer a do sistema.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function salvarProduto(e: FormEvent) {
    e.preventDefault();
    if (!rascunho) return;
    setBusy(true);
    setError('');
    setAviso('');
    try {
      await apiFetch('/api/admin/vitrine', {
        method: 'PUT',
        body: JSON.stringify({
          alvo: 'produto',
          sku: rascunho.sku,
          nome: rascunho.nome,
          descricao: rascunho.descricao,
          imagem_url: rascunho.imagemUrl,
          oculto: rascunho.oculto,
          ordem: rascunho.ordem,
        }),
      });
      await load();
      setAviso(`Produto ${rascunho.sku} salvo.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setBusy(false);
    }
  }

  async function zerarProduto(sku: string) {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/admin/vitrine?sku=${encodeURIComponent(sku)}`, { method: 'DELETE' });
      setEditando(null);
      setRascunho(null);
      await load();
      setAviso(`As correções do ${sku} foram apagadas — voltou tudo ao que vem do sistema.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  function editar(p: Produto) {
    setEditando(p.sku);
    setRascunho({ ...p });
  }

  if (carregando) return <div className="boot">Carregando…</div>;

  return (
    <>
      <div className="page-header">
        <h1>Vitrine</h1>
        <p className="muted">
          O que você muda aqui aparece no site sem precisar de programador. Preço e código
          continuam vindo do sistema (Olist/Tiny) — aqui você corrige o que vem errado e põe
          as fotos.
        </p>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={aba === 'destaque' ? 'tab active' : 'tab'}
          onClick={() => setAba('destaque')}
        >
          Destaque da home
        </button>
        <button
          type="button"
          className={aba === 'produtos' ? 'tab active' : 'tab'}
          onClick={() => setAba('produtos')}
        >
          Produtos ({produtos.length})
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {aviso && <p className="aviso">{aviso}</p>}

      {aba === 'destaque' && destaque && (
        <div className="grid-2">
          <form className="panel form-panel" onSubmit={salvarDestaque}>
            <label className="check">
              <input
                type="checkbox"
                checked={destaque.ativo}
                onChange={(e) => mexer('ativo', e.target.checked)}
              />
              Mostrar este bloco na home
            </label>

            <label>
              Etiqueta (o selo pequeno em cima)
              <input
                value={destaque.badge || ''}
                onChange={(e) => mexer('badge', e.target.value)}
                placeholder="⭐ Produto Mais Vendido"
              />
            </label>

            <div className="row-2">
              <label>
                Título (enter quebra a linha)
                <textarea
                  rows={2}
                  value={destaque.titulo || ''}
                  onChange={(e) => mexer('titulo', e.target.value)}
                  placeholder={'Diga Adeus\nao'}
                />
              </label>
              <label>
                Palavra em dourado
                <input
                  value={destaque.tituloRealce || ''}
                  onChange={(e) => mexer('tituloRealce', e.target.value)}
                  placeholder="Tártaro"
                />
              </label>
            </div>

            <label>
              Texto
              <textarea
                rows={5}
                value={destaque.texto || ''}
                onChange={(e) => mexer('texto', e.target.value)}
              />
            </label>

            <div className="lista-beneficios">
              <span className="label-forte">Lista de benefícios (máx. 8)</span>
              {destaque.beneficios.map((b, i) => (
                <div className="row-inline" key={i}>
                  <input
                    value={b}
                    onChange={(e) => {
                      const copia = [...destaque.beneficios];
                      copia[i] = e.target.value;
                      mexer('beneficios', copia);
                    }}
                  />
                  <button
                    type="button"
                    className="btn-ghost btn-mini"
                    onClick={() =>
                      mexer(
                        'beneficios',
                        destaque.beneficios.filter((_, idx) => idx !== i)
                      )
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
              {destaque.beneficios.length < 8 && (
                <button
                  type="button"
                  className="btn-ghost btn-mini"
                  onClick={() => mexer('beneficios', [...destaque.beneficios, ''])}
                >
                  + adicionar linha
                </button>
              )}
            </div>

            <div className="row-2">
              <label>
                Preço vem deste produto
                <select
                  value={destaque.sku || ''}
                  onChange={(e) => mexer('sku', e.target.value)}
                >
                  <option value="">— não mostrar preço —</option>
                  {produtos.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.sku} · {p.nome || p.nomeSistema}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Texto antes do preço
                <input
                  value={destaque.precoPrefixo || ''}
                  onChange={(e) => mexer('precoPrefixo', e.target.value)}
                  placeholder="a partir de"
                />
              </label>
            </div>
            {precoDoDestaque !== null && (
              <p className="small muted">
                Hoje o sistema diz {moeda(precoDoDestaque)} para esse código. Se mudar lá, muda
                aqui sozinho.
              </p>
            )}

            <div className="row-2">
              <label>
                Botão principal
                <input
                  value={destaque.ctaLabel || ''}
                  onChange={(e) => mexer('ctaLabel', e.target.value)}
                  placeholder="Ver a Linha TartOff"
                />
              </label>
              <label>
                Link do botão
                <input
                  value={destaque.ctaUrl || ''}
                  onChange={(e) => mexer('ctaUrl', e.target.value)}
                  placeholder="produtos.html"
                />
              </label>
            </div>

            <div className="row-2">
              <label>
                Botão secundário (opcional)
                <input
                  value={destaque.cta2Label || ''}
                  onChange={(e) => mexer('cta2Label', e.target.value)}
                />
              </label>
              <label>
                Link do secundário
                <input
                  value={destaque.cta2Url || ''}
                  onChange={(e) => mexer('cta2Url', e.target.value)}
                />
              </label>
            </div>

            <div className="row-actions">
              <button className="btn-primary" disabled={busy} type="submit">
                {busy ? 'Salvando…' : 'Salvar destaque'}
              </button>
            </div>
          </form>

          <div className="panel">
            <h2 className="panel-title">Foto do destaque</h2>
            <div className="foto-box">
              {destaque.imagem ? (
                <img src={destaque.imagem} alt="Foto do destaque" />
              ) : (
                <span className="muted small">Sem foto</span>
              )}
            </div>
            <label>
              Trocar a foto (JPG, PNG ou WebP, até 2 MB)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(e) => enviarImagem('destaque', e.target.files?.[0])}
                disabled={busy}
              />
            </label>
            <label>
              …ou usar um link de imagem
              <input
                value={destaque.imagemUrl || ''}
                onChange={(e) => mexer('imagemUrl', e.target.value)}
                placeholder="/assets/produtos/gel-tartoff-lineup.png"
              />
            </label>
            <p className="small muted">
              A foto enviada aqui manda mais que o link. Salve o formulário ao lado para gravar
              o link.
            </p>
            {destaque.temImagemPropria && (
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => tirarImagem('destaque')}
              >
                Remover a foto enviada
              </button>
            )}
          </div>
        </div>
      )}

      {aba === 'produtos' && (
        <div className="grid-2">
          <div className="panel form-panel">
            {!rascunho && (
              <p className="muted small">
                Clique em <strong>Editar</strong> na lista ao lado para corrigir o nome, o texto
                ou a foto de um produto.
              </p>
            )}
            {rascunho && (
              <form className="form-panel" onSubmit={salvarProduto}>
                <h2 className="panel-title">
                  {rascunho.sku} · {moeda(rascunho.preco)}
                </h2>
                <p className="small muted">
                  No sistema está: <strong>{rascunho.nomeSistema}</strong>
                </p>

                <label>
                  Nome que aparece no site
                  <input
                    value={rascunho.nome}
                    onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                    placeholder={rascunho.nomeSistema}
                  />
                </label>
                <p className="small muted">Vazio = usa o nome do sistema.</p>

                <label>
                  Texto do produto
                  <textarea
                    rows={4}
                    value={rascunho.descricao}
                    onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
                  />
                </label>

                <div className="foto-box foto-box-sm">
                  {rascunho.temImagemPropria || rascunho.imagemUrl || rascunho.imagemSistema ? (
                    <img
                      src={
                        rascunho.imagemPropria || rascunho.imagemUrl || rascunho.imagemSistema
                      }
                      alt={rascunho.nome || rascunho.nomeSistema}
                    />
                  ) : (
                    <span className="muted small">Sem foto</span>
                  )}
                </div>

                <label>
                  Enviar foto (até 2 MB)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={(e) => enviarImagem(rascunho.sku, e.target.files?.[0])}
                    disabled={busy}
                  />
                </label>

                <label>
                  …ou link da imagem
                  <input
                    value={rascunho.imagemUrl}
                    onChange={(e) => setRascunho({ ...rascunho, imagemUrl: e.target.value })}
                  />
                </label>

                <div className="row-2">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={rascunho.oculto}
                      onChange={(e) => setRascunho({ ...rascunho, oculto: e.target.checked })}
                    />
                    Esconder da loja
                  </label>
                  <label>
                    Ordem (1 = primeiro)
                    <input
                      type="number"
                      min={1}
                      value={rascunho.ordem}
                      onChange={(e) =>
                        setRascunho({
                          ...rascunho,
                          ordem: e.target.value === '' ? '' : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>

                <div className="row-actions">
                  <button className="btn-primary" disabled={busy} type="submit">
                    {busy ? 'Salvando…' : 'Salvar produto'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setEditando(null);
                      setRascunho(null);
                    }}
                  >
                    Fechar
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-link"
                  disabled={busy}
                  onClick={() => zerarProduto(rascunho.sku)}
                >
                  Apagar as correções deste produto
                </button>
              </form>
            )}
          </div>

          <div className="panel">
            <table className="table">
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Produto</th>
                  <th>Preço</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => {
                  const foto = p.imagemPropria || p.imagemUrl || p.imagemSistema;
                  const corrigido = Boolean(p.nome && p.nome !== p.nomeSistema);
                  return (
                    <tr key={p.sku} className={editando === p.sku ? 'linha-ativa' : undefined}>
                      <td>
                        {foto ? (
                          <img className="thumb" src={foto} alt="" />
                        ) : (
                          <span className="thumb thumb-vazio">sem foto</span>
                        )}
                      </td>
                      <td>
                        <strong>{p.nome || p.nomeSistema}</strong>
                        <br />
                        <span className="small muted">
                          {p.sku}
                          {corrigido && <> · sistema: {p.nomeSistema}</>}
                          {p.oculto && <> · escondido</>}
                        </span>
                      </td>
                      <td>{moeda(p.preco)}</td>
                      <td>
                        <button type="button" className="btn-link" onClick={() => editar(p)}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
