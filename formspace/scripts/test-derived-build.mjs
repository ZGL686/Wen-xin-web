import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import path from 'node:path';
import {DERIVED_PREVIEWS} from '../data/derived-previews.ts';
const root=path.resolve(import.meta.dirname,'..'),model=readFileSync(path.join(root,'data/models/arc01-mouse.glb'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(model),DERIVED_PREVIEWS[0].modelSha256);
function checkDirectory(directory){for(const item of readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,item.name);if(item.isDirectory())checkDirectory(file);else{const bytes=readFileSync(file);assert.notEqual(hash(bytes),hash(model),'Private model must not be a static file');assert(!bytes.includes(Buffer.from(model.toString('base64'))),'Private model must not be embedded in client code');}}}
checkDirectory(path.join(root,'dist/client'));
const worker=readFileSync(path.join(root,'dist/server/index.js'));
assert(worker.includes(Buffer.from(model.toString('base64'))),'Worker must contain the verified derivative');
console.log(JSON.stringify({result:'passed',modelBytes:model.length,workerGzipBytes:gzipSync(worker).length,staticModelCopies:0}));
