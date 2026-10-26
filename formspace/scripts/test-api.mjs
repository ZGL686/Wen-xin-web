import assert from 'node:assert/strict';
import { handleApi } from '../worker/api.ts';

class MemoryBucket {
  data = new Map();
  counter = 0;
  failPrefix = '';
  rejectNextRecordWrite = false;
  failAfterNextRecordWrite = false;
  lists = 0;
  async put(key, value, options = {}) {
    if (this.failPrefix && key.startsWith(this.failPrefix)) throw new Error('simulated storage failure');
    const current = this.data.get(key);
    if (options.onlyIf?.etagMatches && current?.etag !== options.onlyIf.etagMatches) return null;
    if (options.onlyIf?.etagDoesNotMatch === '*' && current) return null;
    if (this.rejectNextRecordWrite && key.startsWith('records/')) { this.rejectNextRecordWrite = false; return null; }
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(await new Response(value).arrayBuffer());
    // Recheck after consuming an asynchronous body, just as an atomic conditional store does.
    if (options.onlyIf?.etagMatches && this.data.get(key)?.etag !== options.onlyIf.etagMatches) return null;
    if (options.onlyIf?.etagDoesNotMatch === '*' && this.data.has(key)) return null;
    const saved = { bytes, httpMetadata: options.httpMetadata || {}, customMetadata: options.customMetadata || {}, etag: String(++this.counter) };
    this.data.set(key, saved);
    if (this.failAfterNextRecordWrite && key.startsWith('records/')) { this.failAfterNextRecordWrite = false; throw new Error('uncertain record commit reply'); }
    return this.describe(key, saved);
  }
  describe(key, saved) { return { key, size: saved.bytes.length, etag: saved.etag, httpEtag: '"' + saved.etag + '"', customMetadata: saved.customMetadata, httpMetadata: saved.httpMetadata }; }
  async head(key) { const saved = this.data.get(key); return saved ? this.describe(key, saved) : null; }
  async get(key, options = {}) {
    const saved = this.data.get(key); if (!saved) return null;
    const bytes = options.range ? saved.bytes.slice(options.range.offset, options.range.offset + options.range.length) : saved.bytes;
    return { ...this.describe(key, saved), body: new Blob([bytes]).stream(), json: async () => JSON.parse(new TextDecoder().decode(saved.bytes)) };
  }
  async list({ prefix = '', cursor, limit = 100 } = {}) {
    this.lists++;
    const keys = [...this.data.keys()].filter((key) => key.startsWith(prefix)).sort();
    const start = Number(cursor || 0), end = start + Math.min(limit, 2);
    return { objects: keys.slice(start, end).map((key) => ({ key })), truncated: end < keys.length, cursor: String(end) };
  }
  async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) this.data.delete(key); }
}

