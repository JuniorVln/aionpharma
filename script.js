/* ================================================
   AION PHARMA — Main Script
   Cart, Animations, Mobile Nav, Toast, Newsletter
   ================================================ */

// ── State ─────────────────────────────────────────
let cart = [];
let selectedFrete = null; // { id, name, company, price, prazo }

// ── Init ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadCart();
  initScrollBehavior();
  initRevealAnimations();
  initMobileNav();
  initCatalog();
  initProductPage();
});

// ── Header Scroll ──────────────────────────────────
function initScrollBehavior() {
  const header = document.getElementById('header');
  if (!header) return;
  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}

// ── Reveal on Scroll ──────────────────────────────
function initRevealAnimations() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  items.forEach(el => observer.observe(el));
}

// ── Mobile Nav ─────────────────────────────────────
function initMobileNav() {
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('mobile-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
}

function closeMobileNav() {
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('mobile-nav');
  if (!toggle || !nav) return;
  nav.classList.remove('open');
  toggle.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

// ── Cart ───────────────────────────────────────────
function loadCart() {
  try {
    cart = JSON.parse(localStorage.getItem('aion_cart') || '[]');
  } catch {
    cart = [];
  }
  renderCartUI();
}

function saveCart() {
  localStorage.setItem('aion_cart', JSON.stringify(cart));
}

function addToCart(id, name, price, image) {
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, name, price, image, qty: 1 });
  }
  invalidarFrete();
  saveCart();
  renderCartUI();
  showToast(`✅ <strong>${name}</strong> adicionado ao carrinho`);
  openCart();
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  invalidarFrete();
  saveCart();
  renderCartUI();
}

function updateQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  invalidarFrete();
  saveCart();
  renderCartUI();
}

// O frete depende do conteúdo do carrinho; ao mudar, zera a escolha.
function invalidarFrete() {
  selectedFrete = null;
  const box = document.getElementById('cart-frete-options');
  if (box) { box.innerHTML = ''; box._opcoes = null; }
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function getCartCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function renderCartUI() {
  // Count badge
  const countEl = document.getElementById('cart-count');
  const count = getCartCount();
  if (countEl) {
    countEl.textContent = count;
    countEl.style.display = count > 0 ? 'flex' : 'none';
  }

  // Cart items
  const container = document.getElementById('cart-items-container');
  const emptyEl = document.getElementById('cart-empty');
  const footerEl = document.getElementById('cart-footer');
  const totalEl = document.getElementById('cart-total-display');

  if (!container) return;

  if (cart.length === 0) {
    if (emptyEl) emptyEl.style.display = 'flex';
    if (footerEl) footerEl.style.display = 'none';
    // Remove any item cards
    container.querySelectorAll('.cart-item').forEach(el => el.remove());
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (footerEl) footerEl.style.display = 'block';

  // Re-render items
  container.querySelectorAll('.cart-item').forEach(el => el.remove());

  cart.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'cart-item';
    itemEl.id = `cart-item-${item.id}`;
    itemEl.innerHTML = `
      <div class="cart-item-image">
        ${item.image
          ? `<img src="${item.image}" alt="${item.name}" />`
          : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:1.75rem">🐾</div>`
        }
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${formatPrice(item.price * item.qty)}</div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="updateQty('${item.id}', -1)" aria-label="Diminuir quantidade">−</button>
          <span class="qty-value">${item.qty}</span>
          <button class="qty-btn" onclick="updateQty('${item.id}', 1)" aria-label="Aumentar quantidade">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.id}')" aria-label="Remover item">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    `;
    container.appendChild(itemEl);
  });

  // Subtotal + frete + total
  const subtotal = getCartTotal();
  const freteVal = selectedFrete ? Number(selectedFrete.price) : 0;
  const subEl = document.getElementById('cart-subtotal-display');
  if (subEl) subEl.textContent = formatPrice(subtotal);
  const freteLine = document.getElementById('cart-frete-line');
  const freteDisp = document.getElementById('cart-frete-display');
  if (freteLine && freteDisp) {
    if (selectedFrete) {
      freteLine.style.display = 'flex';
      freteDisp.textContent = freteVal === 0 ? 'Grátis' : formatPrice(freteVal);
    } else {
      freteLine.style.display = 'none';
    }
  }
  if (totalEl) totalEl.textContent = formatPrice(subtotal + freteVal);
}

/* ── Frete (cotação via /api/frete) ───────────────────────────── */

