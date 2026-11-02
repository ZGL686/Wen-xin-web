import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),origin=process.argv[2]||'http://127.0.0.1:5173',live=origin.startsWith('https:');
const {chromium}=createRequire(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json'))('playwright');
const output=path.join(root,'outputs/editing');mkdirSync(output,{recursive:true});
const checks=[],errors=[],ids=new Set(),tag='QA-creation-'+Date.now();let writes=0,deletes=0;
const check=(value,label)=>{assert(value,label);checks.push(label);console.log('PASS '+label)};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-unsafe-swiftshader']});
let context,page;const cleanup=[];
try{
 context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',async r=>{if(r.request().method()==='POST'&&r.url()===origin+'/api/works'&&r.status()===201){try{ids.add((await r.json()).work.id)}catch{}}});
 page.on('request',r=>{if(r.url()===origin+'/api/works'&&r.method()==='POST')writes++;if(r.method()==='DELETE')deletes++});
 const initial=await(await context.request.get(origin+'/api/works?scope=public')).json();
 const navigate=async route=>{await page.goto(origin+'/#'+route,{waitUntil:'domcontentloaded'});await page.locator('main').waitFor()};
 const content=label=>page.getByRole('group',{name:'添加内容的方式'}).getByRole('button',{name:new RegExp('^'+label)});
 const save=async(existing=false)=>{
  const response=page.waitForResponse(r=>r.request().method()===(existing?'PUT':'POST')&&(existing?r.url().includes('/api/works/'):r.url()===origin+'/api/works'),{timeout:210000});
  await page.getByRole('button',{name:existing?'保存这一版':'先保存这一刻',exact:true}).click();const r=await response;
  assert.equal(r.status(),existing?200:201);const data=await r.json();ids.add(data.work.id);await page.locator('.owner-work-banner').waitFor();return data;
 };
 await navigate('/upload');await page.locator('#work-title').waitFor();
 check(await page.locator('.creation-accordion[open]').count()===0,'optional introduction, process and settings start collapsed');
 check(await page.locator('textarea:visible').count()===0,'initial page shows required content without optional text walls');
 check((await page.locator('main').innerText()).replace(/\s/g,'').length<500,'initial visible copy stays below half the previous form');
 await page.screenshot({path:path.join(output,live?'form-live.png':'form-local.png'),fullPage:true});
 await page.locator('#work-title').fill(tag);await page.locator('#work-direction').selectOption('三维');
 await content('文字').click();await page.locator('#content-text').fill('一段测试灵感，切换输入方式后继续保留。');
 await content('链接').click();await page.locator('#interactive-url').fill('https://example.com/creation-demo');
 await content('文字').click();check(await page.locator('#content-text').inputValue()==='一段测试灵感，切换输入方式后继续保留。','switching content panels preserves unsaved writing');
 await content('文件').click();
 await page.locator('input[type=file]').first().setInputFiles({name:'qa-original.txt',mimeType:'text/plain',buffer:Buffer.from('QA original bytes - preserve exactly')});
 await page.locator('.creation-media-options').first().locator('summary').click();
 await page.locator('input[accept*=".gltf"]').setInputFiles(path.join(root,'public/portfolio/cabinet.glb'));
 await page.getByText('cabinet.glb',{exact:true}).waitFor();
 check(await page.getByText('qa-original.txt',{exact:true}).isVisible(),'original and independent model are both retained');
 if(!live){
  await page.getByRole('button',{name:'移除原始文件',exact:true}).click();
  check(await page.getByText('qa-original.txt',{exact:true}).count()===0,'selected upload can be removed before saving');
  await page.locator('input[type=file]').first().setInputFiles({name:'qa-original.txt',mimeType:'text/plain',buffer:Buffer.from('QA original bytes - preserve exactly')});
 }
 await content('图片').click();await page.locator('input[accept="image/jpeg,image/png,image/webp,image/avif,image/gif"]').setInputFiles([path.join(root,'public/portfolio/cabinet.webp'),path.join(root,'public/portfolio/sofa.webp')]);
 await page.locator('.image-cover-choice').nth(1).click();
 check(await page.locator('.creation-summary-cover img').count()===1,'selected cover updates the compact live summary');
 await page.getByText('补充作品介绍',{exact:true}).click();await page.locator('#work-tags').fill('测试，产品设计');await page.locator('#work-subtitle').fill('这一页保留作品与过程');await page.locator('#work-description').fill('仅用于本轮验证，结束后删除。');
 await page.getByText('留下创作过程',{exact:true}).click();await page.locator('#process-process').fill('验证新增、续写和删除');await page.locator('#process-difficulties').fill('临时验证内容');await page.locator('#process-solutions').fill('保留私密权限');await page.locator('#process-reflection').fill('完成后清理');
 const first=await save();
 check(first.work.visibility==='private'&&first.isOwner,'real upload creates an owner-only private work');
 check(first.work.contentText.includes('测试灵感')&&first.work.interactiveUrl==='https://example.com/creation-demo'&&first.work.images.length===2&&Boolean(first.work.modelUrl),'files, images, writing and link survive the new layout');
 check(first.work.tags.includes('产品设计')&&first.work.process==='验证新增、续写和删除'&&first.work.reflection==='完成后清理','optional introduction and process are saved intact');
 check((await(await context.request.get(origin+first.work.fileUrl)).body()).toString()==='QA original bytes - preserve exactly','saved original bytes remain unchanged');
 const stranger=await browser.newContext();
 try{
  await stranger.request.post(origin+'/api/session',{headers:{Origin:origin}});
  check((await stranger.request.get(origin+'/api/works/'+first.work.id)).status()===404,'other browsers cannot read the private work');
  check((await stranger.request.delete(origin+'/api/works/'+first.work.id,{headers:{Origin:origin}})).status()===403,'other browsers cannot delete this work');
 }finally{await stranger.close()}
 await page.getByRole('button',{name:'删除作品',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'删除这件作品？'});await dialog.waitFor();
 check(await dialog.getByText(tag,{exact:true}).isVisible(),'detail delete control opens a dialog naming the exact work');
 check(await dialog.getByRole('button',{name:'保留作品',exact:true}).evaluate(n=>n===document.activeElement),'delete confirmation starts with safe keyboard focus');
 const deletesBefore=deletes;await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 check(deletes===deletesBefore&&(await context.request.get(origin+'/api/works/'+first.work.id)).status()===200,'Escape cancels without a delete request');
 await page.getByRole('link',{name:'继续编辑',exact:true}).click();await page.locator('#work-title').waitFor();
 await content('文字').click();await page.locator('#content-text').fill('第二版测试灵感');
 const second=await save(true);
 check(second.work.versionCount===2&&second.work.fileUrl===first.work.fileUrl&&second.work.modelUrl===first.work.modelUrl,'editing adds a version and retains existing files without reupload');
 if(!live){
  const published=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().endsWith('/publication'));
  await page.getByRole('button',{name:'公开展示第 2 版',exact:true}).click();assert.equal((await published).status(),200);
  check((await(await context.request.get(origin+'/api/works?scope=public')).json()).works.some(w=>w.id===first.work.id),'local public work can be managed without exposing private process');
 }
 await navigate('/space');const card=page.locator('.work-card').filter({has:page.getByRole('heading',{name:tag,exact:true})});await card.waitFor();
 check(await card.getByRole('button',{name:'删除作品：'+tag,exact:true}).isVisible(),'my space exposes a visible delete action on owned cards');
 await card.getByRole('button',{name:'收藏'+tag,exact:true}).click();
 await card.getByRole('button',{name:'删除作品：'+tag,exact:true}).click();await dialog.waitFor();
 await dialog.getByRole('button',{name:'保留作品',exact:true}).click();await dialog.waitFor({state:'hidden'});
 check(await card.isVisible(),'retain action closes confirmation and keeps the work');
 await card.getByRole('button',{name:'删除作品：'+tag,exact:true}).click();await dialog.waitFor();
 await page.screenshot({path:path.join(output,live?'delete-live.png':'delete-local.png'),animations:'disabled'});
 check(await dialog.locator('p').first().evaluate(n=>getComputedStyle(n).display==='block'&&n.scrollHeight<=n.clientHeight+1),'delete warning stays readable without work-card text truncation');
 if(!live){
  await page.route('**/api/works/'+first.work.id,async route=>{if(route.request().method()!=='DELETE')return route.continue();await new Promise(resolve=>setTimeout(resolve,800));await route.fulfill({status:503,json:{error:'暂时无法删除，请稍后重试。'}})});
  await dialog.getByRole('button',{name:'确认删除',exact:true}).click();await page.keyboard.press('Escape');
  check(await dialog.isVisible(),'pending deletion keeps confirmation visible and prevents an accidental close');
  await dialog.getByRole('alert').waitFor();
  check(await card.count()===1&&await dialog.isVisible(),'failed deletion keeps the work and shows a retryable dialog error');
  await page.unroute('**/api/works/'+first.work.id);
 }
 const deletion=page.waitForResponse(r=>r.request().method()==='DELETE'&&r.url()===origin+'/api/works/'+first.work.id);
 await dialog.getByRole('button',{name:'确认删除',exact:true}).click();assert.equal((await deletion).status(),200);ids.delete(first.work.id);
 await card.waitFor({state:'detached'});
 check((await context.request.get(origin+'/api/works/'+first.work.id)).status()===404,'confirmed deletion removes the work from the server');
 check((await context.request.get(origin+first.work.fileUrl)).status()===404&&(await context.request.get(origin+first.work.modelUrl)).status()===404,'deleted original and preview are no longer readable');
 check(!await page.evaluate(id=>JSON.parse(localStorage.getItem('formspace-favorites')||'[]').includes(id),first.work.id),'deletion also clears the stale favorite');
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('.creator-page').waitFor();
 check(await page.getByRole('heading',{name:tag,exact:true}).count()===0,'deleted card stays absent after reload');
 const textWork=await context.request.post(origin+'/api/works',{headers:{Origin:origin},data:{title:tag+'-detail',direction:'其他',contentText:'第二件私密验证作品'}});assert.equal(textWork.status(),201);const extra=(await textWork.json()).work;ids.add(extra.id);
 await navigate('/work/'+extra.id);await page.getByRole('button',{name:'删除作品',exact:true}).click();
 const detailDeletion=page.waitForResponse(r=>r.request().method()==='DELETE'&&r.url()===origin+'/api/works/'+extra.id);await page.getByRole('button',{name:'确认删除',exact:true}).click();assert.equal((await detailDeletion).status(),200);ids.delete(extra.id);await page.waitForURL('**/#/space');
 check(true,'detail deletion returns to my space after server confirmation');
 await navigate('/work/lamp');await page.locator('.detail-info h1').waitFor();check(await page.getByRole('button',{name:'删除作品',exact:true}).count()===0,'system exhibits have no delete action');
 for(const size of [{width:1280,height:720},{width:1920,height:1080},{width:390,height:844}]){
  await page.setViewportSize(size);await navigate('/upload');await page.locator('#work-title').waitFor();
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),size.width+'x'+size.height+' form has no horizontal overflow');
 }
 check(errors.length===0,'new form and delete dialog have no browser runtime errors');
 const final=await(await context.request.get(origin+'/api/works?scope=public')).json();
 check(JSON.stringify(initial.works.map(w=>w.id).sort())===JSON.stringify(final.works.map(w=>w.id).sort()),'all existing public works remain unchanged');
 writeFileSync(path.join(output,live?'live.json':'local.json'),JSON.stringify({result:'passed',origin,browser:'Microsoft Edge',version:browser.version(),checks,errors,privateWorksCreated:2,privateWorksDeleted:2,remainingKnownIds:[...ids],publicCount:final.works.length},null,2));
}finally{
 if(context){
  const mine=await context.request.get(origin+'/api/works?scope=mine').then(r=>r.ok()?r.json():null).catch(()=>null);
  for(const work of mine?.works||[])if(work.title===tag||work.title===tag+'-detail')ids.add(work.id);
  for(const id of ids){const response=await context.request.delete(origin+'/api/works/'+id,{headers:{Origin:origin},timeout:60000});assert([200,404].includes(response.status()),'Exact QA cleanup failed');cleanup.push(id)}
 }
 await browser.close();if(cleanup.length)console.log('Cleaned only '+cleanup.length+' exact private QA works');
}
