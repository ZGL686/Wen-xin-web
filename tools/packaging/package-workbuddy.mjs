import { mkdir, readFile, writeFile, copyFile, readdir, lstat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const mode = process.argv[2] || 'prepare';
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const name = process.argv[3] || 'Changxu_WorkBuddy_China_' + date.replaceAll('-', '');
if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error('Use a simple archive name.');
const delivery = path.join(root, 'formspace/outputs/handovers', name);
const source = path.join(delivery, '源码');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const forbidden = /(^|\/)(?:\.git|node_modules|outputs|dist|\.sites-runtime|\.wrangler|\.server-data|\.local-history|\.agents|\.codex|__pycache__)(\/|$)|\.(?:pem|key|p12|pfx|sqlite|db|log)$/i;
const secret = /gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{32,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
function assertPath(relative) {
  if (forbidden.test(relative) || /(^|\/)\.(?:env|dev\.vars)(?:\.|$)/i.test(relative) && !relative.endsWith('.example')) throw new Error('Private/runtime file: ' + relative);
}
async function copy(from, relative) {
  assertPath(relative);
  const info = await lstat(from);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('Not a regular file: ' + from);
  const bytes = await readFile(from);
  if (bytes.subarray(0, 100).toString().startsWith('version https://git-lfs.github.com/spec/v1')) throw new Error('Run git lfs pull: ' + from);
  if (bytes.length < 2 * 1024 * 1024 && /\.(?:md|json|[cm]?js|tsx?|py|ps1|example|sha256)$/.test(relative) && secret.test(bytes.toString('utf8'))) throw new Error('Possible credential: ' + relative);
  const out = path.join(delivery, relative);
  await mkdir(path.dirname(out), { recursive: true });
  await copyFile(from, out);
}
async function walk(dir, visit) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(delivery, absolute).split(path.sep).join('/');
    // Validation may install dependencies; these never enter the archive.
    if (entry.isDirectory() && ['node_modules', 'dist', '.sites-runtime', '.wrangler', '.server-data', '__pycache__'].includes(entry.name)) continue;
    if (entry.isSymbolicLink()) throw new Error('Unexpected symlink: ' + relative);
    if (entry.isDirectory()) await walk(absolute, visit);
    else if (entry.isFile()) await visit(absolute, relative);
  }
}
if (mode === 'prepare') {
  if (existsSync(delivery)) throw new Error('Preserve the existing delivery; use a new package name.');
  const changes = execFileSync('git', ['status', '--porcelain', '--', 'formspace'], { cwd: root, encoding: 'utf8' }).trim();
  if (changes) throw new Error('Review/commit application changes before snapshotting: ' + changes);
  await mkdir(source, { recursive: true });
  for (const file of tracked.filter(f => f.startsWith('formspace/'))) {
    const relative = file.slice('formspace/'.length);
    if (relative !== '.openai/hosting.json') await copy(path.join(root, file), '源码/' + relative);
  }
  await mkdir(path.join(source, '.openai'), { recursive: true });
  await writeFile(path.join(source, '.openai/hosting.json'), JSON.stringify({ d1: null, r2: 'BUCKET' }, null, 2) + '\n');
  await writeFile(path.join(source, '.gitignore'), (await readFile(path.join(source, '.gitignore'), 'utf8')) + '\n# Private Node runtime data\n/.server-data/\n');
  const guide = path.join(root, 'docs/workbuddy/current');
  async function copyGuide(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await copyGuide(file);
      else await copy(file, path.relative(guide, file).split(path.sep).join('/'));
    }
  }
  await copyGuide(guide);
  // Local editable assets are not a backup of private R2 records or credentials.
  const supplementary = [
    'assets/3d source/ARC01_Mouse_3dsMax2026.max',
    'assets/3d source/Porcelain_Teapot_2026/3d.max',
    'assets/3d source/Porcelain_Teapot_2026/peony_albedo.png',
    'assets/3d source/Monitor_27_3dsMax2026.max',
    'assets/pipeline/Teapot.glb', 'assets/pipeline/Monitor_27.glb',
    ...tracked.filter(f => /^assets\/renders\/(teapot|monitor)\//.test(f)),
    ...tracked.filter(f => /^docs\/models\/(teapot|monitor)\//.test(f)),
  ];
  for (const file of supplementary) await copy(path.join(root, file), '补充作品资源/' + file);
  for (const file of tracked.filter(f => f.startsWith('wiki_memory/'))) await copy(path.join(root, file), '工程资料/' + file);
  const hashes = await json(path.join(root, 'docs/models/SHA256SUMS.json'));
  for (const file of supplementary.filter(f => hashes[f])) if (sha(await readFile(path.join(root, file))) !== hashes[file]) throw new Error('Supplementary hash mismatch: ' + file);
  const works = await json(path.join(source, 'data/works.json'));
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  await writeFile(path.join(delivery, '交接清单.json'), JSON.stringify({
    title: '长序 · WorkBuddy 国内部署交接包', packagedDate: date, sourceCommit: commit,
    framework: 'React + Vite + TypeScript', nodeVersion: '24',
    backend: 'Node.js single-process server; FS / unverified COS adapter; original Worker retained',
    identity: 'Accountless browser workspace; server-verified HttpOnly cookie',
    builtInWorks: works.map(w => ({ id: w.id, title: w.title })),
    supplementaryWorks: ['ARC01 鼠标', '青花牡丹朱线茶壶', '27 英寸桌面显示器'], supplementaryFiles: supplementary,
    packagingChanges: ['Removed existing Sites project_id from copied .openai/hosting.json'],
    credentialsIncluded: false, remoteUserDataExported: false, crossDomainAuthorTransferImplemented: false,
    productionCosVerified: false, domesticDeploymentCompleted: false,
  }, null, 2) + '\n');
  console.log(JSON.stringify({ delivery, source, sourceCommit: commit, builtInWorks: works.length, supplementaryFiles: supplementary.length }));
} else if (mode === 'finalize') {
  const validation = await json(path.join(delivery, 'validation.json'));
  await copyFile(path.join(delivery, 'validation.json'), path.join(delivery, '06_本地打包验收.json'));
  const commands = ['npm ci', 'npm run typecheck', 'npm test', 'npm run build', 'npm run test:node', 'node scripts/test-derived-build.mjs'];
  await writeFile(path.join(delivery, '06_本地打包验收.json'), JSON.stringify(validation, null, 2) + '\n');
  for (const command of commands) if (!validation.checks?.some(c => c.command === command && c.exitCode === 0)) throw new Error('Missing independent successful check: ' + command);
  await writeFile(path.join(delivery, '04_打包验收.md'), `# 打包验收\n\n日期：${date}\n\n- 独立源码副本实际通过：${commands.join('、')}。详见 validation.json。\n- 五件系统作品的本地资源及四件基线 MAX/GLB 哈希已核对，完整文件集见 FILE_MANIFEST.sha256。\n- ZIP 工具另行检查 CRC、全部条目哈希及 LFS 实体。\n- 未执行真实 COS、国内部署、新域名迁移或新一轮浏览器验收；未导出远端 R2 用户数据。\n`);
  const works = await json(path.join(source, 'data/works.json'));
  const baseline = await json(path.join(source, 'public/portfolio/verification.json'));
  for (const asset of baseline) {
    const work = works.find(w => w.id === asset.id);
    if (!work) throw new Error('Missing baseline work: ' + asset.id);
    const original = await readFile(path.join(source, 'public', work.fileUrl.replace(/^\//, '')));
    const model = await readFile(path.join(source, 'public/portfolio', asset.glb));
    if (sha(original).toLowerCase() !== asset.original_sha256.toLowerCase() || sha(model) !== asset.glb_sha256.toLowerCase()) throw new Error('Baseline hash mismatch: ' + asset.id);
  }
  for (const work of works) for (const url of new Set([work.fileUrl, work.modelUrl, work.coverUrl, ...(work.images || [])].filter(Boolean))) {
    const bytes = await readFile(path.join(source, 'public', url.replace(/^\//, '')));
    if (bytes.subarray(0, 100).toString().startsWith('version https://git-lfs.github.com/spec/v1')) throw new Error('LFS pointer: ' + url);
    if (url.endsWith('.glb') && (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(8) !== bytes.length)) throw new Error('Invalid GLB: ' + url);
  }
  if ((await json(path.join(source, '.openai/hosting.json'))).project_id) throw new Error('Existing Site identity included.');
  const manifest = [];
  await walk(delivery, async (file, relative) => {
    assertPath(relative);
    if (relative === 'FILE_MANIFEST.sha256') return;
    const bytes = await readFile(file);
    if (bytes.length < 2 * 1024 * 1024 && /\.(?:md|json|[cm]?js|tsx?|py|ps1|example|sha256)$/.test(relative) && secret.test(bytes.toString('utf8'))) throw new Error('Possible credential: ' + relative);
    manifest.push({ file: relative, sha256: sha(bytes), size: bytes.length });
  });
  manifest.sort((a, b) => a.file.localeCompare(b.file));
  await writeFile(path.join(delivery, 'FILE_MANIFEST.sha256'), manifest.map(f => f.sha256 + '  ' + f.file).join('\n') + '\n');
  console.log(JSON.stringify({ delivery, files: manifest.length + 1, uncompressedBytes: manifest.reduce((s, f) => s + f.size, 0), baselineHashes: baseline.length, builtInWorks: works.length }));
} else throw new Error('Unknown mode: ' + mode);
