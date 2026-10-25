import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
const root=path.resolve(import.meta.dirname,'..');
const source=path.resolve(root,'../portfolio-assets');
const original=path.resolve(root,'..');
const assets=JSON.parse(await readFile(path.join(source,'assets.json'),'utf8'));
const works=JSON.parse(await readFile(path.join(root,'data/works.json'),'utf8'));
await mkdir(path.join(root,'public/portfolio'),{recursive:true});
await mkdir(path.join(root,'public/originals'),{recursive:true});
for(const asset of assets){
 const work=works.find(w=>w.id===asset.id);
 await copyFile(path.join(source,asset.glb),path.join(root,'public/portfolio',asset.glb));
 await sharp(path.join(source,asset.image)).webp({quality:88,alphaQuality:95}).toFile(path.join(root,'public/portfolio',asset.id+'.webp'));
 const bytes=await readFile(path.join(original,asset.original_file));
 const digest=createHash('sha256').update(bytes).digest('hex');
 if(digest.toLowerCase()!==asset.original_sha256.toLowerCase())throw new Error('Source file changed: '+asset.id);
 await writeFile(path.join(root,'public',work.fileUrl),bytes);
 work.objects=asset.visible_meshes;
 work.dimensions=asset.source_bounds_metres.map(n=>(n*100).toFixed(1)).join(' × ')+' cm';
 work.triangles=asset.triangles;
 work.materialNote=asset.material_note;
 if(asset.id==='sofa'){work.title='Cloud Bear · 云朵熊沙发';work.description='熊耳、爪掌与圆润体块，把童趣放进日常生活。柔软的坐垫和饱满的扶手组成这件家具建模作品。可以在三维视图中自由查看结构，也可下载原始 MAX 场景继续编辑。';work.tags=['沙发','童趣家具','3ds Max'];}
}
await writeFile(path.join(root,'data/works.json'),JSON.stringify(works,null,2)+'\n');
await writeFile(path.join(root,'public/portfolio/verification.json'),JSON.stringify(assets,null,2)+'\n');
console.log('Imported '+assets.length+' original MAX files, verified hashes, GLB models and WebP covers.');
