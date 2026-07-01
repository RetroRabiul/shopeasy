import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export function isCustomDomain() {
    const host = window.location.hostname;
    return !host.includes('vercel.app') && !host.includes('localhost') && host.split('.').length >= 3;
}

export function getSubdomain() {
    if (!isCustomDomain()) return null;
    const host = window.location.hostname;
    const parts = host.split('.');
    if (parts[0] === 'www' || parts[0] === '' || parts[0] === 'admin') return null;
    return parts[0].toLowerCase();
}

export function isAdminSubdomain() {
    if (!isCustomDomain()) return false;
    const host = window.location.hostname;
    const parts = host.split('.');
    return parts[0].toLowerCase() === 'admin';
}

export function getStoreSubdomain() {
    if (isAdminSubdomain()) {
        const host = window.location.hostname;
        const parts = host.split('.');
        if (parts.length >= 3) return parts[1].toLowerCase();
    }
    return getSubdomain();
}

export function getStoreSlugFromPath() {
    const path = window.location.pathname;
    const match = path.match(/^\/store\/([a-z0-9-]+)$/);
    if (match) return match[1];
    return null;
}

export async function routeBySubdomain() {
    if (!isCustomDomain()) {
        const pathSlug = getStoreSlugFromPath();
        if (pathSlug) return 'store';
        return 'landing';
    }

    const isAdmin = isAdminSubdomain();
    const storeSlug = getStoreSubdomain();

    if (!storeSlug) return 'landing';

    const { data: store, error } = await sb
        .from('stores')
        .select('id, slug, owner_id')
        .eq('slug', storeSlug)
        .single();

    if (error || !store) return 'notfound';
    return isAdmin ? 'admin' : 'store';
}

export function getStoreUrl(slug) {
    if (isCustomDomain()) {
        const host = window.location.hostname;
        const parts = host.split('.');
        const baseDomain = parts.slice(1).join('.');
        return `https://${slug}.${baseDomain}/`;
    }
    return `/store/${slug}`;
}

export function getAdminUrl(slug) {
    if (isCustomDomain()) {
        const host = window.location.hostname;
        const parts = host.split('.');
        const baseDomain = parts.slice(1).join('.');
        return `https://admin.${slug}.${baseDomain}/`;
    }
    return '/dashboard';
}
