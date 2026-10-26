import {readFile,access,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const fail=(message)=>{throw new Error(message);};
const resolve=(file)=>{const result=path.resolve(root,file);if(!result.startsWith(root+path.sep))fail('Path escapes project: '+file);return result;};
const bytes=async file=>{let data;try{data=await readFile(resolve(file));}catch{fail('Missing file: '+file);}if(data.subarray(0,100).toString().startsWith('version https://git-lfs.github.com/spec/v1'))fail('LFS pointer instead of asset: '+file+'. Run git lfs pull.');return data;};
const sha=data=>createHash('sha256').update(data).digest('hex');
const json=async file=>JSON.parse((await bytes(file)).toString('utf8').replace(/^\uFEFF/,''));
const works=await json('formspace/data/works.json');
const assets=await json('formspace/public/portfolio/verification.json');
if(assets.length!==4)fail('The verified initial four-work baseline is missing.');
for(const asset of assets){
 const work=works.find(w=>w.id===asset.id);if(!work)fail('Missing built-in '+asset.id);
 for(const file of ['assets/source/'+asset.original_file,'formspace/public/'+work.fileUrl.replace(/^\//,'')]){
  if(sha(await bytes(file)).toUpperCase()!==asset.original_sha256.toUpperCase())fail('Original hash mismatch: '+file);
 }
 for(const file of ['assets/pipeline/'+asset.glb,'formspace/public/portfolio/'+asset.glb]){
  const model=await bytes(file);
  if(model.toString('ascii',0,4)!=='glTF'||model.readUInt32LE(4)!==2||model.readUInt32LE(8)!==model.length)fail('Invalid GLB '+file);
  if(sha(model).toLowerCase()!==asset.glb_sha256.toLowerCase())fail('GLB hash mismatch '+file);
 }
 const cover=await bytes('formspace/public/'+work.coverUrl.replace(/^\//,''));
 if(cover.toString('ascii',0,4)!=='RIFF'||cover.toString('ascii',8,12)!=='WEBP')fail('Invalid cover '+asset.id);
}
const archive='deliverables/FormSpace_WorkBuddy_China_20261025.zip';
const expected=(await bytes(archive+'.sha256')).toString('utf8').trim().split(/\s+/)[0];
if(sha(await bytes(archive))!==expected)fail('Historical handoff ZIP hash mismatch');
try{await access(resolve('formspace/.git'));fail('Embedded formspace Git would become a gitlink.');}catch(error){if(error.message.startsWith('Embedded'))throw error;}
for(const file of ['AGENTS.md','wiki_memory/AGENTS.md','wiki_memory/当前状态/项目概览.md','tools/project-sync.ps1'])await bytes(file);
const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const privatePath=/(^|\/)(?:\.git|node_modules|\.sites-runtime|\.wrangler|\.local-history|__pycache__)(?:\/|$)|\.(?:pem|key|p12|pfx|sqlite|db|log)$/i;
const secret=/(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{32,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
let textFiles=0;
for(const file of new Set(paths)){
 let info;try{info=await stat(resolve(file));}catch{continue;}
 if(!info.isFile())continue;
 if(privatePath.test(file)||(/(^|\/)\.(?:env|dev\.vars)(?:\.|$)/i.test(file)&&!file.endsWith('.example')))fail('Private/runtime path would be tracked: '+file);
 if(info.size<2*1024*1024&&/\.(?:md|json|yml|yaml|ts|tsx|mjs|py|ps1|ms)$/.test(file)){
  const content=await readFile(resolve(file),'utf8');if(secret.test(content))fail('Possible credential in '+file);textFiles++;
 }
}
for(const privateName of ['.env','formspace/.env.production','formspace/node_modules/probe','deliverables/FormSpace_WorkBuddy_China_20261025/源码/probe','.local-history/probe','assets/pipeline/probe.log']){
 try{execFileSync('git',['check-ignore','-q',privateName],{cwd:root});}catch{fail('Ignore boundary missing: '+privateName);}
}
console.log(JSON.stringify({result:'passed',originals:assets.length,downloadCopies:assets.length,glbPairs:assets.length,covers:assets.length,handoffSha256:expected,textFilesScanned:textFiles}));
