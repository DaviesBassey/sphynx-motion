/**
 * SphynxPlay · Payments
 *
 * Web:    Stripe Checkout (subscription + token purchase)
 * SA:     PayFast ITN (alternative web checkout for South Africa)
 * Mobile: RevenueCat webhook (validates Apple IAP + Google Play receipts server-side)
 *
 * Routes (all public — auth is checked per-route):
 *   POST /api/payments/stripe/checkout       → create Stripe Checkout Session
 *   POST /api/payments/stripe/webhook        → Stripe event handler (raw body)
 *   GET  /api/payments/stripe/portal         → Stripe Customer Portal URL
 *   POST /api/payments/payfast/initiate      → generate PayFast form data + signature
 *   POST /api/payments/payfast/itn           → PayFast Instant Transaction Notification
 *   POST /api/payments/revenuecat/webhook    → RevenueCat event (mobile IAP)
 *   GET  /api/payments/packages              → token packages (public)
 */
const express  = require('express');
const crypto   = require('crypto');
const { supabaseAdmin } = require('../../lib/supabase');

const router = express.Router();

// ── HELPERS ───────────────────────────────────────────────────────────────────
function stripe() {
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

async function getUserFromToken(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '') || req.cookies?.sphynx_session;
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function ensureStripeCustomer(user) {
  const { data: profile, error } = await supabaseAdmin.from('profiles').select('stripe_customer_id, email').eq('id', user.id).single();
  if (error) throw new Error('Failed to fetch profile: ' + error.message);
  if (!profile) throw new Error('Profile not found for user ' + user.id);
  if (profile.stripe_customer_id) return profile.stripe_customer_id;
  const customer = await stripe().customers.create({ email: profile.email || user.email, metadata: { supabase_uid: user.id } });
  await supabaseAdmin.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', user.id);
  return customer.id;
}

// ── TOKEN PACKAGES (public) ───────────────────────────────────────────────────
router.get('/packages', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('soul_token_packages').select('*').eq('is_active', true).order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ packages: data });
});

// ── STRIPE CHECKOUT ───────────────────────────────────────────────────────────
/**
 * POST /api/payments/stripe/checkout
 * body: { type: 'soul_pass'|'soul_tokens', price_id?, package_id?, plan? }
 *
 * type=soul_pass    → Stripe subscription checkout (price_id required)
 * type=soul_tokens  → Stripe one-time payment (package_id required)
 */
