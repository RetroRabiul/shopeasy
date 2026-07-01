import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
import { isAdminSubdomain, getStoreSubdomain, getStoreUrl, getAdminUrl } from './router.js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

let store = null;
let products = [];
let orders = [];
let productImageMode = 'url';
let uploadedProductFile = null;

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await sb.auth.getSession();

    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    const { data: profile } = await sb
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    if (profile && profile.role === 'admin') {
        const currentHost = window.location.hostname;
        if (!isAdminSubdomain() && !currentHost.includes('localhost') && !currentHost.includes('vercel.app')) {
            const { data: userStore } = await sb
                .from('stores')
                .select('slug')
                .eq('owner_id', session.user.id)
                .single();
            
            if (userStore) {
                window.location.href = getAdminUrl(userStore.slug);
                return;
            }
        }
    }

    await loadStore(session.user.id);
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('dashboardApp').style.display = 'block';
});

async function loadStore(userId) {
    const { data, error } = await sb
        .from('stores')
        .select('*')
        .eq('owner_id', userId)
        .single();

    if (error || !data) {
        showToast('Store not found', 'error');
        return;
    }

    store = data;
    document.getElementById('storeNameDisplay').textContent = store.name;
    
    const storeUrl = getStoreUrl(store.slug);
    document.getElementById('previewLink').href = storeUrl;
    
    const statUrl = document.getElementById('statStoreUrl');
    statUrl.textContent = window.location.hostname.replace('www.', '') + '/store/' + store.slug;
    statUrl.href = storeUrl;

    loadStoreSettings();
    loadThemeSettings();
    loadProducts();
    loadOrders();
}

function loadStoreSettings() {
    document.getElementById('settingName').value = store.name || '';
    document.getElementById('settingSlug').value = store.slug || '';
    document.getElementById('settingDesc').value = store.description || '';
    document.getElementById('settingPhone').value = store.phone || '';
    document.getElementById('settingEmail').value = store.email || '';
    document.getElementById('settingAddress').value = store.address || '';
    document.getElementById('settingFacebook').value = store.facebook_link || '';
    document.getElementById('settingWhatsapp').value = store.whatsapp_link || '';

    if (store.logo) {
        document.getElementById('settingLogo').value = store.logo;
        const preview = document.getElementById('logoPreview');
        preview.innerHTML = `<img src="${store.logo}" alt="Logo">`;
    }

    if (store.custom_domain) {
        document.getElementById('customDomain').value = store.custom_domain;
        document.getElementById('domainStatus').style.display = 'block';
        
        if (store.domain_verified) {
            document.getElementById('domainStatusBadge').className = 'status-badge verified';
            document.getElementById('domainStatusBadge').innerHTML = '<i class="fas fa-check-circle"></i> Verified';
        } else {
            document.getElementById('domainStatusBadge').className = 'status-badge pending';
            document.getElementById('domainStatusBadge').innerHTML = '<i class="fas fa-clock"></i> Pending Verification';
            document.getElementById('domainInstructions').style.display = 'block';
            document.getElementById('dnsValue').textContent = store.domain_verification_token || '';
        }
        
        document.getElementById('addDomainBtn').disabled = true;
        document.getElementById('customDomain').disabled = true;
    }
}

function loadThemeSettings() {
    const theme = store.theme || {};
    document.getElementById('themePrimary').value = theme.primary_color || '#6366f1';
    document.getElementById('themeAccent').value = theme.secondary_color || '#06b6d4';
    document.getElementById('themeBg').value = theme.bg_color || '#0a0a0f';
    document.getElementById('themeCard').value = theme.card_color || '#12121a';
    document.getElementById('themeText').value = theme.text_color || '#e2e8f0';
    document.getElementById('themeFont').value = theme.font || 'Inter';
    updateThemePreview();
}

export function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    if (window.innerWidth <= 992) {
        document.getElementById('sidebar').classList.remove('open');
    }
}
window.switchTab = switchTab;

