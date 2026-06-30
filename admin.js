import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://jrbtwulhhxyqugamerrw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyYnR3dWxoaHh5cXVnYW1lcnd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzM5NDksImV4cCI6MjA5ODQwOTk0OX0.zWMonlC3nHN-llyDQtQw4pXtrMXcUSdjZPUUo_494V8';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

let allStores = [];
let allOrders = [];
let allUsers = [];

document.addEventListener('DOMContentLoaded', () => {
    sb.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            const { data: profile } = await sb.from('profiles').select('role').eq('id', session.user.id).single();
            if (profile && profile.role === 'admin') {
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('adminApp').style.display = 'block';
                loadDashboard();
            } else {
                document.getElementById('loginScreen').style.display = 'flex';
                document.getElementById('loginError').textContent = 'Access denied. Admin only.';
            }
        } else {
            document.getElementById('loginScreen').style.display = 'flex';
            document.getElementById('adminApp').style.display = 'none';
        }
    });
});

export async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    errorEl.textContent = 'Logging in...';

    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
        errorEl.textContent = error.message.includes('Invalid') ? 'Wrong credentials' : error.message;
    } else {
        errorEl.textContent = '';
    }
}
window.handleLogin = handleLogin;

export async function logout() {
    await sb.auth.signOut();
    window.location.reload();
}
window.logout = logout;

export function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    if (window.innerWidth <= 992) {
        document.getElementById('adminSidebar').classList.remove('open');
    }
}
window.switchTab = switchTab;

document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('adminSidebar').classList.toggle('open');
});

async function loadDashboard() {
    await Promise.all([loadStores(), loadOrders(), loadUsers()]);
    renderDashboard();
}

async function loadStores() {
    const { data, error } = await sb.from('stores').select('*').order('created_at', { ascending: false });
    if (!error) allStores = data || [];
    document.getElementById('statStores').textContent = allStores.length;
    document.getElementById('storeCount').textContent = allStores.length;
    renderStores();
}

async function loadOrders() {
    const { data, error } = await sb.from('orders').select('*, stores(name, slug)').order('created_at', { ascending: false });
    if (!error) allOrders = data || [];
    document.getElementById('statOrders').textContent = allOrders.length;
    document.getElementById('orderCount').textContent = allOrders.length;
    renderOrders();
}

async function loadUsers() {
    const { data, error } = await sb.rpc('get_all_users');
    if (!error && data) {
        allUsers = data;
    } else {
        allUsers = allStores.map(s => ({
            id: s.owner_id,
            email: '',
            store_name: s.name,
            store_slug: s.slug,
            created_at: s.created_at
        }));
    }
    document.getElementById('statUsers').textContent = allUsers.length;
    document.getElementById('userCount').textContent = allUsers.length;
    renderUsers();
}

async function loadTotalProducts() {
    const { count, error } = await sb.from('products').select('*', { count: 'exact', head: true });
    if (!error) {
        document.getElementById('statProducts').textContent = count || 0;
    }
}

function renderDashboard() {
    loadTotalProducts();

    const recentStores = document.getElementById('recentStores');
    if (allStores.length === 0) {
        recentStores.innerHTML = `<div class="empty-state"><i class="fas fa-store"></i><p>No stores yet</p></div>`;
    } else {
        recentStores.innerHTML = allStores.slice(0, 5).map(s => `
            <div class="recent-item">
                <div style="width:36px;height:36px;background:var(--primary-glow);border-radius:8px;display:flex;align-items:center;justify-content:center;">
                    ${s.logo ? `<img src="${s.logo}" style="width:100%;height:100%;border-radius:8px;object-fit:cover;">` : `<i class="fas fa-store" style="color:var(--primary-light);font-size:14px;"></i>`}
                </div>
                <div class="recent-item-info">
                    <h4>${s.name}</h4>
                    <span>${s.slug}.shopeasy.com</span>
                </div>
            </div>
        `).join('');
    }

    const recentOrders = document.getElementById('recentOrders');
    if (allOrders.length === 0) {
        recentOrders.innerHTML = `<div class="empty-state"><i class="fas fa-shopping-bag"></i><p>No orders yet</p></div>`;
    } else {
        recentOrders.innerHTML = allOrders.slice(0, 5).map(o => `
            <div class="recent-item">
                <div style="width:36px;height:36px;background:var(--primary-glow);border-radius:8px;display:flex;align-items:center;justify-content:center;">
                    <i class="fas fa-shopping-bag" style="color:var(--primary-light);font-size:14px;"></i>
                </div>
                <div class="recent-item-info">
                    <h4>${o.customer_name || 'Customer'}</h4>
                    <span>৳${Number(o.total || 0).toLocaleString()} - ${o.stores?.name || 'Unknown'}</span>
                </div>
            </div>
        `).join('');
    }
}

