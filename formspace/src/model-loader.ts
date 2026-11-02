import * as THREE from 'three';
import { DIRECT_MODEL_EXTENSIONS } from '../shared/portfolio';

export const modelExtension = (name: string) => name.split('?')[0].split('.').pop()?.toLowerCase() || '';
const abortError = () => new DOMException('模型加载已取消', 'AbortError');
const defaultMaterial = () => new THREE.MeshStandardMaterial({ color: 0xbfc3ae, roughness: .55, metalness: .05 });

export function disposeModel(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  object.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
    if (node instanceof THREE.SkinnedMesh) node.skeleton.dispose();
  });
  textures.forEach(texture => { const image = texture.source?.data; if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close(); texture.dispose(); });
  materials.forEach(material => material.dispose()); geometries.forEach(geometry => geometry.dispose());
}

function stepModel(buffer: ArrayBuffer, signal?: AbortSignal): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/decoders/step-worker.js');
    const finish = () => { clearTimeout(timeout); worker.terminate(); signal?.removeEventListener('abort', abort); };
    const abort = () => { finish(); reject(abortError()); };
    const timeout = setTimeout(() => { finish(); reject(new Error('STEP 解析超时，请简化装配或另附轻量 GLB 预览。')); }, 120000);
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = () => { finish(); reject(new Error('STEP 解析未完成，文件可能过大或包含不支持的结构。')); };
    worker.onmessage = ({ data }) => {
      finish();
      if (data.error) { reject(new Error(data.error)); return; }
      const group = new THREE.Group();
      for (const part of data.meshes) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(part.indices, 1));
        if (part.normals) geometry.setAttribute('normal', new THREE.BufferAttribute(part.normals, 3)); else geometry.computeVertexNormals();
        const material = defaultMaterial(); if (part.color) material.color.setRGB(...part.color as [number, number, number], THREE.SRGBColorSpace);
        const materials = [material];
        if (part.faces?.length) {
          let next = 0;
          for (const face of part.faces) {
            if (face.first > next) geometry.addGroup(next * 3, (face.first - next) * 3, 0);
            let index = 0;
            if (face.color) { const m = material.clone(); m.color.setRGB(...face.color as [number, number, number], THREE.SRGBColorSpace); index = materials.push(m) - 1; }
            geometry.addGroup(face.first * 3, (face.last - face.first + 1) * 3, index); next = face.last + 1;
          }
          if (next * 3 < part.indices.length) geometry.addGroup(next * 3, part.indices.length - next * 3, 0);
        }
        const mesh = new THREE.Mesh(geometry, materials.length > 1 ? materials : material); mesh.name = part.name || 'STEP part'; group.add(mesh);
      }
      group.rotation.x = -Math.PI / 2; resolve(group);
    };
    worker.postMessage(buffer, [buffer]);
  });
}

