import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
import { getStoreSubdomain, getStoreSlugFromPath, getStoreByCustomDomain } from './router.js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

let store = null;
let products = [];
let fbLink = '';

document.addEventListener('DOMContentLoaded', async () => {
    const slug = getStoreSlug();
    if (!slug) {
        // Try custom domain
        const customStore = await getStoreByCustomDomain();
        if (customStore) {
            store = customStore;
            fbLink = store.facebook_link || '#';
            applyTheme();
            applyStoreData();
            await loadProducts();
            document.getElementById('storeLoading').style.display = 'none';
            document.getElementById('storeApp').style.display = 'block';
            initScrollEffects();
            return;
        }
        showNotFound();
        return;
    }

    await loadStore(slug);
});

function getStoreSlug() {
    const params = new URLSearchParams(window.location.search);
    const querySlug = params.get('store');
    if (querySlug) return querySlug;

    return getStoreSlugFromPath() || getStoreSubdomain();
}

async function loadStore(slug) {
    const { data, error } = await sb
        .from('stores')
        .select('*')
        .eq('slug', slug)
        .single();

    if (error || !data) {
        showNotFound();
        return;
    }

    store = data;
    fbLink = store.facebook_link || '#';
    applyTheme();
    applyStoreData();
    await loadProducts();

    document.getElementById('storeLoading').style.display = 'none';
    document.getElementById('storeApp').style.display = 'block';
    initScrollEffects();
}

function showNotFound() {
    document.getElementById('storeLoading').style.display = 'none';
    document.getElementById('storeNotFound').style.display = 'flex';
}

function applyTheme() {
    const theme = store.theme || {};
    const primary = theme.primary_color || '#6366f1';
    const accent = theme.secondary_color || '#06b6d4';
    const bg = theme.bg_color || '#0a0a0f';
    const card = theme.card_color || '#12121a';
    const text = theme.text_color || '#e2e8f0';
    const font = theme.font || 'Inter';

    const root = document.documentElement;
    root.style.setProperty('--store-primary', primary);
    root.style.setProperty('--store-accent', accent);

    document.body.style.background = bg;
    document.body.style.color = text;
    document.body.style.fontFamily = `'${font}', sans-serif`;

    const nav = document.getElementById('storeNav');
    nav.style.background = `${bg}ee`;
    nav.style.borderBottom = `1px solid ${text}15`;

    document.querySelectorAll('.store-nav-links a').forEach(a => a.style.color = text);
    document.querySelector('.store-name-text').style.color = text;

    const btnNav = document.querySelector('.btn-order-nav');
    btnNav.style.background = primary;
    btnNav.style.color = '#fff';

    document.querySelectorAll('.mobile-toggle span').forEach(s => s.style.background = text);

    const heroSection = document.getElementById('storeHero');
    heroSection.style.background = bg;

    document.querySelector('.hero-store-name').style.color = primary;
    document.querySelector('.hero-store-desc').style.color = text;

    const btnPrimary = document.querySelector('.btn-hero-primary');
    btnPrimary.style.background = primary;
    btnPrimary.style.color = '#fff';

    const btnOutline = document.querySelector('.btn-hero-outline');
    btnOutline.style.borderColor = primary;
    btnOutline.style.color = primary;

    document.getElementById('heroFbLink').href = fbLink;

    const productsSection = document.getElementById('products-section');
    productsSection.style.background = card;

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.style.color = text;
        btn.style.borderColor = `${text}25`;
    });

    const activeFilter = document.querySelector('.filter-btn.active');
    if (activeFilter) {
        activeFilter.style.background = primary;
        activeFilter.style.borderColor = primary;
        activeFilter.style.color = '#fff';
    }

    const aboutSection = document.getElementById('about-section');
    aboutSection.style.background = bg;

    document.querySelectorAll('.about-feature i').forEach(i => i.style.color = primary);

    const contactSection = document.getElementById('contact-section');
    contactSection.style.background = card;

    document.querySelectorAll('.contact-card').forEach(c => {
        c.style.borderColor = `${text}12`;
    });
    document.querySelectorAll('.contact-card i').forEach(i => i.style.color = primary);

    const footer = document.querySelector('.store-footer');
    footer.style.background = bg;
    footer.style.borderTopColor = `${text}12`;

    const backToTop = document.getElementById('backToTop');
    backToTop.style.background = primary;
    backToTop.style.color = '#fff';
}

