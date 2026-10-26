import { DIRECTIONS } from '../shared/portfolio.ts';
import type { Direction, Profile, Snapshot, User, Version, Work, WorkResponse } from '../shared/portfolio.ts';

type LegacyWork = Record<string, any>;
type Identity = { id: string; name: string };
type BrowserSession = { tokenHash: string; ownerId: string; createdAt: number; expiresAt: number };
type VerifiedSession = { user: Identity; record: BrowserSession; etag: string; token: string };
type Env = { BUCKET?: R2Bucket };
type StoredProfile = Profile & { ownerId: string };
type StoredVersion = Snapshot & { id: string; number: number; savedAt: string; storageKeys: string[] };
type RecordMeta = {
  schema: 2; id: string; ownerId: string; profileSlug: string;
  createdAt: string; updatedAt: string; revision: number;
  versionIds: string[]; latestVersionId: string; displayVersionId: string | null;
  publicVersionIds: string[]; importantVersionIds: string[];
};
type Loaded = { meta: RecordMeta; etag: string; legacyVersion?: StoredVersion; builtIn?: boolean };
type Context = { bucket: R2Bucket; user: Identity | null; session: VerifiedSession | null; builtins: LegacyWork[]; profiles: Map<string, Profile>; versions: Map<string, StoredVersion> };
type Input = { get: (key: string) => unknown; has: (key: string) => boolean; files: (key: string) => File[] };

const MAX_TOTAL = 40 * 1024 * 1024;
const MAX_IMAGE = 12 * 1024 * 1024;
const MAX_JSON = 128 * 1024;
const MAX_VERSIONS = 500;
const SESSION_COOKIE = '__Host-changxu_workspace';
const DEV_SESSION_COOKIE = 'changxu_workspace';
const SESSION_SECONDS = 365 * 24 * 60 * 60;
const RENEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const WORKSPACE_ID = /^workspace-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const FILE_KEY = /^[a-f0-9-]{36}\/(?:[a-f0-9-]{36}\/)?(?:source|model|image-\d+|video|demo-video|audio)\.[a-z0-9]+$/;
const SOURCE_EXTS = new Set(['max', 'blend', 'fbx', 'obj', 'stl', 'glb', 'gltf', 'zip']);
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif']);
const VIDEO_EXTS = new Set(['mp4', 'webm']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'm4a']);
const MODEL_EXTS = new Set(['glb', 'obj', 'stl']);
const LEGACY_3D = new Set(['产品设计', '家具设计', '空间建筑']);
const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif',
  glb: 'model/gltf-binary', gltf: 'model/gltf+json', obj: 'text/plain; charset=utf-8', stl: 'model/stl',
  mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
};
const SYSTEM_PROFILE: Profile = { slug: 'wenxin-exhibits', displayName: '长序 · 系统展品', bio: '从真实三维工程收录的展示作品。', createdAt: '2026-10-25T00:00:00.000Z', updatedAt: '2026-10-25T00:00:00.000Z', system: true };

class ApiFailure extends Error {
  status: number; code?: string;
  constructor(status: number, message: string, code?: string) { super(message); this.status = status; this.code = code; }
}
const fail = (status: number, message: string, code?: string): never => { throw new ApiFailure(status, message, code); };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Cookie' } });
const ext = (name: string) => name.split('.').pop()?.toLowerCase() || '';
const versionKey = (workId: string, versionId: string) => `versions/${workId}/${versionId}.json`;

