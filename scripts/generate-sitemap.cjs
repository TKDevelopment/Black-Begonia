/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://blackbegoniaflorals.com';
const staticRoutes = [
  { url: '/', priority: '1.00' },
  { url: '/about', priority: '0.90' },
  { url: '/portfolio', priority: '0.90' },
  { url: '/services/weddings', priority: '0.85' },
  { url: '/services/general', priority: '0.85' },
  { url: '/testimonials', priority: '0.80' },
  { url: '/workshops', priority: '0.80' },
  { url: '/inquiries', priority: '0.85' },
  { url: '/inquiries/weddings', priority: '0.80' },
  { url: '/inquiries/general', priority: '0.80' },
  { url: '/locations', priority: '0.86' },
  { url: '/privacy-policy', priority: '0.30' },
  { url: '/terms-and-conditions', priority: '0.30' },
];
const locationRoutes = [
  'newport-ri-wedding-florist', 'watch-hill-ri-wedding-florist',
  'providence-ri-wedding-florist', 'bristol-ri-wedding-florist',
  'south-kingstown-ri-wedding-florist', 'narragansett-ri-wedding-florist',
  'westerly-ri-wedding-florist', 'north-kingstown-ri-florist',
  'mystic-ct-wedding-florist', 'stonington-ct-wedding-florist',
  'boston-ma-wedding-florist',
].map((slug) => ({ url: `/locations/${slug}`, priority: '0.82' }));

function dateOnly(value, fallback) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10);
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function toXmlUrl({ url, priority, lastmod }) {
  return `
  <url>
    <loc>${xmlEscape(`${SITE_URL}${url}`)}</loc>
    <lastmod>${xmlEscape(lastmod)}</lastmod>
    <priority>${priority}</priority>
  </url>`;
}

async function fetchSupabaseRows(endpoint, env, fetchImpl) {
  const response = await fetchImpl(endpoint, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
  });
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
  return response.json();
}

async function getPortfolioRoutes(env = process.env, fetchImpl = fetch, today = new Date().toISOString().slice(0, 10)) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return [];
  try {
    const endpoint = `${env.SUPABASE_URL}/rest/v1/portfolio_galleries?select=slug,updated_at,is_active&is_active=eq.true`;
    const rows = await fetchSupabaseRows(endpoint, env, fetchImpl);
    return rows.filter((row) => row.slug).map((row) => ({
      url: `/portfolio/${row.slug}`,
      priority: '0.78',
      lastmod: dateOnly(row.updated_at, today),
    }));
  } catch (error) {
    console.warn('[sitemap] Failed to fetch portfolio galleries:', error.message);
    return [];
  }
}

function workshopRoutesFromRows(rows, today) {
  const allowed = new Set(['series', 'published_open', 'registration_closed', 'completed', 'cancelled', 'rescheduled']);
  return rows
    .filter((row) => row.slug
      && (!row.lifecycleStatus || allowed.has(row.lifecycleStatus))
      && row.seoStatus !== 'redirect'
      && /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/\d{4}-\d{2}-\d{2})?$/.test(row.slug))
    .map((row) => ({
      url: `/workshops/${row.slug}`,
      priority: row.lifecycleStatus === 'completed' ? '0.65' : '0.76',
      lastmod: dateOnly(row.lastmod, today),
    }));
}

async function getWorkshopRoutes(env = process.env, fetchImpl = fetch, today = new Date().toISOString().slice(0, 10)) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return [];
  try {
    const endpoint = `${env.SUPABASE_URL}/rest/v1/rpc/get_public_workshop_sitemap`;
    const rows = await fetchSupabaseRows(endpoint, env, fetchImpl);
    return workshopRoutesFromRows(rows, today);
  } catch (error) {
    console.warn('[sitemap] Failed to fetch workshop URLs:', error.message);
    return [];
  }
}

function deduplicateRoutes(routes) {
  const byUrl = new Map();
  for (const route of routes) {
    const existing = byUrl.get(route.url);
    if (!existing || route.lastmod > existing.lastmod) byUrl.set(route.url, route);
  }
  return [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url));
}

function createSitemap(routes) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(toXmlUrl).join('')}
</urlset>`;
}

async function buildSitemap(options = {}) {
  const now = options.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const [portfolioRoutes, workshopRoutes] = await Promise.all([
    getPortfolioRoutes(env, fetchImpl, today),
    getWorkshopRoutes(env, fetchImpl, today),
  ]);
  const routes = deduplicateRoutes([
    ...staticRoutes.map((route) => ({ ...route, lastmod: today })),
    ...locationRoutes.map((route) => ({ ...route, lastmod: today })),
    ...portfolioRoutes,
    ...workshopRoutes,
  ]);
  const outputPath = options.outputPath ?? path.join(process.cwd(), 'src', 'sitemap.xml');
  fs.writeFileSync(outputPath, createSitemap(routes), 'utf8');
  console.log(`[sitemap] Generated sitemap with ${routes.length} URLs at ${outputPath}`);
  return { routes, outputPath };
}

module.exports = {
  buildSitemap,
  createSitemap,
  deduplicateRoutes,
  getWorkshopRoutes,
  workshopRoutesFromRows,
};

if (require.main === module) {
  buildSitemap().catch((error) => {
    console.error('[sitemap] Generation failed:', error);
    process.exitCode = 1;
  });
}
