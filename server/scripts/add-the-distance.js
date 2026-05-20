#!/usr/bin/env node
// One-shot script: adds "The Distance" series + 4 episodes to SphynxPlay
// Run: node server/scripts/add-the-distance.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function upsertSeries(fields) {
  const { data: existing } = await supabase
    .from('series').select('id').eq('slug', fields.slug).maybeSingle();
  if (existing) {
    console.log(`Series already exists: ${fields.title} (${existing.id})`);
    // Update to ensure featured flag is set
    await supabase.from('series').update({
      is_featured: fields.is_featured,
      is_trending: fields.is_trending,
      status: 'live',
    }).eq('id', existing.id);
    return existing.id;
  }

  const { data, error } = await supabase.from('series').insert({
    title:       fields.title,
    slug:        fields.slug,
    description: fields.description,
    genre:       fields.genre,
    age_rating:  fields.age_rating || 'PG-13',
    language:    fields.language || 'en',
    is_featured: !!fields.is_featured,
    is_trending: !!fields.is_trending,
    status:      'live',
    poster_url:  fields.poster_url || null,
    trailer_url: fields.trailer_url || null,
  }).select('id').single();

  if (error) { console.error(`Error creating series:`, error.message); process.exit(1); }
  console.log(`Created series: ${fields.title} (${data.id})`);
  return data.id;
}

async function upsertEpisode(fields) {
  const { data: existing } = await supabase
    .from('episodes').select('id')
    .eq('series_id', fields.series_id)
    .eq('episode_number', fields.episode_number)
    .maybeSingle();
  if (existing) {
    console.log(`  EP${fields.episode_number} already exists (${existing.id})`);
    return;
  }

  const { data, error } = await supabase.from('episodes').insert({
    series_id:      fields.series_id,
    episode_number: fields.episode_number,
    season_number:  1,
    title:          fields.title,
    description:    fields.description,
    video_url:      fields.video_url,
    duration:       fields.duration || 0,
    is_free:        fields.is_free !== false,
    soul_cost:      fields.soul_cost || 0,
    status:         'live',
  }).select('id').single();

  if (error) { console.error(`  Error creating EP${fields.episode_number}:`, error.message); process.exit(1); }
  console.log(`  EP${fields.episode_number}: ${fields.title} (${data.id})`);
}

async function run() {
  console.log('Adding "The Distance" to SphynxPlay...\n');

  const seriesId = await upsertSeries({
    title:       'The Distance',
    slug:        'the-distance',
    description: 'A gripping African drama series following lives torn apart by secrets, sacrifice, and the impossible distances between love and duty.',
    genre:       'Drama',
    age_rating:  'PG-13',
    language:    'en',
    is_featured: true,
    is_trending: true,
    poster_url:  '/assets/posters/the-distance-poster.jpg',
  });

  await upsertEpisode({
    series_id:      seriesId,
    episode_number: 1,
    title:          'Departure',
    description:    'When a long-held secret surfaces, everything Amara thought she knew about her family begins to unravel.',
    video_url:      '/assets/videos/the-distance-e1.mp4',
    duration:       36,
    is_free:        true,
    soul_cost:      0,
  });

  await upsertEpisode({
    series_id:      seriesId,
    episode_number: 2,
    title:          'Crossroads',
    description:    'Torn between loyalty and truth, Amara makes a decision that will change the lives of everyone she loves.',
    video_url:      '/assets/videos/the-distance-e2.mp4',
    duration:       40,
    is_free:        true,
    soul_cost:      0,
  });

  await upsertEpisode({
    series_id:      seriesId,
    episode_number: 3,
    title:          'The Weight of Silence',
    description:    'Old wounds resurface as two families are forced to confront the truth they buried years ago.',
    video_url:      '/assets/videos/the-distance-e3.mp4',
    duration:       37,
    is_free:        false,
    soul_cost:      50,
  });

  await upsertEpisode({
    series_id:      seriesId,
    episode_number: 4,
    title:          'The Distance',
    description:    'In the shattering season finale, the truth is finally spoken — but at what cost?',
    video_url:      '/assets/videos/the-distance-e4.mov',
    duration:       36,
    is_free:        false,
    soul_cost:      50,
  });

  console.log('\n✓ "The Distance" is now live and featured on SphynxPlay.');
  console.log('  Poster : /assets/posters/the-distance-poster.jpg');
  console.log('  Episodes: 4 (EP1–EP2 free, EP3–EP4 require Soul Tokens)');
}

run().catch(err => { console.error(err); process.exit(1); });
