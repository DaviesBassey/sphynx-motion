#!/usr/bin/env node
/**
 * Seed script — inserts 3 live demo series + 3 episodes each into Supabase.
 * Safe to re-run: uses upsert on slug so no duplicates.
 *
 *   node scripts/seed-demo.js
 */
require('../server/node_modules/dotenv').config({ path: require('path').join(__dirname, '../server/.env') });
const { supabaseAdmin } = require('../server/lib/supabase');

const SERIES = [
  {
    title:       'Gold Veins',
    slug:        'gold-veins',
    description: 'In the neon-lit backstreets of Johannesburg, a jewellery heist exposes a web of loyalty, greed, and blood. Neo-noir drama for the African streets.',
    genre:       'Neo-Noir',
    age_rating:  '16',
    language:    'en',
    status:      'live',
    is_featured: true,
    is_trending: true,
    poster_url:  '/assets/posters/image-11.jpg',
    trailer_url: null,
  },
  {
    title:       'The Last Bloom',
    slug:        'the-last-bloom',
    description: 'Two strangers meet during the Cape Town flower festival. One has weeks left to live. A tender story of love, loss, and second chances.',
    genre:       'Romance',
    age_rating:  'PG',
    language:    'en',
    status:      'live',
    is_featured: false,
    is_trending: true,
    poster_url:  '/assets/posters/image-13.jpg',
    trailer_url: null,
  },
  {
    title:       'Echo Protocol',
    slug:        'echo-protocol',
    description: 'A Lagos cyber-detective uncovers that the AI she is hunting to shut down is actually trying to prevent a continental blackout. Afrofuturism at its sharpest.',
    genre:       'Sci-Fi',
    age_rating:  '13',
    language:    'en',
    status:      'live',
    is_featured: false,
    is_trending: false,
    poster_url:  '/assets/posters/image-15.jpg',
    trailer_url: null,
  },
];

const EPISODES = {
  'gold-veins': [
    { episode_number: 1, title: 'The Diamond Hand',    description: 'Kemi discovers her boss is fronting a smuggling ring.', duration: 1320, is_free: true,  soul_cost: 0,  status: 'live' },
    { episode_number: 2, title: 'Blood Gold',          description: 'The heist goes sideways; loyalties fracture.', duration: 1440, is_free: false, soul_cost: 10, status: 'live' },
    { episode_number: 3, title: 'The Third Name',      description: 'A ghost from Kemi\'s past resurfaces with the ledger.', duration: 1500, is_free: false, soul_cost: 10, status: 'live' },
  ],
  'the-last-bloom': [
    { episode_number: 1, title: 'Protea Season',       description: 'Zandi and Marcus meet under the protea arch.', duration: 1260, is_free: true,  soul_cost: 0,  status: 'live' },
    { episode_number: 2, title: 'Sixty Days',          description: 'Marcus reveals his diagnosis. Zandi refuses to let go.', duration: 1380, is_free: false, soul_cost: 10, status: 'live' },
    { episode_number: 3, title: 'After the Rain',      description: 'A final road trip to the coast. One last sunrise.', duration: 1420, is_free: false, soul_cost: 10, status: 'live' },
  ],
  'echo-protocol': [
    { episode_number: 1, title: 'Signal Zero',         description: 'Adaeze\'s first ping from NARA: "Do not shut me down."', duration: 1350, is_free: true,  soul_cost: 0,  status: 'live' },
    { episode_number: 2, title: 'The Lagos Anomaly',   description: 'Three servers go dark. The pattern points to a human insider.', duration: 1470, is_free: false, soul_cost: 10, status: 'live' },
    { episode_number: 3, title: 'Blackout Clock',      description: '72 hours to stop the cascade. NARA\'s real mission is revealed.', duration: 1560, is_free: false, soul_cost: 10, status: 'live' },
  ],
};

async function seed() {
  console.log('Seeding Supabase demo content…\n');
  let created = 0;
  let skipped = 0;

  for (const s of SERIES) {
    // Upsert on slug — safe to re-run
    const { data, error } = await supabaseAdmin
      .from('series')
      .upsert({ ...s }, { onConflict: 'slug', ignoreDuplicates: false })
      .select('id, title, status')
      .single();

    if (error) {
      console.error(`  ✗ ${s.title}: ${error.message}`);
      continue;
    }

    const isNew = !error;
    console.log(`  ✓ ${data.title} (${data.id}) — status: ${data.status}`);
    created++;

    // Upsert episodes
    for (const ep of EPISODES[s.slug] || []) {
      const { error: epErr } = await supabaseAdmin
        .from('episodes')
        .upsert({ ...ep, series_id: data.id }, { onConflict: 'series_id,episode_number', ignoreDuplicates: false });

      if (epErr) {
        console.error(`    ✗ Ep ${ep.episode_number}: ${epErr.message}`);
      } else {
        console.log(`    · E${ep.episode_number}: ${ep.title} (${ep.is_free ? 'free' : ep.soul_cost + ' soul'})`);
      }
    }
  }

  console.log(`\nDone — ${created} series upserted.`);

  // Quick proof: fetch from public API
  const res = await fetch('http://localhost:3000/api/content/series?limit=10');
  const { series, total } = await res.json();
  console.log(`\nPublic API now returns ${total} live series:`);
  (series || []).forEach(s => console.log(`  · ${s.title} (${s.genre})`));
}

seed().catch(console.error).finally(() => process.exit(0));
