-- Initialize vector infrastructure extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- User Profile Ledger with localized Vector Space mapping
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    stripe_customer_id TEXT UNIQUE,
    financial_profile_text TEXT,
    -- 1536-dimension vector space capturing user risk tolerance and portfolio characteristics via Jina
    portfolio_embedding vector(1536)
);

-- Immutable Transactional Audit Logs
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT NOT NULL,
    amount NUMERIC(14, 4) NOT NULL,
    currency CHAR(3) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Active Security Boundary Isolation via Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile self-access execution policy" ON public.profiles;
CREATE POLICY "Profile self-access execution policy"
    ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profile self-mutation execution policy" ON public.profiles;
CREATE POLICY "Profile self-mutation execution policy"
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Transaction self-history visibility isolation" ON public.transactions;
CREATE POLICY "Transaction self-history visibility isolation"
    ON public.transactions FOR SELECT USING (auth.uid() = user_id);
