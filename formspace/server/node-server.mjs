// Node.js HTTP server that hosts the same API contract as the Cloudflare
// Worker build (worker/index.ts): /api/* handled by worker/api.ts, protected
// preview paths always 404, everything else served as static client files.
// Storage is provided by an R2-compatible adapter (FsBucket locally, COS in
// production). Designed to sit behind Nginx with TLS termination: the public
// origin is recovered from X-Forwarded-Proto, trusted only on loopback.
import http from 'node:http';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fsp, createReadStream } from 'node:fs';
import { handleApi } from '../worker/api.ts';
import { isProtectedPreviewPath } from '../worker/protected-assets.ts';
import { DERIVED_PREVIEWS } from '../data/derived-previews.ts';
import { FsBucket } from './r2-fs-bucket.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');

const PORT = Number(process.env.FORMSPACE_PORT || 8788);
const DATA_DIR = process.env.FORMSPACE_DATA_DIR || path.join(appRoot, '.server-data');
const STATIC_DIR = process.env.FORMSPACE_STATIC_DIR
  ? path.resolve(process.env.FORMSPACE_STATIC_DIR)
  : path.join(appRoot, 'dist', 'client');
const DERIVED_GLB = process.env.FORMSPACE_DERIVED_GLB || path.join(appRoot, 'data', 'models', 'arc01-mouse.glb');

const MIME = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', txt: 'text/plain; charset=utf-8',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif',
  svg: 'image/svg+xml', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2',
  glb: 'model/gltf-binary', gltf: 'model/gltf+json', wasm: 'application/wasm', xml: 'application/xml', webmanifest: 'application/manifest+json',
};

const works = JSON.parse(await fsp.readFile(path.join(appRoot, 'data', 'works.json'), 'utf8'));

// Storage selection: COS when FORMSPACE_COS_* is configured, local FS otherwise.
let bucket;
if (process.env.FORMSPACE_COS_BUCKET) {
  const { CosBucket } = await import('./r2-cos-bucket.mjs');
  bucket = CosBucket.fromEnv(process.env);
  console.log(`formspace storage: COS bucket ${process.env.FORMSPACE_COS_BUCKET} (region ${process.env.FORMSPACE_COS_REGION})`);
} else {
  bucket = new FsBucket(DATA_DIR);
}
await bucket.init();

let derivedBytes;
async function readDerivedModel(url) {
  if (!DERIVED_PREVIEWS[0] || url !== DERIVED_PREVIEWS[0].modelUrl) return null;
  if (!derivedBytes) {
    try { derivedBytes = new Uint8Array(await fsp.readFile(DERIVED_GLB)); } catch { return null; }
  }
  return derivedBytes;
}

const env = { BUCKET: bucket, readDerivedModel };

function requestUrl(req) {
  const forwarded = req.headers['x-forwarded-proto'];
  const local = req.socket.remoteAddress === '127.0.0.1' || req.socket.remoteAddress === '::1' || req.socket.remoteAddress === '::ffff:127.0.0.1';
  const protocol = req.socket.encrypted ? 'https:' : (local && forwarded === 'https' ? 'https:' : 'http:');
  const host = req.headers.host || '127.0.0.1:' + PORT;
  return protocol + '//' + host + req.url;
}

async function serveStatic(pathname, res) {
  let relative;
  try {
    relative = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Bad request'); return;
  }
  relative = relative.replace(/\\/g, '/').replace(/^\/+/, '');
  let filePath = path.normalize(path.join(STATIC_DIR, relative));
  if (!filePath.startsWith(STATIC_DIR + path.sep) && filePath !== STATIC_DIR) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Forbidden'); return;
  }
  let stat = await fsp.stat(filePath).catch(() => null);
  if (stat?.isDirectory()) { filePath = path.join(filePath, 'index.html'); stat = await fsp.stat(filePath).catch(() => null); }
  if (!stat) {
    if (!path.extname(relative)) {
      filePath = path.join(STATIC_DIR, 'index.html'); stat = await fsp.stat(filePath).catch(() => null);
    }
    if (!stat) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
  }
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const immutable = relative.startsWith('assets/');
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  let pathname;
  try { pathname = new URL(requestUrl(req)).pathname; } catch {
    res.writeHead(400); res.end(); return;
  }
  if (isProtectedPreviewPath(pathname)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store' });
    res.end('Not found'); return;
  }
  if (!pathname.startsWith('/api/')) {
    try { await serveStatic(pathname, res); } catch {
      if (!res.headersSent) res.writeHead(500); res.end('Server error');
    }
    return;
  }
  try {
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const init = { method: req.method, headers: req.headers };
    if (hasBody) { init.body = Readable.toWeb(req); init.duplex = 'half'; }
    const response = await handleApi(new Request(requestUrl(req), init), env, works);
    const headers = {};
    for (const [name, value] of response.headers) if (name.toLowerCase() !== 'set-cookie') headers[name] = value;
    const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    if (cookies.length) headers['Set-Cookie'] = cookies;
    res.writeHead(response.status, headers);
    if (req.method === 'HEAD' || !response.body) { res.end(); return; }
    Readable.fromWeb(response.body).pipe(res).on('error', () => res.destroy());
  } catch (error) {
    console.error('api handler error:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' });
      res.end(JSON.stringify({ error: '服务暂时不可用，请稍后重试。' }));
    } else res.destroy();
  }
});

server.listen(PORT, process.env.FORMSPACE_HOST || '127.0.0.1', () => {
  console.log(`formspace node server listening on http://127.0.0.1:${PORT} (data: ${DATA_DIR}, static: ${STATIC_DIR})`);
});
