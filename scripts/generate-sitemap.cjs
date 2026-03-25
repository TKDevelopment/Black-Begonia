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
  { url: '/terms-and-conditions', priority: '0.30' }
];

const locationRoutes = [
  '/locations/newport-ri-wedding-florist',
  '/locations/watch-hill-ri-wedding-florist',
  '/locations/providence-ri-wedding-florist',
  '/locations/bristol-ri-wedding-florist',
  '/locations/south-kingstown-ri-wedding-florist',
  '/locations/narragansett-ri-wedding-florist',
  '/locations/westerly-ri-wedding-florist',
  '/locations/north-kingstown-ri-florist',
  '/locations/mystic-ct-wedding-florist',
  '/locations/stonington-ct-wedding-florist',
  '/locations/boston-ma-wedding-florist'
].map((url) => ({
  url,
  priority: '0.82'
}));

function toXmlUrl({ url, priority, lastmod }) {
  return `
  <url>
    <loc>${SITE_URL}${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${priority}</priority>
  </url>`;
}

async function getPortfolioRoutes() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('[sitemap] SUPABASE_URL or SUPABASE_ANON_KEY missing; skipping portfolio URLs.');
    return [];
  }

  try {
    const endpoint =
      `${supabaseUrl}/rest/v1/portfolio_galleries?select=slug,updated_at,is_active&is_active=eq.true`;

    const response = await fetch(endpoint, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`
      }
    });

    if (!response.ok) {
      console.warn('[sitemap] Failed to fetch portfolio galleries:', response.status);
      return [];
    }

    const rows = await response.json();

    return rows
      .filter((row) => !!row.slug)
      .map((row) => ({
        url: `/portfolio/${row.slug}`,
        priority: '0.78',
        lastmod: row.updated_at
          ? new Date(row.updated_at).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]
      }));
  } catch (error) {
    console.warn('[sitemap] Error fetching portfolio routes:', error);
    return [];
  }
}

async function buildSitemap() {
  const today = new Date().toISOString().split('T')[0];
  const portfolioRoutes = await getPortfolioRoutes();

  const allRoutes = [
    ...staticRoutes.map((route) => ({ ...route, lastmod: today })),
    ...locationRoutes.map((route) => ({ ...route, lastmod: today })),
    ...portfolioRoutes
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${allRoutes
    .map(toXmlUrl)
    .join('')}
</urlset>`;

  const outputPath = path.join(process.cwd(), 'src', 'sitemap.xml');
  fs.writeFileSync(outputPath, xml, 'utf8');

  console.log(`[sitemap] Generated sitemap with ${allRoutes.length} URLs at ${outputPath}`);
}

buildSitemap();