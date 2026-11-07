// Integration test for the Node.js server target: boots server/node-server.mjs
// with a temporary FsBucket data directory and exercises the same permission,
// version and file semantics that scripts/test-api.mjs covers at unit level.
// Covers: loopback HTTP session cookie, X-Forwarded-Proto HTTPS mode, upload,
// private/public file authorization, Range requests, publication, browser
// isolation, protected preview path and static file serving.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dataDir = await mkdtemp(path.join(tmpdir(), 'formspace-node-test-'));
const port = 20000 + Math.floor(Math.random() * 20000);
const child = spawn(process.execPath, [path.resolve(import.meta.dirname, '../server/node-server.mjs')], {
  env: { ...process.env, FORMSPACE_PORT: String(port), FORMSPACE_DATA_DIR: dataDir },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
child.stdout.on('data', (chunk) => { serverLog += chunk; });
child.stderr.on('data', (chunk) => { serverLog += chunk; });

const wait = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const base = `http://127.0.0.1:${port}`;
let ready = false;
for (let attempt = 0; attempt < 100 && !ready; attempt++) {
  try { await fetch(base + '/api/me'); ready = true; } catch { await wait(200); }
}
assert.ok(ready, 'node server did not start: ' + serverLog);

let checks = 0;
const ok = (label) => { checks++; console.log('PASS:', label); };

const jar = new Map();
async function call(pathname, init = {}, browser = null) {
  const headers = { ...(init.headers || {}) };
  if (browser && jar.has(browser)) headers.Cookie = jar.get(browser);
  const response = await fetch(base + pathname, { ...init, headers });
  const cookie = response.headers.get('set-cookie');
  if (cookie && browser) jar.set(browser, cookie.split(';')[0]);
  return response;
}

// 1. Loopback HTTP session: development cookie name, no Secure flag.
const session = await call('/api/session', { method: 'POST', headers: { Origin: base } }, 'a');
assert.equal(session.status, 200);
const data = await session.json();
assert.equal(data.created, true);
assert.equal(data.identityMode, 'browser');
const devCookie = jar.get('a');
assert.match(devCookie, /^changxu_workspace=/);
assert.equal(/(?:^|;\s*)Secure(?:;|$)/.test(devCookie), false);
ok('loopback HTTP session issues development cookie without Secure');

// 2. GET /api/me with the cookie returns the same owner; no cookie returns empty.
const me = await call('/api/me', {}, 'a');
assert.equal((await me.json()).user.id, data.user.id);
const anonymous = await call('/api/me');
assert.equal((await anonymous.json()).user, null);
ok('cookie identity works; anonymous /api/me is empty');

// 3. HTTPS via X-Forwarded-Proto (Nginx mode) issues a __Host- Secure cookie.
// Raw http.request is required because fetch forbids overriding the Host header.
const hostCookie = await new Promise((resolve, reject) => {
  const request = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/api/session', headers: { Origin: 'https://portfolio.test', Host: 'portfolio.test', 'X-Forwarded-Proto': 'https' } }, (response) => {
    if (response.statusCode !== 200) return reject(new Error('https-mode session status ' + response.statusCode));
    resolve(response.headers['set-cookie']?.find((value) => value.startsWith('__Host-changxu_workspace=')));
  });
  request.on('error', reject); request.end();
});
assert.ok(hostCookie, 'expected __Host- cookie behind https proxy');
assert.match(hostCookie, /Secure/);
assert.match(hostCookie, /HttpOnly/);
assert.match(hostCookie, /SameSite=Lax/);
ok('Nginx TLS-termination mode issues __Host- Secure HttpOnly cookie');

// 4. Upload a private work with source + preview model + mp4 demo video.
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const mp4 = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115, 111, 109, 0, 1, 2, 3]);
const form = new FormData();
form.set('title', '节点服务器集成夹具');
form.set('direction', '三维');
form.set('description', '集成测试');
form.set('source', new File(['native engineering data'], 'fixture.max'));
form.set('previewModel', new File(['glTF-browser-preview'], 'fixture.glb'));
form.set('video', new File([mp4], 'fixture.mp4', { type: 'video/mp4' }));
form.append('images', new File([png], 'fixture.png', { type: 'image/png' }));
const create = await call('/api/works', { method: 'POST', body: form, headers: { Origin: base } }, 'a');
const createdBody = await create.json().catch(() => null);
assert.equal(create.status, 201, JSON.stringify(createdBody));
const { work, versions } = createdBody;
const versionId = versions?.[0]?.id;
assert.ok(versionId, 'created work has a version');
ok('multipart upload creates private work with version');

// 5. Private files are author-only; anonymous reads are rejected.
const fileBase = `/api/files/${work.id}/${versionId}`;
const sourceAuthor = await call(fileBase + '/source.max', {}, 'a');
assert.equal(sourceAuthor.status, 200);
assert.equal(await sourceAuthor.text(), 'native engineering data');
const anonymousSource = await call(fileBase + '/source.max');
assert.equal([403, 404].includes(anonymousSource.status), true);
ok('private files authorized for author only');

// 6. Publication exposes only the chosen version; video Range works anonymously.
const publish = await call(`/api/works/${work.id}/publication`, {
  method: 'PATCH',
  headers: { Origin: base, 'Content-Type': 'application/json' },
  body: JSON.stringify({ revision: work.revision, displayVersionId: versionId, publicVersionIds: [versionId] }),
}, 'a');
assert.equal(publish.status, 200, JSON.stringify(await publish.json().catch(() => null)));
const publicWorks = await (await call('/api/works?scope=public')).json();
assert.equal(publicWorks.works.some((entry) => entry.id === work.id), true);
const videoAnonymous = await call(fileBase + '/video.mp4', { headers: { Range: 'bytes=0-3' } });
assert.equal(videoAnonymous.status, 206);
assert.equal(new Uint8Array(await videoAnonymous.arrayBuffer())[0], 0);
ok('published version is public with anonymous Range/206 media support');

// 7. A second browser cannot see or modify the first browser's work.
const second = await call('/api/session', { method: 'POST', headers: { Origin: base } }, 'b');
assert.equal(second.status, 200);
const mineB = await (await call('/api/works?scope=mine', {}, 'b')).json();
assert.equal(mineB.works.some((entry) => entry.id === work.id), false);
const patchB = await call(`/api/works/${work.id}/publication`, {
  method: 'PATCH',
  headers: { Origin: base, 'Content-Type': 'application/json' },
  body: JSON.stringify({ revision: work.revision, displayVersionId: versionId, publicVersionIds: [] }),
}, 'b');
assert.equal([401, 403, 404].includes(patchB.status), true);
ok('second browser is isolated from the first browser\'s work');

// 8. Protected preview path is always 404 with no-store.
const blocked = await call('/protected-previews/x.glb');
assert.equal(blocked.status, 404);
assert.match(blocked.headers.get('cache-control'), /no-store/);
ok('protected preview path stays hidden behind the server');

// 9. Static client files are served when a production build exists.
const home = await call('/');
if (home.status === 200) {
  const html = await home.text();
  assert.match(html, /<!doctype html/i);
  assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
  ok('static client serving works (dist/client present)');
} else {
  assert.equal(home.status, 404);
  console.log('SKIP: dist/client not built; static serving untested in this run');
}

await child.kill();
await rm(dataDir, { recursive: true, force: true });
console.log(`PASS: ${checks} node-server integration checks — sessions, uploads, file authorization, ranges, isolation, protected paths.`);
process.exit(0);
