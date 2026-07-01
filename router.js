import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export function getSubdomain() {
    const host = window.location.hostname;
    const parts = host.split('.');
    
    if (parts.length <= 2) return null;
    
    if (parts[0] === 'www' || parts[0] === '') return null;
    
    return parts[0].toLowerCase();
}

export function isAdminSubdomain() {
    const host = window.location.hostname;
    const parts = host.split('.');
    
    if (parts.length <= 2) return false;
    
    return parts[0].toLowerCase() === 'admin';
}

export function getStoreSubdomain() {
    if (isAdminSubdomain()) {
        const host = window.location.hostname;
        const parts = host.split('.');
        if (parts.length >= 3) {
            return parts[1].toLowerCase();
        }
    }
    return getSubdomain();
}

export async function routeBySubdomain() {
    const isAdmin = isAdminSubdomain();
    const storeSlug = getStoreSubdomain();
    
    if (!storeSlug) {
        return 'landing';
    }
    
    const { data: store, error } = await sb
        .from('stores')
        .select('id, slug, owner_id')
        .eq('slug', storeSlug)
        .single();
    
    if (error || !store) {
        return 'notfound';
    }
    
    if (isAdmin) {
        return 'admin';
    }
    
    return 'store';
}

export function redirectToStore(storeSlug, isAdmin = false) {
    const host = window.location.hostname;
    const parts = host.split('.');
    
    let newHost;
    if (parts.length >= 3) {
        const baseDomain = parts.slice(1).join('.');
        newHost = isAdmin ? `admin.${storeSlug}.${baseDomain}` : `${storeSlug}.${baseDomain}`;
    } else {
        newHost = isAdmin ? `admin.${storeSlug}.${host}` : `${storeSlug}.${host}`;
    }
    
    const protocol = window.location.protocol;
    const port = window.location.port ? `:${window.location.port}` : '';
    window.location.href = `${protocol}//${newHost}${port}/`;
}
