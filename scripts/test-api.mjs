import assert from 'node:assert/strict';
import { handleApi } from '../worker/api.ts';

class MemoryBucket {
  data = new Map();
  failRecords = false;
  async put(key, value, options = {}) {
    if (this.failRecords && key.startsWith('records/')) throw new Error('simulated record failure');
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(await new Response(value).arrayBuffer());
    this.data.set(key, { bytes, ...options });
  }
  async get(key) {
    const saved = this.data.get(key);
    if (!saved) return null;
    return { key, size: saved.bytes.length, httpEtag: '"test-etag"', customMetadata: saved.customMetadata,
      body: new Blob([saved.bytes]).stream(), json: async () => JSON.parse(new TextDecoder().decode(saved.bytes)) };
  }
  async list({ prefix = '', cursor, limit = 100 } = {}) {
    const keys = [...this.data.keys()].filter((key) => key.startsWith(prefix)).sort();
    const start = Number(cursor || 0), end = start + Math.min(limit, 2);
    return { objects: keys.slice(start, end).map((key) => ({ key })), truncated: end < keys.length, cursor: String(end) };
  }
  async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) this.data.delete(key); }
}

const bucket = new MemoryBucket();
const env = { BUCKET: bucket };
const builtins = [{ id: 'lamp', title: '灯具', date: '2026-10-15', builtIn: true }];
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const headers = (id = 'creator-1') => ({ 'oai-authenticated-user-id': id, Origin: 'https://portfolio.test' });
const request = (path, init = {}) => new Request('https://portfolio.test' + path, init);
const call = (path, init) => handleApi(request(path, init), env, builtins);
const form = (source = true) => {
  const data = new FormData();
  data.set('title', '测试作品'); data.set('description', '真实上传流程测试。'); data.set('category', '家具设计'); data.set('tags', '家具，测试');
  if (source) data.set('source', new File(['glTF-test-model'], '模型.glb'));
  data.append('images', new File([png], 'preview.png', { type: 'image/png' }));
  return data;
};

assert.equal((await call('/api/works', { method: 'POST', body: form() })).status, 401, 'anonymous writes rejected');
assert.equal((await call('/api/works', { method: 'POST', headers: { ...headers(), Origin: 'https://evil.test' }, body: form() })).status, 403, 'cross-origin writes rejected');
assert.equal((await call('/api/works', { method: 'POST', headers: { ...headers(), 'Sec-Fetch-Site': 'cross-site' }, body: form() })).status, 403, 'cross-site writes rejected');
const created = await call('/api/works', { method: 'POST', headers: headers(), body: form() });
assert.equal(created.status, 201);
const { work } = await created.json();
assert.equal(work.ownerId, 'creator-1'); assert.equal(work.format, 'GLB'); assert.equal(work.modelUrl, work.fileUrl); assert.deepEqual(work.tags, ['家具', '测试']); assert.equal('storageKeys' in work, false);
assert.equal(bucket.data.size, 3, 'source, image and metadata persisted');
const anonymousList = await (await call('/api/works')).json();
assert.equal(anonymousList.works.length, 2); assert.equal(anonymousList.works[0].id, work.id); assert.equal('ownerId' in anonymousList.works[0], false); assert.equal(anonymousList.user, null);
const ownerList = await (await call('/api/works', { headers: headers() })).json();
assert.equal(ownerList.works[0].ownerId, 'creator-1');
const source = await call(work.fileUrl); assert.equal(source.status, 200); assert.equal(await source.text(), 'glTF-test-model'); assert.match(source.headers.get('Content-Disposition'), /attachment/);
const image = await call(work.coverUrl); assert.equal(image.headers.get('Content-Type'), 'image/png'); assert.deepEqual(new Uint8Array(await image.arrayBuffer()), png);
assert.equal((await call(work.coverUrl, { method: 'HEAD' })).body, null);
assert.equal((await call(work.coverUrl, { method: 'POST', headers: headers() })).status, 405);
assert.equal((await call('/api/files/%E0%A4%A')).status, 404);
assert.equal((await call('/api/files/../../records/a.json')).status, 404);
assert.equal((await call('/api/works/' + work.id, { method: 'DELETE', headers: headers('another-user') })).status, 403);
assert.equal((await call('/api/works/lamp', { method: 'DELETE', headers: headers() })).status, 400);

const bad = form(false); bad.set('images', new File(['<script>alert(1)</script>'], 'fake.png'));
assert.equal((await call('/api/works', { method: 'POST', headers: headers(), body: bad })).status, 400, 'raster signatures verified');
const unsupported = form(); unsupported.set('source', new File(['unsafe'], 'app.exe'));
assert.equal((await call('/api/works', { method: 'POST', headers: headers(), body: unsupported })).status, 400);
const empty = new FormData(); empty.set('title', '无文件');
assert.equal((await call('/api/works', { method: 'POST', headers: headers(), body: empty })).status, 400);
const tooMany = form(false); for (let i = 0; i < 8; i++) tooMany.append('images', new File([png], i + '.png'));
assert.equal((await call('/api/works', { method: 'POST', headers: headers(), body: tooMany })).status, 400);
const tooBig = form(false); tooBig.set('images', new File([new Uint8Array(12 * 1024 * 1024 + 1)], 'large.png'));
assert.equal((await call('/api/works', { method: 'POST', headers: headers(), body: tooBig })).status, 400);
assert.equal((await call('/api/works', { method: 'POST', headers: { ...headers(), 'Content-Length': String(41 * 1024 * 1024) }, body: form() })).status, 413);
const longTitle = form(); longTitle.set('title', '作'.repeat(81));
assert.equal((await call('/api/works', { method: 'POST', headers: headers(), body: longTitle })).status, 400);
const longDescription = form(); longDescription.set('description', '作'.repeat(4001));
assert.equal((await call('/api/works', { method: 'POST', headers: headers(), body: longDescription })).status, 400);
assert.equal((await handleApi(request('/api/works'), {}, builtins)).status, 503);

for (let i = 0; i < 3; i++) assert.equal((await call('/api/works', { method: 'POST', headers: headers(), body: form(false) })).status, 201);
assert.equal((await (await call('/api/works')).json()).works.length, 5, 'record listing follows every page');
const before = bucket.data.size; bucket.failRecords = true;
const originalError = console.error; console.error = () => {};
const failed = await call('/api/works', { method: 'POST', headers: headers(), body: form() });
console.error = originalError; bucket.failRecords = false;
assert.equal(failed.status, 500); assert.equal(bucket.data.size, before, 'failed metadata write rolls back uploaded files');
assert.equal((await call('/api/works/' + work.id, { method: 'DELETE', headers: headers() })).status, 200);
assert.equal((await call(work.fileUrl)).status, 404); assert.equal((await call(work.coverUrl)).status, 404);
assert.equal((await (await call('/api/works')).json()).works.some((item) => item.id === work.id), false);
console.log('PASS: persistent upload/list/download/delete, authentication, ownership, CSRF, validation, pagination and rollback.');
