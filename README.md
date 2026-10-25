# 形间 FORM / SPACE

React 19 + Vite 8 + TypeScript 前端，Three.js 交互模型预览；Cloudflare Worker 提供上传接口，R2 持久保存新增作品与图片。

## 本地运行

需要 Node.js 22.13 或更新版本。

```sh
npm ci
npm run dev
```

打开终端输出的 `http://127.0.0.1:5173/`。本地上传使用预览模拟登录；仅在本机开发环境生效。线上使用 ChatGPT 登录身份，公开浏览无需登录。

```sh
npm run typecheck
npm test
npm run build
npm start
```

## 内容与上传

- 首页、作品库、作品详情、上传、关于页面使用 hash 路由，链接可直接分享。
- 初始房子、柜子、玉石灯、沙发已收录到 `data/works.json`；`public/originals` 保留未经修改的 MAX 原件。
- `public/portfolio` 包含从原生场景转换的真实 GLB 与 WebP 封面；网页材质为基础色近似。源尺寸和哈希记录于 `public/portfolio/verification.json`。
- 支持 MAX、BLEND、FBX、OBJ、STL、GLB、GLTF、ZIP 源文件以及 JPG、PNG、WebP、AVIF、GIF 图片；GLB、单文件 OBJ 和 STL 支持网页预览。带外部依赖的工程可打包 ZIP 并配封面；GLTF 工程可转为内嵌资源的 GLB 后进行网页预览。
- 每件作品最多 1 个模型、8 张图片；单张图片最多 12 MB，每次合计最多 40 MB。
- 上传需登录，提交后展示于公开作品库；上传者可删除自己的新增作品。初始四件作品的条目在源代码维护。
- 新增作品与原文件保存至服务端 R2，不依赖浏览器存储；收藏是当前浏览器的个人偏好。

## 部署

`.openai/hosting.json` 保存当前 Sites 项目身份与 `BUCKET` 绑定。Vite 构建输出 `dist/client` 与 `dist/server`，保留 `sites()` 构建插件。使用 Sites 技能的源码同步、打包与保存/部署流程更新同一网站；勿另建同名项目。

生产地址：https://formspace-sm-3d-studio.h2969351680.chatgpt.site
