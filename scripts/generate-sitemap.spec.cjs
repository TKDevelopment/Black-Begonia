const assert = require('node:assert/strict');
const {
  createSitemap,
  deduplicateRoutes,
  getWorkshopRoutes,
  workshopRoutesFromRows,
} = require('./generate-sitemap.cjs');

const today = '2026-07-30';
const rows = [
  { slug: 'open-event', lifecycleStatus: 'series', seoStatus: 'index', lastmod: '2026-07-28T14:00:00Z' },
  { slug: 'open-event/2026-08-15', lifecycleStatus: 'published_open', seoStatus: 'index', lastmod: '2026-07-28T14:00:00Z' },
  { slug: 'past-event/2026-06-10', lifecycleStatus: 'completed', seoStatus: 'index', lastmod: '2026-06-10T12:00:00Z' },
  { slug: 'cancelled-event/2026-05-01', lifecycleStatus: 'cancelled', seoStatus: 'noindex', lastmod: '2026-05-01T12:00:00Z' },
  { slug: 'expired-event', lifecycleStatus: 'cancelled', seoStatus: 'redirect', lastmod: '2025-01-01T12:00:00Z' },
  { slug: 'draft-event', lifecycleStatus: 'draft', seoStatus: 'index', lastmod: '2026-07-01T12:00:00Z' },
  { slug: 'status?token=secret', lifecycleStatus: 'published_open', seoStatus: 'index', lastmod: '2026-07-01T12:00:00Z' },
];
const workshopRoutes = workshopRoutesFromRows(rows, today);
assert.deepEqual(workshopRoutes.map((route) => route.url), [
  '/workshops/open-event',
  '/workshops/open-event/2026-08-15',
  '/workshops/past-event/2026-06-10',
  '/workshops/cancelled-event/2026-05-01',
]);
assert.equal(workshopRoutes[0].lastmod, '2026-07-28');
assert.equal(
  workshopRoutes.find((route) => route.url === '/workshops/past-event/2026-06-10').priority,
  '0.65',
);

const deduped = deduplicateRoutes([
  ...workshopRoutes,
  { url: '/workshops/open-event', priority: '0.76', lastmod: '2026-07-29' },
]);
assert.equal(deduped.filter((route) => route.url === '/workshops/open-event').length, 1);
assert.equal(deduped.find((route) => route.url === '/workshops/open-event').lastmod, '2026-07-29');
assert.match(createSitemap(deduped), /<lastmod>2026-07-29<\/lastmod>/);

(async () => {
  const requested = [];
  const fetched = await getWorkshopRoutes(
    { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon' },
    async (url) => {
      requested.push(url);
      return { ok: true, json: async () => rows };
    },
    today,
  );
  assert.deepEqual(fetched, workshopRoutes);
  assert.equal(requested[0], 'https://example.supabase.co/rest/v1/rpc/get_public_workshop_sitemap');
  console.log('Workshop sitemap assertions passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
