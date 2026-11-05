import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
}

/**
 * Serves dist/ the way Vercel will: the SPA rewrite plus the headers from
 * vercel.json, so a content security policy violation fails a test here
 * rather than a deployment. Two entries only make sense over HTTPS and are
 * left out on localhost: HSTS and upgrade-insecure-requests.
 */
export function serveDist(root, config) {
  const headers = config.headers
    .find((entry) => entry.source === '/(.*)')
    .headers.filter((header) => header.key !== 'Strict-Transport-Security')
    .map(({ key, value }) => [key, value.replace('; upgrade-insecure-requests', '')])

  const server = http.createServer((request, response) => {
    const url = decodeURIComponent(request.url.split('?')[0])
    let file = path.join(root, url)
    const exists = file.startsWith(root) && fs.existsSync(file) && fs.statSync(file).isFile()
    if (!exists) {
      if (url.startsWith('/assets/')) {
        response.writeHead(404).end()
        return
      }
      file = path.join(root, 'index.html')
    }
    for (const [key, value] of headers) response.setHeader(key, value)
    response.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream')
    fs.createReadStream(file).pipe(response)
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })
    })
  })
}
