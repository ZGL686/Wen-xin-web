import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
for(const [name,source,files] of [
  ['occt','occt-import-js/dist',['occt-import-js.js','occt-import-js.wasm','license.occt.txt','license.occt-import-js.txt']],
  ['draco','three/examples/jsm/libs/draco/gltf',['draco_wasm_wrapper.js','draco_decoder.wasm']],
  ['basis','three/examples/jsm/libs/basis',['basis_transcoder.js','basis_transcoder.wasm','README.md']]
]){
  const destination=path.join(root,'public/decoders',name);mkdirSync(destination,{recursive:true});
  for(const file of files)cpSync(path.join(root,'node_modules',source,file),path.join(destination,file));
}
cpSync(path.join(root,'node_modules/three/examples/jsm/libs/draco/README.md'),path.join(root,'public/decoders/draco/README.md'));
cpSync(path.join(root,'node_modules/three/LICENSE'),path.join(root,'public/decoders/draco/THREE-LICENSE.txt'));
console.log('Model decoders prepared from locked dependencies (same-origin, lazy loaded).');