function applyStoreData() {
    document.title = `${store.name} | ShopEasy`;

    if (store.logo) {
        const logo = document.getElementById('storeLogo');
        logo.src = store.logo;
        logo.style.display = 'block';
        
        let favicon = document.querySelector('link[rel="icon"]');
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }
        favicon.href = store.logo;
    }

    document.getElementById('storeName').textContent = store.name;
    document.getElementById('heroStoreName').textContent = store.name;
    document.getElementById('heroStoreDesc').textContent = store.description || 'Welcome to our store. Browse our products and find what you love.';
    document.getElementById('aboutDesc').textContent = store.description || 'We are dedicated to bringing you the best products at great prices.';
    document.getElementById('footerStoreName').textContent = store.name;
    document.getElementById('footerCopyright').textContent = store.name;

    document.getElementById('storeFbLink').href = fbLink;

    if (store.phone) {
        document.getElementById('contactPhone').style.display = 'block';
        document.getElementById('contactPhoneText').textContent = store.phone;
    }
    if (store.email) {
        document.getElementById('contactEmail').style.display = 'block';
        document.getElementById('contactEmailText').textContent = store.email;
    }
    if (store.address) {
        document.getElementById('contactAddress').style.display = 'block';
        document.getElementById('contactAddressText').textContent = store.address;
    }
    if (store.facebook_link) {
        document.getElementById('contactFb').style.display = 'block';
        document.getElementById('contactFbLink').href = store.facebook_link;
    }
    if (store.whatsapp_link) {
        document.getElementById('contactWhatsapp').style.display = 'block';
        const waLink = store.whatsapp_link.startsWith('http')
            ? store.whatsapp_link
            : `https://wa.me/${store.whatsapp_link.replace(/[^0-9]/g, '')}`;
        document.getElementById('contactWhatsappLink').href = waLink;
        document.getElementById('storeWaLink').href = waLink;
        document.getElementById('storeWaLink').style.display = 'flex';
    }
}

async function loadProducts() {
    const { data, error } = await sb
        .from('products')
        .select('*')
        .eq('store_id', store.id)
        .eq('in_stock', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Load products error:', error);
        return;
    }

    products = data || [];
    buildFilters();
    renderProducts(products);
}

function buildFilters() {
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    const bar = document.getElementById('filterBar');

    if (categories.length <= 1) {
        bar.style.display = 'none';
        return;
    }

    bar.innerHTML = `<button class="filter-btn active" data-filter="all" onclick="filterProducts('all')">All</button>`;
    categories.forEach(cat => {
        bar.innerHTML += `<button class="filter-btn" data-filter="${cat}" onclick="filterProducts('${cat}')">${cat}</button>`;
    });

    const primary = store.theme?.primary_color || '#6366f1';
    const text = store.theme?.text_color || '#e2e8f0';
    bar.querySelectorAll('.filter-btn').forEach(btn => {
        btn.style.color = text;
        btn.style.borderColor = `${text}25`;
    });
    const active = bar.querySelector('.filter-btn.active');
    if (active) {
        active.style.background = primary;
        active.style.borderColor = primary;
        active.style.color = '#fff';
    }
}

export function filterProducts(category) {
    const primary = store.theme?.primary_color || '#6366f1';
    const text = store.theme?.text_color || '#e2e8f0';

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = text;
        btn.style.borderColor = `${text}25`;
    });

    const activeBtn = document.querySelector(`.filter-btn[data-filter="${category}"]`);
    if (activeBtn) {
        activeBtn.style.background = primary;
        activeBtn.style.borderColor = primary;
        activeBtn.style.color = '#fff';
    }

    const filtered = category === 'all' ? products : products.filter(p => p.category === category);
    renderProducts(filtered);
}
window.filterProducts = filterProducts;

