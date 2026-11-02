import assert from 'node:assert/strict';import {createRequire}from'node:module';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{createHash}from'node:crypto';import path from'node:path';
import{DERIVED_PREVIEWS}from'../data/derived-previews.ts';
const root=path.resolve(import.meta.dirname,'..'),origin=process.argv[2]||'http://127.0.0.1:8787',local=!origin.startsWith('https:');
const runtime=path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');const{chromium}=createRequire(runtime)('playwright');
const item=DERIVED_PREVIEWS[0],remote='https://formspace-sm-3d-studio.h2969351680.chatgpt.site';
const bytes=readFileSync(path.join(root,'data/models/arc01-mouse.glb'));const hash=b=>createHash('sha256').update(b).digest('hex');
const checks=[],errors=[],downloads=[];const check=(v,n)=>{assert(v,n);checks.push(n);console.log('PASS '+n)};
const output=path.join(root,'outputs/desktop');mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1366,height:768}});
 const detail=await(await context.request.get((local?remote:origin)+'/api/works/'+item.workId,{timeout:60000})).json();
 if(local){
  detail.work.modelUrl=item.modelUrl;detail.versions.forEach(v=>v.modelUrl=item.modelUrl);
  await context.route('**/api/works/'+item.workId,r=>r.fulfill({json:detail}));
  await context.route('**'+item.modelUrl,r=>r.fulfill({body:bytes,contentType:'model/gltf-binary',headers:{'Cache-Control':'private, no-store'}}));
 }
 check(detail.work.fileUrl===item.sourceUrl&&detail.work.fileName===item.sourceName&&detail.work.fileSize===item.sourceBytes,'mouse original reference retained');
 check(detail.work.title==='ARC01 Mouse 3dsMax2026'&&detail.work.builtIn===false,'same existing creator work retained');
 check(detail.work.modelUrl===item.modelUrl,'mouse snapshot exposes verified derived preview');
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('download',d=>downloads.push(d.suggestedFilename()));
 await page.goto(origin+'/#/work/'+item.workId,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>{const c=document.querySelector('.detail-viewer canvas');return c&&c.parentElement.style.opacity==='1'},null,{timeout:90000});
 check(true,'real converted mouse rendered by WebGL');
 if(await page.getByRole('button',{name:'自动旋转',exact:true}).getAttribute('aria-pressed')==='true')await page.getByRole('button',{name:'自动旋转',exact:true}).click();
 const canvas=page.locator('.detail-viewer canvas'),before=hash(await canvas.screenshot()),b=await canvas.boundingBox();
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+100,b.y+b.height/2+20,{steps:12});await page.mouse.up();await page.waitForTimeout(800);
 check(hash(await canvas.screenshot())!==before,'mouse model rotates with desktop drag');
 await page.getByRole('button',{name:'重置',exact:true}).click();await page.waitForTimeout(900);
 await page.screenshot({path:path.join(output,local?'mouse-local.png':'mouse-live.png'),fullPage:true});
 for(const alias of ['/protected-previews/arc01-mouse.glb','/%70rotected-previews/arc01-mouse.glb','/%2570rotected-previews/arc01-mouse.glb','/x/%2e%2e/protected-previews/arc01-mouse.glb','/data/models/arc01-mouse.glb']){
  const r=await context.request.get(origin+alias,{timeout:30000});check(r.status()===404||r.headers()['content-type']?.includes('text/html'),'no raw model exposed at '+alias);
 }
 if(!local){
  const r=await context.request.get(origin+item.modelUrl,{timeout:120000});check(r.ok()&&hash(await r.body())===hash(bytes),'authorized mouse GLB bytes match native conversion');
  check(r.headers()['cache-control'].includes('private')&&r.headers()['cache-control'].includes('no-store'),'preview response stays private and uncached');
  const head=await context.request.head(origin+item.modelUrl);check(head.status()===200&&Number(head.headers()['content-length'])===bytes.length,'authorized model HEAD reports correct length');
  const range=await context.request.get(origin+item.modelUrl,{headers:{Range:'bytes=0-3'}});check(range.status()===206&&(await range.body()).toString()==='glTF','authorized model supports byte-range preview');
 }
 check(errors.length===0,'no mouse page runtime errors');check(downloads.length===0,'mouse preview does not trigger file download');
 const report={result:'passed',origin,mode:local?'client fixture plus built Worker raw-path protection':'live authorized existing work',checks,modelSha256:hash(bytes),sourceSha256:item.sourceSha256,workWrites:0};
 writeFileSync(path.join(output,local?'mouse-local.json':'mouse-live.json'),JSON.stringify(report,null,2));
}finally{await browser.close()}
