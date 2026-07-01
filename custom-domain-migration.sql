-- ============================================
-- Custom Domain Support - Migration
-- ============================================
-- Run this in Supabase SQL Editor to add custom domain support

-- Add custom domain fields to stores table
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS domain_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS domain_verification_token TEXT;

-- Create index for custom domain lookups
CREATE INDEX IF NOT EXISTS idx_stores_custom_domain ON stores(custom_domain);

-- Function to generate verification token
CREATE OR REPLACE FUNCTION generate_verification_token()
RETURNS TEXT AS $$
BEGIN
    RETURN 'shopeasy-verify-' || encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to verify domain ownership
CREATE OR REPLACE FUNCTION verify_custom_domain(store_id UUID, token TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    stored_token TEXT;
BEGIN
    SELECT domain_verification_token INTO stored_token
    FROM stores
    WHERE id = store_id;
    
    IF stored_token = token THEN
        UPDATE stores
        SET domain_verified = true
        WHERE id = store_id;
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policy for custom domain updates
DROP POLICY IF EXISTS "stores_update_custom_domain" ON stores;
CREATE POLICY "stores_update_custom_domain" ON stores
    FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Function to lookup store by custom domain
CREATE OR REPLACE FUNCTION get_store_by_domain(domain TEXT)
RETURNS TABLE (
    id UUID,
    owner_id UUID,
    name TEXT,
    slug TEXT,
    description TEXT,
    logo TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    facebook_link TEXT,
    whatsapp_link TEXT,
    custom_domain TEXT,
    domain_verified BOOLEAN,
    theme JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.owner_id,
        s.name,
        s.slug,
        s.description,
        s.logo,
        s.phone,
        s.email,
        s.address,
        s.facebook_link,
        s.whatsapp_link,
        s.custom_domain,
        s.domain_verified,
        s.theme,
        s.created_at
    FROM stores s
    WHERE s.custom_domain = domain
    AND s.domain_verified = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Usage Instructions:
-- ============================================
-- 1. Store owner adds their domain in dashboard
-- 2. System generates a verification token
-- 3. Owner adds TXT record: _shopeasy-verify.shopname.com = "shopeasy-verify-abc123..."
-- 4. System checks DNS for the TXT record
-- 5. If found, marks domain as verified
-- 6. Owner points their domain to Vercel (CNAME to cname.vercel-dns.com)
-- 7. Vercel automatically handles SSL and routing