// Máscara simples de CEP (00000-000) e invalida frete escolhido ao editar.
function onCepInput(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 8);
  if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
  el.value = v;
  selectedFrete = null;
}

async function calcularFrete() {
  const cepEl = document.getElementById('cart-cep');
  const box = document.getElementById('cart-frete-options');
  if (!cepEl || !box) return;
  const cep = cepEl.value.replace(/\D/g, '');
  if (cep.length !== 8) {
    box.innerHTML = `<p class="frete-msg frete-erro">Digite um CEP válido (8 dígitos).</p>`;
    return;
  }
  if (cart.length === 0) return;

  box.innerHTML = `<p class="frete-msg">Calculando frete…</p>`;
  try {
    const r = await fetch('/api/frete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cep, itens: cart }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || data.error || 'Falha na cotação');

    if (data.freteGratis) {
      selectedFrete = { id: 'gratis', name: 'Frete grátis', company: '', price: 0, prazo: null };
      box.innerHTML = `<p class="frete-msg frete-ok">🎉 Você ganhou frete grátis!</p>`;
      renderCartUI();
      return;
    }
    if (!data.opcoes || !data.opcoes.length) {
      box.innerHTML = `<p class="frete-msg frete-erro">${data.aviso || 'Sem opções de envio para este CEP.'}</p>`;
      return;
    }
    renderFreteOptions(data.opcoes);
  } catch (err) {
    box.innerHTML = `<p class="frete-msg frete-erro">Não foi possível calcular: ${err.message}</p>`;
  }
}

function renderFreteOptions(opcoes) {
  const box = document.getElementById('cart-frete-options');
  if (!box) return;
  box.innerHTML = opcoes.map((o, i) => {
    const prazo = o.prazo ? ` · ${o.prazo} dia(s) útil(eis)` : '';
    const label = [o.company, o.name].filter(Boolean).join(' ');
    return `<label class="frete-opt">
      <input type="radio" name="frete" value="${i}" onchange="selecionarFrete(${i})" />
      <span class="frete-opt-name">${label}${prazo}</span>
      <span class="frete-opt-price">${formatPrice(o.price)}</span>
    </label>`;
  }).join('');
  // guarda as opções no elemento para o select
  box._opcoes = opcoes;
  // pré-seleciona a 1ª (mais barata)
  const first = box.querySelector('input[name="frete"]');
  if (first) { first.checked = true; selecionarFrete(0); }
}

function selecionarFrete(i) {
  const box = document.getElementById('cart-frete-options');
  const o = box?._opcoes?.[i];
  if (!o) return;
  selectedFrete = o;
  renderCartUI();
}

function formatPrice(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Cart Drawer ────────────────────────────────────
function openCart() {
  document.getElementById('cart-overlay')?.classList.add('open');
  document.getElementById('cart-drawer')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cart-overlay')?.classList.remove('open');
  document.getElementById('cart-drawer')?.classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('cart-btn')?.addEventListener('click', openCart);

// Escape key closes cart
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCart();
});

/* ── Checkout (dados do cliente → /api/checkout → Mercado Pago) ── */

function openCheckout() {
  if (cart.length === 0) return;
  if (!selectedFrete) {
    showToast('📦 Calcule o frete e escolha uma opção de envio antes de finalizar.', 3500);
    return;
  }
  voltarCheckoutForm(); // garante a etapa do formulário ao (re)abrir
  // copia o CEP já informado no carrinho
  const cepCart = document.getElementById('cart-cep');
  const cepForm = document.getElementById('checkout-cep');
  if (cepForm && cepCart && cepCart.value) { cepForm.value = cepCart.value; onCheckoutCep(cepForm); }
  renderCheckoutResumo();
  document.getElementById('checkout-overlay')?.classList.add('open');
  document.getElementById('checkout-panel')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  document.getElementById('checkout-overlay')?.classList.remove('open');
  document.getElementById('checkout-panel')?.classList.remove('open');
  document.body.style.overflow = '';
}

function onTipoPessoa(sel) {
  const lbl = document.getElementById('cpf-label');
  if (lbl) lbl.textContent = sel.value === 'J' ? 'CNPJ*' : 'CPF*';
}

// Máscara de CEP + busca de endereço no ViaCEP
function onCheckoutCep(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 8);
  if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
  el.value = v;
  if (v.replace(/\D/g, '').length === 8) buscarCep(v.replace(/\D/g, ''));
}

