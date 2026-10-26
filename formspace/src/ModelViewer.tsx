import { useEffect, useRef, useState } from 'react';
type Props={src?:string;poster?:string;interactive?:boolean;autoRotate?:boolean;wireframe?:boolean;className?:string};
export default function ModelViewer({src,poster,interactive=true,autoRotate=true,wireframe=false,className=''}:Props){
 const host=useRef<HTMLDivElement>(null);
 const options=useRef({interactive,autoRotate,wireframe});
 options.current={interactive,autoRotate,wireframe};
 const [state,setState]=useState<'loading'|'ready'|'error'>(src?'loading':'error');
 useEffect(()=>{
  const container=host.current;if(!container||!src){setState('error');return;}
  let cancelled=false, frame=0, cleanup=()=>{};
  setState('loading');
  (async()=>{
   const THREE=await import('three');
   const [{OrbitControls},{RoomEnvironment}]=await Promise.all([import('three/addons/controls/OrbitControls.js'),import('three/addons/environments/RoomEnvironment.js')]);
   if(cancelled)return;
   const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
   renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
   renderer.setClearColor(0x000000,0);
   renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
   renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
   renderer.domElement.setAttribute('aria-label','三维作品，可拖动旋转、滚轮缩放，方向键旋转');
   container.appendChild(renderer.domElement);
   const scene=new THREE.Scene();
   const camera=new THREE.PerspectiveCamera(35,1,.01,200);
   const controls=new OrbitControls(camera,renderer.domElement);
   controls.enableDamping=true;controls.dampingFactor=.07;controls.autoRotateSpeed=.8;controls.enablePan=false;
   const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();const environment=pmrem.fromScene(room,.04);
   scene.environment=environment.texture;scene.environmentIntensity=.75;room.dispose();
   scene.add(new THREE.HemisphereLight(0xffffff,0xc4b99d,2));
   const key=new THREE.DirectionalLight(0xfff6e5,3.5);key.position.set(3,7,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=5;key.shadow.camera.bottom=-5;key.shadow.bias=-.0005;scene.add(key);
   const rim=new THREE.DirectionalLight(0xffffff,2);rim.position.set(-4,3,-2);scene.add(rim);
   const group=new THREE.Group();scene.add(group);
   let active=true,model:import('three').Object3D|undefined,fitSize:import('three').Vector3|undefined;
   const fitCamera=()=>{
    if(!fitSize)return;
    const direction=new THREE.Vector3(4.2,2.7,5.6).normalize();
    const right=new THREE.Vector3(direction.z,0,-direction.x).normalize();
    const up=new THREE.Vector3().crossVectors(direction,right);
    const tangent=Math.tan(camera.fov*Math.PI/360);let distance=0;
    for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){
     const corner=new THREE.Vector3(x*fitSize.x,y*fitSize.y,z*fitSize.z);
     distance=Math.max(distance,Math.max(Math.abs(corner.dot(up))/tangent,Math.abs(corner.dot(right))/(tangent*camera.aspect))+corner.dot(direction));
    }
    distance*=1.12;camera.position.copy(direction.multiplyScalar(distance));controls.minDistance=distance*.5;controls.maxDistance=distance*3;controls.target.set(0,0,0);controls.update();
   };
   const resize=()=>{const {width,height}=container.getBoundingClientRect();renderer.setSize(Math.max(1,width),Math.max(1,height));camera.aspect=Math.max(1,width)/Math.max(1,height);camera.updateProjectionMatrix();fitCamera();};
   const observer=new ResizeObserver(resize);observer.observe(container);resize();
   const visibility=new IntersectionObserver(([entry])=>{active=entry.isIntersecting;});visibility.observe(container);
   const keyboard=(e:KeyboardEvent)=>{if(!options.current.interactive)return;const angle=.14;if(['ArrowLeft','ArrowRight'].includes(e.key)){group.rotation.y+=(e.key==='ArrowLeft'?-1:1)*angle;e.preventDefault();}if(e.key==='+'||e.key==='-'){camera.position.multiplyScalar(e.key==='+'?.9:1.1);e.preventDefault();}};
   container.addEventListener('keydown',keyboard);
   const dispose=()=>{cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect();container.removeEventListener('keydown',keyboard);controls.dispose();scene.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();for(const mat of Array.isArray(object.material)?object.material:[object.material]){for(const value of Object.values(mat))if(value instanceof THREE.Texture)value.dispose();mat.dispose();}}});environment.dispose();pmrem.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
   cleanup=dispose;
   const ext=src.split('?')[0].split('.').pop()?.toLowerCase();
   if(ext==='obj'){
    const {OBJLoader}=await import('three/addons/loaders/OBJLoader.js');model=await new OBJLoader().loadAsync(src);
   }else if(ext==='stl'){
    const {STLLoader}=await import('three/addons/loaders/STLLoader.js');const geometry=await new STLLoader().loadAsync(src);geometry.rotateX(-Math.PI/2);model=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xbfc3ae,roughness:.5}));
   }else{
    const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');model=(await new GLTFLoader().loadAsync(src)).scene;
   }
   if(cancelled){model.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});return;}
   const box=new THREE.Box3().setFromObject(model);const size=box.getSize(new THREE.Vector3());const center=box.getCenter(new THREE.Vector3());
   const scale=3/Math.max(size.x,size.y,size.z,.001);model.position.sub(center);group.add(model);group.scale.setScalar(scale);
   model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({color:0x332f25,opacity:.13}));floor.rotation.x=-Math.PI/2;floor.position.y=-size.y*scale/2-.02;floor.receiveShadow=true;scene.add(floor);
   fitSize=size.clone().multiplyScalar(scale);fitCamera();
   setState('ready');
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   let lastWire:boolean|undefined;
   const render=()=>{frame=requestAnimationFrame(render);if(!active||document.hidden)return;const opts=options.current;controls.enabled=opts.interactive;controls.enableZoom=opts.interactive;controls.autoRotate=opts.autoRotate&&!reduced;if(lastWire!==opts.wireframe){group.traverse(o=>{if(o instanceof THREE.Mesh)for(const mat of Array.isArray(o.material)?o.material:[o.material])if('wireframe'in mat){mat.wireframe=opts.wireframe;if('color'in mat&&mat.color instanceof THREE.Color){mat.userData.originalColor??=mat.color.clone();mat.color.copy(opts.wireframe?new THREE.Color(0x3c4938):mat.userData.originalColor);}mat.needsUpdate=true;}});lastWire=opts.wireframe;}controls.update();renderer.render(scene,camera);};render();
  })().catch(()=>{if(!cancelled){setState('error');cleanup();cleanup=()=>{};}});
  return()=>{cancelled=true;cleanup();};
 },[src]);
 return <div className={`model-viewer ${className}`} style={{position:'relative',width:'100%',height:'100%',minHeight:220}}>
  {poster&&state!=='ready'&&<img src={poster} alt="作品预览" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain'}}/>}
  <div ref={host} tabIndex={interactive?0:-1} style={{position:'absolute',inset:0,opacity:state==='ready'?1:0,outlineOffset:-6}}/>
  {state==='loading'&&<span style={{position:'absolute',bottom:22,left:'50%',transform:'translateX(-50%)',fontSize:12,letterSpacing:1,color:'#6f7167'}}>正在打开三维空间…</span>}
  {state==='error'&&!poster&&<div style={{display:'grid',placeContent:'center',height:'100%',minHeight:260,textAlign:'center',color:'#77796e',gap:12}}><span style={{fontSize:64,fontWeight:200}}>◇</span><span>{src?'暂时无法打开三维预览，可下载原文件查看':'上传封面图片，让作品更生动'}</span></div>}
 </div>;
}
