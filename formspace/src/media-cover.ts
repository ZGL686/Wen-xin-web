import { MODEL_PREVIEW_EXTENSIONS } from '../shared/portfolio';
/** Best-effort previews derived from the uploaded content. Never blocks saving. */
const nameFor = (file: File) => `${file.name.replace(/\.[^.]+$/, '')}-cover.webp`;
const canvasFile = (canvas: HTMLCanvasElement, file: File) => new Promise<File | null>((resolve) => {
  canvas.toBlob(blob => resolve(blob ? new File([blob], nameFor(file), { type: 'image/webp' }) : null), 'image/webp', .88);
});

export async function extractVideoCover(file: File, at = 0): Promise<File | null> {
  if (!/\.(mp4|webm)$/i.test(file.name)) return null;
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true; video.preload = 'auto'; video.playsInline = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Preview timeout')), 8000);
      video.onerror = () => reject(new Error('Unsupported video'));
      video.onloadedmetadata = () => {
        const duration = Number.isFinite(video.duration) ? video.duration : Math.max(at + 1, 1);
        video.currentTime = Math.min(Math.max(.01, at), Math.max(.01, duration - .05));
      };
      video.onseeked = () => resolve();
      video.src = url; video.load();
    });
    if (!video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await canvasFile(canvas, file);
  } catch { return null; }
  finally {
    clearTimeout(timer); video.onloadedmetadata = null; video.onseeked = null; video.onerror = null;
    video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
  }
}

export async function extractModelCover(file: File): Promise<File | null> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!(MODEL_PREVIEW_EXTENSIONS as readonly string[]).includes(extension || '') || file.size > 20 * 1024 * 1024) return null;
  let renderer: import('three').WebGLRenderer | undefined;
  let object: import('three').Object3D | undefined;
  let environment: import('three').WebGLRenderTarget | undefined;
  let pmrem: import('three').PMREMGenerator | undefined;
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 8000);
  try {
    const THREE = await import('three');
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    const { loadModel } = await import('./model-loader');
    object = await loadModel(file, { signal: abort.signal, renderer });
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#e8eadf');
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return null;
    const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3());
    const group = new THREE.Group(); object.position.sub(center); group.add(object); group.scale.setScalar(3 / Math.max(size.x, size.y, size.z, .001)); scene.add(group);
    const camera = new THREE.PerspectiveCamera(35, 1, .01, 200); camera.position.set(4.2, 2.7, 5.6); camera.lookAt(0, 0, 0);
    renderer.setSize(900, 900); renderer.setPixelRatio(1); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
    const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
    pmrem = new THREE.PMREMGenerator(renderer); const room = new RoomEnvironment();
    environment = pmrem.fromScene(room, .04); room.dispose(); scene.environment = environment.texture;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc4b99d, 2));
    const light = new THREE.DirectionalLight(0xfff6e5, 3); light.position.set(3, 7, 5); scene.add(light);
    renderer.render(scene, camera);
    return await canvasFile(renderer.domElement, file);
  } catch { return null; }
  finally {
    clearTimeout(timeout); abort.abort();
    if (object) {
      const { disposeModel } = await import('./model-loader'); disposeModel(object);
    }
    environment?.dispose(); pmrem?.dispose(); renderer?.dispose(); renderer?.forceContextLoss();
  }
}