async function buscarCep(cep) {
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const d = await r.json();
    if (d.erro) return;
    const set = (id, val) => { const e = document.getElementById(id); if (e && val && !e.value) e.value = val; };
    set('checkout-endereco', d.logradouro);
    set('checkout-bairro', d.bairro);
    set('checkout-cidade', d.localidade);
    set('checkout-uf', d.uf);
  } catch { /* silencioso — o cliente pode preencher à mão */ }
}

function renderCheckoutResumo() {
  const box = document.getElementById('checkout-resumo');
  if (!box) return;
  const subtotal = getCartTotal();
  const frete = selectedFrete ? Number(selectedFrete.price) : 0;
  const freteLabel = selectedFrete ? [selectedFrete.company, selectedFrete.name].filter(Boolean).join(' ') : '';
  box.innerHTML = `
    <div class="cart-line"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
    <div class="cart-line"><span>Frete (${freteLabel})</span><span>${frete === 0 ? 'Grátis' : formatPrice(frete)}</span></div>
    <div class="cart-line checkout-resumo-total"><span>Total</span><span>${formatPrice(subtotal + frete)}</span></div>`;
}

async function enviarCheckout(event) {
  event.preventDefault();
  const btn = document.getElementById('checkout-submit');
  const form = event.target;
  const f = Object.fromEntries(new FormData(form).entries());

  const cliente = {
    nome: f.nome, email: f.email, telefone: f.telefone,
    tipoPessoa: f.tipoPessoa, cpfCnpj: f.cpfCnpj,
    cep: f.cep, endereco: f.endereco, numero: f.numero,
    complemento: f.complemento || '', bairro: f.bairro,
    cidade: f.cidade, uf: (f.uf || '').toUpperCase(),
  };

  if (btn) { btn.disabled = true; btn.textContent = 'Processando…'; }
  try {
    const r = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente, itens: cart, frete: selectedFrete }),
    });
    const data = await r.json();
    if (!r.ok || !data.preferenceId) throw new Error(data.detail || data.error || 'Falha no checkout');

    // sem public key configurada → cai para o checkout externo (init_point)
    if (!data.publicKey) {
      if (data.paymentUrl) { window.location.href = data.paymentUrl; return; }
      throw new Error('Pagamento indisponível no momento. Tente novamente em instantes.');
    }
    // pagamento embutido no site (modal do Mercado Pago)
    await renderWalletBrick(data.preferenceId, data.publicKey, data.paymentUrl);
  } catch (err) {
    showToast(`❌ ${err.message}`, 4000);
    if (btn) { btn.disabled = false; btn.textContent = 'Ir para o pagamento →'; }
  }
}

/* ── Wallet Brick: abre o Checkout Pro num modal sobre o site ── */
let mpInstance = null;
let walletBrickController = null;

async function renderWalletBrick(preferenceId, publicKey, fallbackUrl) {
  // SDK não carregou → usa o checkout externo se houver
  if (typeof MercadoPago === 'undefined') {
    if (fallbackUrl) { window.location.href = fallbackUrl; return; }
    throw new Error('Não foi possível carregar o pagamento. Recarregue a página.');
  }

  const form = document.getElementById('checkout-form');
  const pag = document.getElementById('checkout-pagamento');
  const container = document.getElementById('wallet-container');

  // troca a etapa: esconde o formulário, mostra o pagamento
  if (form) form.style.display = 'none';
  if (pag) pag.style.display = 'block';
  if (container) container.innerHTML = '';

  if (!mpInstance) mpInstance = new MercadoPago(publicKey, { locale: 'pt-BR' });

  // remove um brick anterior (caso o cliente tenha voltado e refeito o pedido)
  if (walletBrickController) {
    try { await walletBrickController.unmount(); } catch { /* ignore */ }
    walletBrickController = null;
  }

  walletBrickController = await mpInstance.bricks().create('wallet', 'wallet-container', {
    initialization: { preferenceId, redirectMode: 'modal' },
    customization: { texts: { valueProp: 'practicality' } },
  });
}

// Volta da etapa de pagamento para o formulário de dados.
function voltarCheckoutForm() {
  const form = document.getElementById('checkout-form');
  const pag = document.getElementById('checkout-pagamento');
  if (pag) pag.style.display = 'none';
  if (form) form.style.display = '';
  const btn = document.getElementById('checkout-submit');
  if (btn) { btn.disabled = false; btn.textContent = 'Ir para o pagamento →'; }
}

