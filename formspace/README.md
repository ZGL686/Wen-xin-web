# 长序 · 树莓成熟时

React 19 + Vite 8 + TypeScript 作品集应用，使用 Three.js 查看真实三维模型。无需账号登录，打开后为当前浏览器准备独立创作空间；当前服务端为 Cloudflare Worker，R2 持久保存空间资料、作品文件和版本。新作品及完整创作过程默认私密，作者选择展示版本及公开的历史节点。

## 本地运行与检查

在工程仓库根目录执行：

```sh
cd formspace
npm ci
npm run dev
```

本轮运行环境为 Node.js 24，推荐使用该版本。应用工具链需要 Node.js 22.13+；如果使用 Node.js 22 直接运行本项目的 TypeScript 接口测试，使用 22.18 或更新版本。开发地址以终端输出为准，通常为 `http://127.0.0.1:5173/`。

```sh
npm run typecheck
npm test
npm run build
npm start
```

`npm test` 使用服务器实际返回的 Set-Cookie 维护测试 cookie jar，验证浏览器隔离、伪造身份头拒绝、CSRF、过期和无效令牌、版本与公开边界、媒体 Range 请求、旧数据保留、分页、并发冲突和失败回滚。`npm start` 本地运行已构建 Worker，不会部署网站。本机与生产均使用应用自己的浏览器空间 Cookie，不需要 Sites/ChatGPT 登录。

## 免账号空间与数据保留

首次同源 `POST /api/session` 创建 256 位随机令牌，HTTPS 生产通过 `__Host-changxu_workspace` Cookie 保存，属性为 Secure、HttpOnly、SameSite=Lax、Path=/、无 Domain、365 天有效；本机 HTTP 使用不带 Secure 的 `changxu_workspace`。HTTPS 只读取带 `__Host-` 的名称，避免父域同名 Cookie 混淆。R2 只存令牌 SHA-256、随机空间 owner ID 与有效期，不保存原始令牌；JSON 响应不返回令牌。所有接口忽略客户端的 `oai-authenticated-user-*` 和旧模拟登录 Cookie。

HTTP 开发 Cookie 仅在 localhost/回环地址启用；对外服务必须使用 HTTPS。若服务端已有凭据记录但 JSON 或结构损坏，接口返回 503 并保留当前 Cookie，不会把暂时不可读误当新访客而覆盖空间凭据。

有效 Cookie 再次初始化会复用同一令牌和空间，不另建账号。`POST /api/session` 会对齐浏览器与服务端剩余有效期；仅在剩余不足 30 天时，把同一令牌的服务端期限延长到 365 天，支持正常使用中的滚动续期。`GET /api/me` 只读，不创建或续期；没有有效 Cookie 时返回空身份，不暗中认领空间。所有写入，包括初始化，必须携带与请求一致的 Origin。接口和文件使用 `private, no-store` 与 `Vary: Cookie`，不会用共享缓存混淆作者。

**当前浏览器的 Cookie 是管理私密作品的凭据。清除 Cookie、Cookie 到期、换浏览器或换设备后，不能自动找回旧空间。** 新空间不会删除旧数据，也不会凭公开分享地址取得旧空间编辑权。本版本没有恢复码、账号或跨设备恢复系统；不要把“免账号”理解为数据无需权限或会自动跨设备同步。

旧账号 owner 的 R2 数据原样保留，不从浏览器声称的身份头自动绑定。已有明确公开展示仍按原指针提供；v1 原来公开的单记录继续兼容公开。旧私密作品、私密历史和原件不会因此改为公开或交给第一个新浏览器。当前没有自动迁移旧私人历史的流程；公开列表中的作品数量不能证明远端私密数据为空。

仅明确识别的 v1 单记录走旧公开兼容；未知 schema、混入私密/版本索引的记录或损坏索引会返回 503，不会自动推断成公开作品，也不会删除原数据。

## 作品、版本与公开范围

- 主方向固定为交互、影视、三维、其他；每件作品一个方向，可自填多个标签。
- 首次保存需要名称、方向和至少一份内容。内容可以是文字灵感、图片、工程文件、视频、音频或 HTTPS 交互链接，其他作品说明选填。
- 每次主动保存成功后新增一个版本，包括内容没有实际变化的主动保存。后续保存可以沿用已有文件，修改文字不要求重传。
- 定稿后继续修改仍属于同一作品，旧定稿仍在历史中。当前每件作品最多保存 500 个版本，达到限制时接口会明确拒绝并保留已有内容。
- 新版本默认不改变访客正在看的展示版本。作者可以选择公开展示版本，另外选择公开的历史节点和重要节点，也可撤回整件作品的公开展示。
- 仅选择展示版本不会自动公开该版本的过程、困难、解决和心得；这些过程信息只随作者明确公开的历史节点向访客返回。
- 原始工程默认只供作者下载，作者可按版本开启原件下载。网页模型预览与原件使用独立资源地址；公开预览模型本身需要传给浏览器，并非模型防下载机制。
- 私密文件及未公开历史通过文件接口鉴权；只知道文件地址也不能读取。文件响应使用 `private, no-store`，避免撤回公开后继续依赖长期公共缓存。
- 每个浏览器空间有稳定的分享地址和可编辑名称、简介。完整历史仅持有该空间有效 Cookie 的浏览器可见，访客只看公开作品。初始四件作品属于系统展品，不能被任意浏览器认领或修改。

旧版已经公开的上传记录继续展示和下载，但新的免账号空间不能冒认原账号作者。已有四件三维展品兼容为“三维”，原产品设计、家具设计等分类保留为标签；系统展示 slug `wenxin-exhibits` 保留以兼容旧分享地址，显示名称为“长序 · 系统展品”。

## 媒体与大小限制