function renderStores() {
    const list = document.getElementById('storesList');
    if (allStores.length === 0) {
        list.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-store"></i><h3>No stores</h3></div>`;
        return;
    }

    list.innerHTML = allStores.map(s => `
        <div class="store-item" data-name="${s.name.toLowerCase()}" data-slug="${s.slug.toLowerCase()}">
            <div class="store-item-logo">
                ${s.logo ? `<img src="${s.logo}" alt="${s.name}">` : `<i class="fas fa-store"></i>`}
            </div>
            <div class="store-item-info">
                <h4>${s.name}</h4>
                <span class="store-slug">${s.slug}.shopeasy.com</span>
                <div class="store-meta">Created: ${new Date(s.created_at).toLocaleDateString()}</div>
            </div>
            <div class="store-item-actions">
                <a href="store.html?store=${s.slug}" target="_blank" class="btn-sm btn-view"><i class="fas fa-eye"></i> View</a>
                <button class="btn-sm btn-delete-sm" onclick="deleteStore('${s.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

export function filterStores() {
    const query = document.getElementById('storeSearch').value.toLowerCase();
    document.querySelectorAll('.store-item').forEach(item => {
        const name = item.dataset.name;
        const slug = item.dataset.slug;
        item.style.display = (name.includes(query) || slug.includes(query)) ? 'flex' : 'none';
    });
}
window.filterStores = filterStores;

export async function deleteStore(id) {
    if (!confirm('Delete this store and all its data?')) return;

    const { error } = await sb.from('stores').delete().eq('id', id);
    if (error) {
        showToast('Delete failed', 'error');
        return;
    }
    showToast('Store deleted', 'info');
    loadDashboard();
}
window.deleteStore = deleteStore;

function renderUsers() {
    const list = document.getElementById('usersList');
    if (allUsers.length === 0) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><h3>No users</h3></div>`;
        return;
    }

    list.innerHTML = allUsers.map(u => `
        <div class="user-item">
            <div class="user-info">
                <div class="user-avatar">${(u.email || u.store_name || '?')[0].toUpperCase()}</div>
                <div class="user-details">
                    <h4>${u.store_name || u.email || 'Unknown'}</h4>
                    <span>${u.email || u.store_slug || ''}</span>
                </div>
            </div>
            <span class="user-meta">${u.created_at ? new Date(u.created_at).toLocaleDateString() : ''}</span>
        </div>
    `).join('');
}

function renderOrders() {
    const list = document.getElementById('ordersList');
    if (allOrders.length === 0) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-shopping-bag"></i><h3>No orders</h3></div>`;
        return;
    }

    list.innerHTML = allOrders.map(o => `
        <div class="order-item">
            <div class="order-info">
                <div class="order-icon"><i class="fas fa-shopping-bag"></i></div>
                <div class="order-details">
                    <h4>${o.customer_name || 'Customer'}</h4>
                    <span>${o.customer_phone || ''} - ${new Date(o.created_at).toLocaleDateString()}</span>
                </div>
            </div>
            <div class="order-meta">
                <span class="order-store">${o.stores?.name || 'Unknown store'}</span>
                <span class="order-total">৳${Number(o.total || 0).toLocaleString()}</span>
                <span class="order-status ${o.status || 'pending'}">${o.status || 'pending'}</span>
            </div>
        </div>
    `).join('');
}

export async function savePlatformSettings() {
    const name = document.getElementById('platformName').value.trim();
    const email = document.getElementById('supportEmail').value.trim();

    if (!name) {
        showToast('Platform name is required', 'error');
        return;
    }

    const { error } = await sb.from('platform_settings').upsert({
        id: 'config',
        platform_name: name,
        support_email: email
    });

    if (error) {
        showToast('Save failed', 'error');
        return;
    }
    showToast('Settings saved!', 'success');
}
window.savePlatformSettings = savePlatformSettings;

export async function clearPlatform() {
    if (!confirm('This will delete ALL stores, products, and orders. Are you sure?')) return;
    if (!confirm('FINAL WARNING: This cannot be undone!')) return;

    try {
        await sb.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await sb.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await sb.from('stores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        showToast('All data cleared', 'info');
        loadDashboard();
    } catch (err) {
        showToast('Clear failed', 'error');
    }
}
window.clearPlatform = clearPlatform;

export function closeStoreModal() {
    document.getElementById('storeModal').classList.remove('active');
}
window.closeStoreModal = closeStoreModal;

export function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type + ' show';
    setTimeout(() => toast.classList.remove('show'), 3000);
}

document.getElementById('storeModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeStoreModal();
});
