// Integration smoke tests — require the server to be running on PORT (default 3000).
// Run with: node --test test/api.test.js
// Or via:   npm test (from project root)

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const BASE = `http://localhost:${process.env.PORT || 3000}`;

async function get(path) {
  const res = await fetch(BASE + path);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// ── Health ────────────────────────────────────────────────────────────────────

describe('Health endpoints', () => {
  it('GET /api/health returns ok:true', async () => {
    const { status, body } = await get('/api/health');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.ok, true);
  });

  it('GET /api/admin/health reports Supabase connected', async () => {
    const { status, body } = await get('/api/admin/health');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.supabase, true);
    assert.strictEqual(body.migrations, true);
  });
});

// ── Public content API ────────────────────────────────────────────────────────

describe('Content API', () => {
  it('GET /api/content/series returns a series array', async () => {
    const { status, body } = await get('/api/content/series');
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body.series), 'body.series should be an array');
  });

  it('series items have required fields', async () => {
    const { body } = await get('/api/content/series');
    const REQUIRED = ['id', 'title', 'slug'];
    for (const s of body.series) {
      for (const field of REQUIRED) {
        assert.ok(s[field] != null, `series "${s.title}" missing field: ${field}`);
      }
    }
  });
});

// ── Auth protection ───────────────────────────────────────────────────────────

describe('Auth protection', () => {
  it('GET /api/admin/users returns 401 without a token', async () => {
    const { status } = await get('/api/admin/users');
    assert.strictEqual(status, 401);
  });

  it('GET /api/admin/content returns 401 without a token', async () => {
    const { status } = await get('/api/admin/content');
    assert.strictEqual(status, 401);
  });
});

// ── Static assets ─────────────────────────────────────────────────────────────

describe('Static asset serving', () => {
  it('sw.js is served with no-cache headers', async () => {
    const res = await fetch(`${BASE}/sw.js`);
    assert.strictEqual(res.status, 200);
    const cc = res.headers.get('cache-control') || '';
    assert.ok(cc.includes('no-cache') || cc.includes('no-store'),
      `sw.js cache-control should be no-cache, got: ${cc}`);
  });

  it('video endpoint supports Range requests (206)', async () => {
    const res = await fetch(`${BASE}/assets/videos/the-secret-man-e1.mp4`, {
      headers: { Range: 'bytes=0-1023' },
    });
    assert.strictEqual(res.status, 206, 'video should return 206 Partial Content');
  });
});
