// Local-filesystem implementation of the R2-compatible bucket contract used
// by worker/api.ts. Mirrors the semantics of scripts/test-api.mjs MemoryBucket:
// unique etag per write, conditional put (etagMatches / etagDoesNotMatch '*'),
// ranged get, prefix list with cursor, array delete.
// Intended for local development, integration tests, and as the reference
// implementation for the production COS adapter (server/r2-cos-bucket.mjs).
import { createReadStream, promises as fsp } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9/._-]*$/;

function assertKey(key) {
  if (typeof key !== 'string' || !SAFE_KEY.test(key) || key.includes('..') || key.endsWith('/')) {
    throw new Error('invalid bucket key: ' + String(key));
  }
}

export class FsBucket {
  constructor(root) {
    this.root = path.resolve(root);
    this.objects = path.join(this.root, 'objects');
    this.metaRoot = path.join(this.root, 'meta');
    this.locks = new Map();
  }

  async init() {
    await fsp.mkdir(this.objects, { recursive: true });
    await fsp.mkdir(this.metaRoot, { recursive: true });
  }

  #objectPath(key) { return path.join(this.objects, key); }
  #metaPath(key) { return path.join(this.metaRoot, key + '.json'); }

  async #readMeta(key) {
    try { return JSON.parse(await fsp.readFile(this.#metaPath(key), 'utf8')); } catch { return null; }
  }

  describe(key, meta) {
    return {
      key,
      size: meta.size,
      etag: meta.etag,
      httpEtag: '"' + meta.etag + '"',
      customMetadata: meta.customMetadata || {},
      httpMetadata: meta.httpMetadata || {},
    };
  }

  // Serializes conditional writes per key inside one process. Cross-process
  // writes are not expected: the Node server is a single process on one host.
  #withLock(key, fn) {
    const previous = this.locks.get(key) || Promise.resolve();
    const next = previous.then(fn, fn);
    this.locks.set(key, next.finally(() => {
      if (this.locks.get(key) === next) this.locks.delete(key);
    }));
    return next;
  }

  async put(key, value, options = {}) {
    assertKey(key);
    return this.#withLock(key, async () => {
      const current = await this.#readMeta(key);
      if (options.onlyIf?.etagMatches && current?.etag !== options.onlyIf.etagMatches) return null;
      if (options.onlyIf?.etagDoesNotMatch === '*' && current) return null;
      let bytes;
      if (typeof value === 'string') {
        bytes = new TextEncoder().encode(value);
      } else {
        bytes = new Uint8Array(await new Response(value).arrayBuffer());
        // Recheck after consuming an asynchronous body, as an atomic store would.
        const latest = await this.#readMeta(key);
        if (options.onlyIf?.etagMatches && latest?.etag !== options.onlyIf.etagMatches) return null;
        if (options.onlyIf?.etagDoesNotMatch === '*' && latest) return null;
      }
      const meta = {
        etag: randomUUID(),
        size: bytes.length,
        httpMetadata: options.httpMetadata || {},
        customMetadata: options.customMetadata || {},
      };
      const objectPath = this.#objectPath(key);
      const tmpPath = objectPath + '.tmp-' + randomUUID();
      await fsp.mkdir(path.dirname(objectPath), { recursive: true });
      await fsp.mkdir(path.dirname(this.#metaPath(key)), { recursive: true });
      await fsp.writeFile(tmpPath, bytes);
      await fsp.rename(tmpPath, objectPath);
      await fsp.writeFile(this.#metaPath(key), JSON.stringify(meta));
      return this.describe(key, meta);
    });
  }

  async head(key) {
    assertKey(key);
    const meta = await this.#readMeta(key);
    if (!meta) return null;
    try { await fsp.access(this.#objectPath(key)); } catch { return null; }
    return this.describe(key, meta);
  }

  async get(key, options = {}) {
    const described = await this.head(key);
    if (!described) return null;
    const objectPath = this.#objectPath(key);
    let body;
    if (options.range) {
      const { offset, length } = options.range;
      const bytes = Buffer.alloc(length);
      const handle = await fsp.open(objectPath, 'r');
      try {
        const read = await handle.read(bytes, 0, length, offset);
        if (read.bytesRead < length) {
          if (read.bytesRead <= 0) return null;
          body = Readable.toWeb(createReadStream(objectPath, { start: offset, end: offset + read.bytesRead - 1 }));
        } else {
          body = Readable.toWeb(createReadStream(objectPath, { start: offset, end: offset + length - 1 }));
        }
      } finally { await handle.close(); }
      const meta = await this.#readMeta(key);
      return { ...this.describe(key, meta), body };
    }
    const meta = await this.#readMeta(key);
    body = Readable.toWeb(createReadStream(objectPath));
    return { ...described, body, json: async () => JSON.parse(await fsp.readFile(objectPath, 'utf8')) };
  }

  async list({ prefix = '', cursor, limit = 100 } = {}) {
    if (prefix) assertKey(prefix.replace(/\/+$/, '') || prefix);
    const keys = [];
    const walk = async (dir, rel) => {
      let entries;
      try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (entry.name.endsWith('.tmp-')) continue;
        const childRel = rel ? rel + '/' + entry.name : entry.name;
        if (entry.isDirectory()) await walk(path.join(dir, entry.name), childRel);
        else keys.push(childRel);
      }
    };
    await walk(this.objects, '');
    keys.sort();
    const matched = keys.filter((key) => key.startsWith(prefix));
    let start = 0;
    if (cursor) {
      const index = matched.indexOf(cursor);
      start = index >= 0 ? index + 1 : matched.findIndex((key) => key > cursor);
      if (start < 0) start = matched.length;
    }
    const page = matched.slice(start, start + limit);
    const end = start + page.length;
    return {
      objects: page.map((key) => ({ key })),
      truncated: end < matched.length,
      cursor: page.length ? page[page.length - 1] : String(end),
    };
  }

  async delete(keys) {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      try { await fsp.unlink(this.#objectPath(key)); } catch { /* already absent */ }
      try { await fsp.unlink(this.#metaPath(key)); } catch { /* already absent */ }
    }
  }
}
