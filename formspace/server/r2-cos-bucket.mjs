// Tencent Cloud COS implementation of the R2-compatible bucket contract used
// by worker/api.ts (same interface as server/r2-fs-bucket.mjs). Selected via
// FORMSPACE_COS_* environment variables by server/node-server.mjs.
//
// Conditionals (etagMatches / etagDoesNotMatch '*') are enforced under a
// per-key in-process lock by comparing the stored etag with the live object
// ETag. The server is expected to run as a single process on one host, which
// matches the deployment plan (one Lighthouse + one private bucket).
//
// UNVERIFIED IN PRODUCTION: exercise this adapter with real COS credentials
// during test-environment setup before trusting it with author data.
import { Readable } from 'node:stream';
import Cos from 'cos-nodejs-sdk-v5';

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9/._-]*$/;

function assertKey(key) {
  if (typeof key !== 'string' || !SAFE_KEY.test(key) || key.includes('..') || key.endsWith('/')) {
    throw new Error('invalid bucket key: ' + String(key));
  }
}

const stripEtag = (value) => (typeof value === 'string' ? value.replace(/^"|"$/g, '') : value);

export class CosBucket {
  constructor({ secretId, secretKey, bucket, region }) {
    this.client = new Cos({ SecretId: secretId, SecretKey: secretKey });
    this.bucket = bucket;
    this.region = region;
    this.locks = new Map();
  }

  static fromEnv(env = process.env) {
    const required = ['FORMSPACE_COS_SECRET_ID', 'FORMSPACE_COS_SECRET_KEY', 'FORMSPACE_COS_BUCKET', 'FORMSPACE_COS_REGION'];
    const missing = required.filter((name) => !env[name]);
    if (missing.length) throw new Error('missing COS configuration: ' + missing.join(', '));
    return new CosBucket({
      secretId: env.FORMSPACE_COS_SECRET_ID,
      secretKey: env.FORMSPACE_COS_SECRET_KEY,
      bucket: env.FORMSPACE_COS_BUCKET,
      region: env.FORMSPACE_COS_REGION,
    });
  }

  async init() { /* COS requires no local setup */ }

  describe(key, { size, etag, customMetadata, httpMetadata }) {
    return {
      key,
      size,
      etag,
      httpEtag: '"' + etag + '"',
      customMetadata: customMetadata || {},
      httpMetadata: httpMetadata || {},
    };
  }

  #withLock(key, fn) {
    const previous = this.locks.get(key) || Promise.resolve();
    const next = previous.then(fn, fn);
    this.locks.set(key, next.finally(() => {
      if (this.locks.get(key) === next) this.locks.delete(key);
    }));
    return next;
  }

  #liveEtag(key) {
    return new Promise((resolve, reject) => {
      this.client.headObject({ Bucket: this.bucket, Region: this.region, Key: key }, (error, data) => {
        if (error) {
          if (error.statusCode === 404) return resolve(null);
          return reject(error);
        }
        resolve({ etag: stripEtag(data.ETag), size: data.headers && Number(data.headers['content-length']) });
      });
    });
  }

  put(key, value, options = {}) {
    assertKey(key);
    return this.#withLock(key, async () => {
      const current = await this.#liveEtag(key);
      if (options.onlyIf?.etagMatches && current?.etag !== options.onlyIf.etagMatches) return null;
      if (options.onlyIf?.etagDoesNotMatch === '*' && current) return null;
      let body;
      if (typeof value === 'string') {
        body = Buffer.from(value, 'utf8');
      } else {
        body = Buffer.from(await new Response(value).arrayBuffer());
        const latest = await this.#liveEtag(key);
        if (options.onlyIf?.etagMatches && latest?.etag !== options.onlyIf.etagMatches) return null;
        if (options.onlyIf?.etagDoesNotMatch === '*' && latest) return null;
      }
      const headers = {};
      if (options.httpMetadata?.contentType) headers['Content-Type'] = options.httpMetadata.contentType;
      if (options.httpMetadata?.cacheControl) headers['Cache-Control'] = options.httpMetadata.cacheControl;
      const metadata = options.customMetadata ? { ...options.customMetadata } : undefined;
      const etag = await new Promise((resolve, reject) => {
        this.client.putObject({ Bucket: this.bucket, Region: this.region, Key: key, Body: body, Headers: headers, Metadata: metadata }, (error, data) => {
          if (error) return reject(error);
          resolve(stripEtag(data.ETag) || (current ? undefined : null));
        });
      });
      return this.describe(key, { size: body.length, etag: etag ?? current?.etag, customMetadata: options.customMetadata, httpMetadata: options.httpMetadata });
    });
  }

  async head(key) {
    assertKey(key);
    const live = await this.#liveEtag(key);
    if (!live) return null;
    const metadata = await new Promise((resolve) => {
      this.client.headObject({ Bucket: this.bucket, Region: this.region, Key: key }, (error, data) => {
        if (error) return resolve({});
        const custom = {};
        for (const [name, value] of Object.entries(data.headers || {})) {
          if (name.toLowerCase().startsWith('x-cos-meta-')) custom[name.slice('x-cos-meta-'.length)] = value;
        }
        resolve({ customMetadata: custom, httpMetadata: { contentType: data.headers && data.headers['content-type'] } });
      });
    });
    return this.describe(key, { size: live.size, etag: live.etag, customMetadata: metadata.customMetadata, httpMetadata: metadata.httpMetadata });
  }

  get(key, options = {}) {
    assertKey(key);
    const headers = options.range ? { Range: `bytes=${options.range.offset}-${options.range.offset + options.range.length - 1}` } : undefined;
    return new Promise((resolve, reject) => {
      this.client.getObject({ Bucket: this.bucket, Region: this.region, Key: key, Headers: headers }, (error, data) => {
        if (error) {
          if (error.statusCode === 404) return resolve(null);
          return reject(error);
        }
        const etag = stripEtag(data.ETag);
        const described = this.describe(key, { size: data.headers && Number(data.headers['content-length']), etag, customMetadata: {}, httpMetadata: { contentType: data.headers && data.headers['content-type'] } });
        resolve({
          ...described,
          body: Readable.toWeb(data.Body),
          json: async () => {
            const chunks = [];
            for await (const chunk of data.Body) chunks.push(Buffer.from(chunk));
            return JSON.parse(Buffer.concat(chunks).toString('utf8'));
          },
        });
      });
    });
  }

  list({ prefix = '', cursor, limit = 100 } = {}) {
    if (prefix) assertKey(prefix.replace(/\/+$/, '') || prefix);
    return new Promise((resolve, reject) => {
      this.client.listObjects({ Bucket: this.bucket, Region: this.region, Prefix: prefix, Marker: cursor || '', MaxKeys: limit }, (error, data) => {
        if (error) return reject(error);
        const objects = (data.Contents || []).map((entry) => ({ key: entry.Key, size: entry.Size, etag: stripEtag(entry.ETag) }));
        resolve({ objects, truncated: !!data.IsTruncated, cursor: data.NextMarker || '' });
      });
    });
  }

  async delete(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) assertKey(key);
    if (!list.length) return;
    await new Promise((resolve, reject) => {
      this.client.deleteMultipleObject({ Bucket: this.bucket, Region: this.region, Objects: list.map((key) => ({ Key: key })) }, (error) => (error ? reject(error) : resolve()));
    });
  }
}
