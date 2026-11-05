import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Emits robots.txt and sitemap.xml at build time so they always carry the
 * same origin as the metadata in index.html. Keeping them generated rather
 * than checked in means there is one place to change the domain —
 * VITE_SITE_URL — instead of three files that quietly drift apart.
 */
function siteFiles(siteUrl) {
  return {
    name: 'cosmos-site-files',
    apply: 'build',
    // A placeholder of our own rather than Vite's %VITE_*% syntax, which
    // only resolves when the variable is literally set and warns otherwise.
    // This way the resolved origin always wins, whatever supplied it.
    transformIndexHtml(html) {
      return html.replaceAll('__SITE_URL__', siteUrl)
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: ['User-agent: *', 'Allow: /', '', `Sitemap: ${siteUrl}/sitemap.xml`, ''].join('\n'),
      })
      // One page, one entry: COSMOS keeps all of its state in memory and has
      // no routes of its own to list.
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          '  <url>',
          `    <loc>${siteUrl}/</loc>`,
          `    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>`,
          '    <changefreq>monthly</changefreq>',
          '    <priority>1.0</priority>',
          '  </url>',
          '</urlset>',
          '',
        ].join('\n'),
      })
    },
  }
}

/**
 * The public origin, from the first of: an explicit VITE_SITE_URL, the
 * production domain Vercel exposes to its builds, or localhost. There is
 * deliberately no made-up production default: metadata pointing at a domain
 * nobody here controls is worse than metadata that is obviously local, and
 * the warning makes sure that case cannot ship unnoticed.
 */
function resolveSiteUrl(explicit) {
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const origin = explicit || (vercelDomain && `https://${vercelDomain}`)
  if (origin) return origin.replace(/\/+$/, '')
  if (process.argv.includes('build')) {
    console.warn('[cosmos] VITE_SITE_URL is not set: canonical, Open Graph and sitemap URLs will use localhost.')
  }
  return 'http://localhost:4173'
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Only VITE_-prefixed values are read, and the single one used here is a
  // public URL. Nothing secret reaches the bundle.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const siteUrl = resolveSiteUrl(env.VITE_SITE_URL)

  return {
    plugins: [react(), tailwindcss(), siteFiles(siteUrl)],
    build: {
      // Three.js is large by nature; the bundler already splits it into its own
      // chunk, so raise the advisory limit rather than fighting it.
      chunkSizeWarningLimit: 1200,
      rolldownOptions: {
        output: {
          // Libraries that change only when their version changes are kept
          // apart from application code, so shipping a change to COSMOS does
          // not make returning visitors re-download React, Motion, GSAP or,
          // above all, the 238 kB of Three.js.
          codeSplitting: {
            groups: [
              { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: 'vendor-motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/ },
              { name: 'vendor-gsap', test: /node_modules[\\/]gsap[\\/]/ },
              { name: 'vendor-three', test: /node_modules[\\/](three|three-stdlib|@react-three|its-fine|suspend-react|zustand|use-sync-external-store)[\\/]/ },
            ],
          },
        },
      },
    },
  }
})