document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

async function loadProducts() {
    const { data, error } = await sb
        .from('products')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Load products error:', error);
        return;
    }

    products = data || [];
    renderProducts();
    renderOverview();
}

function renderProducts() {
    const grid = document.getElementById('productsGrid');
    const count = document.getElementById('productCount');
    count.textContent = products.length;
    document.getElementById('statProducts').textContent = products.length;

    if (products.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-box-open"></i><h3>No products yet</h3><p>Add your first product to get started</p></div>`;
        return;
    }

    grid.innerHTML = products.map(p => `
        <div class="product-card">
            <div class="product-card-img">
                ${p.image ? `<img src="${p.image}" alt="${p.name}">` : `<i class="fas fa-image no-img"></i>`}
                ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
            </div>
            <div class="product-card-body">
                <h4>${p.name}</h4>
                <p class="product-cat">${p.category || ''}</p>
                <div class="price-row">
                    <span class="price">৳${Number(p.price).toLocaleString()}</span>
                    ${p.old_price ? `<span class="old-price">৳${Number(p.old_price).toLocaleString()}</span>` : ''}
                </div>
                <div class="product-card-actions">
                    <button class="btn-edit" onclick="editProduct('${p.id}')"><i class="fas fa-edit"></i> Edit</button>
                    <button class="btn-delete" onclick="deleteProduct('${p.id}')"><i class="fas fa-trash"></i> Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderOverview() {
    const recent = document.getElementById('recentProducts');
    if (products.length === 0) {
        recent.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><p>No products yet</p></div>`;
    } else {
        recent.innerHTML = products.slice(0, 5).map(p => `
            <div class="recent-item">
                ${p.image ? `<img src="${p.image}" alt="${p.name}">` : `<div style="width:40px;height:40px;background:var(--bg);border-radius:8px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-image" style="color:var(--text-dim);opacity:0.3;"></i></div>`}
                <div class="recent-item-info">
                    <h4>${p.name}</h4>
                    <span>৳${Number(p.price).toLocaleString()}</span>
                </div>
            </div>
        `).join('');
    }
}

export function showAddProduct() {
    document.getElementById('productModalTitle').textContent = 'Add Product';
    document.getElementById('productForm').reset();
    document.getElementById('editProductId').value = '';
    document.getElementById('productImagePreview').style.display = 'none';
    uploadedProductFile = null;
    productImageMode = 'url';
    switchProductImageTab('url');
    document.getElementById('productModal').classList.add('active');
}
window.showAddProduct = showAddProduct;

export function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}
window.closeProductModal = closeProductModal;

export function editProduct(id) {
    const p = products.find(prod => prod.id === id);
    if (!p) return;

    document.getElementById('productModalTitle').textContent = 'Edit Product';
    document.getElementById('editProductId').value = p.id;
    document.getElementById('productName').value = p.name;
    document.getElementById('productCategory').value = p.category || '';
    document.getElementById('productPrice').value = p.price;
    document.getElementById('productOldPrice').value = p.old_price || '';
    document.getElementById('productBadge').value = p.badge || '';
    document.getElementById('productStock').value = String(p.in_stock !== false);
    document.getElementById('productDesc').value = p.description || '';

    if (p.image) {
        document.getElementById('productImage').value = p.image;
        document.getElementById('productPreviewImg').src = p.image;
        document.getElementById('productImagePreview').style.display = 'block';
    }

    document.getElementById('productModal').classList.add('active');
}
window.editProduct = editProduct;

export async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;

    const { error } = await sb.from('products').delete().eq('id', id);
    if (error) {
        showToast('Delete failed', 'error');
        return;
    }
    showToast('Product deleted', 'info');
    loadProducts();
}
window.deleteProduct = deleteProduct;

