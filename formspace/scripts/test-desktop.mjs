import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),origin=process.argv[2]||'http://127.0.0.1:5173';
const runtime=path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=createRequire(runtime)('playwright');
const out=path.join(root,'outputs/desktop');mkdirSync(out,{recursive:true});
const checks=[],errors=[],downloads=[];const requests=new Map();
const check=(value,label)=>{assert(value,label);checks.push(label);console.log('PASS '+label)};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('download',d=>downloads.push(d.suggestedFilename()));
 page.on('request',r=>{if(/\.glb(?:\?|$)/.test(r.url()))requests.set(r.url(),(requests.get(r.url())||0)+1)});
 const navigate=async(route)=>{await page.goto(origin+'/#'+route,{waitUntil:'domcontentloaded'});await page.locator('main').waitFor()};
 const ready=async(selector)=>{await page.waitForFunction(selector=>{const canvas=document.querySelector(selector+' canvas');return canvas&&canvas.parentElement.style.opacity==='1'},selector,{timeout:90000})};
 const drag=async(canvas,button='left',dx=90,dy=20)=>{const b=await canvas.boundingBox();await page.mouse.move(b.x+b.width*.5,b.y+b.height*.5);await page.mouse.down({button});await page.mouse.move(b.x+b.width*.5+dx,b.y+b.height*.5+dy,{steps:12});await page.mouse.up({button});await page.waitForTimeout(800)};
 await navigate('/');await ready('.hero-viewer');const hero=page.locator('.hero-viewer canvas');
 await drag(hero);
 check(await page.getByRole('button',{name:'开启自动旋转',exact:true}).isVisible(),'homepage rotation button reflects manual camera control');
 const total=()=>[...requests.values()].reduce((a,b)=>a+b,0);const before=total();
 const originalNode=await hero.elementHandle();
 await page.getByRole('button',{name:'重置展示角度',exact:true}).click();await page.waitForTimeout(1000);
 check(total()===before,'homepage reset does not request model again');
 check(await hero.evaluate((node,original)=>node===original,originalNode),'homepage reset retains the same WebGL canvas');
 const host=page.locator('.hero-viewer .model-canvas-host');await host.focus();
 let pixels=hash(await hero.screenshot());await page.keyboard.press('ArrowRight');await page.waitForTimeout(800);check(hash(await hero.screenshot())!==pixels,'desktop arrow key rotates homepage model');
 pixels=hash(await hero.screenshot());await page.keyboard.press('Equal');await page.waitForTimeout(800);check(hash(await hero.screenshot())!==pixels,'desktop plus key zooms homepage model');
 await page.keyboard.press('r');await page.waitForTimeout(900);check(total()===before,'keyboard reset keeps loaded geometry');
 await page.screenshot({path:path.join(out,'home-1366.png')});
 await navigate('/works');
 const preview=page.getByRole('button',{name:'转一转，看看细节：RAPOO · 104 键键盘',exact:true});await preview.waitFor();await preview.click();
 const card=page.locator('.card-is-active');await ready('.card-is-active');
 await card.getByRole('button',{name:'全屏查看模型'}).click();await page.waitForTimeout(700);
 check(await page.evaluate(()=>{const node=document.querySelector('.model-viewer.is-expanded');return node&&node.getBoundingClientRect().width>=innerWidth-2&&node.getBoundingClientRect().height>=innerHeight-2}),'desktop work-card preview fills fullscreen viewport');
 await page.getByRole('button',{name:'退出模型全屏'}).click();await page.getByRole('button',{name:'停止预览：RAPOO · 104 键键盘',exact:true}).click();
 check(await page.locator('.card-is-active').count()===0,'desktop card preview stops cleanly');
 await navigate('/work/rapoo-keyboard');await ready('.detail-viewer');
 const canvas=page.locator('.detail-viewer canvas');
 if(await page.getByRole('button',{name:'自动旋转',exact:true}).getAttribute('aria-pressed')==='true')await page.getByRole('button',{name:'自动旋转',exact:true}).click();
 await page.waitForTimeout(600);pixels=hash(await canvas.screenshot());await drag(canvas,'right');check(hash(await canvas.screenshot())!==pixels,'desktop right mouse drag pans detail model');
 pixels=hash(await canvas.screenshot());await page.mouse.wheel(0,-220);await page.waitForTimeout(800);check(hash(await canvas.screenshot())!==pixels,'desktop mouse wheel zooms detail model');
 await page.getByRole('button',{name:'重置',exact:true}).click();await page.waitForTimeout(1000);
 pixels=hash(await canvas.screenshot());await canvas.dblclick();await page.waitForTimeout(900);check(hash(await canvas.screenshot())!==pixels,'desktop double click focuses model detail');
 await page.getByRole('button',{name:'自动居中模型'}).click();await page.waitForTimeout(700);
 await page.getByRole('button',{name:'线框',exact:true}).click();check(await page.getByRole('button',{name:'线框',exact:true}).getAttribute('aria-pressed')==='true','desktop wireframe control works');await page.getByRole('button',{name:'线框',exact:true}).click();
 for(const viewport of [{width:1280,height:720},{width:1366,height:768},{width:1920,height:1080}]){
  await page.setViewportSize(viewport);
  for(const route of ['/','/works','/work/rapoo-keyboard','/upload']){
   await navigate(route);
   if(route==='/')await ready('.hero-viewer');
   if(route==='/work/rapoo-keyboard')await ready('.detail-viewer');
   if(route==='/works')await page.locator('.work-card').first().waitFor();
   if(route==='/upload')await page.locator('#work-title').waitFor();
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),viewport.width+'x'+viewport.height+' '+route+' has no horizontal overflow');
  }
  await navigate('/work/rapoo-keyboard');await ready('.detail-viewer');
  await page.screenshot({path:path.join(out,'detail-'+viewport.width+'.png'),fullPage:true});
 }
 const response=await context.request.get(origin+'/api/works?scope=public');const publicData=await response.json();
 check(['lamp','sofa','cabinet','house','rapoo-keyboard'].every(id=>publicData.works.some(work=>work.id===id)),'existing system works remain available');
 check(errors.length===0,'no desktop page runtime errors');check(downloads.length===0,'desktop preview never starts file download');
 const report={result:'passed',origin,browser:'Microsoft Edge',version:browser.version(),viewportSizes:['1280x720','1366x768','1920x1080'],checks,errors,downloads,workWrites:0,publicCount:publicData.works.length};
 writeFileSync(path.join(out,origin.startsWith('https:')?'live.json':'local.json'),JSON.stringify(report,null,2));
}finally{await browser.close()}
