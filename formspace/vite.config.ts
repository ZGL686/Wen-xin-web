import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import { sites } from './scripts/vite/sites-vite-plugin';
import { configureToolEnvironment } from './scripts/tool-environment.mjs';
configureToolEnvironment(process.cwd());
export default defineConfig({
 plugins:[react(),sites(),cloudflare({viteEnvironment:{name:'server'},inspectorPort:false,config:{name:'formspace-portfolio',main:'./worker/index.ts',compatibility_date:'2026-05-15',compatibility_flags:['nodejs_compat'],assets:{binding:'ASSETS',not_found_handling:'single-page-application',run_worker_first:['/api/*']},r2_buckets:[{binding:'BUCKET',bucket_name:'formspace-portfolio'}]}})],
 server:{host:'127.0.0.1'}, build:{chunkSizeWarningLimit:700}
});