export async function saveProduct(e) {
    e.preventDefault();

    const name = document.getElementById('productName').value.trim();
    const category = document.getElementById('productCategory').value;
    const price = document.getElementById('productPrice').value;
    const oldPrice = document.getElementById('productOldPrice').value;
    const badge = document.getElementById('productBadge').value;
    const inStock = document.getElementById('productStock').value === 'true';
    const description = document.getElementById('productDesc').value.trim();
    const editId = document.getElementById('editProductId').value;

    let image = document.getElementById('productImage').value.trim();

    if (!name || !category || !price) {
        showToast('Fill in required fields', 'error');
        return;
    }

    if (productImageMode === 'file' && uploadedProductFile) {
        showToast('Uploading image...', 'info');
        const ext = uploadedProductFile.name.split('.').pop();
        const fileName = `${store.slug}-${Date.now()}.${ext}`;

        const { error: uploadError } = await sb.storage
            .from('product-images')
            .upload(fileName, uploadedProductFile, { cacheControl: '3600', upsert: false });

        if (uploadError) {
            showToast('Image upload failed', 'error');
            return;
        }

        const { data: urlData } = sb.storage.from('product-images').getPublicUrl(fileName);
        image = urlData.publicUrl;
    }

    if (!image) {
        showToast('Please add a product image', 'error');
        return;
    }

    const product = {
        store_id: store.id,
        name,
        category,
        price: Number(price),
        old_price: oldPrice ? Number(oldPrice) : null,
        badge: badge || null,
        in_stock: inStock,
        description: description || null,
        image
    };

    try {
        if (editId) {
            const { error } = await sb.from('products').update(product).eq('id', editId);
            if (error) throw error;
            showToast('Product updated!', 'success');
        } else {
            const { error } = await sb.from('products').insert([product]);
            if (error) throw error;
            showToast('Product added!', 'success');
        }

        closeProductModal();
        loadProducts();
    } catch (err) {
        console.error('Save error:', err);
        showToast('Save failed', 'error');
    }
}
window.saveProduct = saveProduct;

export function switchProductImageTab(mode) {
    productImageMode = mode;
    document.querySelectorAll('.image-tabs .upload-tab').forEach(t => t.classList.remove('active'));
    if (mode === 'url') {
        document.querySelector('.image-tabs .upload-tab:first-child').classList.add('active');
        document.getElementById('productImageUrlSection').style.display = 'block';
        document.getElementById('productImageFileSection').style.display = 'none';
    } else {
        document.querySelector('.image-tabs .upload-tab:last-child').classList.add('active');
        document.getElementById('productImageUrlSection').style.display = 'none';
        document.getElementById('productImageFileSection').style.display = 'block';
    }
}
window.switchProductImageTab = switchProductImageTab;

export function previewProductImage(e) {
    const url = e.target.value.trim();
    if (url) {
        document.getElementById('productPreviewImg').src = url;
        document.getElementById('productImagePreview').style.display = 'block';
    } else {
        document.getElementById('productImagePreview').style.display = 'none';
    }
}
window.previewProductImage = previewProductImage;

export function previewProductFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showToast('File too large (max 5MB)', 'error');
        return;
    }
    uploadedProductFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
        document.getElementById('productPreviewImg').src = ev.target.result;
        document.getElementById('productImagePreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
}
window.previewProductFile = previewProductFile;

export function removeProductImage() {
    document.getElementById('productImage').value = '';
    document.getElementById('productImageFile').value = '';
    uploadedProductFile = null;
    document.getElementById('productImagePreview').style.display = 'none';
}
window.removeProductImage = removeProductImage;

async function loadOrders() {
    const { data, error } = await sb
        .from('orders')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Load orders error:', error);
        return;
    }

    orders = data || [];
    renderOrders();
}

