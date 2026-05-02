#!/usr/bin/env node
// Run AFTER migrations: node server/scripts/setup-superadmin.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const EMAIL    = process.env.ADMIN_EMAIL    || (() => { console.error('Set ADMIN_EMAIL env var'); process.exit(1); })();
const PASSWORD = process.env.ADMIN_PASSWORD || (() => { console.error('Set ADMIN_PASSWORD env var'); process.exit(1); })();

async function run() {
  console.log('Setting up superadmin user...\n');

  // 1. Create auth user (or get existing)
  let userId;
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });

  if (createErr) {
    if (createErr.message.includes('already been registered') || createErr.code === 'email_exists') {
      console.log(`User ${EMAIL} already exists — fetching...`);
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = (list?.users || []).find(u => u.email === EMAIL);
      if (!existing) { console.error('Could not find existing user.'); process.exit(1); }
      userId = existing.id;
      console.log(`Found user: ${userId}`);
    } else {
      console.error('Create user error:', createErr.message);
      process.exit(1);
    }
  } else {
    userId = created.user.id;
    console.log(`Created user: ${userId}`);
  }

  // 2. Upsert profile with superadmin role
  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email: EMAIL,
      display_name: 'Davies (Superadmin)',
      role: 'superadmin',
    }, { onConflict: 'id' });

  if (profileErr) {
    console.error('Profile upsert error:', profileErr.message);
    process.exit(1);
  }

  console.log(`\nSuperadmin profile set for ${EMAIL}`);
  console.log(`\nLogin credentials:`);
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`\nDone!`);
}

run();
