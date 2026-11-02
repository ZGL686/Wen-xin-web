import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { zipSync } from 'three/addons/libs/fflate.module.js';
const root=path.resolve(import.meta.dirname,'..');
const runtime=path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=createRequire(runtime)('playwright');
const origin=process.argv[2]||'http://127.0.0.1:5173',production=origin.startsWith('https:');
const output=path.join(root,'outputs/viewer');mkdirSync(output,{recursive:true});
const checks=[],errors=[], downloads=[];let modelRequests=0;
const check=(v,n)=>{assert(v,n);checks.push(n);console.log('PASS '+n)};
const hash=b=>createHash('sha256').update(b).digest('hex');
const encoder=new TextEncoder();
const triangle=new Float32Array([-1,-1,0,1,-1,0,0,1,0]);
const document={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],materials:[{pbrMetallicRoughness:{baseColorFactor:[.2,.6,.3,1],roughnessFactor:.5}}],buffers:[{byteLength:triangle.byteLength,uri:'data:application/octet-stream;base64,'+Buffer.from(triangle.buffer).toString('base64')}],bufferViews:[{buffer:0,byteLength:triangle.byteLength}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[-1,-1,0],max:[1,1,0]}]};
const external=structuredClone(document);external.buffers[0].uri='../data/triangle.bin';
const obj='o triangle\nv -1 -1 0\nv 1 -1 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt .5 1\nf 1/1 2/2 3/3\n';
const textured='mtllib triangle.mtl\nusemtl test\n'+obj;
const stl='solid triangle\nfacet normal 0 0 1\nouter loop\nvertex -1 -1 0\nvertex 1 -1 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid triangle';
const files={
 'gltf':Buffer.from(JSON.stringify(document)), 'obj':Buffer.from(obj),'stl':Buffer.from(stl),
 'fbx':readFileSync(path.join(root,'../deliverables/Keyboard_Rapoo_20261029/Keyboard_Rapoo.fbx')),
 'step':readFileSync(path.join(root,'node_modules/occt-import-js/test/testfiles/simple-basic-cube/cube.stp')),
 'stp':readFileSync(path.join(root,'node_modules/occt-import-js/test/testfiles/simple-basic-cube/cube.stp')),
 'zip':Buffer.from(zipSync({'models/triangle.gltf':encoder.encode(JSON.stringify(external)),'data/triangle.bin':new Uint8Array(triangle.buffer)}))
};
if(existsSync(path.join(output,'draco/Box.gltf')))files['draco.zip']=Buffer.from(zipSync({'Box.gltf':readFileSync(path.join(output,'draco/Box.gltf')),'Box.bin':readFileSync(path.join(output,'draco/Box.bin'))}));
const unicode=structuredClone(document);unicode.buffers[0].uri='../材质/triangle.bin';
files['unicode.zip']=Buffer.from(zipSync({'参考 模型/scene.gltf':encoder.encode(JSON.stringify(unicode)),'材质/triangle.bin':new Uint8Array(triangle.buffer),'另一份/triangle.bin':encoder.encode('not the geometry')}));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-unsafe-swiftshader']});
let context,report;const createdIds=[];
try{
 context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(()=>{window.__qaFrames=0;const original=requestAnimationFrame;window.requestAnimationFrame=fn=>original.call(window,time=>{window.__qaFrames++;fn(time)})});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('download',d=>downloads.push(d.suggestedFilename()));
 page.on('request',r=>{if(r.url().includes('/portfolio/keyboard-rapoo.glb'))modelRequests++});
 const ready=async()=>{await page.waitForFunction(()=>{const canvas=window.document.querySelector('.detail-viewer canvas');return canvas&&canvas.parentElement.style.opacity==='1'},null,{timeout:120000})};
 await page.goto(origin+'/#/work/rapoo-keyboard',{waitUntil:'domcontentloaded'});await ready();
 check(true,'real keyboard GLB loads in existing detail page');
 await page.getByRole('button',{name:'自动旋转',exact:true}).click();await page.waitForTimeout(900);
 const canvas=page.locator('.detail-viewer canvas');const original=hash(await canvas.screenshot());const b=await canvas.boundingBox();
 const drag=async(button,dx,dy)=>{await page.mouse.move(b.x+b.width*.5,b.y+b.height*.5);await page.mouse.down({button});await page.mouse.move(b.x+b.width*(.5+dx),b.y+b.height*(.5+dy),{steps:14});await page.mouse.up({button});await page.waitForTimeout(800)};
 await drag('left',.17,.07);check(hash(await canvas.screenshot())!==original,'left drag rotates model');
 const rotated=hash(await canvas.screenshot());await drag('right',-.16,.04);check(hash(await canvas.screenshot())!==rotated,'right drag pans model');
 const panned=hash(await canvas.screenshot());await page.mouse.wheel(0,-340);await page.waitForTimeout(1000);check(hash(await canvas.screenshot())!==panned,'wheel performs smooth zoom');
 const beforeReset=modelRequests;await page.getByRole('button',{name:'重置',exact:true}).click();await page.waitForTimeout(1200);
 check(modelRequests===beforeReset,'view reset keeps loaded geometry without another model request');
 const reset=hash(await canvas.screenshot());await canvas.dblclick();await page.waitForTimeout(1100);check(hash(await canvas.screenshot())!==reset,'double click focuses a local model region');
 await page.getByRole('button',{name:'自动居中模型'}).click();await page.waitForTimeout(1000);
 check(await page.getByRole('button',{name:'自动旋转',exact:true}).getAttribute('aria-pressed')==='false','manual camera interaction pauses automatic rotation');
 await page.getByRole('button',{name:'全屏查看模型'}).click();await page.waitForTimeout(900);
 check(await page.getByRole('button',{name:'退出模型全屏'}).isVisible(),'fullscreen entry and responsive viewer');
 check(await page.evaluate(()=>window.document.querySelector('.model-viewer.is-expanded').getBoundingClientRect().width>=innerWidth-2),'fullscreen fills viewport');
 await page.getByRole('button',{name:'退出模型全屏'}).click();await page.waitForTimeout(900);
 check(await page.getByRole('button',{name:'全屏查看模型'}).isVisible(),'fullscreen exits and restores page');
 await page.evaluate(()=>{window.__qaFullscreen=Element.prototype.requestFullscreen;Element.prototype.requestFullscreen=undefined});
 await page.getByRole('button',{name:'全屏查看模型'}).click();await page.waitForTimeout(700);
 check(await page.getByRole('dialog',{name:'全屏三维模型'}).isVisible(),'fullscreen fallback works when native fullscreen is unavailable');
 await page.keyboard.press('Escape');await page.waitForTimeout(600);check(!(await page.getByRole('dialog',{name:'全屏三维模型'}).count()),'fallback fullscreen exits with Escape');
 await page.evaluate(()=>Element.prototype.requestFullscreen=window.__qaFullscreen);
 const frames=await page.evaluate(()=>window.__qaFrames);await page.waitForTimeout(700);check((await page.evaluate(()=>window.__qaFrames))-frames<5,'idle camera stops requesting animation frames');
 await page.screenshot({path:path.join(output,(production?'live':'local')+'-viewer.png'),fullPage:true});
 const baseline=await (await context.request.get(origin+'/api/works/rapoo-keyboard')).json();
 for(const [extension,bytes] of Object.entries(files)){
   const url='/portfolio/viewer-fixture.'+extension;
   const response=structuredClone(baseline);response.work.modelUrl=url;response.work.fileUrl='';response.work.title='Viewer fixture '+extension;
   response.versions.forEach(v=>{v.modelUrl=url;v.fileUrl='';v.title=response.work.title});
   await page.route('**/api/works/viewer-fixture',route=>route.fulfill({json:response}));
   await page.route('**/portfolio/viewer-fixture.'+extension,route=>route.fulfill({body:bytes,contentType:extension==='zip'?'application/zip':'application/octet-stream'}));
   await page.goto(origin+'/#/work/viewer-fixture',{waitUntil:'domcontentloaded'});await ready();check(true,'rendered '+extension+' via published model loader and WebGL');
   await page.unroute('**/api/works/viewer-fixture');
 }
 // OBJ material/texture and glTF external buffer bundles use the same resource resolver.
 const texture=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
 const materialBundle=Buffer.from(zipSync({'triangle.obj':encoder.encode(textured),'triangle.mtl':encoder.encode('newmtl test\nKd .3 .6 .2\nmap_Kd texture.gif\n'),'texture.gif':texture}));
 const response=structuredClone(baseline);response.work.modelUrl='/portfolio/material-fixture.zip';response.versions.forEach(v=>v.modelUrl=response.work.modelUrl);
 await page.route('**/api/works/viewer-fixture',r=>r.fulfill({json:response}));await page.route('**/portfolio/material-fixture.zip',r=>r.fulfill({body:materialBundle}));
 await page.reload({waitUntil:'domcontentloaded'});await ready();check(true,'OBJ MTL and texture load from an inert local bundle');
 await page.unroute('**/api/works/viewer-fixture');
 if(!production){
 const safety=await page.evaluate(async()=>{
   const {loadModel,disposeModel,bundleModelFiles}=await import('/src/model-loader.ts');
   const bad={asset:{version:'2.0'},buffers:[{uri:'https://example.invalid/private.bin',byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0};
   let blocked=false;try{await loadModel(new File([JSON.stringify(bad)],'bad.gltf'))}catch{blocked=true}
   const controller=new AbortController();controller.abort();let cancelled=false;try{await loadModel(new File(['STEP'],'cancel.step'),{signal:controller.signal})}catch(e){cancelled=e.name==='AbortError'}
   const packed=await bundleModelFiles([new File(['v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3'],'part.obj'),new File(['unused'],'note.txt')]);
   const model=await loadModel(packed);disposeModel(model);
   return{blocked,cancelled,packed:packed.name.endsWith('.zip')};
  });check(safety.blocked,'unprovided external glTF URLs are rejected');check(safety.cancelled,'cancelled loads abort before parsing');check(safety.packed,'multi-file upload creates a readable preview bundle');
  for(const [file,bytes] of [['unsafe.zip',zipSync({'../triangle.obj':encoder.encode(obj)})],['ambiguous.zip',zipSync({'a.obj':encoder.encode(obj),'b.obj':encoder.encode(obj)})]]){
   const blocked=await page.evaluate(async({file,bytes})=>{const{loadModel}=await import('/src/model-loader.ts');try{await loadModel(new File([new Uint8Array(bytes)],file));return false}catch{return true}},{file,bytes:Array.from(bytes)});
   check(blocked,'reject invalid model bundle '+file);
  }
  await page.unroute('**/api/works/viewer-fixture');
  for(const mode of ['step','bundle']){
   await page.goto(origin+'/#/upload',{waitUntil:'domcontentloaded'});await page.locator('#work-title').waitFor({timeout:20000});
   await page.locator('#work-title').fill('QA viewer private '+mode);await page.locator('#work-direction').selectOption('三维');
   if(mode==='step')await page.locator('.upload-form input[type=file]').first().setInputFiles({name:'cube.step',mimeType:'model/step',buffer:files.step});
   else {
    const doc=structuredClone(document);doc.buffers[0].uri='triangle.bin';
    await page.locator('input[accept*=".gltf"]').setInputFiles([{name:'triangle.gltf',mimeType:'model/gltf+json',buffer:Buffer.from(JSON.stringify(doc))},{name:'triangle.bin',mimeType:'application/octet-stream',buffer:Buffer.from(triangle.buffer)}]);
    await page.getByText('triangle-preview.zip',{exact:true}).waitFor();
   }
   const saved=page.waitForResponse(r=>r.url().endsWith('/api/works')&&r.request().method()==='POST',{timeout:180000});
   await page.getByRole('button',{name:'先保存这一刻',exact:true}).click();const r=await saved;assert.equal(r.status(),201);const data=await r.json();createdIds.push(data.work.id);
   check(data.work.visibility==='private'&&data.isOwner,'real '+mode+' upload stays private');await ready();check(true,'saved '+mode+' preview reads authenticated R2 bytes');
   check(data.work.images.length>0,'automatic '+mode+' cover generated from model');
   const stranger=await browser.newContext();check((await stranger.request.get(origin+data.work.modelUrl)).status()===404,'private '+mode+' preview denied to other browser');await stranger.close();
   check(errors.length===0,'no upload or rendering runtime errors for '+mode);
  }
 }
 const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1});const touch=await mobile.newPage();
 await touch.goto(origin+'/#/work/rapoo-keyboard',{waitUntil:'domcontentloaded'});await touch.waitForFunction(()=>{const c=window.document.querySelector('.detail-viewer canvas');return c&&c.parentElement.style.opacity==='1'},null,{timeout:90000});
 await touch.getByRole('button',{name:'自动旋转',exact:true}).click();await touch.waitForTimeout(600);const touchCanvas=touch.locator('.detail-viewer canvas');await touchCanvas.scrollIntoViewIfNeeded();
 const rect=await touchCanvas.boundingBox(),cx=rect.x+rect.width/2,cy=rect.y+rect.height/2;
 const cdp=await mobile.newCDPSession(touch);
 const gesture=async(start,end)=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:start});for(let t=1;t<=12;t++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:start.map((p,i)=>({...p,x:p.x+(end[i].x-p.x)*t/12,y:p.y+(end[i].y-p.y)*t/12}))})}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.waitForTimeout(800)};
 let pixels=hash(await touchCanvas.screenshot());await gesture([{id:1,x:cx,y:cy}],[{id:1,x:cx+60,y:cy+30}]);check(hash(await touchCanvas.screenshot())!==pixels,'touch single finger rotates');
 pixels=hash(await touchCanvas.screenshot());await gesture([{id:1,x:cx-30,y:cy},{id:2,x:cx+30,y:cy}],[{id:1,x:cx-70,y:cy},{id:2,x:cx+70,y:cy}]);check(hash(await touchCanvas.screenshot())!==pixels,'touch pinch zooms');
 pixels=hash(await touchCanvas.screenshot());await gesture([{id:1,x:cx-30,y:cy},{id:2,x:cx+30,y:cy}],[{id:1,x:cx,y:cy+25},{id:2,x:cx+60,y:cy+25}]);check(hash(await touchCanvas.screenshot())!==pixels,'touch two fingers pan');
 await touch.getByRole('button',{name:'重置',exact:true}).click();await touch.waitForTimeout(900);await touchCanvas.scrollIntoViewIfNeeded();
 const tapBox=await touchCanvas.boundingBox();pixels=hash(await touchCanvas.screenshot());
 for(let i=0;i<2;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:tapBox.x+tapBox.width/2,y:tapBox.y+tapBox.height/2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.waitForTimeout(70)}
 await touch.waitForTimeout(900);check(hash(await touchCanvas.screenshot())!==pixels,'touch double tap focuses a model region');
 check(await touch.evaluate(()=>window.document.documentElement.scrollWidth<=innerWidth+1),'390px viewer page has no horizontal overflow');
 await touch.screenshot({path:path.join(output,(production?'live':'local')+'-mobile.png'),fullPage:true});await mobile.close();
 check(downloads.length===0,'preview never starts a browser file download');check(errors.length===0,'no page runtime errors');
 report={result:'passed',origin,checks,errors,modelRequests,fixtureMode:production?'client-side request fixtures; no R2 work writes':'client-side fixtures plus real local private uploads',downloads};
}catch(error){console.error('VIEWER_QA_FAILED',error.message);throw error}finally{
 if(context)for(const id of createdIds){const deleted=await context.request.delete(origin+'/api/works/'+id,{headers:{Origin:origin},timeout:60000});assert.equal(deleted.status(),200,'clean up own private local fixture')}
 await browser.close();
 if(report){report.cleanedOwnLocalWorks=createdIds.length;writeFileSync(path.join(output,(production?'live':'local')+'-qa.json'),JSON.stringify(report,null,2))}
}
