import works from '../data/works.json';
import { handleApi } from './api';
import { isProtectedPreviewPath } from './protected-assets';
import { readDerivedModel } from './derived-model';
export default {async fetch(request:Request,env:{BUCKET:R2Bucket;ASSETS:Fetcher}) {
 if(isProtectedPreviewPath(new URL(request.url).pathname))return new Response('Not found',{status:404,headers:{'Cache-Control':'private, no-store'}});
 if(new URL(request.url).pathname.startsWith('/api/'))return handleApi(request,{...env,readDerivedModel},works);
 return env.ASSETS.fetch(request);
}};