router.post('/stripe/checkout', async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Stripe not configured' });

  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Sign in to purchase', code: 'auth_required' });

  const { type, price_id, package_id } = req.body;
  const origin = process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get('host')}`;

  try {
    const customerId = await ensureStripeCustomer(user);

    let session;
    if (type === 'soul_pass') {
      if (!price_id) return res.status(400).json({ error: 'price_id required for soul_pass' });
      session = await stripe().checkout.sessions.create({
        customer:    customerId,
        mode:        'subscription',
        line_items:  [{ price: price_id, quantity: 1 }],
        success_url: `${origin}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${origin}/#member`,
        metadata:    { user_id: user.id, type: 'soul_pass' },
        subscription_data: { metadata: { user_id: user.id } },
      });
    } else if (type === 'soul_tokens') {
      if (!package_id) return res.status(400).json({ error: 'package_id required for soul_tokens' });
      const { data: pkg } = await supabaseAdmin.from('soul_token_packages').select('*').eq('id', package_id).single();
      if (!pkg) return res.status(404).json({ error: 'Package not found' });
      session = await stripe().checkout.sessions.create({
        customer:   customerId,
        mode:       'payment',
        line_items: [{
          price_data: {
            currency:     'zar',
            unit_amount:  Math.round(pkg.price_zar * 100),
            product_data: { name: `${pkg.amount} Soul Tokens`, description: 'SphynxPlay Soul Tokens' },
          },
          quantity: 1,
        }],
        success_url: `${origin}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${origin}/#member`,
        metadata:    { user_id: user.id, type: 'soul_tokens', package_id, tokens: pkg.amount },
      });
    } else {
      return res.status(400).json({ error: 'type must be soul_pass or soul_tokens' });
    }

    // Record pending order
    await supabaseAdmin.from('payment_orders').insert({
      user_id: user.id, provider: 'stripe', provider_order_id: session.id,
      product_type: type, product_id: price_id || package_id,
      amount: session.amount_total ? session.amount_total / 100 : null,
      currency: 'ZAR', status: 'pending',
    });

    res.json({ url: session.url, session_id: session.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── STRIPE CUSTOMER PORTAL ────────────────────────────────────────────────────
router.get('/stripe/portal', async (req, res) => {
  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Sign in required' });
  const { data: profile } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
  if (!profile?.stripe_customer_id) return res.status(400).json({ error: 'No Stripe customer found' });
  const origin = process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get('host')}`;
  try {
    const session = await stripe().billingPortal.sessions.create({
      customer:   profile.stripe_customer_id,
      return_url: `${origin}/#profile`,
    });
    res.json({ url: session.url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── STRIPE WEBHOOK ────────────────────────────────────────────────────────────
// Registered as raw body middleware in index.js
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe().webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send(`Webhook signature failed: ${e.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId  = session.metadata?.user_id;
        if (!userId) break;

        await supabaseAdmin.from('payment_orders')
          .update({ status: 'paid' }).eq('provider_order_id', session.id);

        if (session.metadata?.type === 'soul_tokens') {
          const tokens = parseInt(session.metadata.tokens || 0);
          if (tokens > 0) {
            await supabaseAdmin.rpc('grant_soul_tokens', {
              p_user_id: userId, p_amount: tokens, p_reason: 'Stripe token purchase',
            });
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub    = event.data.object;
        const { data: profile } = await supabaseAdmin.from('profiles')
          .select('id').eq('stripe_customer_id', sub.customer).single();
        if (!profile) break;

        const status    = sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'cancelled';
        const expiresAt = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;

        await supabaseAdmin.rpc('activate_subscription', {
          p_user_id: profile.id, p_plan: 'soul_pass', p_provider: 'stripe',
          p_provider_sub_id: sub.id, p_price_id: sub.items?.data[0]?.price?.id,
          p_amount: (sub.items?.data[0]?.price?.unit_amount || 0) / 100,
          p_expires_at: expiresAt,
        });

        if (status !== 'active') {
          await supabaseAdmin.from('profiles').update({ subscription_status: status }).eq('id', profile.id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const { data: profile } = await supabaseAdmin.from('profiles')
          .select('id').eq('stripe_customer_id', sub.customer).single();
        if (!profile) break;
        await supabaseAdmin.from('subscriptions').update({ status: 'cancelled' }).eq('stripe_subscription_id', sub.id);
        await supabaseAdmin.from('profiles').update({ subscription_status: 'cancelled' }).eq('id', profile.id);
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object;
        const { data: profile } = await supabaseAdmin.from('profiles')
          .select('id').eq('stripe_customer_id', inv.customer).single();
        if (profile) await supabaseAdmin.from('profiles').update({ subscription_status: 'past_due' }).eq('id', profile.id);
        break;
      }
    }
  } catch (e) {
    console.error('Stripe webhook handler error:', e.message);
  }

  res.json({ received: true });
});

// ── PAYFAST (South Africa) ────────────────────────────────────────────────────
/**
 * POST /api/payments/payfast/initiate
 * Returns form fields + signature to POST to PayFast.
 * Client renders a hidden form and auto-submits it.
 */
router.post('/payfast/initiate', async (req, res) => {
  if (!process.env.PAYFAST_MERCHANT_ID) return res.status(503).json({ error: 'PayFast not configured' });

  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Sign in required' });

  const { type, package_id, plan } = req.body;
  const { data: profile } = await supabaseAdmin.from('profiles').select('email, display_name').eq('id', user.id).single();
  const origin = process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get('host')}`;

  let amount, itemName, itemDescription;
  if (type === 'soul_tokens' && package_id) {
    const { data: pkg } = await supabaseAdmin.from('soul_token_packages').select('*').eq('id', package_id).single();
    if (!pkg) return res.status(404).json({ error: 'Package not found' });
    amount = pkg.price_zar.toFixed(2);
    itemName = `${pkg.amount} Soul Tokens`;
    itemDescription = 'SphynxPlay Soul Tokens';
  } else if (type === 'soul_pass') {
    amount = plan === 'yearly' ? '699.00' : '79.00';
    itemName = `Soul Pass ${plan === 'yearly' ? 'Yearly' : 'Monthly'}`;
    itemDescription = 'SphynxPlay Soul Pass subscription';
  } else {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const mPaymentId = `sm-${Date.now()}-${user.id.slice(0, 8)}`;

  const fields = {
    merchant_id:  process.env.PAYFAST_MERCHANT_ID,
    merchant_key: process.env.PAYFAST_MERCHANT_KEY,
    return_url:   `${origin}/payments/success`,
    cancel_url:   `${origin}/#member`,
    notify_url:   `${origin}/api/payments/payfast/itn`,
    name_first:   (profile?.display_name || 'User').split(' ')[0].slice(0, 100),
    email_address: profile?.email || user.email || '',
    m_payment_id: mPaymentId,
    amount,
    item_name:    itemName,
    item_description: itemDescription,
    custom_str1:  user.id,
    custom_str2:  type,
    custom_str3:  package_id || plan || '',
  };

  // Build signature string (alphabetical, exclude empty)
  const sigString = Object.entries(fields)
    .filter(([, v]) => v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
    .join('&');

  const passphrase = process.env.PAYFAST_PASSPHRASE || '';
  const sigInput   = passphrase ? `${sigString}&passphrase=${encodeURIComponent(passphrase)}` : sigString;
  const signature  = crypto.createHash('md5').update(sigInput).digest('hex');

  await supabaseAdmin.from('payment_orders').insert({
    user_id: user.id, provider: 'payfast', provider_order_id: mPaymentId,
    product_type: type, amount: parseFloat(amount), currency: 'ZAR', status: 'pending',
  });

  const isProd = process.env.NODE_ENV === 'production';
  res.json({
    action: isProd ? 'https://www.payfast.co.za/eng/process' : 'https://sandbox.payfast.co.za/eng/process',
    fields: { ...fields, signature },
  });
});

/**
 * POST /api/payments/payfast/itn
 * PayFast calls this server-side to confirm payment.
 */
router.post('/payfast/itn', express.urlencoded({ extended: true }), async (req, res) => {
  const data = req.body;

  // Verify with PayFast server
  try {
    const sigFields = Object.entries(data)
      .filter(([k]) => k !== 'signature')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
      .join('&');
    const passphrase = process.env.PAYFAST_PASSPHRASE || '';
    const sigInput   = passphrase ? `${sigFields}&passphrase=${encodeURIComponent(passphrase)}` : sigFields;
    const expected   = crypto.createHash('md5').update(sigInput).digest('hex');
    if (expected !== data.signature) {
      console.warn('PayFast ITN: bad signature');
      return res.status(200).send('invalid'); // always 200 to PayFast
    }
  } catch { return res.status(200).send('error'); }

  if (data.payment_status === 'COMPLETE') {
    const userId  = data.custom_str1;
    const type    = data.custom_str2;
    const ref     = data.custom_str3;

    await supabaseAdmin.from('payment_orders')
      .update({ status: 'paid' }).eq('provider_order_id', data.m_payment_id);

    if (type === 'soul_pass') {
      const expiresAt = new Date(Date.now() + (ref === 'yearly' ? 365 : 30) * 86400000).toISOString();
      await supabaseAdmin.rpc('activate_subscription', {
        p_user_id: userId, p_plan: 'soul_pass', p_provider: 'payfast',
        p_provider_sub_id: data.m_payment_id, p_amount: parseFloat(data.amount_gross),
        p_expires_at: expiresAt,
      });
    } else if (type === 'soul_tokens') {
      const { data: pkg } = await supabaseAdmin.from('soul_token_packages').select('amount').eq('id', ref).single();
      if (pkg?.amount) {
        await supabaseAdmin.rpc('grant_soul_tokens', {
          p_user_id: userId, p_amount: pkg.amount, p_reason: 'PayFast token purchase',
        });
      }
    }
  }

  res.status(200).send('OK');
});

// ── REVENUECAT WEBHOOK (mobile IAP) ──────────────────────────────────────────
/**
 * POST /api/payments/revenuecat/webhook
 * RevenueCat handles Apple IAP + Google Play receipt validation.
 * This receives the "source of truth" events from RevenueCat.
 */
router.post('/revenuecat/webhook', express.json(), async (req, res) => {
  // Verify shared secret with constant-time comparison to prevent timing attacks
  const authHeader = req.headers.authorization || '';
  const secret     = process.env.REVENUECAT_WEBHOOK_SECRET || '';
  if (!secret) {
    console.error('[revenuecat] REVENUECAT_WEBHOOK_SECRET is not set — rejecting all webhook requests');
    return res.status(503).send('Webhook auth not configured');
  }
  const a = Buffer.from(authHeader.padEnd(secret.length));
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).send('Unauthorized');
  }

  const { event } = req.body;
  if (!event) return res.status(400).json({ error: 'No event' });

  const userId = event.app_user_id; // RevenueCat app_user_id should be set to Supabase UID
  if (!userId) return res.json({ received: true });

  try {
    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION': {
        const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;
        await supabaseAdmin.rpc('activate_subscription', {
          p_user_id: userId, p_plan: 'soul_pass',
          p_provider: event.store === 'APP_STORE' ? 'apple' : 'google',
          p_provider_sub_id: event.original_transaction_id,
          p_expires_at: expiresAt,
        });
        break;
      }

      case 'NON_RENEWING_PURCHASE': {
        // One-time token purchase via mobile IAP
        const tokens = parseInt(event.product_id?.match(/(\d+)_soul/)?.[1] || 0);
        if (tokens > 0) {
          await supabaseAdmin.rpc('grant_soul_tokens', {
            p_user_id: userId, p_amount: tokens,
            p_reason: `${event.store} token purchase: ${event.product_id}`,
          });
          await supabaseAdmin.from('payment_orders').insert({
            user_id: userId, provider: event.store === 'APP_STORE' ? 'apple' : 'google',
            provider_order_id: event.id, product_type: 'soul_tokens',
            product_id: event.product_id, tokens_granted: tokens, status: 'paid',
          });
        }
        break;
      }

      case 'CANCELLATION':
      case 'EXPIRATION':
      case 'SUBSCRIPTION_PAUSED': {
        await supabaseAdmin.from('subscriptions')
          .update({ status: event.type === 'EXPIRATION' ? 'expired' : 'cancelled' })
          .eq('user_id', userId);
        await supabaseAdmin.from('profiles')
          .update({ subscription_status: event.type === 'EXPIRATION' ? 'expired' : 'cancelled' })
          .eq('id', userId);
        break;
      }
    }
  } catch (e) {
    console.error('RevenueCat webhook error:', e.message);
  }

  res.json({ received: true });
});

module.exports = router;