function renderOrders() {
    const list = document.getElementById('ordersList');
    const count = document.getElementById('orderCount');
    count.textContent = orders.length;
    document.getElementById('statOrders').textContent = orders.length;

    const pending = orders.filter(o => o.status === 'pending').length;
    document.getElementById('statPending').textContent = pending;

    const badge = document.getElementById('orderBadge');
    if (pending > 0) {
        badge.style.display = 'inline';
        badge.textContent = pending;
    } else {
        badge.style.display = 'none';
    }

    const recent = document.getElementById('recentOrders');
    if (orders.length === 0) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-shopping-bag"></i><h3>No orders yet</h3><p>Orders will appear here when customers place them</p></div>`;
        recent.innerHTML = `<div class="empty-state"><i class="fas fa-shopping-bag"></i><p>No orders yet</p></div>`;
        return;
    }

    list.innerHTML = orders.map(o => `
        <div class="order-item">
            <div class="order-info">
                <div class="order-icon"><i class="fas fa-shopping-bag"></i></div>
                <div class="order-details">
                    <h4>${o.customer_name || 'Customer'}</h4>
                    <span>${new Date(o.created_at).toLocaleDateString()} - ${o.customer_phone || ''}</span>
                </div>
            </div>
            <div class="order-meta">
                <span class="order-total">৳${Number(o.total || 0).toLocaleString()}</span>
                <span class="order-status ${o.status || 'pending'}">${o.status || 'pending'}</span>
                <button class="btn-view-order" onclick="viewOrder('${o.id}')">View</button>
            </div>
        </div>
    `).join('');

    recent.innerHTML = orders.slice(0, 5).map(o => `
        <div class="recent-item">
            <div style="width:40px;height:40px;background:var(--primary-glow);border-radius:8px;display:flex;align-items:center;justify-content:center;">
                <i class="fas fa-shopping-bag" style="color:var(--primary-light);font-size:14px;"></i>
            </div>
            <div class="recent-item-info">
                <h4>${o.customer_name || 'Customer'}</h4>
                <span>৳${Number(o.total || 0).toLocaleString()} - ${o.status || 'pending'}</span>
            </div>
        </div>
    `).join('');
}

export function viewOrder(id) {
    const o = orders.find(order => order.id === id);
    if (!o) return;

    const items = o.items || [];
    const content = document.getElementById('orderDetailContent');
    content.innerHTML = `
        <div style="margin-bottom:20px;">
            <p><strong>Customer:</strong> ${o.customer_name || 'N/A'}</p>
            <p><strong>Phone:</strong> ${o.customer_phone || 'N/A'}</p>
            <p><strong>Address:</strong> ${o.customer_address || 'N/A'}</p>
            <p><strong>Date:</strong> ${new Date(o.created_at).toLocaleString()}</p>
            <p><strong>Status:</strong> <span class="order-status ${o.status || 'pending'}">${o.status || 'pending'}</span></p>
        </div>
        <h4 style="margin-bottom:12px;">Items</h4>
        <div style="margin-bottom:20px;">
            ${items.map(item => `
                <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
                    <span>${item.name || 'Product'} x${item.quantity || 1}</span>
                    <span>৳${Number(item.price || 0).toLocaleString()}</span>
                </div>
            `).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:18px;">
            <span>Total</span>
            <span>৳${Number(o.total || 0).toLocaleString()}</span>
        </div>
        <div style="margin-top:20px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn-outline" onclick="updateOrderStatus('${o.id}','confirmed')" style="flex:1;padding:10px;border-radius:8px;cursor:pointer;font-family:inherit;">Confirm</button>
            <button class="btn-outline" onclick="updateOrderStatus('${o.id}','delivered')" style="flex:1;padding:10px;border-radius:8px;cursor:pointer;border-color:var(--success);color:var(--success);font-family:inherit;">Delivered</button>
            <button class="btn-outline" onclick="updateOrderStatus('${o.id}','cancelled')" style="flex:1;padding:10px;border-radius:8px;cursor:pointer;border-color:var(--danger);color:var(--danger);font-family:inherit;">Cancel</button>
        </div>
    `;
    document.getElementById('orderModal').classList.add('active');
}
window.viewOrder = viewOrder;

export function closeOrderModal() {
    document.getElementById('orderModal').classList.remove('active');
}
window.closeOrderModal = closeOrderModal;

