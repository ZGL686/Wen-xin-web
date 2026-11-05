import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..'),origin=process.argv[2]||'http://127.0.0.1:5173';
const seeds=JSON.parse(readFileSync(path.join(root,'data/works.json'),'utf8')),expected=seeds.find(work=>work.id==='house');
const {chromium}=createRequire(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json'))('playwright');
const out=path.join(root,'outputs/house');mkdirSync(out,{recursive:true});
const checks=[],errors=[],downloads=[];
const check=(value,label)=>{assert(value,label);checks.push(label);console.log('PASS '+label)};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));page.on('download',download=>downloads.push(download.suggestedFilename()));
 const publicResponse=await context.request.get(origin+'/api/works?scope=public');check(publicResponse.ok(),'public gallery API succeeds');
 const publicData=await publicResponse.json();
 check(seeds.every(seed=>publicData.works.some(work=>work.id===seed.id&&work.title===seed.title)),'all existing system works remain in the gallery');
 const response=await context.request.get(origin+'/api/works/house');check(response.ok(),'house detail API succeeds');
 const detail=await response.json(),work=detail.work;
 check(work.id==='house'&&work.builtIn&&!detail.isOwner,'existing system house identity is retained');
 for(const key of ['title','fileName','fileSize','modelUrl','coverUrl','objects','triangles','dimensions'])check(work[key]===expected[key],'current house '+key+' matches source');
 for(const url of [...new Set([expected.fileUrl,expected.modelUrl,expected.coverUrl,...expected.images])]){
  const asset=await context.request.get(origin+url,{timeout:180000});check(asset.ok(),'asset is readable: '+url);
  check(hash(await asset.body())===hash(readFileSync(path.join(root,'public',url.replace(/^\//,'')))),'asset bytes match: '+url);
 }
 await page.goto(origin+'/#/work/house',{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:expected.title,exact:true}).waitFor();
 await page.waitForFunction(()=>{const canvas=document.querySelector('.detail-viewer canvas');return canvas&&canvas.parentElement.style.opacity==='1'},null,{timeout:90000});
 const canvas=page.locator('.detail-viewer canvas');
 if(await page.getByRole('button',{name:'自动旋转',exact:true}).getAttribute('aria-pressed')==='true')await page.getByRole('button',{name:'自动旋转',exact:true}).click();
 await page.waitForTimeout(500);let pixels=hash(await canvas.screenshot());const box=await canvas.boundingBox();
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+100,box.y+box.height*.5+25,{steps:12});await page.mouse.up();await page.waitForTimeout(800);
 check(hash(await canvas.screenshot())!==pixels,'actual house model rotates');
 pixels=hash(await canvas.screenshot());await page.mouse.wheel(0,-220);await page.waitForTimeout(800);check(hash(await canvas.screenshot())!==pixels,'actual house model zooms');
 await page.getByRole('button',{name:'重置',exact:true}).click();await page.waitForTimeout(700);
 await page.getByRole('button',{name:'线框',exact:true}).click();check(await page.getByRole('button',{name:'线框',exact:true}).getAttribute('aria-pressed')==='true','house wireframe works');await page.getByRole('button',{name:'线框',exact:true}).click();
 await page.screenshot({path:path.join(out,origin.startsWith('https:')?'live-model.png':'local-model.png'),fullPage:true});
 await page.getByRole('button',{name:'图片',exact:true}).click();await page.locator('.detail-image').waitFor();
 check(await page.locator('.detail-image').evaluate(image=>image.complete&&image.naturalWidth>0),'house cover displays');
 if(expected.images.length>1){await page.getByRole('button',{name:'下一张图片',exact:true}).click();check((await page.locator('.detail-image').getAttribute('src'))===expected.images[1],'alternate render displays');}
 await page.getByRole('button',{name:'放大图片',exact:true}).click();check(await page.getByRole('dialog',{name:'作品图片大图'}).isVisible(),'house image lightbox opens');await page.keyboard.press('Escape');
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'house page has no horizontal overflow');
 check(errors.length===0,'no house page runtime errors');check(downloads.length===0,'preview does not start file download');
 writeFileSync(path.join(out,origin.startsWith('https:')?'live.json':'local.json'),JSON.stringify({result:'passed',origin,checks,errors,downloads,workWrites:0,browser:browser.version(),workId:work.id,publicIds:publicData.works.map(item=>item.id).sort()},null,2));
}finally{await browser.close()}
