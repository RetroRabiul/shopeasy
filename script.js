import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
import { routeBySubdomain, isAdminSubdomain, getStoreSubdomain } from './router.js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    const route = await routeBySubdomain();
    const loading = document.getElementById('routerLoading');
    const landingContent = document.getElementById('landingContent');

    if (route === 'admin') {
        window.location.href = 'dashboard.html';
        return;
    }

    if (route === 'store') {
        window.location.href = `store.html?store=${getStoreSubdomain()}`;
        return;
    }

    if (route === 'notfound') {
        loading.innerHTML = '<div style="text-align:center;color:#e2e8f0;"><h1 style="font-size:48px;margin-bottom:16px;">Store Not Found</h1><p style="color:#94a3b8;margin-bottom:24px;">The store you\'re looking for doesn\'t exist.</p><a href="/" style="color:#6366f1;">Go to ShopEasy</a></div>';
        return;
    }

    if (loading) loading.style.display = 'none';
    if (landingContent) landingContent.style.display = 'block';

    initLandingPage();
});

function initLandingPage() {
    const navbar = document.getElementById('navbar');
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');

    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.pageYOffset > 50);
    });

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
        });
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

    function showModal(type) {
        const overlay = document.getElementById('modalOverlay');
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');

        if (type === 'login') {
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
        } else {
            loginForm.style.display = 'none';
            signupForm.style.display = 'block';
        }

        overlay.classList.add('active');
    }

    function hideModal() {
        document.getElementById('modalOverlay').classList.remove('active');
        document.getElementById('loginError').textContent = '';
        document.getElementById('signupError').textContent = '';
    }

    window.showModal = showModal;
    window.hideModal = hideModal;

    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) hideModal();
    });

    async function handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');

        if (!email || !password) {
            errorEl.textContent = 'Please fill in all fields';
            return;
        }

        errorEl.textContent = 'Logging in...';

        const { data, error } = await sb.auth.signInWithPassword({ email, password });

        if (error) {
            errorEl.textContent = error.message.includes('Invalid') ? 'Wrong email or password!' : 'Login error: ' + error.message;
        } else {
            errorEl.textContent = '';
            hideModal();
            showToast('Login successful!', 'success');

            const { data: profile } = await sb
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

            setTimeout(async () => {
                if (profile && profile.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    const { data: store } = await sb
                        .from('stores')
                        .select('slug')
                        .eq('owner_id', data.user.id)
                        .single();

                    if (store) {
                        const host = window.location.hostname;
                        const parts = host.split('.');
                        const baseDomain = parts.length >= 3 ? parts.slice(1).join('.') : host;
                        window.location.href = `https://admin.${store.slug}.${baseDomain}/`;
                    } else {
                        window.location.href = 'dashboard.html';
                    }
                }
            }, 500);
        }
    }

    async function handleSignup(e) {
        e.preventDefault();
        const name = document.getElementById('signupName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const storeName = document.getElementById('signupStore').value.trim();
        const subdomain = document.getElementById('signupSubdomain').value.trim().toLowerCase();
        const errorEl = document.getElementById('signupError');

        if (!name || !email || !password || !storeName || !subdomain) {
            errorEl.textContent = 'Please fill in all fields';
            return;
        }

        if (!/^[a-z0-9-]+$/.test(subdomain)) {
            errorEl.textContent = 'Subdomain can only have lowercase letters, numbers, and hyphens';
            return;
        }

        if (password.length < 6) {
            errorEl.textContent = 'Password must be at least 6 characters';
            return;
        }

        errorEl.textContent = 'Creating your store...';

        const { data: authData, error: authError } = await sb.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } }
        });

        if (authError) {
            errorEl.textContent = authError.message;
            return;
        }

        if (authData.user) {
            const { error: storeError } = await sb.from('stores').insert([{
                owner_id: authData.user.id,
                name: storeName,
                slug: subdomain,
                description: '',
                theme: {
                    primary_color: '#6366f1',
                    secondary_color: '#06b6d4',
                    bg_color: '#0a0a0f',
                    card_color: '#12121a',
                    text_color: '#e2e8f0',
                    font: 'Inter'
                }
            }]);

            if (storeError) {
                if (storeError.message.includes('duplicate') || storeError.code === '23505') {
                    errorEl.textContent = 'This subdomain is already taken. Try another one.';
                    return;
                }
                console.error('Store creation error:', storeError);
            }

            errorEl.textContent = '';
            hideModal();
            showToast('Store created! Please check your email to verify.', 'success');
            setTimeout(() => {
                const host = window.location.hostname;
                const parts = host.split('.');
                const baseDomain = parts.length >= 3 ? parts.slice(1).join('.') : host;
                window.location.href = `https://${subdomain}.${baseDomain}/`;
            }, 1500);
        }
    }

    window.handleLogin = handleLogin;
    window.handleSignup = handleSignup;

    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast ' + type + ' show';
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    sb.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            const loginBtn = document.getElementById('loginBtn');
            if (loginBtn) {
                loginBtn.textContent = 'Dashboard';
                loginBtn.onclick = () => window.location.href = 'dashboard.html';
            }
        }
    });
}