/** Bundles are inert model resources; no scripts run and no external asset URLs are fetched. */
export async function loadModel(source: string | File, options: { signal?: AbortSignal; renderer?: THREE.WebGLRenderer; onProgress?: (text: string) => void } = {}) {
  const { signal, renderer, onProgress } = options;
  onProgress?.('正在加载模型数据…');
  let name: string, buffer: ArrayBuffer;
  if (typeof source === 'string') {
    const url = new URL(source, location.href);
    if (url.origin !== location.origin) throw new Error('请使用本站已上传的模型预览。');
    const response = await fetch(url, { signal, credentials: 'same-origin' });
    if (!response.ok) throw new Error('模型暂不可读取，请确认展示权限或稍后重试。');
    if (Number(response.headers.get('content-length')) > 80 * 1024 * 1024) throw new Error('模型过大，请提供轻量预览。');
    buffer = await response.arrayBuffer(); name = decodeURIComponent(url.pathname.split('/').pop() || '');
  } else { buffer = await source.arrayBuffer(); name = source.name; }
  if (buffer.byteLength > 80 * 1024 * 1024) throw new Error('模型过大，请提供轻量预览。');
  if (signal?.aborted) throw abortError();
  const resources = new Map<string, Uint8Array>();
  if (modelExtension(name) === 'zip') {
    onProgress?.('正在读取模型与配套文件…');
    const { unzipSync } = await import('three/addons/libs/fflate.module.js');
    let size = 0, count = 0;
    const files = unzipSync(new Uint8Array(buffer), { filter: entry => {
      if (++count > 256 || (size += entry.originalSize) > 80 * 1024 * 1024) throw new Error('模型包解压后过大或文件过多，请精简后上传。');
      if (entry.name.startsWith('/') || entry.name.includes('\\') || entry.name.split('/').includes('..')) throw new Error('模型包包含无效文件路径。');
      return !entry.name.endsWith('/') && !entry.name.startsWith('__MACOSX/');
    } });
    Object.entries(files).forEach(([key, bytes]) => resources.set(key, bytes));
    const models = [...resources.keys()].filter(key => (DIRECT_MODEL_EXTENSIONS as readonly string[]).includes(modelExtension(key)));
    if (models.length !== 1) throw new Error('模型包中请只保留一份主模型，以及它的材质、纹理和数据文件。');
    name = models[0]; buffer = resources.get(name)!.slice().buffer;
  }
  const extension = modelExtension(name), base = name.includes('/') ? name.slice(0, name.lastIndexOf('/') + 1) : '';
  if (!(DIRECT_MODEL_EXTENSIONS as readonly string[]).includes(extension)) throw new Error('暂不支持这个预览格式，请补充 GLB、glTF、OBJ、STL、FBX 或 STEP。');
  const urls = new Map<string, string>();
  const manager = new THREE.LoadingManager();
  let resourceError: Error | undefined, started = false;
  let texturesDone: () => void = () => {};
  const texturesReady = new Promise<void>(resolve => { texturesDone = resolve; });
  manager.onStart = () => { started = true; }; manager.onLoad = () => texturesDone();
  manager.onError = () => { resourceError = new Error('配套纹理无法读取，请检查模型包中的图片。'); texturesDone(); };
  manager.setURLModifier(url => {
    if (/^(data:|blob:)/.test(url)) return url;
    const normalized = decodeURIComponent(url.replace(/\\/g, '/'));
    const path = decodeURIComponent(new URL(normalized, 'https://model.local/' + base).pathname).slice(1);
    let key = resources.has(normalized) ? normalized : resources.has(path) ? path : '';
    if (!key) {
      const matches = [...resources.keys()].filter(p => p.split('/').pop() === normalized.split('/').pop());
      if (matches.length === 1) key = matches[0];
    }
    if (key) {
      if (!urls.has(key)) urls.set(key, URL.createObjectURL(new Blob([resources.get(key)!.slice().buffer], { type: /\.png$/i.test(key) ? 'image/png' : /\.jpe?g$/i.test(key) ? 'image/jpeg' : /\.webp$/i.test(key) ? 'image/webp' : 'application/octet-stream' })));
      return urls.get(key)!;
    }
    resourceError = new Error('缺少模型配套文件，请将 .bin、材质和纹理与主模型一起打包上传。');
    throw resourceError;
  });
  let object: THREE.Object3D | undefined, disposeDecoders = () => {};
  try {
    onProgress?.(extension === 'step' || extension === 'stp' ? '正在后台解析 STEP 曲面…' : '正在解析几何与材质…');
    if (extension === 'step' || extension === 'stp') object = await stepModel(buffer, signal);
    else if (extension === 'fbx') { const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js'); object = new FBXLoader(manager).parse(buffer, ''); }
    else if (extension === 'obj') {
      const text = new TextDecoder().decode(buffer);
      const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js'); const loader = new OBJLoader(manager);
      const libraries = [...text.matchAll(/^mtllib\s+(.+)$/gm)].map(match => match[1].trim());
      if (libraries.length) {
        const { MTLLoader } = await import('three/addons/loaders/MTLLoader.js');
        const creators = libraries.map(path => {
          const key = decodeURIComponent(new URL(path, 'https://model.local/' + base).pathname).slice(1);
          const bytes = resources.get(key);
          if (!bytes) throw new Error('缺少 OBJ 的 MTL 材质文件，请使用模型与配套文件上传入口。');
          const creator = new MTLLoader(manager).parse(new TextDecoder().decode(bytes), key.includes('/') ? key.slice(0, key.lastIndexOf('/') + 1) : '');
          creator.preload(); return creator;
        });
        const materials = creators[0];
        for (const creator of creators.slice(1)) Object.assign(materials.materials, creator.materials);
        loader.setMaterials(materials);
      }
      object = loader.parse(text);
    } else if (extension === 'stl') {
      const { STLLoader } = await import('three/addons/loaders/STLLoader.js'); const geometry = new STLLoader().parse(buffer);
      geometry.rotateX(-Math.PI / 2); const material = defaultMaterial(); if (geometry.hasAttribute('color')) material.vertexColors = true;
      object = new THREE.Mesh(geometry, material);
    } else {
      const [{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js'), import('three/addons/libs/meshopt_decoder.module.js')]);
      const draco = new DRACOLoader().setDecoderPath('/decoders/draco/'); draco.setWorkerLimit(2);
      const loader = new GLTFLoader(manager).setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
      let ktx: import('three/addons/loaders/KTX2Loader.js').KTX2Loader | undefined;
      disposeDecoders = () => { draco.dispose(); ktx?.dispose(); };
      if (renderer) { const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js'); ktx = new KTX2Loader().setTranscoderPath('/decoders/basis/').detectSupport(renderer); loader.setKTX2Loader(ktx); }
      object = (await loader.parseAsync(buffer, '')).scene;
    }
    if (started) await texturesReady;
    if (resourceError) throw resourceError;
    if (signal?.aborted) throw abortError();
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty() || ![...box.min, ...box.max].every(Number.isFinite) || box.getSize(new THREE.Vector3()).length() === 0) throw new Error('模型中没有可显示的有效几何。');
    return object;
  } catch (error) { if (object) disposeModel(object); throw resourceError || error; }
  finally { urls.forEach(url => URL.revokeObjectURL(url)); disposeDecoders(); }
}

export async function bundleModelFiles(files: File[]) {
  if (files.length === 1) return files[0];
  if (files.length > 256) throw new Error('模型与配套文件最多选择 256 项。');
  if (files.reduce((sum, file) => sum + file.size, 0) > 40 * 1024 * 1024) throw new Error('模型与配套文件合计不能超过 40 MiB。');
  const models = files.filter(file => (DIRECT_MODEL_EXTENSIONS as readonly string[]).includes(modelExtension(file.name)));
  if (models.length !== 1) throw new Error('请只选择一份主模型，并一起选择它的配套文件。');
  const { zipSync } = await import('three/addons/libs/fflate.module.js');
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    const name = file.webkitRelativePath || file.name;
    if (entries[name]) throw new Error('配套文件存在同名项，请使用文件夹上传保留路径。');
    entries[name] = new Uint8Array(await file.arrayBuffer());
  }
  const bytes = zipSync(entries, { level: 0 });
  return new File([bytes.slice().buffer], models[0].name.replace(/\.[^.]+$/, '') + '-preview.zip', { type: 'application/zip' });
}
