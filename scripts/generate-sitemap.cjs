/**
 * Node script to generate sitemap.xml from Angular route meta.
 * Usage:
 *   node scripts/generate-sitemap.cjs --domain=https://YOUR_DOMAIN --out=sitemap.xml
 */
const fs = require('fs');
const path = require('path');

const args = Object.fromEntries(process.argv.slice(2).map(kv => kv.split('=')));
const domain = args['--domain'] || 'https://blackbegoniaflorals.com';
const out = args['--out'] || 'sitemap.xml';

// Minimal, adjust to import your actual app routes if available.
const ROUTES = [
  '', 'portfolio', 'services', 'inquiries', 'about', 'testimonials', 'workshops', 'privacy-policy', 'terms-and-conditions'
];

const today = new Date().toISOString().slice(0,10);
const urls = ROUTES.map(p => `
  <url>
    <loc>${domain}${p ? '/' + p : '/'}</loc>
    <lastmod>${today}</lastmod>
    <priority>${p === '' ? '1.00' : '0.80'}</priority>
  </url>
`).join('');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

fs.writeFileSync(out, xml, 'utf8');
console.log('Wrote', out);
