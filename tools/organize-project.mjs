import {access,cp,mkdir,rename,readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const safe=(name)=>{const resolved=path.resolve(root,name);if(!resolved.startsWith(root+path.sep))throw new Error('Path outside project: '+name);return resolved;};
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
if(await exists(safe('.git')))throw new Error('Root Git already exists; organization is one-time and must not be replayed.');
const moves=[];
async function move(from,to){const source=safe(from),destination=safe(to);if(!await exists(source))throw new Error('Missing source '+from);if(await exists(destination))throw new Error('Destination already exists '+to);await mkdir(path.dirname(destination),{recursive:true});await rename(source,destination);moves.push({from,to});}
const names=['房子3d.max','柜子_补齐完成.max','AURELIA_Jade_Lamp.max','Sofa_3dsMax2026.max'];
const hashes={};for(const name of names)hashes[name]=createHash('sha256').update(await readFile(safe(name))).digest('hex');
await mkdir(safe('.local-history'),{recursive:true});
const gitBackup=safe('.local-history/formspace-git-before-organization');
if(await exists(gitBackup))throw new Error('Git backup already exists.');
await cp(safe('formspace/.git'),gitBackup,{recursive:true,errorOnExist:true,force:false});
for(const name of names)await move(name,'assets/source/'+name);
await move('portfolio-assets','assets/pipeline');
await move('work','archive/cabinet-20261011');
await move('archive/cabinet-20261011/package-workbuddy.mjs','tools/packaging/package-workbuddy.mjs');
await move('archive/cabinet-20261011/zip-workbuddy.py','tools/packaging/zip-workbuddy.py');
await move('交付文件','deliverables');
for(const item of await readdir(safe('wiki_memory/wiki_memory'),{withFileTypes:true})){await move('wiki_memory/wiki_memory/'+item.name,'wiki_memory/'+item.name);}
// Keep the now empty template wrapper locally for traceability, outside the Wiki.
await move('wiki_memory/wiki_memory','.local-history/empty-wiki-wrapper');
await move('formspace/.git','.git');
for(const name of names){const actual=createHash('sha256').update(await readFile(safe('assets/source/'+name))).digest('hex');if(actual!==hashes[name])throw new Error('Original changed '+name);}
await writeFile(safe('.local-history/organization-2026-10-26.json'),JSON.stringify({date:'2026-10-26',moves,originalHashes:hashes},null,2)+'\n');
console.log(JSON.stringify({moves:moves.length,originalsVerified:names.length,gitHistoryPreserved:true,backup:'.local-history/formspace-git-before-organization'}));