| 内容 | 格式或限制 |
| --- | --- |
| 原始工程 `source` | MAX、BLEND、FBX、OBJ、STL、GLB、GLTF、ZIP；最多一个 |
| 独立三维预览 `previewModel` | GLB、单文件 OBJ、STL；最多一个 |
| 图片 `images` | PNG、JPG/JPEG、WebP、AVIF、GIF；最多八张，每张不超过 12 MiB |
| 正片 `video`、演示 `demoVideo` | MP4、WebM；各最多一个，支持鉴权后的字节范围读取 |
| 音频 `audio` | MP3、WAV、OGG、M4A；最多一个 |
| 交互链接 `interactiveUrl` | 完整 HTTPS 地址，不接受含账号密码的地址 |

每次新上传文件合计不超过 40 MiB，JSON 文字请求不超过 128 KiB。标题最多 80 字，介绍和每项过程说明最多 4000 字，文字灵感最多 20000 字；标签最多八个、每个最多 24 字，去除空白和重复。`previewStart`、`previewEnd` 为选填的非负秒数，结束必须晚于开始，不设硬性预览时长。

图片、视频与音频执行格式签名校验。原始 MAX/BLEND/影视工程不会自动在 Worker 转为可播放预览；可另传兼容预览模型、演示视频或图片。外部 HTTPS 体验能否嵌入还受目标网站和浏览器策略限制，上传 ZIP 不代表可运行其中代码。

## API 合同

类型和完整字段注释见 `shared/portfolio.ts`。

| 接口 | 行为 |
| --- | --- |
| `POST /api/session` | 同源初始化/复用浏览器空间，返回 `{user,profile,created,identityMode:'browser'}`，令牌只在 HttpOnly Cookie |
| `GET /api/me` | 只读当前浏览器空间；缺失、无效、过期 Cookie 返回空用户，不新建 |
| `PATCH /api/me/profile` | 有效浏览器空间更新 `displayName`、`bio`，保留分享地址 |
| `GET /api/profiles/:slug` | 该空间资料及公开作品 |
| `GET /api/works?scope=public` | 全站公开展示版本；可用 `profile=slug` 限定空间 |
| `GET /api/works?scope=mine` | 仅当前浏览器空间的最新作品快照，含私密作品 |
| `GET /api/works/:id` | 作者取得完整历史，访客只取得展示版和指定公开节点；可加 `version=id` 选择允许查看的版本 |
| `POST /api/works` | 保存私密新作，成功返回 `201` |
| `PUT/PATCH /api/works/:id` | 提供 `baseRevision`，给同一作品保存新版本 |
| `PATCH /api/works/:id/publication` | 提供 `revision`，更新 `displayVersionId`、`publicVersionIds`、`importantVersionIds`；不增加内容版本 |
| `DELETE /api/works/:id` | 作者删除自己的作品及其全部版本文件 |
| `GET/HEAD /api/files/:work/:version/:file` | 按作者或公开节点授权读取；兼容旧文件地址；视频支持 Range/206/416 |

保存接受 JSON 或 multipart，文件字段见上表；文字字段与 Snapshot 同名。后续保存缺省字段沿用最新版本，不能通过提交任意文件 URL 引用其他作品。图片上传会替换该版图片集；`clearImages`、`clearSource`、`clearModel`、`clearVideo`、`clearDemoVideo`、`clearAudio` 可清除继承的媒体，但保存后仍须有一份内容。

保存成功响应为 `{work, versions, user, isOwner}`。缺少有效浏览器空间为 401、code `workspace_required`，无权访问私密内容为 403/404，校验失败为 400/413，过期 revision 为 409；错误体为 `{error, code?}`。保存先完成文件和版本再用条件写入提交作品指针；冲突或失败不会显示保存成功。

R2 使用 `sessions/` 保存令牌哈希及空间归属、`profiles/` 保存空间资料、`records/` 保存作品索引、`versions/` 保存不可变快照、`files/` 保存附件。收藏仍是当前浏览器的偏好，不属于服务端作品数据。

## 初始资产

`data/works.json` 收录房子、柜子、AURELIA 玉石灯、Cloud Bear 云朵熊沙发；`public/originals/` 保留 MAX 下载副本，`public/portfolio/` 提供真实 GLB、WebP 和哈希/源尺寸验证清单。网页材质为基础色近似，完整材质与灯光以原始工程为准。

工程仓库的 `assets/3d source/` 是原始 MAX，`assets/pipeline/` 是离线转换资料。`scripts/import-portfolio.mjs` 是离线导入辅助脚本，不属于普通启动或构建步骤。

## 部署边界

`.openai/hosting.json` 保存原 Sites 项目身份与 `BUCKET` 绑定；Vite 构建输出 `dist/client` 和 `dist/server`，保留 `sites()` 集成。只部署客户端会缺少保存、版本、文件权限及个人管理能力。

Git 根目录在应用的上一级。未来通过 Sites 工作流发布时，准备独立应用 checkout 并复用该项目身份，不把包含 Wiki 和离线资产的工程根目录交给单应用发布 helper。GitHub 源码推送与网站发布是两项操作。

原站地址为 https://formspace-sm-3d-studio.h2969351680.chatgpt.site 。地址存在不表示本次代码已经上线，当前发布状态与线上验证以实际部署回执为准。当前应用已不依赖平台登录，仍使用 Sites 的 Worker/R2 托管；国内托管及持久存储迁移尚未完成。迁移需保留服务器验证的 Cookie 权限和持久数据，不能用伪造身份头或单纯复制前端替代。改变站点域名也不会自动转移浏览器 Cookie。

历史交付 ZIP 不包含远端后来投稿、私密历史或用户数据。备份/迁移新增数据时须单独导出相应 R2 记录与文件，保持 URL 映射并核对完整性。