async function updateOrderStatus(id, status) {
    const { error } = await sb.from('orders').update({ status }).eq('id', id);
    if (error) {
        showToast('Update failed', 'error');
        return;
    }
    showToast('Order updated', 'success');
    closeOrderModal();
    loadOrders();
}

export async function saveStoreSettings(e) {
    e.preventDefault();

    const updates = {
        name: document.getElementById('settingName').value.trim(),
        description: document.getElementById('settingDesc').value.trim(),
        phone: document.getElementById('settingPhone').value.trim(),
        email: document.getElementById('settingEmail').value.trim(),
        address: document.getElementById('settingAddress').value.trim(),
        facebook_link: document.getElementById('settingFacebook').value.trim(),
        whatsapp_link: document.getElementById('settingWhatsapp').value.trim()
    };

    const logoFile = document.getElementById('logoFile').files[0];
    if (logoFile) {
        showToast('Uploading logo...', 'info');
        const ext = logoFile.name.split('.').pop();
        const fileName = `${store.slug}-logo-${Date.now()}.${ext}`;

        const { error: uploadError } = await sb.storage
            .from('product-images')
            .upload(fileName, logoFile, { cacheControl: '3600', upsert: false });

        if (uploadError) {
            showToast('Logo upload failed', 'error');
            return;
        }

        const { data: urlData } = sb.storage.from('product-images').getPublicUrl(fileName);
        updates.logo = urlData.publicUrl;
    } else {
        const logoUrl = document.getElementById('settingLogo').value.trim();
        if (logoUrl) updates.logo = logoUrl;
    }

    const { error } = await sb.from('stores').update(updates).eq('id', store.id);
    if (error) {
        showToast('Save failed', 'error');
        return;
    }

    store = { ...store, ...updates };
    document.getElementById('storeNameDisplay').textContent = store.name;
    showToast('Settings saved!', 'success');
}
window.saveStoreSettings = saveStoreSettings;

export async function addCustomDomain() {
    const domain = document.getElementById('customDomain').value.trim().toLowerCase();
    
    if (!domain) {
        showToast('Please enter a domain', 'error');
        return;
    }

    if (!domain.includes('.')) {
        showToast('Please enter a valid domain', 'error');
        return;
    }

    const token = 'shopeasy-verify-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

    const { error } = await sb
        .from('stores')
        .update({
            custom_domain: domain,
            domain_verified: false,
            domain_verification_token: token
        })
        .eq('id', store.id);

    if (error) {
        if (error.code === '23505') {
            showToast('This domain is already in use', 'error');
        } else {
            showToast('Failed to add domain', 'error');
        }
        return;
    }

    document.getElementById('domainStatus').style.display = 'block';
    document.getElementById('domainStatusBadge').className = 'status-badge pending';
    document.getElementById('domainStatusBadge').innerHTML = '<i class="fas fa-clock"></i> Pending Verification';
    
    document.getElementById('domainInstructions').style.display = 'block';
    document.getElementById('dnsValue').textContent = token;
    
    document.getElementById('addDomainBtn').disabled = true;
    document.getElementById('customDomain').disabled = true;

    showToast('Domain added! Please verify ownership.', 'info');
}
window.addCustomDomain = addCustomDomain;

export async function verifyDomain() {
    showToast('Checking DNS records...', 'info');

    const { data, error } = await sb.rpc('verify_custom_domain', {
        store_id: store.id,
        token: store.domain_verification_token
    });

    if (error || !data) {
        showToast('Verification failed. Please add the DNS record first.', 'error');
        return;
    }

    document.getElementById('domainStatusBadge').className = 'status-badge verified';
    document.getElementById('domainStatusBadge').innerHTML = '<i class="fas fa-check-circle"></i> Verified';
    document.getElementById('domainInstructions').style.display = 'none';

    showToast('Domain verified successfully!', 'success');
}
window.verifyDomain = verifyDomain;

