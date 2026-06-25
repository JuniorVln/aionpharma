/* ================================================
   AION PHARMA — Main Script
   Cart, Animations, Mobile Nav, Toast, Newsletter
   ================================================ */

// ── State ─────────────────────────────────────────
let cart = [];

// ── Init ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadCart();
  initScrollBehavior();
  initRevealAnimations();
  initMobileNav();
  initCatalog();
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
  saveCart();
  renderCartUI();
  showToast(`✅ <strong>${name}</strong> adicionado ao carrinho`);
  openCart();
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
  renderCartUI();
}

function updateQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart();
  renderCartUI();
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

  // Total
  if (totalEl) totalEl.textContent = formatPrice(getCartTotal());
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

// ── Checkout via WhatsApp ──────────────────────────
function handleCheckout() {
  if (cart.length === 0) return;

  const WHATSAPP_NUMBER = '5511999999999'; // ← Substitua pelo número real
  const items = cart.map(item =>
    `• ${item.name} x${item.qty} = ${formatPrice(item.price * item.qty)}`
  ).join('\n');
  const total = formatPrice(getCartTotal());
  const message = encodeURIComponent(
    `Olá! Gostaria de fazer um pedido na Aion Pharma:\n\n${items}\n\n*Total: ${total}*\n\nPor favor, me informe sobre as formas de pagamento e entrega. Obrigado! 🐾`
  );
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
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
  return { ...p, animal, category };
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

function productCardHTML(p) {
  const animalLabel = p.animal === 'gato' ? '🐈 Gatos'
    : p.animal === 'cao' ? '🐕 Cães'
    : '🐕 Cães & 🐈 Gatos';
  const priceOld = p.priceOld ? `<span class="price-old">${formatPrice(p.priceOld)}</span>` : '';
  const desc = (p.description || '').split('\n')[0].slice(0, 90) || 'Produto Aion Pharma para o cuidado do seu pet.';
  const outOfStock = p.inStock === false;
  // dados escapados para o onclick
  const safeName = (p.name || '').replace(/'/g, "\\'");
  return `
  <div class="product-card reveal" data-animal="${p.animal}" data-category="${p.category}" data-price="${p.price}" data-name="${(p.name || '').toLowerCase()}">
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
        <button class="add-to-cart-btn" aria-label="Adicionar ao carrinho" ${outOfStock ? 'disabled' : ''}
          onclick="addToCart('${p.id}','${safeName}',${p.price},'${p.image}')">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>
    </div>
  </div>`;
}

function updateProductCount(n) {
  const el = document.getElementById('product-count');
  if (el) el.textContent = n;
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