async function sha256(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function loopbackDevelopment(url: URL) {
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname.toLowerCase());
}
function cookieToken(request: Request): string | null {
  const url = new URL(request.url);
  if (url.protocol !== 'https:' && !loopbackDevelopment(url)) return null;
  const name = url.protocol === 'https:' ? SESSION_COOKIE : DEV_SESSION_COOKIE;
  const matches = (request.headers.get('Cookie') || '').split(';').map((part) => part.trim()).filter((part) => part.startsWith(name + '='));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
async function identity(request: Request, bucket: R2Bucket): Promise<VerifiedSession | null> {
  // Header identity, client owner IDs and local preview sign-in cookies are
  // deliberately ignored. Only a server-issued, hash-verified bearer is proof.
  const token = cookieToken(request);
  if (!token) return null;
  const hash = await sha256(token);
  const object = await bucket.get('sessions/' + hash + '.json');
  if (!object) return null;
  let session: BrowserSession;
  try { session = await object.json<BrowserSession>(); } catch { return fail(503, '浏览器空间凭据暂时无法读取，请保留 Cookie 并稍后重试。', 'workspace_storage_unavailable'); }
  if (!session || session.tokenHash !== hash || !WORKSPACE_ID.test(session.ownerId) || !Number.isFinite(session.createdAt) || !Number.isFinite(session.expiresAt) || session.expiresAt <= session.createdAt) return fail(503, '浏览器空间凭据校验暂时失败，请保留 Cookie 并稍后重试。', 'workspace_storage_unavailable');
  if (session.expiresAt <= Date.now()) return null;
  return { user: { id: session.ownerId, name: '我的创作空间' }, record: session, etag: object.etag, token };
}
function workspaceRequired(): never {
  return fail(401, '当前浏览器空间尚未准备好，请重新打开空间后再试。', 'workspace_required');
}
async function bootstrapSession(context: Context, request: Request, url: URL) {
  sameOrigin(request, url);
  if (url.protocol !== 'https:' && !loopbackDevelopment(url)) return fail(403, '请通过 HTTPS 打开创作空间；仅本机开发允许 HTTP。');
  if (context.user) {
    const profile = await ensureProfile(context, context.user);
    const response = json({ user: await responseUser(context), profile, created: false, identityMode: 'browser' });
    const verified = context.session;
    // Align the browser's remaining lifetime even if an earlier renewal reply
    // was lost. This never rotates the token or extends the server expiry by itself.
    if (verified) response.headers.set('Set-Cookie', sessionCookie(url, verified.token, Math.max(1, Math.floor((verified.record.expiresAt - Date.now()) / 1000))));
    if (verified && verified.record.expiresAt - Date.now() < RENEW_WINDOW_MS) {
      const extended = { ...verified.record, expiresAt: Date.now() + SESSION_SECONDS * 1000 };
      const key = 'sessions/' + extended.tokenHash + '.json';
      const saved = await context.bucket.put(key, JSON.stringify(extended), { onlyIf: { etagMatches: verified.etag }, httpMetadata: { contentType: 'application/json' } });
      if (!saved) {
        // Another tab can extend the same token first. It may not substitute
        // another owner or force a new empty workspace during that race.
        const current = await context.bucket.get(key);
        const latest = current ? await current.json<BrowserSession>() : null;
        if (!latest || latest.ownerId !== verified.record.ownerId || latest.tokenHash !== verified.record.tokenHash || latest.expiresAt <= Date.now()) return fail(409, '空间凭据刚刚变化，请重新打开空间后重试。');
        response.headers.set('Set-Cookie', sessionCookie(url, verified.token, Math.max(1, Math.floor((latest.expiresAt - Date.now()) / 1000))));
      } else response.headers.set('Set-Cookie', sessionCookie(url, verified.token));
    }
    return response;
  }
  const secret = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const tokenHash = await sha256(secret);
  const now = Date.now();
  const session: BrowserSession = { tokenHash, ownerId: 'workspace-' + crypto.randomUUID(), createdAt: now, expiresAt: now + SESSION_SECONDS * 1000 };
  const key = 'sessions/' + tokenHash + '.json';
  const stored = await context.bucket.put(key, JSON.stringify(session), { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/json' } });
  if (!stored) return fail(503, '浏览器空间暂时无法建立，请重试。');
  context.user = { id: session.ownerId, name: '我的创作空间' };
  try {
    const profile = await ensureProfile(context, context.user);
    const response = json({ user: await responseUser(context), profile, created: true, identityMode: 'browser' });
    response.headers.set('Set-Cookie', sessionCookie(url, secret));
    return response;
  } catch (error) {
    try { await context.bucket.delete(key); } catch { /* No token was sent; unreachable session metadata can be cleaned later. */ }
    throw error;
  }
}
function sessionCookie(url: URL, secret: string, maxAge = SESSION_SECONDS) {
  const secure = url.protocol === 'https:';
  return `${secure ? SESSION_COOKIE : DEV_SESSION_COOKIE}=${secret}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

async function userSlug(id: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id)));
  return 'wen-' + Array.from(bytes.slice(0, 10), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function publicProfile(profile: StoredProfile | Profile): Profile {
  return { slug: profile.slug, displayName: profile.displayName, bio: profile.bio, createdAt: profile.createdAt, updatedAt: profile.updatedAt, ...(profile.system ? { system: true } : {}) };
}
async function ensureProfile(context: Context, user: Identity): Promise<Profile> {
  const slug = await userSlug(user.id);
  const cached = context.profiles.get(slug);
  if (cached) return cached;
  const key = 'profiles/' + slug + '.json';
  const object = await context.bucket.get(key);
  if (object) {
    const stored = await object.json<StoredProfile>();
    if (stored.ownerId !== user.id) return fail(409, '个人空间标识冲突，请稍后重试。');
    const profile = publicProfile(stored); context.profiles.set(slug, profile); return profile;
  }
  const now = new Date().toISOString();
  const profile: StoredProfile = { slug, displayName: user.name, bio: '', createdAt: now, updatedAt: now, ownerId: user.id };
  const saved = await context.bucket.put(key, JSON.stringify(profile), { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/json' } });
  if (!saved) {
    const existing = await context.bucket.get(key);
    if (!existing) return fail(409, '个人空间正在创建，请重试。');
    const stored = await existing.json<StoredProfile>();
    if (stored.ownerId !== user.id) return fail(409, '个人空间标识冲突。');
    const result = publicProfile(stored); context.profiles.set(slug, result); return result;
  }
  const result = publicProfile(profile); context.profiles.set(slug, result); return result;
}
async function responseUser(context: Context): Promise<User> {
  if (!context.user) return null;
  const slug = await userSlug(context.user.id);
  let profile = context.profiles.get(slug);
  if (!profile) {
    const object = await context.bucket.get('profiles/' + slug + '.json');
    if (object) {
      const stored = await object.json<StoredProfile>();
      if (stored.ownerId !== context.user.id) return fail(409, '浏览器空间资料校验失败，请稍后重试。');
      profile = publicProfile(stored); context.profiles.set(slug, profile);
    }
  }
  return { ...context.user, ...(profile ? { profile } : {}), identityMode: 'browser' };
}
async function authorFor(context: Context, loaded: Loaded): Promise<Profile> {
  if (loaded.builtIn) return SYSTEM_PROFILE;
  const cached = context.profiles.get(loaded.meta.profileSlug);
  if (cached) return cached;
  const stored = await context.bucket.get('profiles/' + loaded.meta.profileSlug + '.json');
  const profile: Profile = stored ? publicProfile(await stored.json<StoredProfile>()) : { slug: loaded.meta.profileSlug, displayName: '创作者', bio: '', createdAt: loaded.meta.createdAt, updatedAt: loaded.meta.createdAt };
  context.profiles.set(profile.slug, profile); return profile;
}

function normalizeTags(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[,，]/) : [];
  return [...new Set(values.map((tag) => String(tag).normalize('NFC').trim().slice(0, 24)).filter(Boolean))].slice(0, 8);
}
function legacySnapshot(old: LegacyWork): Snapshot {
  const previousCategory = String(old.category || '其他创作');
  const direction: Direction = (DIRECTIONS as readonly string[]).includes(old.direction) ? old.direction : LEGACY_3D.has(previousCategory) || old.builtIn ? '三维' : '其他';
  return {
    title: String(old.title || '未命名作品'), direction, category: direction,
    tags: normalizeTags([...((previousCategory && !(DIRECTIONS as readonly string[]).includes(previousCategory)) ? [previousCategory] : []), ...(Array.isArray(old.tags) ? old.tags : [])]),
    subtitle: String(old.subtitle || ''), description: String(old.description || ''), contentText: '', process: '', difficulties: '', solutions: '', reflection: '', status: 'in-progress',
    fileName: String(old.fileName || ''), fileSize: Number(old.fileSize || 0), fileUrl: String(old.fileUrl || ''), format: String(old.format || ''),
    modelUrl: String(old.modelUrl || ''), coverUrl: String(old.coverUrl || ''), images: Array.isArray(old.images) ? old.images.filter((item: unknown) => typeof item === 'string') : [],
    videoUrl: '', audioUrl: '', demoVideoUrl: '', interactiveUrl: '', allowSourceDownload: true,
    ...(old.objects !== undefined ? { objects: old.objects } : {}), ...(old.dimensions ? { dimensions: old.dimensions } : {}),
    ...(old.triangles !== undefined ? { triangles: old.triangles } : {}), ...(old.materialNote ? { materialNote: old.materialNote } : {}),
  };
}
async function fromLegacy(old: LegacyWork, etag: string, builtIn = false): Promise<Loaded> {
  const savedAt = String(old.date || new Date(0).toISOString());
  const legacyVersion: StoredVersion = { ...legacySnapshot(old), id: builtIn ? 'builtin' : 'legacy', number: 1, savedAt, storageKeys: Array.isArray(old.storageKeys) ? old.storageKeys : [] };
  // v1 uploads were public by contract; preserve their existing presentation.
  // This never grants their historical account owner to a new browser space.
  return { etag, builtIn, legacyVersion, meta: { schema: 2, id: String(old.id), ownerId: builtIn ? '__system__' : String(old.ownerId || ''), profileSlug: builtIn ? SYSTEM_PROFILE.slug : await userSlug(String(old.ownerId || 'unassigned-legacy')), createdAt: savedAt, updatedAt: savedAt, revision: 1, versionIds: [legacyVersion.id], latestVersionId: legacyVersion.id, displayVersionId: legacyVersion.id, publicVersionIds: [], importantVersionIds: [] } };
}
async function loadRecord(context: Context, id: string): Promise<Loaded | null> {
  const builtin = context.builtins.find((work) => work.id === id);
  if (builtin) return fromLegacy({ ...builtin, builtIn: true }, '', true);
  if (!UUID.test(id)) return null;
  const object = await context.bucket.get('records/' + id + '.json');
  if (!object) return null;
  let stored: LegacyWork;
  try { stored = await object.json<LegacyWork>(); } catch { return fail(503, '作品记录暂时无法读取，请稍后重试。', 'record_storage_unavailable'); }
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return fail(503, '作品记录格式暂时无法识别。', 'record_storage_unavailable');
  if (stored.schema === 2) {
    const versions = stored.versionIds;
    const validIds = Array.isArray(versions) && versions.length > 0 && versions.every((value: unknown) => typeof value === 'string' && (UUID.test(value) || value === 'legacy')) && new Set(versions).size === versions.length;
    const subset = (values: unknown) => Array.isArray(values) && values.every((value) => typeof value === 'string' && versions.includes(value));
    if (!validIds || stored.id !== id || typeof stored.ownerId !== 'string' || !stored.ownerId || typeof stored.profileSlug !== 'string' || !/^[a-z0-9-]{3,64}$/.test(stored.profileSlug) || !Number.isSafeInteger(stored.revision) || stored.revision < 1 || !versions.includes(stored.latestVersionId) || (stored.displayVersionId !== null && !versions.includes(stored.displayVersionId)) || !subset(stored.publicVersionIds) || !subset(stored.importantVersionIds) || typeof stored.createdAt !== 'string' || typeof stored.updatedAt !== 'string') return fail(503, '作品版本索引暂时无法识别，请稍后重试。', 'record_storage_unavailable');
    return { meta: stored as RecordMeta, etag: object.etag };
  }
  const legacyShape = (stored.schema === undefined || stored.schema === 1) && !['versionIds', 'latestVersionId', 'displayVersionId', 'publicVersionIds', 'importantVersionIds', 'visibility', 'isPublic', 'private', 'publishedVersionId', 'currentVersionId'].some((key) => Object.hasOwn(stored, key)) && stored.id === id && typeof stored.ownerId === 'string' && !!stored.ownerId && typeof stored.title === 'string' && (typeof stored.fileUrl === 'string' || Array.isArray(stored.images));
  if (!legacyShape) return fail(503, '该作品的数据版本暂不受支持，已保留原始记录。', 'record_storage_unavailable');
  return fromLegacy({ ...stored, id }, object.etag);
}
async function loadVersion(context: Context, loaded: Loaded, id: string): Promise<StoredVersion> {
  if (!loaded.meta.versionIds.includes(id)) return fail(404, '版本不存在。');
  if (loaded.legacyVersion?.id === id) return loaded.legacyVersion;
  const key = versionKey(loaded.meta.id, id);
  const cached = context.versions.get(key);
  if (cached) return cached;
  const object = await context.bucket.get(key);
  if (!object) return fail(503, '该版本暂时无法读取，请稍后重试。');
  const version = await object.json<StoredVersion>(); context.versions.set(key, version); return version;
}
function owner(context: Context, loaded: Loaded) { return !loaded.builtIn && !!context.user && context.user.id === loaded.meta.ownerId; }
function publicIds(loaded: Loaded) {
  return loaded.meta.displayVersionId ? loaded.meta.versionIds.filter((id) => id === loaded.meta.displayVersionId || loaded.meta.publicVersionIds.includes(id)) : [];
}
function snapshotFor(version: StoredVersion, loaded: Loaded, isOwner: boolean): Snapshot {
  const { id: _id, number: _number, savedAt: _savedAt, storageKeys: _keys, ...snapshot } = version;
  if (isOwner) return snapshot;
  const result = { ...snapshot };
  if (!result.allowSourceDownload) { result.fileUrl = ''; result.fileName = ''; result.fileSize = 0; }
  if (!loaded.meta.publicVersionIds.includes(version.id)) { result.process = ''; result.difficulties = ''; result.solutions = ''; result.reflection = ''; }
  return result;
}
async function workFor(context: Context, loaded: Loaded, version: StoredVersion, forcePublic = false): Promise<Work> {
  const isOwner = owner(context, loaded);
  const privateView = isOwner && !forcePublic;
  const meta = loaded.meta;
  return { ...snapshotFor(version, loaded, privateView), id: meta.id, date: version.savedAt, createdAt: meta.createdAt, updatedAt: privateView ? meta.updatedAt : version.savedAt,
    revision: privateView ? meta.revision : 0, versionId: version.id, versionNumber: privateView ? version.number : Math.max(1, publicIds(loaded).indexOf(version.id) + 1), versionCount: privateView ? meta.versionIds.length : publicIds(loaded).length,
    ...(privateView ? { latestVersionId: meta.latestVersionId, publicVersionIds: meta.publicVersionIds, importantVersionIds: meta.importantVersionIds, ownerId: meta.ownerId } : {}),
    displayVersionId: meta.displayVersionId, visibility: meta.displayVersionId ? 'public' : 'private', isOwner, author: await authorFor(context, loaded), builtIn: !!loaded.builtIn };
}
async function detailFor(context: Context, loaded: Loaded, selected?: string): Promise<WorkResponse> {
  const isOwner = owner(context, loaded);
  const ids = isOwner ? loaded.meta.versionIds : publicIds(loaded);
  if (!ids.length) return fail(404, '作品不存在或尚未公开。');
  const selectedId = selected || (isOwner ? loaded.meta.latestVersionId : loaded.meta.displayVersionId!);
  if (!ids.includes(selectedId)) return fail(404, '该版本不存在或尚未公开。');
  const stored = await Promise.all(ids.map((id) => loadVersion(context, loaded, id)));
  const versions: Version[] = stored.map((version, index) => ({ ...snapshotFor(version, loaded, isOwner), id: version.id, number: isOwner ? version.number : index + 1, savedAt: version.savedAt, important: loaded.meta.importantVersionIds.includes(version.id), isPublic: loaded.meta.publicVersionIds.includes(version.id) }));
  const selectedVersion = stored.find((version) => version.id === selectedId)!;
  return { work: await workFor(context, loaded, selectedVersion), versions, user: await responseUser(context), isOwner };
}
async function allRecords(context: Context): Promise<Loaded[]> {
  const records: Loaded[] = []; let cursor: string | undefined;
  do {
    const page = await context.bucket.list({ prefix: 'records/', limit: 100, cursor });
    for (let offset = 0; offset < page.objects.length; offset += 10) {
      const batch = await Promise.all(page.objects.slice(offset, offset + 10).map((item) => loadRecord(context, item.key.slice(8, -5))));
      records.push(...batch.filter((record): record is Loaded => record !== null));
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return records;
}

function sameOrigin(request: Request, url: URL) {
  const origin = request.headers.get('Origin');
  if (origin !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') fail(403, '请从本网站保存作品。');
}
async function parseInput(request: Request): Promise<Input> {
  const contentType = request.headers.get('Content-Type') || '';
  const isJson = /^application\/json(?:\s*;|$)/i.test(contentType);
  const isForm = /^multipart\/form-data\s*;/i.test(contentType);
  if (!isJson && !isForm) return fail(400, '请使用作品表单或 JSON 提交。');
  const max = isJson ? MAX_JSON : MAX_TOTAL + 256 * 1024;
  if (Number(request.headers.get('Content-Length')) > max) return fail(413, isJson ? '文字内容过大，请适当精简。' : '本次新上传文件合计不能超过 40 MB。');
  if (!request.body) return fail(400, '提交内容为空。');
  let received = 0, exceeded = false;
  const limited = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, controller) { received += chunk.byteLength; if (received > max) { exceeded = true; throw new Error('body_too_large'); } controller.enqueue(chunk); } }));
  try {
    const response = new Response(limited, { headers: { 'Content-Type': contentType } });
    if (isJson) {
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || Array.isArray(data)) return fail(400, '提交内容格式不正确。');
      const object = data as Record<string, unknown>;
      return { get: (key) => object[key], has: (key) => Object.hasOwn(object, key), files: () => [] };
    }
    const form = await response.formData();
    return { get: (key) => form.get(key), has: (key) => form.has(key), files: (key) => form.getAll(key).filter((item): item is File => item instanceof File && item.size > 0) };
  } catch (error) {
    if (error instanceof ApiFailure) throw error;
    return fail(exceeded ? 413 : 400, exceeded ? '提交内容超过大小限制。' : '无法读取提交内容，请重新选择文件。');
  }
}
function text(input: Input, key: string, fallback: string, limit: number) {
  if (!input.has(key)) return fallback;
  const raw = input.get(key);
  if (typeof raw !== 'string') return fail(400, '文字字段格式不正确。');
  const value = raw.trim();
  if (value.length > limit) return fail(400, `${key === 'title' ? '作品名称' : '文字内容'}不能超过 ${limit} 字。`);
  return value;
}
function bool(input: Input, key: string, fallback = false) {
  if (!input.has(key)) return fallback;
  const value = input.get(key);
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0' || value === '') return false;
  return fail(400, '开关字段格式不正确。');
}
function revision(input: Input, key: string, expected: number) {
  if (!input.has(key)) return fail(409, '缺少版本校验信息，请刷新后重试。', 'revision_required');
  const actual = Number(input.get(key));
  if (!Number.isSafeInteger(actual) || actual !== expected) return fail(409, '作品已在其他窗口更新，请刷新后重试。', 'revision_conflict');
}
function httpsUrl(value: string) {
  if (!value) return '';
  let parsed: URL;
  try { parsed = new URL(value); } catch { return fail(400, '体验链接必须是完整的 HTTPS 地址。'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return fail(400, '体验链接仅支持不含账号密码的 HTTPS 地址。');
  return parsed.href;
}
function previewNumber(input: Input, key: string, previous?: number): number | undefined {
  if (!input.has(key)) return previous;
  if (input.get(key) === '' || input.get(key) === null) return undefined;
  const value = Number(input.get(key));
  if (!Number.isFinite(value) || value < 0) return fail(400, '视频预览时间应为零或正数秒。');
  return value;
}
async function validateSignature(file: File, kind: 'image' | 'video' | 'audio') {
  const bytes = new Uint8Array(await file.slice(0, 96).arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  let valid = false;
  switch (ext(file.name)) {
    case 'png': valid = [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n); break;
    case 'jpg': case 'jpeg': valid = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255; break;
    case 'webp': valid = ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'; break;
    case 'gif': valid = ['GIF87a', 'GIF89a'].includes(ascii(0, 6)); break;
    case 'avif': valid = ascii(4, 8) === 'ftyp' && /avif|avis/.test(ascii(8, 96)); break;
    case 'mp4': case 'm4a': valid = ascii(4, 8) === 'ftyp'; break;
    case 'webm': valid = [26, 69, 223, 163].every((n, i) => bytes[i] === n); break;
    case 'mp3': valid = ascii(0, 3) === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224); break;
    case 'wav': valid = ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE'; break;
    case 'ogg': valid = ascii(0, 4) === 'OggS'; break;
  }
  if (!valid) fail(400, `${kind === 'image' ? '图片' : kind === 'video' ? '视频' : '音频'}格式与内容不符，请重新导出后上传。`);
}
function emptySnapshot(): Snapshot {
  return { title: '', direction: '其他', category: '其他', tags: [], subtitle: '', description: '', contentText: '', process: '', difficulties: '', solutions: '', reflection: '', status: 'in-progress', fileName: '', fileSize: 0, fileUrl: '', format: '', modelUrl: '', coverUrl: '', images: [], videoUrl: '', audioUrl: '', demoVideoUrl: '', interactiveUrl: '', allowSourceDownload: false };
}
async function prepareSnapshot(input: Input, previous?: StoredVersion) {
  const base = previous ? { ...previous, images: [...previous.images] } : emptySnapshot();
  const snapshot: Snapshot = { ...base };
  for (const key of ['title', 'subtitle', 'description', 'contentText', 'process', 'difficulties', 'solutions', 'reflection'] as const) {
    snapshot[key] = text(input, key, base[key], key === 'title' ? 80 : key === 'subtitle' ? 200 : key === 'contentText' ? 20000 : 4000);
  }
  if (!snapshot.title) return fail(400, '请填写作品名称。');
  const rawDirection = input.has('direction') ? input.get('direction') : input.has('category') ? input.get('category') : previous?.direction;
  if (typeof rawDirection !== 'string' || !(DIRECTIONS as readonly string[]).includes(rawDirection)) return fail(400, '请选择交互、影视、三维或其他中的一个主方向。');
  snapshot.direction = rawDirection as Direction; snapshot.category = snapshot.direction;
  if (input.has('tags')) snapshot.tags = normalizeTags(input.get('tags'));
  const status = input.has('status') ? input.get('status') : base.status;
  if (status !== 'in-progress' && status !== 'final') return fail(400, '请选择创作中或定稿状态。');
  snapshot.status = status;
  snapshot.allowSourceDownload = bool(input, 'allowSourceDownload', base.allowSourceDownload);
  snapshot.interactiveUrl = httpsUrl(text(input, 'interactiveUrl', base.interactiveUrl, 2048));
  snapshot.previewStart = previewNumber(input, 'previewStart', base.previewStart);
  snapshot.previewEnd = previewNumber(input, 'previewEnd', base.previewEnd);
  if (snapshot.previewEnd !== undefined && snapshot.previewEnd <= (snapshot.previewStart || 0)) return fail(400, '视频预览结束时间应晚于开始时间。');
  const source = input.files('source'), models = input.files('previewModel'), images = input.files('images'), videos = input.files('video'), demos = input.files('demoVideo'), audios = input.files('audio');
  if ([source, models, videos, demos, audios].some((files) => files.length > 1)) return fail(400, '每种源文件或媒体最多选择一个。');
  if (images.length > 8) return fail(400, '最多上传 8 张图片。');
  if (source.some((file) => !SOURCE_EXTS.has(ext(file.name)))) return fail(400, '源文件支持 MAX、BLEND、FBX、OBJ、STL、GLB、GLTF、ZIP。');
  if (models.some((file) => !MODEL_EXTS.has(ext(file.name)))) return fail(400, '网页三维预览文件支持 GLB、OBJ、STL。');
  if (images.some((file) => !IMAGE_EXTS.has(ext(file.name)) || file.size > MAX_IMAGE)) return fail(400, '图片支持 PNG/JPG/WebP/AVIF/GIF，每张不超过 12 MB。');
  if ([...videos, ...demos].some((file) => !VIDEO_EXTS.has(ext(file.name)))) return fail(400, '视频支持 MP4 或 WebM。');
  if (audios.some((file) => !AUDIO_EXTS.has(ext(file.name)))) return fail(400, '音频支持 MP3、WAV、OGG 或 M4A。');
  const all = [...source, ...models, ...images, ...videos, ...demos, ...audios];
  if (all.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL) return fail(413, '本次新上传文件合计不能超过 40 MB。');
  for (const file of images) await validateSignature(file, 'image');
  for (const file of [...videos, ...demos]) await validateSignature(file, 'video');
  for (const file of audios) await validateSignature(file, 'audio');
  if (bool(input, 'clearSource')) { if (snapshot.modelUrl === snapshot.fileUrl) snapshot.modelUrl = ''; snapshot.fileUrl = ''; snapshot.fileName = ''; snapshot.fileSize = 0; snapshot.format = ''; }
  if (bool(input, 'clearImages')) { snapshot.images = []; snapshot.coverUrl = ''; }
  if (bool(input, 'clearModel')) snapshot.modelUrl = '';
  if (bool(input, 'clearVideo')) snapshot.videoUrl = '';
  if (bool(input, 'clearDemoVideo')) snapshot.demoVideoUrl = '';
  if (bool(input, 'clearAudio')) snapshot.audioUrl = '';
  // File inheritance is server-owned. Arbitrary incoming file URLs are never trusted.
  return { snapshot, source: source[0], model: models[0], images, video: videos[0], demo: demos[0], audio: audios[0] };
}
async function saveVersion(context: Context, input: Input, loaded?: Loaded): Promise<Loaded> {
  const user = context.user!;
  if (loaded) {
    if (!owner(context, loaded)) return fail(403, '只能修改自己的作品。');
    revision(input, 'baseRevision', loaded.meta.revision);
    if (loaded.meta.versionIds.length >= MAX_VERSIONS) return fail(400, '这件作品已达到 500 个保存版本，请联系维护者扩容。');
  }
  const previous = loaded ? await loadVersion(context, loaded, loaded.meta.latestVersionId) : undefined;
  const prepared = await prepareSnapshot(input, previous);
  const profile = await ensureProfile(context, user);
  const id = loaded?.meta.id || crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const storedKeys: string[] = [];
  let wroteVersion = false;
  let attemptedMeta: RecordMeta | undefined;
  async function saveFile(file: File, role: string) {
    const key = `files/${id}/${versionId}/${role}.${ext(file.name)}`;
    storedKeys.push(key);
    await context.bucket.put(key, file.stream(), { httpMetadata: { contentType: MIME[ext(file.name)] || 'application/octet-stream' }, customMetadata: { name: file.name.slice(0, 255) } });
    return '/api/' + key;
  }
  try {
    const snapshot = prepared.snapshot;
    if (prepared.source) {
      snapshot.fileUrl = await saveFile(prepared.source, 'source'); snapshot.fileName = prepared.source.name; snapshot.fileSize = prepared.source.size; snapshot.format = ext(prepared.source.name).toUpperCase();
      // Public preview uses its own role/key. The native source URL and original
      // filename never become public merely because a preview was selected.
      snapshot.modelUrl = MODEL_EXTS.has(ext(prepared.source.name)) && !prepared.model ? await saveFile(prepared.source, 'model') : '';
    }
    if (prepared.model) snapshot.modelUrl = await saveFile(prepared.model, 'model');
    if (prepared.images.length) {
      snapshot.images = []; for (let index = 0; index < prepared.images.length; index++) snapshot.images.push(await saveFile(prepared.images[index], `image-${index}`));
      snapshot.coverUrl = snapshot.images[0];
    }
    if (prepared.video) snapshot.videoUrl = await saveFile(prepared.video, 'video');
    if (prepared.demo) snapshot.demoVideoUrl = await saveFile(prepared.demo, 'demo-video');
    if (prepared.audio) snapshot.audioUrl = await saveFile(prepared.audio, 'audio');
    if (input.has('coverUrl')) {
      const requested = text(input, 'coverUrl', '', 2048);
      if (requested && !snapshot.images.includes(requested)) return fail(400, '封面必须来自本次作品的图片。');
      snapshot.coverUrl = requested;
    }
    if (!(snapshot.contentText || snapshot.fileUrl || snapshot.modelUrl || snapshot.images.length || snapshot.videoUrl || snapshot.demoVideoUrl || snapshot.audioUrl || snapshot.interactiveUrl)) return fail(400, '请至少提供文字灵感、图片、文件、音视频或体验链接中的一份内容。');
    if (!snapshot.fileUrl) snapshot.format = snapshot.videoUrl ? 'VIDEO' : snapshot.audioUrl ? 'AUDIO' : snapshot.modelUrl ? ext(snapshot.modelUrl).toUpperCase() : snapshot.interactiveUrl ? 'WEB' : snapshot.images.length ? 'IMAGE' : 'TEXT';
    const version: StoredVersion = { ...snapshot, id: versionId, number: (loaded?.meta.versionIds.length || 0) + 1, savedAt: now, storageKeys: storedKeys };
    if (loaded?.legacyVersion) await context.bucket.put(versionKey(id, loaded.legacyVersion.id), JSON.stringify(loaded.legacyVersion), { httpMetadata: { contentType: 'application/json' } });
    wroteVersion = true;
    await context.bucket.put(versionKey(id, versionId), JSON.stringify(version), { httpMetadata: { contentType: 'application/json' } });
    const meta: RecordMeta = loaded ? { ...loaded.meta, updatedAt: now, revision: loaded.meta.revision + 1, versionIds: [...loaded.meta.versionIds, versionId], latestVersionId: versionId } : {
      schema: 2, id, ownerId: user.id, profileSlug: profile.slug, createdAt: now, updatedAt: now, revision: 1, versionIds: [versionId], latestVersionId: versionId, displayVersionId: null, publicVersionIds: [], importantVersionIds: [],
    };
    attemptedMeta = meta;
    const saved = await context.bucket.put('records/' + id + '.json', JSON.stringify(meta), { onlyIf: loaded ? { etagMatches: loaded.etag } : { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/json' } });
    if (!saved) return fail(409, '作品已在其他窗口更新，本次内容未保存，请刷新后重试。', 'revision_conflict');
    context.versions.set(versionKey(id, versionId), version);
    return { meta, etag: saved.etag };
  } catch (error) {
    if (attemptedMeta) {
      // A transport failure can arrive after the conditional pointer write was
      // committed. Read back before rolling files back, otherwise a successful
      // saved version could be left pointing at deleted blobs.
      try {
        const committed = await context.bucket.get('records/' + id + '.json');
        if (committed) {
          const meta = await committed.json<RecordMeta>();
          if (meta.schema === 2 && meta.versionIds.includes(versionId)) return { meta, etag: committed.etag };
        }
      } catch { throw error; } // Uncertain outcome: preserve content for recovery.
    }
    const cleanup = [...storedKeys, ...(wroteVersion ? [versionKey(id, versionId)] : [])];
    try { if (cleanup.length) await context.bucket.delete(cleanup); } catch { /* Failed leftovers remain inaccessible because no committed record references them. */ }
    throw error;
  }
}
async function updatePublication(context: Context, loaded: Loaded, input: Input) {
  if (!owner(context, loaded)) return fail(403, '只能管理自己的公开节点。');
  revision(input, 'revision', loaded.meta.revision);
  const ids = (key: string, current: string[]) => {
    if (!input.has(key)) return current;
    const values = input.get(key);
    if (!Array.isArray(values) || values.some((id) => typeof id !== 'string' || !loaded.meta.versionIds.includes(id))) return fail(400, '公开或重要节点包含不存在的版本。');
    return [...new Set(values)] as string[];
  };
  const selected = input.has('displayVersionId') ? input.get('displayVersionId') : loaded.meta.displayVersionId;
  if (selected !== null && (typeof selected !== 'string' || !loaded.meta.versionIds.includes(selected))) return fail(400, '请选择存在的公开展示版本。');
  const meta: RecordMeta = { ...loaded.meta, revision: loaded.meta.revision + 1, updatedAt: new Date().toISOString(), displayVersionId: selected as string | null, publicVersionIds: ids('publicVersionIds', loaded.meta.publicVersionIds), importantVersionIds: ids('importantVersionIds', loaded.meta.importantVersionIds) };
  if (loaded.legacyVersion) await context.bucket.put(versionKey(meta.id, loaded.legacyVersion.id), JSON.stringify(loaded.legacyVersion), { httpMetadata: { contentType: 'application/json' } });
  const saved = await context.bucket.put('records/' + meta.id + '.json', JSON.stringify(meta), { onlyIf: { etagMatches: loaded.etag }, httpMetadata: { contentType: 'application/json' } });
  if (!saved) return fail(409, '作品已更新，请刷新后再选择公开节点。', 'revision_conflict');
  return { meta, etag: saved.etag } satisfies Loaded;
}

function authorizedUrls(version: StoredVersion) {
  return [version.modelUrl, version.coverUrl, ...version.images, version.videoUrl, version.demoVideoUrl, version.audioUrl, ...(version.allowSourceDownload ? [version.fileUrl] : [])].filter(Boolean);
}
async function fileResponse(context: Context, request: Request, path: string) {
  if (!['GET', 'HEAD'].includes(request.method)) return fail(405, '不支持该请求方式。');
  let key: string;
  try { key = decodeURIComponent(path.slice('/api/files/'.length)); } catch { return fail(404, '文件不存在。'); }
  if (!FILE_KEY.test(key) || !UUID.test(key.split('/')[0])) return fail(404, '文件不存在。');
  const loaded = await loadRecord(context, key.split('/')[0]);
  if (!loaded) return fail(404, '文件不存在或尚未公开。');
  if (!owner(context, loaded)) {
    let authorized = false;
    const url = '/api/files/' + key;
    for (const id of publicIds(loaded)) { if (authorizedUrls(await loadVersion(context, loaded, id)).includes(url)) { authorized = true; break; } }
    if (!authorized) return fail(404, '文件不存在或尚未公开。');
  }
  const storageKey = 'files/' + key;
  const head = await context.bucket.head(storageKey);
  if (!head) return fail(404, '文件不存在。');
  const headers = new Headers({ 'Content-Type': MIME[ext(key)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'Accept-Ranges': 'bytes', 'Content-Length': String(head.size), ETag: head.httpEtag });
  if (/\/source\./.test(key)) headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent((head.customMetadata?.name || key.split('/').pop()!).replace(/[\r\n]/g, ''))}`);
  if (request.method === 'HEAD') return new Response(null, { headers });
  let offset = 0, length = head.size, partial = false;
  const range = request.headers.get('Range');
  if (range && (!request.headers.has('If-Range') || request.headers.get('If-Range') === head.httpEtag)) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    let valid = !!match && (!!match[1] || !!match[2]);
    if (valid && match) {
      if (!match[1]) { const suffix = Number(match[2]); valid = Number.isSafeInteger(suffix) && suffix > 0; length = Math.min(suffix, head.size); offset = head.size - length; }
      else { offset = Number(match[1]); const end = match[2] ? Number(match[2]) : head.size - 1; valid = Number.isSafeInteger(offset) && Number.isSafeInteger(end) && offset >= 0 && offset < head.size && end >= offset; length = Math.min(end, head.size - 1) - offset + 1; }
      valid = valid && head.size > 0;
    }
    if (!valid) { headers.set('Content-Range', `bytes */${head.size}`); headers.set('Content-Length', '0'); return new Response(null, { status: 416, headers }); }
    partial = true; headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${head.size}`); headers.set('Content-Length', String(length));
  }
  const object = await context.bucket.get(storageKey, partial ? { range: { offset, length } } : undefined);
  if (!object) return fail(404, '文件不存在。');
  return new Response(object.body, { status: partial ? 206 : 200, headers });
}

export async function handleApi(request: Request, env: Env, builtins: LegacyWork[] = []): Promise<Response> {
  const url = new URL(request.url), path = url.pathname;
  try {
    if (!env.BUCKET) return fail(503, '作品存储暂时不可用，请稍后重试。');
    const session = await identity(request, env.BUCKET), user = session?.user || null;
    const context: Context = { bucket: env.BUCKET, user, session, builtins, profiles: new Map(), versions: new Map() };
    if (path === '/api/session' && request.method === 'POST') return await bootstrapSession(context, request, url);
    if (path.startsWith('/api/files/')) return await fileResponse(context, request, path);
    if (path === '/api/me' && request.method === 'GET') { const current = await responseUser(context); return json({ user: current, profile: current?.profile || null }); }
    if (path === '/api/me/profile' && request.method === 'PATCH') {
      if (!user) return workspaceRequired(); sameOrigin(request, url);
      const profile = await ensureProfile(context, user), input = await parseInput(request);
      const displayName = text(input, 'displayName', profile.displayName, 80), bio = text(input, 'bio', profile.bio, 600);
      if (!displayName) return fail(400, '请填写个人空间名称。');
      const key = 'profiles/' + profile.slug + '.json', object = await context.bucket.get(key);
      if (!object) return fail(409, '个人资料已变化，请刷新重试。');
      const updated: StoredProfile = { ...profile, displayName, bio, updatedAt: new Date().toISOString(), ownerId: user.id };
      const saved = await context.bucket.put(key, JSON.stringify(updated), { onlyIf: { etagMatches: object.etag }, httpMetadata: { contentType: 'application/json' } });
      if (!saved) return fail(409, '个人资料已变化，请刷新重试。');
      context.profiles.set(profile.slug, publicProfile(updated)); return json({ profile: publicProfile(updated), user: await responseUser(context) });
    }
    const profileMatch = /^\/api\/profiles\/([a-z0-9-]{3,64})$/.exec(path);
    if ((path === '/api/works' || profileMatch) && request.method === 'GET') {
      const mine = !profileMatch && url.searchParams.get('scope') === 'mine';
      if (mine && !user) return workspaceRequired();
      const current = await responseUser(context);
      const requestedProfile = profileMatch?.[1] || url.searchParams.get('profile');
      const records = await allRecords(context);
      if (!mine) for (const builtin of builtins) records.push(await fromLegacy({ ...builtin, builtIn: true }, '', true));
      let profile: Profile | null = mine ? current?.profile || null : null;
      if (requestedProfile) {
        if (requestedProfile === SYSTEM_PROFILE.slug) profile = SYSTEM_PROFILE;
        else {
          const object = await context.bucket.get('profiles/' + requestedProfile + '.json');
          if (object) profile = publicProfile(await object.json<StoredProfile>());
          else { const legacy = records.find((record) => record.meta.profileSlug === requestedProfile); if (legacy) profile = await authorFor(context, legacy); }
        }
        if (!profile) return fail(404, '这个个人空间暂不存在。');
      }
      const chosen = records.filter((record) => (mine ? owner(context, record) : !!record.meta.displayVersionId) && (!requestedProfile || record.meta.profileSlug === requestedProfile));
      const works: Work[] = [];
      for (let offset = 0; offset < chosen.length; offset += 10) {
        works.push(...await Promise.all(chosen.slice(offset, offset + 10).map(async (record) => workFor(context, record, await loadVersion(context, record, mine ? record.meta.latestVersionId : record.meta.displayVersionId!), !mine))));
      }
      works.sort((a, b) => b.date.localeCompare(a.date));
      return json(profileMatch ? { profile, works, user: current, isOwner: !!current?.profile && current.profile.slug === profile?.slug } : { works, user: current, profile });
    }
    const workMatch = /^\/api\/works\/([^/]+)(?:\/(publication))?$/.exec(path);
    if (workMatch && !workMatch[2] && request.method === 'GET') {
      const loaded = await loadRecord(context, workMatch[1]); if (!loaded) return fail(404, '作品不存在或尚未公开。');
      return json(await detailFor(context, loaded, url.searchParams.get('version') || undefined));
    }
    const create = path === '/api/works' && request.method === 'POST';
    const update = !!workMatch && !workMatch[2] && ['PUT', 'PATCH'].includes(request.method);
    const publication = !!workMatch?.[2] && request.method === 'PATCH';
    const remove = !!workMatch && !workMatch[2] && request.method === 'DELETE';
    if (!create && !update && !publication && !remove) return fail(404, '未找到该接口。');
    if (!user) return workspaceRequired(); sameOrigin(request, url);
    let loaded: Loaded | undefined;
    if (!create) {
      loaded = await loadRecord(context, workMatch![1]) || undefined;
      if (!loaded) return fail(404, '作品不存在。');
      if (loaded.builtIn) return fail(403, '系统展品不能作为个人作品修改或认领。');
      if (!owner(context, loaded)) return fail(403, '只能管理自己的作品。');
    }
    if (remove && loaded) {
      const versions = await Promise.all(loaded.meta.versionIds.map((id) => loadVersion(context, loaded!, id)));
      const keys = [...new Set(versions.flatMap((version) => version.storageKeys))];
      await context.bucket.delete('records/' + loaded.meta.id + '.json');
      const all = [...keys, ...loaded.meta.versionIds.map((id) => versionKey(loaded!.meta.id, id))];
      for (let offset = 0; offset < all.length; offset += 100) await context.bucket.delete(all.slice(offset, offset + 100));
      return json({ ok: true });
    }
    const input = await parseInput(request);
    const saved = publication ? await updatePublication(context, loaded!, input) : await saveVersion(context, input, loaded);
    return json(await detailFor(context, saved), create ? 201 : 200);
  } catch (error) {
    if (error instanceof ApiFailure) return json({ error: error.message, ...(error.code ? { code: error.code } : {}) }, error.status);
    console.error('Portfolio request failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: '操作暂时未完成，请稍后重试；未显示保存成功时请保留本地内容。' }, 500);
  }
}
