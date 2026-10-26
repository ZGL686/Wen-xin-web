import {mkdir,readFile,writeFile,copyFile,readdir,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';

const repository=path.resolve(import.meta.dirname,'../..');
const original=path.join(repository,'formspace');
const packageDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const packageName=process.argv[3]||'FormSpace_WorkBuddy_China_'+packageDate.replaceAll('-','');
if(!/^[A-Za-z0-9_-]+$/.test(packageName))throw new Error('Use a simple archive name.');
const delivery=path.join(repository,'deliverables',packageName);
const source=path.join(delivery,'源码');
const mode=process.argv[2]||'prepare';
const docs={
'01_先读我.md':`# 形间 FORM / SPACE · WorkBuddy 接手包

目标：保留现有三维作品展厅和 React + Vite 架构，由 WorkBuddy 继续改造成面向中国用户、可以在选定国内服务环境部署的网站。

## 使用方法

1. 把整个压缩包交给 WorkBuddy，先让它阅读本文件和「03_迁移说明.md」。
2. 把「02_发给WorkBuddy的任务.md」中的正文粘贴给它。
3. 在「源码」目录执行 npm ci、npm run dev 即可运行当前版本。Node.js 需要 22.13 或更新版本。
4. 当前版本使用 Cloudflare Worker / R2 与 Sites 的 ChatGPT 登录。它是待迁移的完整原版，不是已经完成国内部署的版本。

## 包内内容

- 源码：React + Vite + TypeScript 前端、Three.js 预览、上传 API、接口测试、依赖锁文件。
- 源码/public/originals：4 个原始 MAX 工程，内容未经修改。
- 源码/public/portfolio：真实 GLB 模型、WebP 封面、几何与原文件哈希验证清单。
- 界面参考：本次交付前已验证的首页、详情及手机页面截图。
- 03_迁移说明.md：接口、数据结构、平台依赖与需要完成的迁移事项。
- FILE_MANIFEST.sha256：包内文件的 SHA-256 清单。

包中没有 node_modules、Git 历史、登录凭据、环境变量文件、本机缓存或现站发布身份。安装依赖后即可生成构建产物。

原站视觉参考：https://formspace-sm-3d-studio.h2969351680.chatgpt.site
`,
'02_发给WorkBuddy的任务.md':`请接手这个项目，把它迁移成面向中国用户、可以在所选国内服务环境部署的三维作品展示与上传网站。请先阅读压缩包中的 01_先读我.md、03_迁移说明.md 和源码，不要只重新生成一个外观相似的静态页面。

请保留 React + Vite + TypeScript 架构，保留「形间 FORM / SPACE」现有的奶油白、墨黑、柠檬黄视觉，以及首页、作品库、作品详情、上传、关于页面和手机适配。保留实际模型旋转、自动旋转、线框、重置、图片放大、搜索、分类、排序、收藏、分享、源文件下载等交互。

现有 4 个作品必须完整保留：房子、柜子、AURELIA 玉石灯和 Cloud Bear 云朵熊沙发。public/originals 中的 MAX 原件不要修改，真实 GLB 和封面继续使用，不能用假模型或生成图片替代。

重点完成后端迁移：
1. 替换 ChatGPT / Sites 登录为适合目标部署环境、由服务端验证的登录会话。公开浏览无需登录，上传和删除必须有真实权限。不要信任客户端传入的 oai-authenticated-user-* 请求头。
2. 替换 Cloudflare Worker / R2 绑定，使用目标环境可持续运行的服务端及持久存储。前端保持 React + Vite；后端技术与存储根据实际可用环境选择。保持现有 HTTP 接口，减少前端改动。
3. 文件和图片真实上传并持久保存，刷新、重启服务和换设备后仍可读取。保留原文件下载、作者删除权限、上传大小/类型限制和失败回滚；不要改成 localStorage 保存作品，不要做假进度和假成功。
4. 移除生产版本对 Sites 发布、ChatGPT 登录和 Cloudflare 专属运行时的依赖。默认使用本地打包的字体/图标/模型资源或系统字体，确保所有关键资源在目标网络环境可访问。
5. GLB、单文件 OBJ、STL 保持网页预览；MAX、BLEND、FBX、GLTF、ZIP 完整保存并配图展示。自动转换新上传 MAX 不是现有能力，若要新增请先给出可运行的转换方案并验证。

完成后请交付完整可编辑源码、运行及部署步骤、所需环境变量清单，以及实际可分享的网页链接。先把可运行版本和测试完成，再列明确实需要我提供的部署账号、域名或配置；不要把密钥写进源码或前端。

请实际检查电脑和手机页面、登录、模型和图片上传、刷新后持久化、重新启动服务后读取、他人越权删除拒绝，以及四个原文件下载哈希。发布前按实际部署地区和服务商要求完成域名与上线配置。
`,
'03_迁移说明.md':`# 技术现状与迁移说明

## 已完成的功能

前端为 React 19 + Vite 8 + TypeScript，Three.js 延迟加载真实三维模型。页面使用 hash 路由：/#/、/#/works、/#/work/:id、/#/upload、/#/about。链接分享无需额外服务器路由重写即可定位作品。

初始四件作品在 data/works.json；源文件在 public/originals，GLB 和 WebP 在 public/portfolio。现有作品的网页模型由 MAX 原生几何离线转换，网页基础材质为近似，完整材质效果以 MAX 原件为准。

收藏是当前浏览器的 localStorage 偏好；上传作品和文件使用服务端存储。现有权限：公开浏览、已登录者可提交、作者可删除自己的新增作品；初始四件作品通过源码维护，不能经删除 API 删除。

## 必须迁移的平台部分

| 位置 | 当前依赖 | 接手要求 |
| --- | --- | --- |
| vite.config.ts | @cloudflare/vite-plugin 和 sites() | 为目标服务端整理 Vite 构建与开发代理，保留纯 React + Vite 前端 |
| worker/index.ts | Worker fetch / env.ASSETS | 替换为目标服务端路由与静态资源服务 |
| worker/api.ts | env.BUCKET 的 put/get/list/delete | 适配目标文件存储及持久作品记录 |
| src/App.tsx 的 signIn | /signin-with-chatgpt | 改成新登录入口和会话流程 |
| worker/api.ts 的 currentUser | 平台注入 oai-authenticated-user-id | 改成服务端验证的身份，不能直接接收任意客户端同名请求头 |
| scripts/vite/sites-vite-plugin.ts | 只在本地模拟登录 | 不能当作正式身份认证；迁移时可移除，保留许可证要求 |
| .openai/hosting.json | 原版构建清单 | 本包移除了现站 project_id；不是新站发布配置 |

原版 npm run build 输出 dist/client 与 dist/server。dist/server 仍是 Cloudflare Worker，不是 Node.js 常驻服务器。只上传 dist/client 会缺少上传和管理功能。

## API 合同

| 方法与路径 | 输入 | 返回与要求 |
| --- | --- | --- |
| GET /api/works | 无 | { works: Work[], user: {id,name} 或 null }；公开读取，隐藏他人的 ownerId 与内部 storageKeys |
| POST /api/works | multipart：title、category、description、tags、source、images | 登录后提交，成功 201 {work}；失败 {error}，不得返回假成功 |
| GET /api/files/:uuid/:file | 文件路径 | 图片/模型/原件，正确 MIME 和 nosniff；源文件支持原文件名下载 |
| HEAD /api/files/:uuid/:file | 文件路径 | 与 GET 一致的元数据，不带内容 |
| DELETE /api/works/:uuid | 当前登录会话 | 仅作者可删除其新增作品；内置作品不允许；成功 {ok:true} |

Work 字段包括 id、title、subtitle、category、description、tags、date、fileName、fileSize、fileUrl、modelUrl、coverUrl、images、format、objects、dimensions、builtIn，以及当前作者可见的 ownerId。storageKeys 仅用于服务端内部删除文件。

上传约束：每次最多 1 个源文件、8 张图片；单张图片最多 12 MB，合计最多 40 MB；标题最多 80 字；API 介绍最多 4000 字，当前表单限制 3000 字。标签使用中英文逗号分隔，最多 8 个、每个最多 24 字。分类为「产品设计」「家具设计」「空间建筑」「其他创作」。

源文件：MAX、BLEND、FBX、OBJ、STL、GLB、GLTF、ZIP。图片：PNG、JPG/JPEG、WebP、AVIF、GIF。图片有服务端签名校验。GLB、单文件 OBJ、STL 可以直接预览；GLTF 外部贴图等依赖可以打 ZIP 存档，网页预览建议导出自包含 GLB。

## 数据范围

本包完整包含初始四件作品及其真实资源。线上后续投稿在远端 R2 中，源码打包不代表导出了远端后来新增的数据；如需要迁移后来新增的投稿，必须单独取得授权导出 records/ 和 files/，并核对数量和哈希。本包不含远端服务凭据，也没有导出远端用户记录。

原存储布局：records/{uuid}.json 保存作品，files/{uuid}/source.ext 与 image-N.ext 保存源文件/图片。迁移时可更换存储结构，但保持公开 URL 或提供映射，避免分享链接和图片链接失效。

## 本地验证

在「源码」目录依次执行：

    npm ci
    npm run typecheck
    npm test
    npm run build
    npm run dev

需要 Node.js 22.13+。原版开发服务器会打印 127.0.0.1:5173，本地模拟登录仅供开发；生产不能使用该模拟身份。迁移后还需增加针对实际新后端和登录系统的集成验收。

scripts/import-portfolio.mjs 是首轮资产导入辅助脚本，依赖原工作站的assets/source 中 MAX 与 assets/pipeline，不属于安装/构建步骤。现有成品资源已完整放在 public 内，运行和重新构建网站无需执行该脚本。

## 交付验收要求

保留所有页面与真实资产；确认国内目标网络中的首页、API、文件和模型资源可访问；实际登录并上传模型和多图；刷新、重启后作品仍在；匿名上传与他人删除被拒绝；四个原始文件下载后与 public/portfolio/verification.json 中 SHA-256 一致。提供新部署地址和服务端启动/持久存储/备份说明。
`
};

if(mode==='prepare'){
 if(existsSync(delivery))throw new Error('Delivery folder already exists; preserve it and use a new name.');
 await mkdir(source,{recursive:true});
 const files=execFileSync('git',['ls-files','-z'],{cwd:original,encoding:'utf8'}).split('\0').filter(Boolean);
 for(const file of files){
  if(file==='README.md'||file==='.openai/hosting.json')continue;
  const out=path.join(source,file);await mkdir(path.dirname(out),{recursive:true});await copyFile(path.join(original,file),out);
 }
 await mkdir(path.join(source,'.openai'),{recursive:true});
 await writeFile(path.join(source,'.openai/hosting.json'),JSON.stringify({d1:null,r2:'BUCKET'},null,2)+'\n');
 await writeFile(path.join(source,'README.md'),'# 形间 · 待迁移源码\n\n先阅读上一级目录中的 01_先读我.md 和 03_迁移说明.md。\n\n本目录为完整 React + Vite / Cloudflare Worker 原版，尚未替换为国内运行环境。Node.js 22.13+。\n\n```sh\nnpm ci\nnpm run typecheck\nnpm test\nnpm run build\nnpm run dev\n```\n\n本地模拟登录仅供开发。现站发布身份已从本副本移除。4件初始作品在 data/works.json 和 public/ 中；不要修改 MAX 原件。\n');
 for(const [name,body] of Object.entries(docs))await writeFile(path.join(delivery,name),body+'\n');
 await mkdir(path.join(delivery,'界面参考'),{recursive:true});
 for(const name of ['live-home-desktop.png','live-home-mobile.png','sofa-desktop.png','upload-mobile.png'])await copyFile(path.join(original,'outputs',name),path.join(delivery,'界面参考',name));
 const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:original,encoding:'utf8'}).trim();
 await writeFile(path.join(delivery,'交接清单.json'),JSON.stringify({title:'FORM / SPACE · WorkBuddy China migration handoff',packagedDate:packageDate,sourceCommit:commit,frontend:'React + Vite + TypeScript',backendStatus:'Original Cloudflare Worker + R2; migration required',existingSiteIdentityIncluded:false,initialWorks:4,remoteSubmissionsExported:false,credentialsIncluded:false},null,2)+'\n');
 console.log(JSON.stringify({delivery,source,files:files.length}));
}else if(mode==='finalize'){
 const assets=JSON.parse(await readFile(path.join(source,'public/portfolio/verification.json'),'utf8'));
 const works=JSON.parse(await readFile(path.join(source,'data/works.json'),'utf8'));
 for(const asset of assets){const work=works.find(w=>w.id===asset.id);const file=await readFile(path.join(source,'public',work.fileUrl));const sha=createHash('sha256').update(file).digest('hex');if(sha.toUpperCase()!==asset.original_sha256.toUpperCase())throw new Error('Original hash mismatch '+asset.id);}
 await writeFile(path.join(delivery,'04_打包验收.md'),'# 打包验收\n\n日期：2026-10-25\n\n- 已从现有已发布版本复制完整源码与初始4件作品。\n- 独立安装、类型检查、API测试和生产构建需按迁移说明另行执行，并保存实际回执；本工具不预先声明这些检查通过。\n- 验证4个原始 MAX 文件 SHA-256 与原始验证清单一致。\n- 已排除 Git 历史、node_modules、运行缓存、环境变量、凭据和现站 project_id。\n- 界面截图为原站验收记录，国内服务端迁移仍待 WorkBuddy 完成。\n- 本包没有导出远端后续投稿或远端用户数据。\n');
 const manifest=[];
 async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(['node_modules','.sites-runtime','.wrangler','dist','.git'].includes(entry.name))continue;const absolute=path.join(dir,entry.name);if(entry.isDirectory())await walk(absolute);else if(entry.isFile()){const relative=path.relative(delivery,absolute).split(path.sep).join('/');if(relative==='FILE_MANIFEST.sha256')continue;const bytes=await readFile(absolute);manifest.push({file:relative,sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length});}}}
 await walk(delivery);manifest.sort((a,b)=>a.file.localeCompare(b.file));
 await writeFile(path.join(delivery,'FILE_MANIFEST.sha256'),manifest.map(f=>f.sha256+'  '+f.file).join('\n')+'\n');
 console.log(JSON.stringify({delivery,files:manifest.length+1,uncompressedBytes:manifest.reduce((s,f)=>s+f.size,0),verifiedOriginals:assets.length}));
}else throw new Error('Unknown mode');
