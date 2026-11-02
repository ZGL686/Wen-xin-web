import mouseData from '../data/models/arc01-mouse.glb?url&inline';
import { DERIVED_PREVIEWS } from '../data/derived-previews';
import { Buffer } from 'node:buffer';

let mouseBytes: Uint8Array<ArrayBuffer> | undefined;
// Keep this small verified derivative inside the Worker, outside the public asset tree.
export async function readDerivedModel(url: string) {
  if (url !== DERIVED_PREVIEWS[0].modelUrl) return null;
  if (!mouseBytes) {
    mouseBytes = Buffer.from(mouseData.slice(mouseData.indexOf(',') + 1), 'base64');
  }
  return mouseBytes;
}
