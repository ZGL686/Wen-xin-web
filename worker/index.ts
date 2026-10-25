import works from '../data/works.json';
import { handleApi } from './api';
export default {async fetch(request:Request,env:{BUCKET:R2Bucket;ASSETS:Fetcher}) {
 if(new URL(request.url).pathname.startsWith('/api/'))return handleApi(request,env,works);
 return env.ASSETS.fetch(request);
}};
