import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://jrbtwulhhxyqugamerrw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyYnR3dWxoaHh5cXVnYW1lcnd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzM5NDksImV4cCI6MjA5ODQwOTk0OX0.zWMonlC3nHN-llyDQtQw4pXtrMXcUSdjZPUUo_494V8';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

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

export function showModal(type) {
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

export function hideModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.getElementById('loginError').textContent = '';
    document.getElementById('signupError').textContent = '';
}

window.showModal = showModal;
window.hideModal = hideModal;

document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideModal();
});

export async function handleLogin(e) {
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
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 500);
    }
}

export async function handleSignup(e) {
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
            window.location.href = 'dashboard.html';
        }, 1500);
    }
}

window.handleLogin = handleLogin;
window.handleSignup = handleSignup;

export function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type + ' show';
    setTimeout(() => toast.classList.remove('show'), 3000);
}

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.textContent = 'Dashboard';
            loginBtn.onclick = () => window.location.href = 'dashboard.html';
        }
    }
});
