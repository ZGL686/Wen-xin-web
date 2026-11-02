import { useEffect, useRef, useState } from 'react';
import { Focus, Maximize, Minimize } from 'lucide-react';
import './model-viewer.css';

type Props = { src?: string; poster?: string; interactive?: boolean; autoRotate?: boolean; wireframe?: boolean; resetToken?: number; onInteraction?: () => void; className?: string };
export default function ModelViewer({ src, poster, interactive = true, autoRotate = true, wireframe = false, resetToken = 0, onInteraction, className = '' }: Props) {
  const wrapper = useRef<HTMLDivElement>(null), host = useRef<HTMLDivElement>(null);
  const options = useRef({ interactive, autoRotate, wireframe, onInteraction }); options.current = { interactive, autoRotate, wireframe, onInteraction };
  const actions = useRef<{ reset: () => void; fit: () => void; invalidate: () => void } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(src ? 'loading' : 'error');
  const [message, setMessage] = useState('正在打开三维空间…');
  const [retry, setRetry] = useState(0), [expanded, setExpanded] = useState(false);
  const toggleFullscreen = async () => {
    const root = wrapper.current; if (!root) return;
    if (document.fullscreenElement === root) { await document.exitFullscreen(); return; }
    if (expanded) { setExpanded(false); return; }
    try { if (!root.requestFullscreen) throw new Error(); await root.requestFullscreen(); }
    catch { setExpanded(true); }
  };
  useEffect(() => {
    const changed = () => setExpanded(document.fullscreenElement === wrapper.current);
    document.addEventListener('fullscreenchange', changed); return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow; const opener = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden'; wrapper.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) setExpanded(false);
      if (event.key === 'Tab' && wrapper.current) {
        const items = Array.from(wrapper.current.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]'));
        if (!items.length) return;
        if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === wrapper.current)) { items.at(-1)?.focus(); event.preventDefault(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { items[0].focus(); event.preventDefault(); }
      }
    };
    window.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', escape); if (opener?.isConnected) opener.focus(); };
  }, [expanded]);
  useEffect(() => { if (resetToken) actions.current?.reset(); }, [resetToken]);
  useEffect(() => { actions.current?.invalidate(); }, [interactive, autoRotate, wireframe]);

  useEffect(() => {
    const container = host.current; if (!container || !src) { setState('error'); return; }
    let cancelled = false, frame = 0, cleanup = () => {};
    const abort = new AbortController();
    setState('loading'); setMessage('正在打开三维空间…');
    (async () => {
      const [THREE, { default: CameraControls }, { RoomEnvironment }, { loadModel, disposeModel }] = await Promise.all([
        import('three'), import('camera-controls'), import('three/addons/environments/RoomEnvironment.js'), import('./model-loader')
      ]);
      if (cancelled) return;
      CameraControls.install({ THREE });
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(max-width:700px)').matches ? 1.5 : 2));
      renderer.setClearColor(0, 0); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
      renderer.domElement.setAttribute('aria-label', '三维模型：左键旋转，右键平移，滚轮缩放，双击聚焦；触屏单指旋转、双指缩放和平移');
      container.appendChild(renderer.domElement);
      const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 1, .005, 100);
      const controls = new CameraControls(camera, renderer.domElement);
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      controls.smoothTime = reduced ? .001 : .22; controls.draggingSmoothTime = reduced ? .001 : .12;
      controls.minDistance = .04; controls.maxDistance = 60; controls.dollyToCursor = true;
      controls.mouseButtons.left = CameraControls.ACTION.ROTATE; controls.mouseButtons.right = CameraControls.ACTION.TRUCK;
      controls.mouseButtons.middle = CameraControls.ACTION.DOLLY; controls.mouseButtons.wheel = CameraControls.ACTION.DOLLY;
      controls.touches.one = CameraControls.ACTION.TOUCH_ROTATE; controls.touches.two = CameraControls.ACTION.TOUCH_DOLLY_TRUCK;
      controls.touches.three = CameraControls.ACTION.TOUCH_TRUCK;
      let active = true, dirty = true, lastTime = 0, stoppedRotation = false, previousRotate = options.current.autoRotate;
      let fullBox: import('three').Box3 | undefined, focusBox: import('three').Box3 | undefined;
      let model: import('three').Object3D | undefined, lastWire: boolean | undefined;
      let pmrem: import('three').PMREMGenerator | undefined, environment: import('three').WebGLRenderTarget | undefined;
      const schedule = () => { if (!cancelled && active && !document.hidden && !frame) frame = requestAnimationFrame(render); };
      const invalidate = () => { dirty = true; schedule(); };
      const userAction = () => { stoppedRotation = true; options.current.onInteraction?.(); schedule(); };
      const frameBox = (box: import('three').Box3, transition: boolean, reset = false) => {
        const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
        const direction = reset ? new THREE.Vector3(4.2, 2.7, 5.6).normalize() : controls.getPosition(new THREE.Vector3(), true).sub(controls.getTarget(new THREE.Vector3(), true)).normalize();
        const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
        const up = new THREE.Vector3().crossVectors(direction, right).normalize();
        const tangent = Math.tan(camera.fov * Math.PI / 360); let distance = .04;
        for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) {
          const corner = new THREE.Vector3(x * size.x, y * size.y, z * size.z);
          distance = Math.max(distance, Math.max(Math.abs(corner.dot(up)) / tangent, Math.abs(corner.dot(right)) / (tangent * camera.aspect)) + corner.dot(direction));
        }
        const position = direction.multiplyScalar(distance * 1.1).add(center);
        if (reset) controls.normalizeRotations();
        void controls.setLookAt(position.x, position.y, position.z, center.x, center.y, center.z, transition);
      };
      const fit = (reset: boolean) => {
        if (!fullBox) return;
        userAction(); focusBox = fullBox.clone();
        frameBox(fullBox, !reduced, reset); invalidate();
      };
      const resize = () => {
        const { width, height } = container.getBoundingClientRect();
        renderer.setSize(Math.max(1, width), Math.max(1, height)); camera.aspect = Math.max(1, width) / Math.max(1, height); camera.updateProjectionMatrix();
        if (focusBox) frameBox(focusBox, false);
        invalidate();
      };
      const observer = new ResizeObserver(resize); observer.observe(container);
      const visibility = new IntersectionObserver(([entry]) => { active = entry.isIntersecting; if (active) { lastTime = 0; invalidate(); } else { cancelAnimationFrame(frame); frame = 0; } }); visibility.observe(container);
      const pageVisibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else { lastTime = 0; invalidate(); } };
      document.addEventListener('visibilitychange', pageVisibility);
      controls.addEventListener('wake', invalidate); controls.addEventListener('controlstart', userAction); controls.addEventListener('control', userAction);
      const raycaster = new THREE.Raycaster();
      const focus = (clientX: number, clientY: number) => {
        if (!options.current.interactive || !model) return;
        const rect = container.getBoundingClientRect();
        raycaster.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1), camera);
        const hit = raycaster.intersectObject(model, true).find(value => (value.object as import('three').Mesh).isMesh);
        if (!hit) return;
        userAction();
        const partSize = new THREE.Box3().setFromObject(hit.object).getSize(new THREE.Vector3());
        const radius = Math.max(.06, Math.min(.45, Math.max(partSize.x, partSize.y, partSize.z) * .65));
        focusBox = new THREE.Box3().setFromCenterAndSize(hit.point, new THREE.Vector3(radius * 2, radius * 2, radius * 2));
        frameBox(focusBox, !reduced); invalidate();
      };
      const doubleClick = (event: MouseEvent) => { event.preventDefault(); focus(event.clientX, event.clientY); };
      let lastTap = { time: 0, x: 0, y: 0 }, touchStart = { x: 0, y: 0 }, multiTouch = false;
      const pointers = new Set<number>();
      const pointerDown = (event: PointerEvent) => {
        if (event.pointerType !== 'touch') return;
        pointers.add(event.pointerId); if (pointers.size > 1) { multiTouch = true; lastTap.time = 0; }
        touchStart = { x: event.clientX, y: event.clientY };
      };
      const pointerUp = (event: PointerEvent) => {
        if (event.pointerType !== 'touch') return;
        pointers.delete(event.pointerId);
        if (!multiTouch && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) < 12) {
          const time = performance.now();
          if (time - lastTap.time < 320 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 24) { focus(event.clientX, event.clientY); lastTap.time = 0; }
          else lastTap = { time, x: event.clientX, y: event.clientY };
        }
        if (!pointers.size) multiTouch = false;
      };
      const pointerCancel = () => { pointers.clear(); multiTouch = false; lastTap.time = 0; };
      const contextMenu = (event: Event) => { if (options.current.interactive) event.preventDefault(); };
      const keyboard = (event: KeyboardEvent) => {
        if (!options.current.interactive || event.ctrlKey || event.metaKey || event.altKey) return;
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home', 'r', 'R'].includes(event.key)) {
          userAction(); event.preventDefault();
          if (event.key.startsWith('Arrow')) void controls.rotate(event.key === 'ArrowLeft' ? -.16 : event.key === 'ArrowRight' ? .16 : 0, event.key === 'ArrowUp' ? -.16 : event.key === 'ArrowDown' ? .16 : 0, !reduced);
          else if (['Home', 'r', 'R'].includes(event.key)) fit(true);
          else void controls.dollyTo(controls.distance * (event.key === '-' ? 1.18 : .85), !reduced);
          invalidate();
        }
      };
      container.addEventListener('dblclick', doubleClick); container.addEventListener('contextmenu', contextMenu); container.addEventListener('keydown', keyboard);
      container.addEventListener('pointerdown', pointerDown); container.addEventListener('pointerup', pointerUp); container.addEventListener('pointercancel', pointerCancel);
      cleanup = () => {
        abort.abort(); cancelAnimationFrame(frame); observer.disconnect(); visibility.disconnect(); document.removeEventListener('visibilitychange', pageVisibility);
        container.removeEventListener('dblclick', doubleClick); container.removeEventListener('contextmenu', contextMenu); container.removeEventListener('keydown', keyboard);
        container.removeEventListener('pointerdown', pointerDown); container.removeEventListener('pointerup', pointerUp); container.removeEventListener('pointercancel', pointerCancel);
        actions.current = null; controls.dispose(); disposeModel(scene); environment?.dispose(); pmrem?.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      };
      function render(time: number) {
        frame = 0; if (cancelled || !active || document.hidden) return;
        const delta = lastTime ? Math.min((time - lastTime) / 1000, .05) : 1 / 60; lastTime = time;
        const opts = options.current; controls.enabled = opts.interactive;
        if (opts.autoRotate !== previousRotate) { stoppedRotation = false; previousRotate = opts.autoRotate; }
        const rotating = opts.autoRotate && !stoppedRotation && !reduced && Boolean(model);
        if (rotating) void controls.rotate(.16 * delta, 0, false);
        if (model && lastWire !== opts.wireframe) {
          model.traverse(node => { if (node instanceof THREE.Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            if ('wireframe' in material) { material.wireframe = opts.wireframe; material.needsUpdate = true; }
          } }); lastWire = opts.wireframe; dirty = true;
        }
        const changed = controls.update(delta);
        if (changed || dirty || rotating) { renderer.render(scene, camera); dirty = false; }
        if (changed || rotating) schedule();
      }
      resize();
      pmrem = new THREE.PMREMGenerator(renderer); const room = new RoomEnvironment(); environment = pmrem.fromScene(room, .04); room.dispose();
      scene.environment = environment.texture; scene.environmentIntensity = .75;
      scene.add(new THREE.HemisphereLight(0xffffff, 0xc4b99d, 2));
      const key = new THREE.DirectionalLight(0xfff6e5, 3.5); key.position.set(3, 7, 5); key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4; key.shadow.bias = -.0005; scene.add(key);
      const rim = new THREE.DirectionalLight(0xffffff, 2); rim.position.set(-4, 3, -2); scene.add(rim);
      model = await loadModel(src, { signal: abort.signal, renderer, onProgress: text => { if (!cancelled) setMessage(text); } });
      if (cancelled) { disposeModel(model); return; }
      const originalBox = new THREE.Box3().setFromObject(model), size = originalBox.getSize(new THREE.Vector3());
      const normalized = new THREE.Group(); model.position.sub(originalBox.getCenter(new THREE.Vector3())); normalized.add(model); normalized.scale.setScalar(3 / Math.max(size.x, size.y, size.z)); scene.add(normalized);
      let triangles = 0; model.traverse(node => { if (node instanceof THREE.Mesh) triangles += (node.geometry.index?.count ?? node.geometry.getAttribute('position')?.count ?? 0) / 3 * (node instanceof THREE.InstancedMesh ? node.count : 1); });
      // shortcut: large meshes use direct lighting without dynamic shadows; add LOD when large production samples require it.
      key.castShadow = triangles < 500000;
      if (!key.castShadow) renderer.setPixelRatio(1);
      model.traverse(node => { if (node instanceof THREE.Mesh) { node.castShadow = key.castShadow; node.receiveShadow = key.castShadow; } });
      fullBox = new THREE.Box3().setFromObject(normalized); focusBox = fullBox.clone();
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ color: 0x332f25, opacity: .13 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = fullBox.min.y - .02; floor.receiveShadow = key.castShadow; scene.add(floor); renderer.shadowMap.needsUpdate = true;
      frameBox(fullBox, false, true);
      if (cancelled) return;
      actions.current = { reset: () => fit(true), fit: () => fit(false), invalidate };
      setState('ready'); invalidate();
    })().catch(error => {
      if (!cancelled) { setState('error'); setMessage(error instanceof Error && /[\u3400-\u9fff]/.test(error.message) ? error.message : '模型解析未完成，请确认文件完整，或将主模型和配套文件一起上传。'); cleanup(); cleanup = () => {}; }
    });
    return () => { cancelled = true; abort.abort(); cleanup(); };
  }, [src, retry]);

  return <div ref={wrapper} tabIndex={-1} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={expanded ? '全屏三维模型' : undefined} className={`model-viewer ${expanded ? 'is-expanded' : ''} ${className}`}>
    {poster && state !== 'ready' && <img className="model-poster" src={poster} alt="作品预览"/>}
    <div ref={host} tabIndex={interactive ? 0 : -1} className="model-canvas-host" style={{ opacity: state === 'ready' ? 1 : 0 }}/>
    {state === 'loading' && <span className="model-status" role="status">{message}</span>}
    {state === 'error' && <div className={`model-error ${poster ? 'with-poster' : ''}`} role="status"><span>{message || '暂时无法打开三维预览，可稍后重试。'}</span><button type="button" onClick={() => setRetry(value => value + 1)}>重新加载模型</button></div>}
    {interactive && (state === 'ready' || expanded) && <div className="model-actions">{state === 'ready' && <button type="button" onClick={() => actions.current?.fit()} aria-label="自动居中模型" title="自动居中 / 适应窗口"><Focus size={17}/><span>居中</span></button>}<button type="button" onClick={() => void toggleFullscreen()} aria-label={expanded ? '退出模型全屏' : '全屏查看模型'} aria-pressed={expanded}>{expanded ? <Minimize size={17}/> : <Maximize size={17}/>}<span>{expanded ? '退出全屏' : '全屏'}</span></button></div>}
    {expanded && <div className="model-fullscreen-help">左键旋转 · 右键平移 · 滚轮缩放 · 双击聚焦 · R 复位<span>触屏：单指旋转，双指缩放与平移，双击聚焦</span><button type="button" onClick={() => actions.current?.reset()}>视角复位</button></div>}
  </div>;
}
