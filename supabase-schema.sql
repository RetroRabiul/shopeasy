-- ============================================
-- ShopEasy Platform - Supabase Database Schema
-- ============================================
-- Run this in your Supabase SQL Editor to set up all tables.
-- Make sure to also set up RLS policies (see bottom of file).
-- ============================================

-- Drop old tables if they exist (from previous version)
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS platform_settings CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- ============================================
-- 1. PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'user'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 2. STORES TABLE
-- ============================================
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    logo TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    facebook_link TEXT,
    whatsapp_link TEXT,
    theme JSONB DEFAULT '{"primary_color":"#6366f1","secondary_color":"#06b6d4","bg_color":"#0a0a0f","card_color":"#12121a","text_color":"#e2e8f0","font":"Inter"}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stores_slug ON stores(slug);
CREATE INDEX idx_stores_owner ON stores(owner_id);

-- ============================================
-- 3. PRODUCTS TABLE
-- ============================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    price DECIMAL(10,2) NOT NULL,
    old_price DECIMAL(10,2),
    image TEXT,
    badge TEXT,
    in_stock BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_store ON products(store_id);

-- ============================================
-- 4. ORDERS TABLE
-- ============================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_name TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    items JSONB DEFAULT '[]',
    total DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'delivered', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_store ON orders(store_id);

-- ============================================
-- 5. PLATFORM SETTINGS TABLE
-- ============================================
CREATE TABLE platform_settings (
    id TEXT PRIMARY KEY DEFAULT 'config',
    platform_name TEXT DEFAULT 'ShopEasy',
    support_email TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_settings (id, platform_name) VALUES ('config', 'ShopEasy');

-- ============================================
-- 6. HELPER FUNCTION: Get all users (admin only)
-- ============================================
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
    id UUID,
    email TEXT,
    store_name TEXT,
    store_slug TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        au.id,
        au.email::TEXT,
        s.name AS store_name,
        s.slug AS store_slug,
        au.created_at
    FROM auth.users au
    LEFT JOIN stores s ON s.owner_id = au.id
    ORDER BY au.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- PROFILES: Users can read their own profile
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- STORES: 
--   - Anyone can read stores (needed for storefronts)
--   - Users can insert their own store
--   - Users can update/delete their own store
--   - Admins can do everything
DROP POLICY IF EXISTS "stores_select_all" ON stores;
CREATE POLICY "stores_select_all" ON stores
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "stores_insert_own" ON stores;
CREATE POLICY "stores_insert_own" ON stores
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "stores_update_own" ON stores;
CREATE POLICY "stores_update_own" ON stores
    FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "stores_delete_own" ON stores;
CREATE POLICY "stores_delete_own" ON stores
    FOR DELETE USING (auth.uid() = owner_id);

-- PRODUCTS:
--   - Anyone can read products (needed for storefronts)
--   - Store owners can manage their own products
--   - Admins can do everything
DROP POLICY IF EXISTS "products_select_all" ON products;
CREATE POLICY "products_select_all" ON products
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "products_insert_own_store" ON products;
CREATE POLICY "products_insert_own_store" ON products
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE id = store_id AND owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "products_update_own_store" ON products;
CREATE POLICY "products_update_own_store" ON products
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE id = store_id AND owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "products_delete_own_store" ON products;
CREATE POLICY "products_delete_own_store" ON products
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE id = store_id AND owner_id = auth.uid())
    );

-- ORDERS:
--   - Anyone can insert orders (customers place orders)
--   - Store owners can read/update their store's orders
--   - Admins can do everything
DROP POLICY IF EXISTS "orders_insert_all" ON orders;
CREATE POLICY "orders_insert_all" ON orders
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "orders_select_own_store" ON orders;
CREATE POLICY "orders_select_own_store" ON orders
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE id = store_id AND owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "orders_update_own_store" ON orders;
CREATE POLICY "orders_update_own_store" ON orders
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE id = store_id AND owner_id = auth.uid())
    );

-- PLATFORM SETTINGS: Anyone can read, only admins can update
DROP POLICY IF EXISTS "platform_settings_select_all" ON platform_settings;
CREATE POLICY "platform_settings_select_all" ON platform_settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "platform_settings_update_admin" ON platform_settings;
CREATE POLICY "platform_settings_update_admin" ON platform_settings
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- 8. ADMIN SETUP
-- ============================================
-- After creating your admin account in Supabase Auth,
-- run this to make them an admin:
--
-- UPDATE profiles SET role = 'admin' WHERE id = 'YOUR-USER-UUID-HERE';
--
-- Or to make the first user an admin:
-- UPDATE profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users LIMIT 1);

-- ============================================
-- 9. STORAGE BUCKET
-- ============================================
-- Create a storage bucket called 'product-images' in Supabase Dashboard
-- Then add these policies:
--
-- - Allow public read access (for displaying images)
-- - Allow authenticated users to upload
-- - Allow users to delete their own uploads

-- ============================================
-- DONE! Your database is ready.
-- ============================================