export function previewLogo(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        document.getElementById('logoPreview').innerHTML = `<img src="${ev.target.result}" alt="Logo">`;
    };
    reader.readAsDataURL(file);
}
window.previewLogo = previewLogo;

export function previewLogoUrl(e) {
    const url = e.target.value.trim();
    if (url) {
        document.getElementById('logoPreview').innerHTML = `<img src="${url}" alt="Logo">`;
    }
}
window.previewLogoUrl = previewLogoUrl;

export function updateThemePreview() {
    const primary = document.getElementById('themePrimary').value;
    const accent = document.getElementById('themeAccent').value;
    const bg = document.getElementById('themeBg').value;
    const card = document.getElementById('themeCard').value;
    const text = document.getElementById('themeText').value;

    document.getElementById('themePrimaryHex').textContent = primary;
    document.getElementById('themeAccentHex').textContent = accent;
    document.getElementById('themeBgHex').textContent = bg;
    document.getElementById('themeCardHex').textContent = card;
    document.getElementById('themeTextHex').textContent = text;

    const preview = document.getElementById('themePreview');
    preview.style.background = bg;
    preview.style.color = text;
    preview.querySelector('.tp-logo').style.background = primary;
    preview.querySelectorAll('.tp-nav span').forEach(s => s.style.background = text);
    preview.querySelector('.tp-title').style.background = text;
    preview.querySelector('.tp-subtitle').style.background = text;
    preview.querySelector('.tp-btn').style.background = primary;
    preview.querySelectorAll('.tp-product').forEach(p => {
        p.style.background = card;
        p.style.borderColor = `${text}22`;
    });
}
window.updateThemePreview = updateThemePreview;

export async function saveTheme() {
    const theme = {
        primary_color: document.getElementById('themePrimary').value,
        secondary_color: document.getElementById('themeAccent').value,
        bg_color: document.getElementById('themeBg').value,
        card_color: document.getElementById('themeCard').value,
        text_color: document.getElementById('themeText').value,
        font: document.getElementById('themeFont').value
    };

    const { error } = await sb.from('stores').update({ theme }).eq('id', store.id);
    if (error) {
        showToast('Save failed', 'error');
        return;
    }

    store.theme = theme;
    showToast('Theme saved!', 'success');
}
window.saveTheme = saveTheme;

export async function exportProducts() {
    if (products.length === 0) {
        showToast('No products to export', 'error');
        return;
    }
    const data = JSON.stringify(products, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${store.slug}-products-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Products exported!', 'success');
}
window.exportProducts = exportProducts;

export async function importProducts(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const imported = JSON.parse(ev.target.result);
            if (!Array.isArray(imported)) {
                showToast('Invalid file format', 'error');
                return;
            }
            if (!confirm(`Import ${imported.length} products?`)) return;

            const rows = imported.map(p => {
                const { id, store_id, ...rest } = p;
                return { ...rest, store_id: store.id };
            });

            const { error } = await sb.from('products').insert(rows);
            if (error) throw error;
            showToast(`${imported.length} products imported!`, 'success');
            loadProducts();
        } catch (err) {
            showToast('Import failed', 'error');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}
window.importProducts = importProducts;

export async function clearAllProducts() {
    if (!confirm('Delete ALL products? This cannot be undone!')) return;
    if (!confirm('Are you absolutely sure?')) return;

    const { error } = await sb.from('products').delete().eq('store_id', store.id);
    if (error) {
        showToast('Delete failed', 'error');
        return;
    }
    showToast('All products deleted', 'info');
    loadProducts();
}
window.clearAllProducts = clearAllProducts;

export async function logout() {
    await sb.auth.signOut();
    window.location.href = 'index.html';
}
window.logout = logout;

export function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type + ' show';
    setTimeout(() => toast.classList.remove('show'), 3000);
}

document.getElementById('productModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeProductModal();
});

document.getElementById('orderModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeOrderModal();
});
