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
const headers = (id = 'creator-1') => ({ 'oai-authenticated-user-id': id, Origin: 'https://portfolio.test', 'oai-authenticated-user-full-name': encodeURIComponent(id === 'creator-1' ? '创作者一' : '创作者二'), 'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8' });
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

// Authenticated writes and personal spaces.
assert.equal((await call('/api/works', { method: 'POST', body: createForm() })).status, 401);
assert.equal((await call('/api/works', { method: 'POST', headers: { ...headers(), Origin: 'https://evil.test' }, body: createForm() })).status, 403);
assert.equal((await call('/api/works', { method: 'POST', headers: { ...headers(), 'Sec-Fetch-Site': 'cross-site' }, body: createForm() })).status, 403);
assert.equal((await call('/api/works?scope=mine')).status, 401);
assert.deepEqual(await get('/api/me'), { user: null, profile: null });
const me = await get('/api/me', 'creator-1');
assert.equal(me.profile.displayName, '创作者一'); assert.ok(!me.profile.slug.includes('creator-1')); assert.equal('ownerId' in me.profile, false);
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

// Legacy public records remain public; first edit upgrades their history without publishing new private files.
const legacyId = crypto.randomUUID(), legacyFile = `files/${legacyId}/source.max`;
await bucket.put(legacyFile, 'legacy original', { customMetadata: { name: '旧工程.max' } });
await bucket.put('records/' + legacyId + '.json', JSON.stringify({ id: legacyId, ownerId: 'creator-1', title: '旧家具', category: '家具设计', tags: ['木质'], date: '2026-10-25', fileUrl: '/api/' + legacyFile, fileName: '旧工程.max', fileSize: 15, format: 'MAX', images: [], storageKeys: [legacyFile] }));
let legacy = await get('/api/works/' + legacyId);
assert.equal(legacy.work.direction, '三维'); assert.ok(legacy.work.tags.includes('家具设计')); assert.equal((await call('/api/' + legacyFile)).status, 200);
legacy = await get('/api/works/' + legacyId, 'creator-1');
const legacyUpdate = new FormData(); legacyUpdate.set('baseRevision', String(legacy.work.revision)); legacyUpdate.set('source', new File(['new private native'], '新工程.max')); legacyUpdate.set('process', 'legacy private process');
legacy = await read(await call('/api/works/' + legacyId, { method: 'PUT', headers: headers(), body: legacyUpdate }));
assert.equal(legacy.versions.length, 2); assert.equal(legacy.work.displayVersionId, 'legacy'); assert.equal((await call(legacy.work.fileUrl)).status, 404);
assert.equal((await get('/api/works/' + legacyId)).work.fileName, '旧工程.max');
assert.equal((await get('/api/works/' + legacyId, 'creator-1')).versions[0].fileUrl, '/api/' + legacyFile);
checks += 8;

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
assert.equal((await call('/api/works/' + legacyId, { method: 'DELETE', headers: headers() })).status, 200); assert.equal(bucket.data.has(legacyFile), false);
assert.equal((await call('/api/works/' + other.work.id, { headers: headers('creator-2') })).status, 200);
checks += 9;
console.log(`PASS: ${checks} meaningful checks — independent profiles, private saves, curated publication, immutable versions/finals, file authorization, media ranges, legacy migration, validation, pagination, CAS conflicts and rollback.`);
