type Work = Record<string, any>;
type User = { id: string; name: string } | null;
type Env = { BUCKET?: R2Bucket };

const MAX_TOTAL = 40 * 1024 * 1024;
const MAX_MULTIPART = MAX_TOTAL + 256 * 1024;
const MAX_IMAGE = 12 * 1024 * 1024;
const SOURCE_EXTENSIONS = new Set(['max', 'blend', 'fbx', 'obj', 'stl', 'glb', 'gltf', 'zip']);
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif']);
const CATEGORIES = new Set(['产品设计', '家具设计', '空间建筑', '其他创作']);
const FILE_KEY = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/(?:source|image-\d+)\.[a-z0-9]+$/;
const WORK_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  avif: 'image/avif', gif: 'image/gif', glb: 'model/gltf-binary',
  gltf: 'model/gltf+json', obj: 'text/plain; charset=utf-8', stl: 'model/stl',
};
const ext = (name: string) => name.split('.').pop()?.toLowerCase() || '';
const json = (value: unknown, status = 200) => Response.json(value, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

function currentUser(request: Request): User {
  const id = request.headers.get('oai-authenticated-user-id');
  if (!id) return null;
  const raw = request.headers.get('oai-authenticated-user-full-name');
  let name = '创作者';
  if (raw) {
    try {
      name = (request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8'
        ? decodeURIComponent(raw) : raw).trim().slice(0, 80) || name;
    } catch { /* Fall back to a neutral display name. */ }
  }
  return { id, name };
}

function publicWork(work: Work, user: User) {
  const { storageKeys: _privateKeys, ownerId, ...safe } = work;
  return { ...safe, ...(user?.id === ownerId ? { ownerId } : {}) };
}

async function validRaster(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 96).arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  switch (ext(file.name)) {
    case 'png': return [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
    case 'jpg': case 'jpeg': return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    case 'webp': return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
    case 'gif': return ['GIF87a', 'GIF89a'].includes(ascii(0, 6));
    case 'avif': return ascii(4, 8) === 'ftyp' && /avif|avis/.test(ascii(8, 96));
    default: return false;
  }
}

export async function handleApi(request: Request, env: Env, builtins: Work[] = []): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const user = currentUser(request);
  const bucket = env.BUCKET;

  try {
    if (path === '/api/works' && request.method === 'GET') {
      if (!bucket) return json({ error: '作品存储暂时不可用，请稍后重试。' }, 503);
      const records: Work[] = [];
      let cursor: string | undefined;
      do {
        const page = await bucket.list({ prefix: 'records/', limit: 100, cursor });
        const values = await Promise.all(page.objects.map(async (item) => {
          const object = await bucket.get(item.key);
          return object ? object.json<Work>() : null;
        }));
        records.push(...values.filter((item): item is Work => item !== null));
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      records.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return json({ works: [...records, ...builtins].map((work) => publicWork(work, user)), user });
    }

    if (path.startsWith('/api/files/')) {
      if (!['GET', 'HEAD'].includes(request.method)) return json({ error: '不支持该请求方式。' }, 405);
      let key: string;
      try { key = decodeURIComponent(path.slice('/api/files/'.length)); }
      catch { return json({ error: '文件不存在。' }, 404); }
      if (!FILE_KEY.test(key)) return json({ error: '文件不存在。' }, 404);
      if (!bucket) return json({ error: '文件存储暂时不可用。' }, 503);
      const file = await bucket.get('files/' + key);
      if (!file) return json({ error: '文件不存在。' }, 404);
      const headers = new Headers({
        'Content-Type': MIME[ext(key)] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': String(file.size),
        ETag: file.httpEtag,
      });
      if (key.includes('/source.')) {
        const name = (file.customMetadata?.name || key.split('/').pop()!).replace(/[\r\n]/g, '');
        headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
      }
      return new Response(request.method === 'HEAD' ? null : file.body, { headers });
    }

    const create = path === '/api/works' && request.method === 'POST';
    const remove = path.startsWith('/api/works/') && request.method === 'DELETE';
    if (!create && !remove) return json({ error: '未找到该接口。' }, 404);
    if (!user) return json({ error: '登录后即可提交和管理作品。' }, 401);
    const origin = request.headers.get('Origin');
    if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
      return json({ error: '请从本网站提交作品。' }, 403);
    }
    if (!bucket) return json({ error: '作品存储暂时不可用，请稍后重试。' }, 503);

    if (remove) {
      const id = path.slice('/api/works/'.length);
      if (!WORK_ID.test(id)) return json({ error: '该作品不能删除。' }, 400);
      const object = await bucket.get('records/' + id + '.json');
      if (!object) return json({ error: '作品不存在。' }, 404);
      const work = await object.json<Work>();
      if (work.ownerId !== user.id) return json({ error: '只能管理自己提交的作品。' }, 403);
      await bucket.delete('records/' + id + '.json');
      await bucket.delete(Array.isArray(work.storageKeys) ? work.storageKeys : []);
      return json({ ok: true });
    }

    if (Number(request.headers.get('Content-Length')) > MAX_MULTIPART) {
      return json({ error: '每次提交总大小不能超过 40 MB。' }, 413);
    }
    const contentType = request.headers.get('Content-Type') || '';
    if (!/^multipart\/form-data\s*;/i.test(contentType) || !request.body) {
      return json({ error: '请选择文件后通过上传表单提交。' }, 400);
    }
    let exceeded = false;
    let received = 0;
    const limitedBody = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > MAX_MULTIPART) { exceeded = true; throw new Error('upload_too_large'); }
        controller.enqueue(chunk);
      },
    }));
    let form: FormData;
    try {
      form = await new Response(limitedBody, { headers: { 'Content-Type': contentType } }).formData();
    } catch {
      return json({ error: exceeded ? '每次提交总大小不能超过 40 MB。' : '无法读取上传内容，请重新选择文件。' }, exceeded ? 413 : 400);
    }

    const title = String(form.get('title') || '').trim();
    if (!title || title.length > 80) return json({ error: '请填写 1–80 字的作品名称。' }, 400);
    const description = String(form.get('description') || '').trim();
    if (description.length > 4000) return json({ error: '作品介绍不能超过 4000 字。' }, 400);
    const sourceFiles = form.getAll('source').filter((file): file is File => file instanceof File && file.size > 0);
    const sourceFile = sourceFiles[0] || null;
    const imageFiles = form.getAll('images').filter((file): file is File => file instanceof File && file.size > 0);
    if (sourceFiles.length > 1) return json({ error: '每件作品最多上传一个工程文件。' }, 400);
    if (!sourceFile && !imageFiles.length) return json({ error: '请至少上传一个模型文件或一张图片。' }, 400);
    if (imageFiles.length > 8) return json({ error: '最多上传 8 张图片。' }, 400);
    if (sourceFile && !SOURCE_EXTENSIONS.has(ext(sourceFile.name))) {
      return json({ error: '请选择 MAX、BLEND、FBX、OBJ、STL、GLB、GLTF 或 ZIP 文件。' }, 400);
    }
    if (imageFiles.some((file) => !IMAGE_EXTENSIONS.has(ext(file.name)) || file.size > MAX_IMAGE)) {
      return json({ error: '图片支持 PNG / JPG / WEBP / AVIF / GIF，每张不超过 12 MB。' }, 400);
    }
    if ((sourceFile?.size || 0) + imageFiles.reduce((size, file) => size + file.size, 0) > MAX_TOTAL) {
      return json({ error: '每次提交总大小不能超过 40 MB。' }, 413);
    }
    for (const image of imageFiles) {
      if (!await validRaster(image)) return json({ error: '图片格式与内容不符，请重新导出后上传。' }, 400);
    }

    const id = crypto.randomUUID();
    const stored: string[] = [];
    async function save(file: File, name: string) {
      const key = `files/${id}/${name}.${ext(file.name)}`;
      await bucket!.put(key, file.stream(), {
        httpMetadata: { contentType: MIME[ext(file.name)] || 'application/octet-stream' },
        customMetadata: { name: file.name.slice(0, 255) },
      });
      stored.push(key);
      return '/api/' + key;
    }

    try {
      const fileUrl = sourceFile ? await save(sourceFile, 'source') : '';
      const imageUrls: string[] = [];
      for (let index = 0; index < imageFiles.length; index++) imageUrls.push(await save(imageFiles[index], `image-${index}`));
      const sourceExt = sourceFile ? ext(sourceFile.name) : '';
      const category = String(form.get('category') || '其他创作');
      const work: Work = {
        id, title, subtitle: '新的想法，在这里成形。', category: CATEGORIES.has(category) ? category : '其他创作',
        description, tags: String(form.get('tags') || '').split(/[,，]/).map((tag) => tag.trim().slice(0, 24)).filter(Boolean).slice(0, 8),
        date: new Date().toISOString(), fileName: sourceFile?.name || '', fileSize: sourceFile?.size || 0,
        fileUrl, modelUrl: ['glb', 'obj', 'stl'].includes(sourceExt) ? fileUrl : '',
        coverUrl: imageUrls[0] || '', images: imageUrls, format: sourceExt.toUpperCase() || 'IMAGE',
        ownerId: user.id, builtIn: false, storageKeys: stored,
      };
      await bucket.put('records/' + id + '.json', JSON.stringify(work), { httpMetadata: { contentType: 'application/json' } });
      return json({ work: publicWork(work, user) }, 201);
    } catch (error) {
      // A record appears only after all files have arrived; incomplete uploads leave no portfolio entry.
      try { await bucket.delete(stored); } catch { /* Keep the original failure for the response. */ }
      throw error;
    }
  } catch (error) {
    console.error('Portfolio request failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: '操作暂时未完成，请稍后重试。' }, 500);
  }
}