const bucket = new MemoryBucket(), env = { BUCKET: bucket };
const builtins = [{ id: 'lamp', title: '灯具', category: '产品设计', tags: ['玉石'], date: '2026-10-15', fileUrl: '/originals/lamp.max', modelUrl: '/portfolio/lamp.glb', images: ['/portfolio/lamp.webp'], coverUrl: '/portfolio/lamp.webp', builtIn: true }];
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const mp4 = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115, 111, 109, 0, 1, 2, 3]);
const audio = new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, 0, 20, 30]);
// A test label is only a cookie jar index, never a server identity header.
const jars = new Map();
const headers = (browser = 'creator-1') => ({ ...(jars.has(browser) ? { Cookie: jars.get(browser) } : {}), Origin: 'https://portfolio.test' });
const req = (path, init = {}) => new Request('https://portfolio.test' + path, init);
const call = (path, init = {}) => handleApi(req(path, init), env, builtins);
const read = async (response, status = 200) => { const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data)); return data; };
const get = async (path, user) => read(await call(path, user ? { headers: headers(user) } : {}));
const sendJson = (path, method, body, user = 'creator-1') => call(path, { method, headers: { ...headers(user), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const createForm = (direction = '三维') => {
  const data = new FormData(); data.set('title', '我的私密创作'); data.set('direction', direction); data.set('description', '作品介绍'); data.set('process', '尚未公开的过程'); data.set('tags', '家具， 测试,家具');
  data.set('source', new File(['native engineering data'], '工程.max'));
  data.set('previewModel', new File(['glTF-browser-preview'], '预览.glb'));
  data.append('images', new File([png], 'preview.png', { type: 'image/png' })); return data;
};
const postForm = (form = createForm(), user = 'creator-1') => call('/api/works', { method: 'POST', headers: headers(user), body: form });
const save = (work, fields = {}) => sendJson('/api/works/' + work.id, 'PUT', { baseRevision: work.revision, ...fields });
const publish = (work, fields) => sendJson('/api/works/' + work.id + '/publication', 'PATCH', { revision: work.revision, ...fields });
const keys = () => [...bucket.data.keys()].sort();
let checks = 0;

// Server-issued browser sessions: same-origin only, high entropy, no readable bearer.
const pristine = keys();
assert.deepEqual(await get('/api/me'), { user: null, profile: null });
assert.deepEqual(keys(), pristine, 'GET /me must not create sessions or profiles');
assert.equal((await call('/api/session', { method: 'POST' })).status, 403);
assert.equal((await call('/api/session', { method: 'POST', headers: { Origin: 'https://evil.test' } })).status, 403);
assert.equal((await call('/api/session', { method: 'POST', headers: { Origin: 'null' } })).status, 403);
assert.equal((await call('/api/session', { method: 'POST', headers: { Origin: 'https://portfolio.test', 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
const spoofHeaders = { 'oai-authenticated-user-id': 'creator-1', 'oai-authenticated-user-full-name': 'Forged account', Origin: 'https://portfolio.test', Cookie: '__sites_local_auth=1' };
assert.deepEqual(await read(await call('/api/me', { headers: spoofHeaders })), { user: null, profile: null });
assert.equal((await call('/api/works', { method: 'POST', headers: spoofHeaders, body: createForm() })).status, 401);
assert.deepEqual(await read(await call('/api/me', { headers: { Cookie: '__Host-changxu_workspace=not-a-valid-token' } })), { user: null, profile: null });
assert.deepEqual(await read(await call('/api/me', { headers: { Cookie: '__Host-changxu_workspace=' + 'a'.repeat(43) } })), { user: null, profile: null });
async function openBrowser(label, extraHeaders = {}) {
  const response = await call('/api/session', { method: 'POST', headers: { ...headers(label), ...extraHeaders } });
  const cookie = response.headers.get('Set-Cookie');
  if (cookie) jars.set(label, cookie.split(';')[0]);
  const data = await read(response);
  return { data, cookie, response };
}
const firstBrowser = await openBrowser('creator-1', spoofHeaders);
assert.equal(firstBrowser.data.created, true); assert.equal(firstBrowser.data.identityMode, 'browser');
assert.match(firstBrowser.data.user.id, /^workspace-[a-f0-9-]{36}$/); assert.notEqual(firstBrowser.data.user.id, 'creator-1');
assert.match(firstBrowser.cookie, /HttpOnly/); assert.match(firstBrowser.cookie, /SameSite=Lax/); assert.match(firstBrowser.cookie, /Path=\//); assert.match(firstBrowser.cookie, /Secure/); assert.match(firstBrowser.cookie, /Max-Age=31536000/);
assert.match(firstBrowser.cookie, /^__Host-changxu_workspace=/); assert.equal(/(?:^|;\s*)Domain=/i.test(firstBrowser.cookie), false);
assert.match(firstBrowser.response.headers.get('Cache-Control'), /no-store/); assert.equal(firstBrowser.response.headers.get('Vary'), 'Cookie');
const firstSecret = jars.get('creator-1').split('=')[1]; assert.equal(firstSecret.length, 43);
assert.equal(JSON.stringify(firstBrowser.data).includes(firstSecret), false, 'bearer is never returned as JSON');
for (const [key, stored] of bucket.data) { assert.equal(new TextDecoder().decode(stored.bytes).includes(firstSecret), false, 'R2 stores no raw bearer'); if (key.startsWith('sessions/')) assert.match(JSON.parse(new TextDecoder().decode(stored.bytes)).tokenHash, /^[a-f0-9]{64}$/); }
const reused = await openBrowser('creator-1'); assert.equal(reused.data.created, false); assert.equal(reused.data.user.id, firstBrowser.data.user.id); assert.equal(reused.cookie.split(';')[0], jars.get('creator-1'));
assert.deepEqual(await read(await call('/api/me', { headers: { Cookie: 'changxu_workspace=' + firstSecret } })), { user: null, profile: null }, 'HTTPS rejects a parent-domain/development-name cookie even with a valid token');
const secondBrowser = await openBrowser('creator-2'); assert.notEqual(secondBrowser.data.user.id, firstBrowser.data.user.id); assert.notEqual(jars.get('creator-1'), jars.get('creator-2'));
const beforeRead = keys(); assert.equal((await get('/api/me', 'creator-1')).user.id, firstBrowser.data.user.id); assert.deepEqual(keys(), beforeRead);
// Duplicate cookies are ambiguous and never authenticate.
assert.deepEqual(await read(await call('/api/me', { headers: { Cookie: jars.get('creator-1') + '; ' + jars.get('creator-2') } })), { user: null, profile: null });
// Concurrent cookieless opens produce independent empty owners, never a shared global workspace.
const concurrentSessions = await Promise.all([openBrowser('parallel-a'), openBrowser('parallel-b')]);
assert.notEqual(concurrentSessions[0].data.user.id, concurrentSessions[1].data.user.id);
// An expired token cannot recover or attach its owner's retained data.
const expiring = await openBrowser('expired-browser');
const expiredSecret = jars.get('expired-browser').split('=')[1];
const expiredHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(expiredSecret)))].map(x => x.toString(16).padStart(2, '0')).join('');
const expiredKey = 'sessions/' + expiredHash + '.json';
const expiryRecord = await (await bucket.get(expiredKey)).json(); await bucket.put(expiredKey, JSON.stringify({ ...expiryRecord, createdAt: Date.now() - 366 * 86400000, expiresAt: Date.now() - 1 }));
assert.equal((await get('/api/me', 'expired-browser')).user, null);
const replacement = await openBrowser('expired-browser'); assert.notEqual(replacement.data.user.id, expiring.data.user.id); assert.equal(bucket.data.has(expiredKey), true);
const invalidReplacement = await openBrowser('invalid-cookie', { Cookie: '__Host-changxu_workspace=' + 'z'.repeat(43), 'oai-authenticated-user-id': firstBrowser.data.user.id });
assert.equal(invalidReplacement.data.created, true); assert.notEqual(invalidReplacement.data.user.id, firstBrowser.data.user.id);
const forgedWithValidCookie = await read(await call('/api/me', { headers: { ...headers('creator-2'), 'oai-authenticated-user-id': firstBrowser.data.user.id, 'oai-authenticated-user-full-name': 'Pretend first browser' } }));
assert.equal(forgedWithValidCookie.user.id, secondBrowser.data.user.id); assert.notEqual(forgedWithValidCookie.user.name, 'Pretend first browser');
// A failed bootstrap never sends a bearer cookie or reports an owner as ready.
const sessionKeysBeforeFailure = keys().filter(key => key.startsWith('sessions/'));
const suppressedBootstrapError = console.error; console.error = () => {};
bucket.failPrefix = 'profiles/';
const failedBootstrap = await call('/api/session', { method: 'POST', headers: { Origin: 'https://portfolio.test' } });
bucket.failPrefix = ''; console.error = suppressedBootstrapError;
assert.equal(failedBootstrap.status, 500); assert.equal(failedBootstrap.headers.has('Set-Cookie'), false); assert.deepEqual(keys().filter(key => key.startsWith('sessions/')), sessionKeysBeforeFailure);
const httpBootstrap = await handleApi(new Request('http://127.0.0.1:5173/api/session', { method: 'POST', headers: { Origin: 'http://127.0.0.1:5173' } }), env, builtins);
assert.equal(httpBootstrap.status, 200); assert.equal(/(?:^|;\s*)Secure(?:;|$)/.test(httpBootstrap.headers.get('Set-Cookie')), false, 'HTTP loopback can retain the development cookie'); assert.match(httpBootstrap.headers.get('Set-Cookie'), /^changxu_workspace=/);
const insecureBootstrap = await handleApi(new Request('http://public.example/api/session', { method: 'POST', headers: { Origin: 'http://public.example' } }), env, builtins);
assert.equal(insecureBootstrap.status, 403); assert.equal(insecureBootstrap.headers.has('Set-Cookie'), false);
const insecureIdentity = await handleApi(new Request('http://public.example/api/me', { headers: { Cookie: 'changxu_workspace=' + firstSecret } }), env, builtins);
assert.deepEqual(await insecureIdentity.json(), { user: null, profile: null });
checks += 36;
checks += 7;
checks += 4;
checks += 3;

// A read never renews; an explicit bootstrap within the last month extends the
// same owner/token, including concurrent tabs. Fresh sessions are not extended.
const renewalBrowser = await openBrowser('renewing');
const renewalCookie = jars.get('renewing'), renewalSecret = renewalCookie.split('=')[1];
const renewalHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(renewalSecret)))].map(x => x.toString(16).padStart(2, '0')).join('');
const renewalKey = 'sessions/' + renewalHash + '.json';
const renewalRecord = await (await bucket.get(renewalKey)).json();
await bucket.put(renewalKey, JSON.stringify({ ...renewalRecord, expiresAt: Date.now() + 10 * 86400000 }));
const beforeMeRenew = new TextDecoder().decode(bucket.data.get(renewalKey).bytes);
const readNearExpiry = await call('/api/me', { headers: headers('renewing') }); assert.equal(readNearExpiry.status, 200); assert.equal(readNearExpiry.headers.has('Set-Cookie'), false); assert.equal(new TextDecoder().decode(bucket.data.get(renewalKey).bytes), beforeMeRenew);
const renewedTabs = await Promise.all([openBrowser('renewing'), openBrowser('renewing')]);
for (const result of renewedTabs) { assert.equal(result.data.created, false); assert.equal(result.data.user.id, renewalBrowser.data.user.id); assert.equal(result.cookie.split(';')[0], renewalCookie); assert.match(result.cookie, /Secure/); }
const renewedRecord = await (await bucket.get(renewalKey)).json();
assert.ok(renewedRecord.expiresAt > Date.now() + 364 * 86400000); assert.equal(renewedRecord.ownerId, renewalRecord.ownerId); assert.equal(renewedRecord.createdAt, renewalRecord.createdAt); assert.equal(renewedRecord.tokenHash, renewalRecord.tokenHash);
const freshRecordBefore = new TextDecoder().decode(bucket.data.get(renewalKey).bytes); await openBrowser('renewing'); assert.equal(new TextDecoder().decode(bucket.data.get(renewalKey).bytes), freshRecordBefore);
checks += 16;

// Existing-but-damaged server state must fail closed, not overwrite a still
// recoverable cookie with a new empty workspace.
const intactSession = await (await bucket.get(renewalKey)).json();
for (const damaged of ['{malformed', JSON.stringify({ ...intactSession, tokenHash: 'mismatched-hash' }), JSON.stringify({ ...intactSession, ownerId: 'old-account-owner' }), JSON.stringify({ ...intactSession, createdAt: null }), JSON.stringify({ ...intactSession, expiresAt: 'not-a-date' })]) {
  await bucket.put(renewalKey, damaged);
  const rowsBefore = keys();
  for (const method of ['GET', 'POST']) {
    const response = await call(method === 'GET' ? '/api/me' : '/api/session', { method, headers: headers('renewing') });
    const error = await read(response, 503); assert.equal(error.code, 'workspace_storage_unavailable'); assert.equal(response.headers.has('Set-Cookie'), false); assert.equal(JSON.stringify(error).includes(renewalSecret), false);
  }
  assert.deepEqual(keys(), rowsBefore);
}
await bucket.put(renewalKey, JSON.stringify(intactSession));
assert.equal((await get('/api/me', 'renewing')).user.id, renewalBrowser.data.user.id);
checks += 31;

// Cookie-verified writes and personal spaces; protected writes also require Origin.
assert.equal((await call('/api/works', { method: 'POST', body: createForm() })).status, 401);
assert.equal((await call('/api/works', { method: 'POST', headers: { Cookie: jars.get('creator-1') }, body: createForm() })).status, 403);
assert.equal((await call('/api/works', { method: 'POST', headers: { ...headers(), Origin: 'https://evil.test' }, body: createForm() })).status, 403);
assert.equal((await call('/api/works', { method: 'POST', headers: { ...headers(), 'Sec-Fetch-Site': 'cross-site' }, body: createForm() })).status, 403);
assert.equal((await call('/api/works?scope=mine')).status, 401);
assert.deepEqual(await get('/api/me'), { user: null, profile: null });
const me = await get('/api/me', 'creator-1');
assert.equal(me.profile.displayName, '我的创作空间'); assert.ok(!me.profile.slug.includes(firstBrowser.data.user.id)); assert.equal('ownerId' in me.profile, false);
const profileUpdated = await read(await sendJson('/api/me/profile', 'PATCH', { displayName: '温柔的造物者', bio: '记录成长。' }));
assert.equal(profileUpdated.profile.slug, me.profile.slug); assert.equal(profileUpdated.user.profile.displayName, '温柔的造物者');
checks += 10;

// A successful first save is private; no filename or guessed resource URL is public.
let detail = await read(await postForm(), 201), work = detail.work;
const id = work.id, first = work.versionId, initialFile = work.fileUrl, model = work.modelUrl, cover = work.coverUrl;
assert.equal(work.visibility, 'private'); assert.equal(work.isOwner, true); assert.equal(work.direction, '三维'); assert.deepEqual(work.tags, ['家具', '测试']);
assert.equal(detail.versions.length, 1); assert.equal(detail.versions[0].process, '尚未公开的过程'); assert.equal('storageKeys' in detail.versions[0], false);
assert.equal((await get('/api/works')).works.length, 1); // system exhibit only
assert.equal((await get('/api/works?scope=mine', 'creator-1')).works[0].id, id);
assert.equal((await call('/api/works/' + id)).status, 404);
assert.equal((await call(initialFile)).status, 404); assert.equal((await call(model, { headers: headers('creator-2') })).status, 404);
assert.equal(await (await call(initialFile, { headers: headers() })).text(), 'native engineering data');
assert.equal((await get('/api/works?scope=mine', 'creator-2')).works.length, 0);
assert.equal((await sendJson('/api/works/' + id, 'PUT', { baseRevision: work.revision, description: 'steal' }, 'creator-2')).status, 403);
checks += 15;
// Cookie loss creates a new empty workspace but never deletes or reassigns the old private record.
await openBrowser('lost-browser');
const lostDraft = await read(await sendJson('/api/works', 'POST', { title: '仍然保留的私稿', direction: '其他', contentText: 'private retained content' }, 'lost-browser'), 201);
const lostOwner = lostDraft.work.ownerId;
jars.delete('lost-browser'); assert.equal((await get('/api/me', 'lost-browser')).user, null);
const afterCookieLoss = await openBrowser('lost-browser'); assert.notEqual(afterCookieLoss.data.user.id, lostOwner);
assert.equal((await get('/api/works?scope=mine', 'lost-browser')).works.length, 0);
assert.equal((await call('/api/works/' + lostDraft.work.id, { headers: headers('lost-browser') })).status, 404);
assert.equal((await (await bucket.get('records/' + lostDraft.work.id + '.json')).json()).ownerId, lostOwner);
assert.equal(bucket.data.has('versions/' + lostDraft.work.id + '/' + lostDraft.work.versionId + '.json'), true);
checks += 6;

// A selected display snapshot is public, while its private process and native source stay private.
detail = await read(await publish(work, { displayVersionId: first })); work = detail.work;
let visitor = await get('/api/works/' + id);
assert.equal(visitor.work.fileUrl, ''); assert.equal(visitor.work.fileName, ''); assert.equal(visitor.work.modelUrl, model);
assert.equal(visitor.work.process, ''); assert.equal(visitor.versions[0].process, ''); assert.equal(visitor.versions[0].isPublic, false);
assert.equal('ownerId' in visitor.work, false); assert.equal('latestVersionId' in visitor.work, false); assert.equal('publicVersionIds' in visitor.work, false);
assert.equal((await call(initialFile)).status, 404);
const publicModel = await call(model); assert.equal(publicModel.status, 200); assert.match(publicModel.headers.get('Cache-Control'), /no-store/);
assert.equal((await call(cover)).status, 200); assert.equal((await call(cover, { method: 'HEAD' })).body, null);
const personal = await get('/api/profiles/' + me.profile.slug);
assert.equal(personal.profile.displayName, '温柔的造物者'); assert.equal(personal.works.length, 1); assert.equal(personal.works[0].id, id);
const system = await get('/api/profiles/wenxin-exhibits');
assert.equal(system.profile.system, true); assert.equal(system.works[0].isOwner, false); assert.equal(system.works[0].direction, '三维'); assert.ok(system.works[0].tags.includes('产品设计'));
assert.equal((await call('/api/works/lamp', { method: 'DELETE', headers: headers() })).status, 403);
checks += 20;

// Save a final snapshot, then more private changes: old finals and public presentation are untouched.
detail = await read(await save(work, { description: '第二版介绍', process: '第二版解决过程', status: 'final' })); work = detail.work;
const second = work.versionId;
assert.equal(work.id, id); assert.equal(work.fileUrl, initialFile); assert.equal(work.versionCount, 2); assert.equal(work.status, 'final');
assert.equal((await get('/api/works/' + id)).work.description, '作品介绍');
assert.equal((await call('/api/works/' + id + '?version=' + second)).status, 404);
detail = await read(await save(work)); work = detail.work;
assert.equal(work.versionCount, 3, 'unchanged manual save is still a saved version'); assert.equal(detail.versions.find((v) => v.id === second).status, 'final');
const third = work.versionId;
const nextMedia = new FormData(); nextMedia.set('baseRevision', String(work.revision)); nextMedia.set('description', '第四版私密视频'); nextMedia.set('process', '第四版过程'); nextMedia.set('status', 'in-progress');
nextMedia.set('video', new File([mp4], 'new.mp4')); nextMedia.set('audio', new File([audio], 'sound.mp3')); nextMedia.set('previewStart', '1'); nextMedia.set('previewEnd', '4');
detail = await read(await call('/api/works/' + id, { method: 'PATCH', headers: headers(), body: nextMedia })); work = detail.work;
const fourth = work.versionId, privateVideo = work.videoUrl;
assert.equal(work.versionCount, 4); assert.equal(work.status, 'in-progress'); assert.equal(work.fileUrl, initialFile); assert.equal(work.previewEnd, 4);
assert.equal((await call(privateVideo)).status, 404); assert.equal((await call(work.audioUrl)).status, 404);
visitor = await get('/api/works/' + id); assert.equal(visitor.versions.length, 1); assert.equal(visitor.work.versionCount, 1); assert.equal(JSON.stringify(visitor).includes(fourth), false);
detail = await read(await publish(work, { publicVersionIds: [second], importantVersionIds: [second] })); work = detail.work;
visitor = await get('/api/works/' + id);
assert.equal(visitor.versions.length, 2); assert.equal(visitor.versions.find((v) => v.id === second).process, '第二版解决过程'); assert.equal(visitor.versions.find((v) => v.id === second).important, true);
assert.equal(visitor.work.versionId, first); assert.equal((await get('/api/works/' + id + '?version=' + second)).work.status, 'final');
assert.equal((await call('/api/works/' + id + '?version=' + third)).status, 404);
checks += 25;

// Public video is range-streamed; unrelated private files remain denied.
detail = await read(await publish(work, { displayVersionId: fourth })); work = detail.work;
visitor = await get('/api/works/' + id);
assert.equal(visitor.work.videoUrl, privateVideo); assert.equal(visitor.work.process, ''); assert.equal((await call(initialFile)).status, 404);
const range = await call(privateVideo, { headers: { Range: 'bytes=0-7' } });
assert.equal(range.status, 206); assert.equal(range.headers.get('Content-Range'), 'bytes 0-7/24'); assert.deepEqual(new Uint8Array(await range.arrayBuffer()), mp4.slice(0, 8));
const suffix = await call(privateVideo, { headers: { Range: 'bytes=-4' } }); assert.equal(suffix.status, 206); assert.deepEqual(new Uint8Array(await suffix.arrayBuffer()), mp4.slice(-4));
const openRange = await call(privateVideo, { headers: { Range: 'bytes=20-' } }); assert.equal(openRange.status, 206); assert.equal(openRange.headers.get('Content-Length'), '4');
for (const bad of ['bytes=100-', 'bytes=8-2', 'bytes=0-1,4-5', 'bytes=-0', 'invalid']) assert.equal((await call(privateVideo, { headers: { Range: bad } })).status, 416);
const mediaHead = await call(privateVideo, { method: 'HEAD' }); assert.equal(mediaHead.headers.get('Accept-Ranges'), 'bytes'); assert.equal(mediaHead.headers.get('Content-Type'), 'video/mp4');
const full = await call(privateVideo, { headers: { Range: 'bytes=0-1', 'If-Range': '"stale"' } }); assert.equal(full.status, 200); assert.equal((await full.arrayBuffer()).byteLength, 24);
assert.equal((await call(privateVideo, { method: 'POST', headers: headers() })).status, 405);
checks += 16;

// Original download is an explicit version-level choice; unpublishing and revocation take effect on every fetch.
detail = await read(await save(work, { allowSourceDownload: true })); work = detail.work;
assert.equal((await call(initialFile)).status, 404);
detail = await read(await publish(work, { displayVersionId: work.versionId, publicVersionIds: [] })); work = detail.work;
assert.equal((await call(initialFile)).status, 200); assert.equal((await get('/api/works/' + id)).work.fileUrl, initialFile);
detail = await read(await publish(work, { displayVersionId: null })); work = detail.work;
assert.equal((await call('/api/works/' + id)).status, 404); assert.equal((await call(initialFile)).status, 404); assert.equal((await call(model)).status, 404); assert.equal((await call(privateVideo)).status, 404);
assert.equal((await get('/api/profiles/' + me.profile.slug)).works.length, 0);
detail = await read(await publish(work, { displayVersionId: first, publicVersionIds: [] })); work = detail.work;
assert.equal((await call(initialFile)).status, 404); assert.equal((await call(privateVideo)).status, 404); assert.equal((await call(model)).status, 200);
checks += 12;

// Validation: direction is required, tags are normalized, text and HTTPS experiences can be first content.
assert.equal((await sendJson('/api/works', 'POST', { title: '灵感', contentText: '只有想法' })).status, 400);
assert.equal((await sendJson('/api/works', 'POST', { title: '灵感', direction: '家具设计', contentText: '只有想法' })).status, 400);
assert.equal((await sendJson('/api/works', 'POST', { title: '无内容', direction: '其他' })).status, 400);
assert.equal((await sendJson('/api/works', 'POST', { title: '假链接', direction: '其他', fileUrl: initialFile })).status, 400);
assert.equal((await sendJson('/api/works', 'POST', { title: '假图片', direction: '其他', images: [cover] })).status, 400);
for (const link of ['http://example.com', 'javascript:alert(1)', 'https://user:secret@example.com']) assert.equal((await sendJson('/api/works', 'POST', { title: '链接', direction: '交互', interactiveUrl: link })).status, 400);
for (const direction of ['交互', '影视', '三维', '其他']) {
  const created = await read(await sendJson('/api/works', 'POST', { title: direction + '灵感', direction, contentText: '未完成，也值得被保留。', tags: [' 产品设计 ', '产品设计', '', '测试'] }), 201);
  assert.equal(created.work.direction, direction); assert.deepEqual(created.work.tags, ['产品设计', '测试']); assert.equal(created.work.visibility, 'private');
}
const interaction = await read(await sendJson('/api/works', 'POST', { title: '交互原型', direction: '交互', interactiveUrl: 'https://example.com/experience' }), 201);
assert.equal(interaction.work.interactiveUrl, 'https://example.com/experience');
const previewOnly = new FormData(); previewOnly.set('title', '只有网页预览'); previewOnly.set('direction', '三维'); previewOnly.set('previewModel', new File(['glTF-preview-only'], 'model.glb'));
const previewOnlyDetail = await read(await postForm(previewOnly), 201); assert.equal(previewOnlyDetail.work.format, 'GLB');
const textDraft = await read(await sendJson('/api/works', 'POST', { title: '从文字开始', direction: '影视', contentText: '拍摄想法' }), 201);
const textToVideo = new FormData(); textToVideo.set('baseRevision', String(textDraft.work.revision)); textToVideo.set('video', new File([mp4], 'film.mp4'));
const filmDraft = await read(await call('/api/works/' + textDraft.work.id, { method: 'PUT', headers: headers(), body: textToVideo })); assert.equal(filmDraft.work.format, 'VIDEO');
// A standalone GLB gets a separately addressed preview; the original key/name stay private.
const glbForm = new FormData(); glbForm.set('title', '自带预览的模型'); glbForm.set('direction', '三维'); glbForm.set('source', new File(['glTF-original-preview'], '不要公开我的原文件名.glb'));
let glbDetail = await read(await postForm(glbForm), 201);
assert.notEqual(glbDetail.work.fileUrl, glbDetail.work.modelUrl);
glbDetail = await read(await publish(glbDetail.work, { displayVersionId: glbDetail.work.versionId }));
assert.equal((await call(glbDetail.work.fileUrl)).status, 404);
const glbPreview = await call(glbDetail.work.modelUrl); assert.equal(glbPreview.status, 200); assert.equal(glbPreview.headers.has('Content-Disposition'), false);
assert.equal(JSON.stringify(await get('/api/works/' + glbDetail.work.id)).includes('不要公开我的原文件名'), false);
assert.equal((await save(work, { previewStart: 10, previewEnd: 4 })).status, 400);
assert.equal((await save(work, { previewStart: -1 })).status, 400);
assert.equal((await save(work, { title: '作'.repeat(81) })).status, 400);
assert.equal((await save(work, { description: '作'.repeat(4001) })).status, 400);
assert.equal((await publish(work, { displayVersionId: 'nonexistent' })).status, 400);
assert.equal((await publish(work, { publicVersionIds: ['nonexistent'] })).status, 400);
checks += 25;
checks += 5;
checks += 2;

// Invalid media, count and request sizes do not create versions or files.
const beforeValidation = keys();
const invalidImage = createForm(); invalidImage.set('images', new File(['<script>unsafe</script>'], 'fake.png'));
assert.equal((await postForm(invalidImage)).status, 400);
const invalidVideo = createForm(); invalidVideo.set('video', new File(['not a video'], 'fake.mp4')); assert.equal((await postForm(invalidVideo)).status, 400);
const unsupported = createForm(); unsupported.set('source', new File(['bad'], 'app.exe')); assert.equal((await postForm(unsupported)).status, 400);
const duplicate = createForm(); duplicate.append('source', new File(['native'], 'other.max')); assert.equal((await postForm(duplicate)).status, 400);
const tooMany = createForm(); for (let i = 0; i < 8; i++) tooMany.append('images', new File([png], i + '.png')); assert.equal((await postForm(tooMany)).status, 400);
const tooBig = createForm(); tooBig.set('images', new File([new Uint8Array(12 * 1024 * 1024 + 1)], 'large.png')); assert.equal((await postForm(tooBig)).status, 400);
assert.equal((await call('/api/works', { method: 'POST', headers: { ...headers(), 'Content-Length': String(41 * 1024 * 1024) }, body: createForm() })).status, 413);
assert.deepEqual(keys(), beforeValidation);
assert.equal((await call('/api/files/%E0%A4%A')).status, 404);
assert.equal((await handleApi(req('/api/works'), {}, builtins)).status, 503);
checks += 10;

// Record listing follows storage pagination, and private spaces never mix authors.
const countBefore = bucket.lists;
const mine = await get('/api/works?scope=mine', 'creator-1');
assert.ok(mine.works.length >= 6); assert.ok(bucket.lists - countBefore >= 3); assert.equal(mine.works.every((item) => item.author.slug === me.profile.slug), true);
const other = await read(await sendJson('/api/works', 'POST', { title: '第二人的私密灵感', direction: '其他', contentText: 'another' }, 'creator-2'), 201);
assert.notEqual(other.work.author.slug, me.profile.slug); assert.equal((await get('/api/works?scope=mine', 'creator-2')).works.length, 1);
assert.equal((await get('/api/works')).works.some((item) => item.id === other.work.id), false);
assert.equal((await get('/api/works?profile=' + me.profile.slug)).works.every((item) => item.author.slug === me.profile.slug), true);
checks += 7;

// Account-era records are retained, with their public snapshot intact, but no new browser can claim them.
const legacyId = crypto.randomUUID(), legacyFile = `files/${legacyId}/source.max`;
await bucket.put(legacyFile, 'legacy original', { customMetadata: { name: '旧工程.max' } });
await bucket.put('records/' + legacyId + '.json', JSON.stringify({ id: legacyId, ownerId: 'creator-1', title: '旧家具', category: '家具设计', tags: ['木质'], date: '2026-10-25', fileUrl: '/api/' + legacyFile, fileName: '旧工程.max', fileSize: 15, format: 'MAX', images: [], storageKeys: [legacyFile] }));
let legacy = await get('/api/works/' + legacyId);
assert.equal(legacy.work.direction, '三维'); assert.ok(legacy.work.tags.includes('家具设计')); assert.equal((await call('/api/' + legacyFile)).status, 200);
legacy = await get('/api/works/' + legacyId, 'creator-1');
assert.equal(legacy.isOwner, false);
const legacyUpdate = new FormData(); legacyUpdate.set('baseRevision', String(legacy.work.revision)); legacyUpdate.set('source', new File(['new private native'], '新工程.max')); legacyUpdate.set('process', 'legacy private process');
assert.equal((await call('/api/works/' + legacyId, { method: 'PUT', headers: { ...headers(), 'oai-authenticated-user-id': 'creator-1' }, body: legacyUpdate })).status, 403);
assert.equal((await sendJson('/api/works/' + legacyId + '/publication', 'PATCH', { revision: 1, displayVersionId: null })).status, 403);
assert.equal(legacy.versions.length, 1); assert.equal(legacy.work.displayVersionId, 'legacy');
assert.equal((await get('/api/works/' + legacyId)).work.fileName, '旧工程.max');
assert.equal((await get('/api/works/' + legacyId, 'creator-1')).versions[0].fileUrl, '/api/' + legacyFile);
const retainedLegacyBytes = new TextDecoder().decode(bucket.data.get('records/' + legacyId + '.json').bytes);
// Modern old-account private and published/private-history records use exact existing pointers.
const accountPrivateId = crypto.randomUUID(), accountPublicId = crypto.randomUUID(), accountPublicVersion = crypto.randomUUID(), accountSecretVersion = crypto.randomUUID();
const accountPrivateFile = `files/${accountPrivateId}/${accountSecretVersion}/source.max`;
const accountSecretFile = `files/${accountPublicId}/${accountSecretVersion}/video.mp4`;
await bucket.put(accountPrivateFile, 'old private native'); await bucket.put(accountSecretFile, mp4);
const accountBase = { ...(await get('/api/works/' + id, 'creator-1')).versions[0], id: accountSecretVersion, number: 2, storageKeys: [accountPrivateFile], fileUrl: '/api/' + accountPrivateFile, fileName: 'old private.max', process: 'never reveal old private process', videoUrl: '', images: [], coverUrl: '', modelUrl: '' };
await bucket.put(`versions/${accountPrivateId}/${accountSecretVersion}.json`, JSON.stringify(accountBase));
const accountMeta = { schema: 2, id: accountPrivateId, ownerId: 'old-platform-owner', profileSlug: 'old-account-profile', createdAt: '2026-10-25', updatedAt: '2026-10-25', revision: 1, versionIds: [accountSecretVersion], latestVersionId: accountSecretVersion, displayVersionId: null, publicVersionIds: [], importantVersionIds: [] };
await bucket.put(`records/${accountPrivateId}.json`, JSON.stringify(accountMeta));
await bucket.put(`versions/${accountPublicId}/${accountPublicVersion}.json`, JSON.stringify({ ...accountBase, id: accountPublicVersion, number: 1, title: 'old published content', fileUrl: '', fileName: '', process: 'old private process', storageKeys: [] }));
await bucket.put(`versions/${accountPublicId}/${accountSecretVersion}.json`, JSON.stringify({ ...accountBase, videoUrl: '/api/' + accountSecretFile, storageKeys: [accountSecretFile] }));
await bucket.put(`records/${accountPublicId}.json`, JSON.stringify({ ...accountMeta, id: accountPublicId, versionIds: [accountPublicVersion, accountSecretVersion], latestVersionId: accountSecretVersion, displayVersionId: accountPublicVersion }));
for (const cookie of ['', jars.get('creator-1'), jars.get('creator-2')]) {
  const forged = { Cookie: cookie, 'oai-authenticated-user-id': 'old-platform-owner', Origin: 'https://portfolio.test' };
  assert.equal((await call('/api/works/' + accountPrivateId, { headers: forged })).status, 404);
  assert.equal((await call('/api/' + accountPrivateFile, { headers: { ...forged, Range: 'bytes=0-1' } })).status, 404);
  assert.equal((await call('/api/' + accountSecretFile, { method: 'HEAD', headers: forged })).status, 404);
  const oldPublic = await read(await call('/api/works/' + accountPublicId, { headers: forged })); assert.equal(oldPublic.isOwner, false); assert.equal(oldPublic.versions.length, 1); assert.equal(oldPublic.work.process, ''); assert.equal(JSON.stringify(oldPublic).includes(accountSecretVersion), false);
}
assert.equal((await get('/api/works?scope=mine', 'creator-1')).works.some(value => value.id === accountPrivateId || value.id === accountPublicId || value.id === legacyId), false);
assert.equal(new TextDecoder().decode(bucket.data.get('records/' + legacyId + '.json').bytes), retainedLegacyBytes);
checks += 29;

// Unknown or mixed schemas are not v1 public uploads. Neither lists nor detail
// may reveal a private ID/title by opportunistically calling the legacy adapter.
const unknownId = crypto.randomUUID(), unknownRecordKey = `records/${unknownId}.json`;
for (const unknown of [
  { ...accountMeta, id: unknownId, schema: 3, title: 'schema-three-private-content', fileUrl: '', images: [] },
  { ...accountMeta, id: unknownId, schema: undefined, title: 'mixed-private-index', fileUrl: '', images: [] },
  { id: unknownId, ownerId: 'old-platform-owner', title: 'private-visibility-marker', fileUrl: '', images: [], visibility: 'private' },
  { ...accountMeta, id: unknownId, schema: 2, publicVersionIds: ['not-a-real-version'] },
]) {
  await bucket.put(unknownRecordKey, JSON.stringify(unknown));
  for (const path of ['/api/works', '/api/works/' + unknownId]) {
    const response = await read(await call(path), 503); assert.equal(response.code, 'record_storage_unavailable'); assert.equal(JSON.stringify(response).includes(unknownId), false); assert.equal(JSON.stringify(response).includes(unknown.title || 'never-a-match'), false);
  }
}
await bucket.delete(unknownRecordKey);
checks += 24;

// CAS conflicts and failed writes leave no phantom versions or leaked uploads.
const staleRevision = work.revision;
detail = await read(await save(work, { description: '新的私密改动' })); work = detail.work;
assert.equal((await sendJson('/api/works/' + id, 'PUT', { baseRevision: staleRevision, description: 'stale' })).status, 409);
const originalError = console.error; console.error = () => {};
let beforeFailure = keys(); bucket.failPrefix = 'records/';
const failedCreate = await postForm(); bucket.failPrefix = ''; assert.equal(failedCreate.status, 500); assert.deepEqual(keys(), beforeFailure);
beforeFailure = keys(); bucket.failPrefix = 'versions/';
const failedVersion = await postForm(); bucket.failPrefix = ''; assert.equal(failedVersion.status, 500); assert.deepEqual(keys(), beforeFailure);
beforeFailure = keys(); bucket.rejectNextRecordWrite = true;
const rejected = await postForm(); assert.equal(rejected.status, 409); assert.deepEqual(keys(), beforeFailure);
console.error = originalError;
bucket.failAfterNextRecordWrite = true;
const recoveredCommit = await read(await postForm(), 201);
assert.equal((await get('/api/works/' + recoveredCommit.work.id, 'creator-1')).work.versionId, recoveredCommit.work.versionId);
assert.equal((await call(recoveredCommit.work.fileUrl, { headers: headers() })).status, 200, 'uncertain commit response must not delete already committed files');
const simultaneous = await Promise.all([save(work, { description: '同时保存 A' }), save(work, { description: '同时保存 B' })]);
assert.deepEqual(simultaneous.map((r) => r.status).sort(), [200, 409]);
detail = await get('/api/works/' + id, 'creator-1');
assert.equal(detail.work.versionCount, work.versionCount + 1);
const versionObjects = [...bucket.data.keys()].filter((key) => key.startsWith('versions/' + id + '/'));
assert.equal(versionObjects.length, detail.work.versionCount);
checks += 11;
checks += 2;

// Deletion removes every saved file and version, and never deletes another author's work.
assert.equal((await call('/api/works/' + id, { method: 'DELETE', headers: headers('creator-2') })).status, 403);
assert.equal((await call('/api/works/' + id, { method: 'DELETE', headers: headers() })).status, 200);
assert.equal((await call('/api/works/' + id, { headers: headers() })).status, 404);
assert.equal([...bucket.data.keys()].some((key) => key.startsWith('files/' + id + '/') || key.startsWith('versions/' + id + '/')), false);
assert.equal((await call(model)).status, 404); assert.equal((await call(privateVideo)).status, 404);
assert.equal((await call('/api/works/' + legacyId, { method: 'DELETE', headers: headers() })).status, 403); assert.equal(bucket.data.has(legacyFile), true);
assert.equal(bucket.data.has(`records/${accountPrivateId}.json`), true); assert.equal(bucket.data.has(accountPrivateFile), true);
assert.equal((await call('/api/works/' + other.work.id, { headers: headers('creator-2') })).status, 200);
checks += 9;
console.log(`PASS: ${checks} meaningful checks — HttpOnly cookie workspaces, ignored forged identity headers, CSRF, expiry, independent profiles, private saves, curated publication, immutable versions/finals, file authorization, media ranges, retained unclaimed account data, validation, pagination, CAS conflicts and rollback.`);