// ── Toast Notifications ────────────────────────────
function showToast(html, duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="toast-icon">🛒</span><span>${html}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOutToast 0.3s var(--ease) forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Newsletter ─────────────────────────────────────
function handleNewsletterSubmit(event) {
  event.preventDefault();
  const emailEl = document.getElementById('newsletter-email');
  if (!emailEl || !emailEl.value) return;

  const btn = event.target.querySelector('button[type="submit"]');
  if (btn) {
    btn.textContent = '✅ Inscrito!';
    btn.disabled = true;
    btn.style.background = 'var(--clr-primary-lt)';
  }

  showToast(`🎉 Obrigado! Seu cupom de 10% OFF foi enviado para <strong>${emailEl.value}</strong>`);
  emailEl.value = '';

  setTimeout(() => {
    if (btn) {
      btn.textContent = 'Quero o Desconto →';
      btn.disabled = false;
      btn.style.background = '';
    }
  }, 5000);
}

// ── Search (placeholder) ───────────────────────────
document.getElementById('search-btn')?.addEventListener('click', () => {
  showToast('🔍 Busca em breve. Use o catálogo de produtos por enquanto!', 2500);
});

/* ================================================================
   Catálogo dinâmico — lê os produtos do Tiny via /api/produtos
   ================================================================ */

let CATALOG = [];

function initCatalog() {
  const catalogGrid = document.getElementById('catalog-grid'); // página produtos
  const homeGrid = document.getElementById('products-grid');   // home
  if (!catalogGrid && !homeGrid) return;

  const grid = catalogGrid || homeGrid;
  grid.innerHTML = catalogSkeleton(catalogGrid ? 6 : 4);

  fetch('/api/produtos')
    .then((r) => r.json())
    .then((data) => {
      CATALOG = (data.produtos || []).map(withTags);
      if (homeGrid) renderProducts(homeGrid, CATALOG.slice(0, 4));
      if (catalogGrid) {
        renderProducts(catalogGrid, CATALOG);
        updateFilterCounts(CATALOG);
        wireCatalogControls();
      }
    })
    .catch(() => {
      grid.innerHTML = `<div class="catalog-empty">
        <p>Não foi possível carregar os produtos agora.</p>
        <button class="btn btn-primary btn-sm" onclick="location.reload()">Tentar novamente</button>
      </div>`;
    });
}

// Imagem local com fundo transparente para a linha TartOff (sobrepõe a do Tiny)
function localProductImage(name) {
  const n = (name || '').toLowerCase();
  const isGel = n.includes('gel dental') || n.includes('tartoff');
  if (!isGel) return null;
  const size = n.includes('100') ? '100ml' : n.includes('50') ? '50ml' : null;
  const flavor = n.includes('banana') ? 'banana' : n.includes('menta') ? 'menta' : null;
  if (!flavor || !size) return null;
  return `/assets/produtos/gel-${flavor}-${size}.png`;
}

// Deriva tags simples (animal/categoria) a partir do nome — best effort
function withTags(p) {
  const n = (p.name || '').toLowerCase();
  let animal = 'cao gato';
  let category = 'saude';
  if (n.includes('gel dental') || n.includes('tartoff') || n.includes('tártaro') || n.includes('tartaro')) {
    animal = 'cao gato'; category = 'bucal';
  } else if (n.includes('areia') || n.includes('green cat') || n.includes('gato')) {
    animal = 'gato'; category = 'lar';
  } else if (n.includes('osso') || n.includes('everbone') || n.includes('nylon')) {
    animal = 'cao'; category = 'saude';
  }
  const image = localProductImage(p.name) || p.image;
  return { ...p, animal, category, image };
}

function catalogSkeleton(n) {
  return Array.from({ length: n }, () =>
    `<div class="product-card skeleton-card"><div class="product-image skeleton"></div>
     <div class="product-body"><div class="skeleton skeleton-line"></div>
     <div class="skeleton skeleton-line short"></div></div></div>`
  ).join('');
}

function renderProducts(grid, products) {
  if (!products.length) {
    grid.innerHTML = `<div class="catalog-empty"><p>Nenhum produto encontrado.</p></div>`;
    return;
  }
  grid.innerHTML = products.map(productCardHTML).join('');
  // re-aplica animação de reveal
  if (typeof IntersectionObserver !== 'undefined') {
    grid.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
  }
  updateProductCount(products.length);
}

function productUrl(p) {
  return `produto.html?id=${encodeURIComponent(p.id)}`;
}

function productCardHTML(p) {
  const animalLabel = p.animal === 'gato' ? '🐈 Gatos'
    : p.animal === 'cao' ? '🐕 Cães'
    : '🐕 Cães & 🐈 Gatos';
  const priceOld = p.priceOld ? `<span class="price-old">${formatPrice(p.priceOld)}</span>` : '';
  const desc = (p.description || '').split('\n')[0].slice(0, 90) || 'Produto Aion Pharma para o cuidado do seu pet.';
  const outOfStock = p.inStock === false;
  const safeName = (p.name || '').replace(/'/g, "\\'");
  const safeImage = (p.image || '').replace(/'/g, "\\'");
  return `
  <a href="${productUrl(p)}" class="product-card reveal" data-animal="${p.animal}" data-category="${p.category}" data-price="${p.price}" data-name="${(p.name || '').toLowerCase()}">
    <div class="product-image">
      <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.src='/assets/images/placeholder-produto.svg'" />
      ${outOfStock ? '<div class="product-badges"><span class="badge badge-muted">Indisponível</span></div>' : ''}
    </div>
    <div class="product-body">
      <span class="product-animal">${animalLabel}</span>
      <h3 class="product-name">${p.name}</h3>
      <p class="product-desc">${desc}</p>
      <div class="product-footer">
        <div class="product-price">${priceOld}<span class="price-current">${formatPrice(p.price)}</span></div>
        <button type="button" class="add-to-cart-btn" aria-label="Adicionar ao carrinho" ${outOfStock ? 'disabled' : ''}
          onclick="event.preventDefault(); event.stopPropagation(); addToCart('${p.id}','${safeName}',${p.price},'${safeImage}')">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>
    </div>
  </a>`;
}

function updateProductCount(n) {
  const el = document.getElementById('product-count');
  if (el) el.textContent = n;
}

// Contadores da sidebar de filtros — derivados do catálogo real (Tiny/Olist),
// para não ficarem defasados quando o catálogo muda. Espelha a lógica de applyCatalog.
function updateFilterCounts(catalog) {
  const setCount = (id, n) => {
    const el = document.getElementById(id);
    if (el) el.textContent = n;
  };
  const count = (fn) => catalog.filter(fn).length;
  setCount('count-cao', count((p) => p.animal.includes('cao')));
  setCount('count-gato', count((p) => p.animal.includes('gato')));
  setCount('count-bucal', count((p) => p.category === 'bucal'));
  setCount('count-lar', count((p) => p.category === 'lar'));
  setCount('count-saude', count((p) => p.category === 'saude'));
  setCount('count-price-1', count((p) => p.price <= 50));
  setCount('count-price-2', count((p) => p.price > 50 && p.price <= 120));
  setCount('count-price-3', count((p) => p.price > 120));
}

// Filtros + ordenação na página de catálogo
function wireCatalogControls() {
  const sort = document.querySelector('.sort-select');
  sort?.addEventListener('change', applyCatalog);
  document.querySelectorAll('.filters-sidebar input[type=checkbox]').forEach((cb) =>
    cb.addEventListener('change', applyCatalog)
  );
}

function applyCatalog() {
  const grid = document.getElementById('catalog-grid');
  if (!grid) return;
  const animals = checkedValues(['filter-cao', 'filter-gato'], { 'filter-cao': 'cao', 'filter-gato': 'gato' });
  const cats = checkedValues(['filter-bucal', 'filter-lar', 'filter-saude'],
    { 'filter-bucal': 'bucal', 'filter-lar': 'lar', 'filter-saude': 'saude' });

  let list = CATALOG.filter((p) => {
    const animalOk = !animals.length || animals.some((a) => p.animal.includes(a));
    const catOk = !cats.length || cats.includes(p.category);
    return animalOk && catOk;
  });

  const sort = document.querySelector('.sort-select')?.value;
  if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);

  renderProducts(grid, list);
}

function checkedValues(ids, map) {
  return ids.filter((id) => document.getElementById(id)?.checked).map((id) => map[id]);
}

// substitui a antiga applyFilter inline da página
function applyFilter() { applyCatalog(); }
window.applyFilter = applyFilter;

/* ================================================================
   Página de produto — produto.html?id=
   ================================================================ */

let PRODUCT_PAGE = null;
let productQty = 1;

function initProductPage() {
  const root = document.getElementById('product-page-root');
  if (!root) return;

  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    root.innerHTML = productPageNotFound();
    return;
  }

  root.innerHTML = '<div class="product-page-loading">Carregando produto…</div>';

  fetch('/api/produtos')
    .then((r) => r.json())
    .then((data) => {
      const p = (data.produtos || []).map(withTags).find((item) => item.id === id);
      if (!p) {
        root.innerHTML = productPageNotFound();
        return;
      }
      PRODUCT_PAGE = p;
      productQty = 1;
      document.title = `${p.name} — Aion Pharma`;
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.content = (p.description || p.name).slice(0, 160);
      root.innerHTML = renderProductPageHTML(p);
      document.getElementById('product-breadcrumb-name').textContent = p.name;
      initRevealAnimations();
    })
    .catch(() => {
      root.innerHTML = `<div class="product-page-error">
        <p>Não foi possível carregar este produto.</p>
        <a href="produtos.html" class="btn btn-primary btn-sm">Voltar ao catálogo</a>
      </div>`;
    });
}

function productPageNotFound() {
  return `<div class="product-page-error">
    <p>Produto não encontrado.</p>
    <a href="produtos.html" class="btn btn-primary btn-sm">Ver todos os produtos</a>
  </div>`;
}

function renderProductPageHTML(p) {
  const animalLabel = p.animal === 'gato' ? '🐈 Gatos'
    : p.animal === 'cao' ? '🐕 Cães'
    : '🐕 Cães & 🐈 Gatos';
  const priceOld = p.priceOld
    ? `<span class="price-compare">${formatPrice(p.priceOld)}</span>`
    : '';
  const discount = p.priceOld
    ? `<span class="price-discount">−${Math.round((1 - p.price / p.priceOld) * 100)}%</span>`
  : '';
  const desc = (p.description || 'Produto Aion Pharma para o cuidado do seu pet.').trim();
  const stockBadge = p.inStock === false
    ? '<span class="badge badge-muted">Indisponível</span>'
    : '<span class="badge badge-green">Em estoque</span>';
  const disabled = p.inStock === false ? 'disabled' : '';

  return `
  <div class="product-layout">
    <div class="product-gallery">
      <div class="product-main-image">
        <img src="${p.image}" alt="${p.name}" id="main-product-img" onerror="this.src='/assets/images/placeholder-produto.svg'" />
      </div>
    </div>
    <div class="product-info">
      <div class="product-info-top">
        <div class="product-brand">Aion Pharma</div>
        <h1 class="product-title">${p.name}</h1>
        <div class="product-rating-row">
          <span class="product-animal">${animalLabel}</span>
          ${stockBadge}
        </div>
        <p class="product-description">${desc}</p>
      </div>
      <div class="price-block">
        <div class="price-row">
          <span class="price-main">${formatPrice(p.price)}</span>
          ${priceOld}
          ${discount}
        </div>
        <p class="price-note">ou 3× de ${formatPrice(p.price / 3)} sem juros no cartão</p>
      </div>
      <div class="option-group">
        <div class="option-label">Quantidade</div>
        <div class="qty-selector">
          <button type="button" class="qty-btn-lg" onclick="changeProductQty(-1)" aria-label="Diminuir">−</button>
          <span class="qty-display" id="product-qty">1</span>
          <button type="button" class="qty-btn-lg" onclick="changeProductQty(1)" aria-label="Aumentar">+</button>
        </div>
      </div>
      <div class="buy-actions">
        <button type="button" class="btn btn-gold btn-lg" ${disabled} onclick="addProductPageToCart()">Adicionar ao carrinho</button>
        <button type="button" class="btn btn-outline btn-lg" ${disabled} onclick="buyProductNow()">Comprar agora</button>
      </div>
      <div class="shipping-info">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        <span>Frete grátis em compras acima de R$ 99</span>
      </div>
    </div>
  </div>
  <div class="product-tabs">
    <div class="tab-content active" id="tab-descricao">
      <h2 class="heading-3" style="margin-bottom:1rem">Sobre o produto</h2>
      <div class="product-long-desc">${desc.replace(/\n/g, '<br>')}</div>
    </div>
  </div>`;
}

function changeProductQty(delta) {
  productQty = Math.max(1, productQty + delta);
  const el = document.getElementById('product-qty');
  if (el) el.textContent = productQty;
}

function addProductPageToCart() {
  if (!PRODUCT_PAGE) return;
  const p = PRODUCT_PAGE;
  for (let i = 0; i < productQty; i++) {
    addToCart(p.id, p.name, p.price, p.image);
  }
}

function buyProductNow() {
  addProductPageToCart();
  openCart();
}

window.changeProductQty = changeProductQty;
window.addProductPageToCart = addProductPageToCart;
window.buyProductNow = buyProductNow;