function renderProducts(items) {
    const grid = document.getElementById('productsGrid');
    const primary = store.theme?.primary_color || '#6366f1';
    const card = store.theme?.card_color || '#12121a';
    const text = store.theme?.text_color || '#e2e8f0';

    if (items.length === 0) {
        grid.innerHTML = `<div class="empty-products"><i class="fas fa-box-open"></i><p>No products available</p></div>`;
        return;
    }

    grid.innerHTML = items.map((p, i) => `
        <div class="product-card" onclick="openProductModal(${i})" style="background:${card};border-color:${text}12;" data-category="${p.category || ''}">
            <div class="product-card-image" style="background:${card};">
                ${p.image ? `<img src="${p.image}" alt="${p.name}">` : `<i class="fas fa-image no-img" style="color:${text};"></i>`}
                ${p.badge ? `<span class="product-card-badge" style="background:${primary};">${p.badge}</span>` : ''}
            </div>
            <div class="product-card-body">
                <h4 style="color:${text};">${p.name}</h4>
                <p class="cat">${p.category || ''}</p>
                <div class="price-row">
                    <span class="price" style="color:${primary};">৳${Number(p.price).toLocaleString()}</span>
                    ${p.old_price ? `<span class="old-price" style="color:${text};">৳${Number(p.old_price).toLocaleString()}</span>` : ''}
                </div>
                <a href="${fbLink}" target="_blank" class="btn-card-order" style="border-color:${primary};color:${primary};" onclick="event.stopPropagation();">
                    Order Now
                </a>
            </div>
        </div>
    `).join('');
}

export function openProductModal(index) {
    const filtered = getFilteredProducts();
    const p = filtered[index];
    if (!p) return;

    const primary = store.theme?.primary_color || '#6366f1';
    const card = store.theme?.card_color || '#12121a';
    const text = store.theme?.text_color || '#e2e8f0';

    const modal = document.getElementById('productModal');
    modal.querySelector('.modal').style.background = card;
    document.getElementById('modalName').textContent = p.name;
    document.getElementById('modalName').style.color = text;
    document.getElementById('modalCategory').textContent = p.category || '';
    document.getElementById('modalCategory').style.color = text;
    document.getElementById('modalDesc').textContent = p.description || '';
    document.getElementById('modalDesc').style.color = text;
    document.getElementById('modalPrice').textContent = `৳${Number(p.price).toLocaleString()}`;
    document.getElementById('modalPrice').style.color = primary;
    document.getElementById('modalImg').src = p.image || '';

    if (p.old_price) {
        document.getElementById('modalOldPrice').textContent = `৳${Number(p.old_price).toLocaleString()}`;
        document.getElementById('modalOldPrice').style.display = 'inline';
    } else {
        document.getElementById('modalOldPrice').style.display = 'none';
    }

    if (p.badge) {
        document.getElementById('modalBadge').textContent = p.badge;
        document.getElementById('modalBadge').style.display = 'inline-block';
        document.getElementById('modalBadge').style.background = primary;
    } else {
        document.getElementById('modalBadge').style.display = 'none';
    }

    document.getElementById('modalOrderLink').href = fbLink;
    document.getElementById('modalOrderLink').style.background = primary;

    if (store.whatsapp_link) {
        const waLink = store.whatsapp_link.startsWith('http')
            ? store.whatsapp_link
            : `https://wa.me/${store.whatsapp_link.replace(/[^0-9]/g, '')}`;
        document.getElementById('modalWaLink').href = waLink;
        document.getElementById('modalWaLink').style.display = 'flex';
    } else {
        document.getElementById('modalWaLink').style.display = 'none';
    }

    modal.classList.add('active');
}
window.openProductModal = openProductModal;

function getFilteredProducts() {
    const activeFilter = document.querySelector('.filter-btn.active');
    const category = activeFilter ? activeFilter.dataset.filter : 'all';
    return category === 'all' ? products : products.filter(p => p.category === category);
}

export function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}
window.closeProductModal = closeProductModal;

document.getElementById('productModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeProductModal();
});

function initScrollEffects() {
    const backToTop = document.getElementById('backToTop');

    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTop.classList.add('show');
        } else {
            backToTop.classList.remove('show');
        }
    });

    backToTop.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                window.scrollTo({ top: target.offsetTop - 80, behavior: 'smooth' });
            }
        });
    });

    const mobileToggle = document.getElementById('mobileToggle');
    const navLinks = document.getElementById('storeNavLinks');

    mobileToggle.addEventListener('click', () => {
        mobileToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    document.querySelectorAll('.store-nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            mobileToggle.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });
}
