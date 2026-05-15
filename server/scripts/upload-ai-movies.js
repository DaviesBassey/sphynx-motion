#!/usr/bin/env node
// One-shot script: adds "The Secret Man" and "Drive" series + episodes
// Run: node server/scripts/upload-ai-movies.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function upsertSeries({ title, slug, description, genre, language, is_featured, is_trending, poster_url }) {
  const { data: existing } = await supabase.from('series').select('id').eq('slug', slug).maybeSingle();
  if (existing) { console.log(`Series already exists: ${title} (${existing.id})`); return existing.id; }

  const { data, error } = await supabase.from('series').insert({
    title, slug, description, genre,
    language: language || 'en',
    is_featured: !!is_featured,
    is_trending: !!is_trending,
    status: 'live',
    poster_url: poster_url || null,
  }).select('id').single();

  if (error) { console.error(`Error creating series "${title}":`, error.message); process.exit(1); }
  console.log(`Created series: ${title} (${data.id})`);
  return data.id;
}

async function upsertEpisode({ series_id, episode_number, title, description, video_url, duration, is_free }) {
  const { data: existing } = await supabase
    .from('episodes').select('id').eq('series_id', series_id).eq('episode_number', episode_number).maybeSingle();
  if (existing) { console.log(`  Episode ${episode_number} already exists (${existing.id})`); return; }

  const { data, error } = await supabase.from('episodes').insert({
    series_id, episode_number, title, description,
    video_url, duration: duration || 0,
    is_free: is_free !== false,
    status: 'live',
  }).select('id').single();

  if (error) { console.error(`  Error creating episode "${title}":`, error.message); process.exit(1); }
  console.log(`  Episode ${episode_number}: ${title} (${data.id})`);
}

async function run() {
  console.log('Uploading AI Movies to SphynxPlay...\n');

  // ── Series 1: The Secret Man ────────────────────────────────────────────────
  const secretManId = await upsertSeries({
    title:       'The Secret Man',
    slug:        'the-secret-man',
    description: 'A gripping AI-generated thriller following a mysterious figure whose identity unravels across three explosive episodes.',
    genre:       'Thriller',
    language:    'en',
    is_featured: true,
    is_trending: true,
    poster_url:  '/assets/posters/image-12.jpg',
  });

  await upsertEpisode({
    series_id:      secretManId,
    episode_number: 1,
    title:          'The Secret Man',
    description:    'A shadowy figure emerges from the darkness — nothing is what it seems.',
    video_url:      '/assets/videos/the-secret-man-e1.mp4',
    duration:       15,
    is_free:        true,
  });

  // ── Series 2: Drive ─────────────────────────────────────────────────────────
  const driveId = await upsertSeries({
    title:       'Drive',
    slug:        'drive',
    description: 'An adrenaline-fuelled AI cinematic series where every road leads somewhere dangerous.',
    genre:       'Action',
    language:    'en',
    is_featured: false,
    is_trending: true,
    poster_url:  '/assets/posters/image-13.jpg',
  });

  await upsertEpisode({
    series_id:      driveId,
    episode_number: 1,
    title:          'Behind the Wheel',
    description:    'When the engine starts, there is no turning back.',
    video_url:      '/assets/videos/car-e1.mp4',
    duration:       19,
    is_free:        true,
  });

  console.log('\nDone! Both series are live on SphynxPlay.');
}

run().catch(err => { console.error(err); process.exit(1); });
