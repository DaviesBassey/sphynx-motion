-- SPHYNX MOTION · Payment Integration
-- Run after 004_video.sql

-- ─── STRIPE FIELDS ON PROFILES ────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- ─── PAYMENT ORDERS ───────────────────────────────────────────────────────────
-- One row per payment attempt (web or mobile). Linked to subscriptions or tokens.
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL CHECK (provider IN ('stripe','payfast','apple','google','revenuecat')),
  provider_order_id    TEXT,          -- Stripe session/PI id, PayFast m_payment_id, etc.
  product_type         TEXT NOT NULL CHECK (product_type IN ('soul_pass','soul_tokens')),
  product_id           TEXT,          -- Stripe price_id, package id, IAP product id
  amount               NUMERIC(10,2),
  currency             TEXT DEFAULT 'ZAR',
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','paid','failed','refunded','cancelled')),
  tokens_granted       INTEGER DEFAULT 0,
  meta                 JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── STRIPE COLUMNS ON SUBSCRIPTIONS ─────────────────────────────────────────
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_price_id         TEXT,
  ADD COLUMN IF NOT EXISTS payfast_payment_id       TEXT,
  ADD COLUMN IF NOT EXISTS revenuecat_entitlement   TEXT,
  ADD COLUMN IF NOT EXISTS renewed_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end     BOOLEAN DEFAULT FALSE;

-- ─── PUSH NOTIFICATION SUBSCRIPTIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  platform   TEXT DEFAULT 'web',  -- 'web', 'ios', 'android'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.payment_orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_own"        ON public.payment_orders     FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "orders_admin"      ON public.payment_orders     FOR ALL    USING (public.get_my_role() IN ('admin','superadmin'));
CREATE POLICY "push_own_insert"   ON public.push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "push_own_select"   ON public.push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "push_admin"        ON public.push_subscriptions FOR ALL    USING (public.get_my_role() IN ('admin','superadmin'));

-- ─── HELPER: activate subscription after payment ─────────────────────────────
CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_user_id           UUID,
  p_plan              TEXT,
  p_provider          TEXT,
  p_provider_sub_id   TEXT DEFAULT NULL,
  p_price_id          TEXT DEFAULT NULL,
  p_amount            NUMERIC DEFAULT NULL,
  p_currency          TEXT DEFAULT 'ZAR',
  p_expires_at        TIMESTAMPTZ DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO public.subscriptions
    (user_id, plan, status, provider, provider_id, stripe_subscription_id, stripe_price_id,
     amount, currency, expires_at, started_at)
  VALUES
    (p_user_id, p_plan, 'active', p_provider, p_provider_sub_id, p_provider_sub_id,
     p_price_id, p_amount, p_currency, p_expires_at, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET status = 'active', provider = p_provider, provider_id = p_provider_sub_id,
        stripe_subscription_id = p_provider_sub_id, stripe_price_id = p_price_id,
        amount = p_amount, currency = p_currency, expires_at = p_expires_at,
        renewed_at = NOW();

  UPDATE public.profiles
  SET subscription_status = 'active', updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
