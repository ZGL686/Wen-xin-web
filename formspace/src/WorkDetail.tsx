import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Heart, Share2, Link2, Download, Box, Image as ImageIcon, Film, Music2, MousePointer2, FileText, FileBox, Grid2X2, Pause, Play, RotateCcw, LockKeyhole, Globe2, Sprout, PencilLine, History, Star, Check, CheckCircle2, ChevronLeft, ChevronRight, Expand, X, Trash2, LoaderCircle, ExternalLink } from 'lucide-react';
import type { PublicationInput, Snapshot, Version, WorkResponse } from '../shared/portfolio';
import MediaPreview from './MediaPreview';
import { api, copyShare, dateLabel, errorMessage, go, jsonBody, publicSharePath, sizeLabel } from './ui-utils';
import { LoadingState, StateNotice } from './PortfolioViews';

type Mode = 'model' | 'video' | 'audio' | 'web' | 'images' | 'text' | 'file';
const modeLabels: Record<Mode, string> = { model: '三维', video: '视频', audio: '音频', web: '交互', images: '图片', text: '文字灵感', file: '原始文件' };
const modeIcons = { model: Box, video: Film, audio: Music2, web: MousePointer2, images: ImageIcon, text: FileText, file: FileBox };
function modesFor(snapshot: Snapshot): Mode[] {
  const modes: Mode[] = [];
  if (snapshot.interactiveUrl) modes.push('web');
  if (snapshot.modelUrl) modes.push('model');
  if (snapshot.videoUrl || snapshot.demoVideoUrl) modes.push('video');
  if (snapshot.audioUrl) modes.push('audio');
  if (snapshot.images.length || snapshot.coverUrl) modes.push('images');
  if (snapshot.contentText) modes.push('text');
  if (!modes.length) modes.push('file');
  if (snapshot.direction === '影视' && modes.includes('video')) return ['video', ...modes.filter(mode => mode !== 'video')];
  if (snapshot.direction === '三维' && modes.includes('model')) return ['model', ...modes.filter(mode => mode !== 'model')];
  return modes;
}
function forMode(snapshot: Snapshot, mode: Mode): Snapshot {
  return { ...snapshot, direction: mode === 'web' ? '交互' : snapshot.direction, interactiveUrl: mode === 'web' ? snapshot.interactiveUrl : '', modelUrl: mode === 'model' ? snapshot.modelUrl : '', videoUrl: mode === 'video' ? snapshot.videoUrl : '', demoVideoUrl: mode === 'video' ? snapshot.demoVideoUrl : '', audioUrl: mode === 'audio' ? snapshot.audioUrl : '' };
}

export default function WorkDetail({ id, requestedVersion, favorite, onFavorite, notify, onChange }: { id: string; requestedVersion?: string; favorite: boolean; onFavorite: () => void; notify: (message: string) => void; onChange: () => void }) {
  const [data, setData] = useState<WorkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [mode, setMode] = useState<Mode>('model');
  const [rotate, setRotate] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareFallback, setShareFallback] = useState('');
  const [versionNotice, setVersionNotice] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await api<WorkResponse>(`/api/works/${encodeURIComponent(id)}`);
      setData(response);
      const chosen = requestedVersion ? response.versions.find(version => version.id === requestedVersion) : undefined;
      const selected = chosen || response.versions.find(version => version.id === response.work.versionId) || response.versions[0];
      setSelectedId(selected?.id || response.work.versionId); setMode(modesFor(selected || response.work)[0]); setVersionNotice(requestedVersion && !chosen ? '该历史节点暂不可见，当前展示你有权查看的版本。' : '');
    } catch (error) { setError(errorMessage(error)); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); setConfirmDelete(false); setShareFallback(''); }, [id, requestedVersion]);
  const selected = data?.versions.find(version => version.id === selectedId);
  const snapshot = selected || data?.work;
  const images = snapshot ? [...new Set([snapshot.coverUrl, ...snapshot.images].filter(Boolean))] : [];
  useEffect(() => { setImageIndex(0); setLightbox(false); setWireframe(false); setResetKey(value => value + 1); }, [selectedId]);
  useEffect(() => {
    if (!lightbox) return;
    const before = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightbox(false); if (event.key === 'ArrowRight') setImageIndex(value => (value + 1) % images.length); if (event.key === 'ArrowLeft') setImageIndex(value => (value - 1 + images.length) % images.length); };
    window.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = before; window.removeEventListener('keydown', keydown); };
  }, [lightbox, images.length]);
  const chooseVersion = (version: Version) => { setSelectedId(version.id); setMode(modesFor(version)[0]); setShareFallback(''); };
  const publication = async (change: Omit<PublicationInput, 'revision'>, success: string) => {
    if (!data) return;
    setPending(true); setError('');
    try {
      const response = await api<WorkResponse>(`/api/works/${encodeURIComponent(id)}/publication`, { method: 'PATCH', ...jsonBody({ revision: data.work.revision, ...change }) });
      setData(response); onChange(); notify(success);
    } catch (error) { setError(errorMessage(error)); } finally { setPending(false); }
  };
  const toggleNode = (version: Version, kind: 'public' | 'important') => {
    if (!data) return;
    const ids = kind === 'public' ? data.work.publicVersionIds || data.versions.filter(value => value.isPublic).map(value => value.id) : data.work.importantVersionIds || data.versions.filter(value => value.important).map(value => value.id);
    const next = ids.includes(version.id) ? ids.filter(value => value !== version.id) : [...ids, version.id];
    void publication(kind === 'public' ? { publicVersionIds: next } : { importantVersionIds: next }, kind === 'public' ? ids.includes(version.id) ? '这一版的过程已设为私密。' : '这一版已选为公开历史节点，过程内容会随节点展示。' : ids.includes(version.id) ? '已取消重要节点标记。' : '已标记为重要节点。');
  };
  const share = async () => {
    if (!data) return;
    const path = publicSharePath(data.work, selected?.isPublic && selected.id !== data.work.displayVersionId ? selected.id : undefined);
    if (await copyShare(path)) notify('公开作品链接已复制。'); else setShareFallback(`${location.origin}${location.pathname}#${path}`);
  };
  const remove = async () => {
    setDeleting(true); setError('');
    try { await api<{ ok: boolean }>(`/api/works/${encodeURIComponent(id)}`, { method: 'DELETE' }); onChange(); notify('作品与它的版本记录已删除。'); go('/space'); }
    catch (error) { setError(errorMessage(error)); } finally { setDeleting(false); setConfirmDelete(false); }
  };
  if (loading) return <main className="section"><LoadingState text="正在打开作品与它的创作轨迹…"/></main>;
  if (!data || !snapshot) return <main className="section"><StateNotice title="这份创作，暂时无法查看。" message={error || '作品可能尚未公开、已被移除，或不属于当前浏览器空间。'} retry={load}/><a className="text-link" href="#/works"><ArrowLeft size={15}/>回到公开展厅</a></main>;
  const { work, isOwner, versions } = data;
  const isLatest = selectedId === (work.latestVersionId || work.versionId);
  const isDisplay = selectedId === work.displayVersionId;
  const available = modesFor(snapshot);
  const currentMode = available.includes(mode) ? mode : available[0];
  const shownVersions = isOwner ? [...versions].reverse() : versions.filter(version => version.isPublic).reverse();
  const hasSource = Boolean(snapshot.fileName || snapshot.fileUrl);
  const hasOtherPreview = Boolean(snapshot.coverUrl || snapshot.images.length || snapshot.videoUrl || snapshot.demoVideoUrl || snapshot.audioUrl || snapshot.interactiveUrl);
  const needsSourcePreview = hasSource && !snapshot.modelUrl && (snapshot.direction === '三维' || !hasOtherPreview);
  const processFields = ([{ key: 'process', title: '这一版做了什么', icon: PencilLine }, { key: 'difficulties', title: '遇到的困难', icon: Box }, { key: 'solutions', title: '找到的办法', icon: Sprout }, { key: 'reflection', title: '此刻的心得', icon: FileText }] as const).filter(field => snapshot[field.key].trim());
  return <main className="detail-page wenxin-detail"><div className="detail-breadcrumb"><a href={isOwner ? '#/space' : '#/works'}><ArrowLeft size={15}/>{isOwner ? '我的创作空间' : '公开作品'}</a><span>/</span><span>{snapshot.direction}</span><div><button className={`text-icon ${favorite ? 'is-favorite' : ''}`} onClick={onFavorite} aria-pressed={favorite}><Heart size={16} fill={favorite ? 'currentColor' : 'none'}/>{favorite ? '已收藏' : '收藏'}</button>{work.visibility === 'public' && <button className="text-icon" onClick={share}><Share2 size={16}/>分享公开版</button>}</div></div>
    {versionNotice && <div className="version-notice">{versionNotice}</div>}{error && <div className="detail-error form-error" role="alert"><span>!</span><div>{error}<button className="text-icon" onClick={load}>重新读取作品 <RotateCcw size={13}/></button></div></div>}
    {isOwner && <div className="owner-work-banner"><div><LockKeyhole size={17}/><span>作者视角 · 你能查看完整私密历史<small>当前查看第 {selected?.number || work.versionNumber} 版{isLatest ? '（最新保存）' : ''}，{isDisplay ? '正在作为公开展示' : selected?.isPublic ? '已选为公开历史节点' : '这一版的内容仅自己可见'}。</small></span></div><a href={`#/edit/${work.id}`} className="button button-dark"><PencilLine size={15}/>{snapshot.status === 'final' ? '继续创作' : '继续编辑'}</a></div>}
    <div className="detail-main"><section className="detail-gallery"><div className="viewer-toolbar"><div className="viewer-tabs" role="group" aria-label="作品内容预览">{available.map(value => { const Icon = modeIcons[value]; return <button key={value} className={currentMode === value ? 'active' : ''} aria-pressed={currentMode === value} onClick={() => setMode(value)}><Icon size={15}/>{modeLabels[value]}</button>; })}</div><span className="viewer-live"><span className="online-dot"/>{isDisplay ? 'PUBLIC DISPLAY' : isOwner && !selected?.isPublic ? 'PRIVATE VERSION' : 'CREATIVE ARCHIVE'}</span></div>
      <div className={`detail-viewer ${currentMode === 'images' ? 'image-mode' : ''} ${currentMode === 'text' ? 'text-mode' : ''}`}>{currentMode === 'images' ? <><img className="detail-image" src={images[imageIndex] || images[0]} alt={`${snapshot.title}，第 ${imageIndex + 1} 张作品图片`} onClick={() => setLightbox(true)}/><button className="expand-button icon-button" aria-label="放大图片" onClick={() => setLightbox(true)}><Expand size={19}/></button>{images.length > 1 && <div className="image-arrows"><button className="icon-button" aria-label="上一张图片" onClick={() => setImageIndex((imageIndex - 1 + images.length) % images.length)}><ChevronLeft/></button><span>{imageIndex + 1} / {images.length}</span><button className="icon-button" aria-label="下一张图片" onClick={() => setImageIndex((imageIndex + 1) % images.length)}><ChevronRight/></button></div>}</> : currentMode === 'text' ? <div className="text-content-view"><span className="eyebrow">THE FIRST THOUGHT / 文字也是一种开始</span><FileText size={30} strokeWidth={1}/><div>{snapshot.contentText}</div></div> : currentMode === 'file' ? <div className="preview-unavailable"><FileBox size={65} strokeWidth={.8}/><h3>原件已保存，尚无网页预览</h3><p>原始文件已归档，可另补作品图片或网页预览模型。<br/>{snapshot.direction === '三维' ? 'GLB / OBJ / STL 可直接预览；MAX 等格式的独立云端转换服务尚待接入。' : snapshot.fileUrl ? '可以下载原件，在对应软件中打开。' : '作者暂未开放原文件下载。'}</p>{isOwner && <a className="text-link" href={`#/edit/${work.id}`}>在新版本中补充预览 <ArrowUpRight size={15}/></a>}</div> : <MediaPreview key={`${selectedId}-${currentMode}-${resetKey}`} work={forMode(snapshot, currentMode)} mode="detail" autoRotate={rotate} wireframe={wireframe} className="detail-model"/>}{currentMode === 'model' && <span className="model-coordinate">X / Y / Z</span>}</div>
      {currentMode === 'model' ? <div className="viewer-bottom"><span><MousePointer2 size={14}/>拖动旋转 · 滚轮缩放</span><div><button className={rotate ? 'active' : ''} aria-pressed={rotate} onClick={() => setRotate(!rotate)}>{rotate ? <Pause size={14}/> : <Play size={14}/>}自动旋转</button><button className={wireframe ? 'active' : ''} aria-pressed={wireframe} onClick={() => setWireframe(!wireframe)}><Grid2X2 size={14}/>线框</button><button onClick={() => setResetKey(value => value + 1)}><RotateCcw size={14}/>重置</button></div></div> : currentMode === 'images' && images.length > 1 ? <div className="thumbnail-row">{images.map((image, index) => <button key={image} className={imageIndex === index ? 'active' : ''} aria-label={`查看第 ${index + 1} 张图片`} onClick={() => setImageIndex(index)}><img src={image} alt=""/></button>)}</div> : <div className="viewer-caption"><span>{currentMode === 'video' ? '完整视频 · 播放、声音与全屏由你控制' : currentMode === 'web' ? '交互内容由创作者提供，点击开始体验后加载' : currentMode === 'audio' ? '戴上耳机，听见这一段创作' : '这一刻的创作内容，已被留在这里'}</span></div>}
      {currentMode === 'model' && <p className="preview-note">{snapshot.materialNote || (work.builtIn ? '三维预览来自原始 MAX 场景的真实几何，网页材质为展示近似；完整效果以原始工程为准。' : '网页预览按上传模型显示；外部贴图与专业软件效果可能存在差异。')}</p>}
      {needsSourcePreview && currentMode !== 'file' && <div className="source-preview-status" role="status"><FileBox size={19}/><div><strong>{hasOtherPreview ? '原件已保存，尚无交互式三维预览' : '原件已保存，尚无网页预览'}</strong><p>{hasOtherPreview ? '当前展示的是图片、影音或其他预览资源，并不是可旋转的三维模型。' : '文件已完整归档，网页预览需要另行准备。'}GLB / OBJ / STL 可直接预览；MAX 等格式的独立云端转换服务尚待接入。</p>{isOwner && <a className="text-link" href={`#/edit/${work.id}`}>在新版本中补充网页模型或图片 <ArrowUpRight size={14}/></a>}</div></div>}
      {snapshot.contentText && currentMode !== 'text' && <section className="work-writing"><span className="eyebrow">A NOTE TO THE IDEA / 留给灵感的话</span><p>{snapshot.contentText}</p></section>}
      {processFields.length > 0 && <section className="process-record"><div className="process-record-heading"><span className="eyebrow">GROWTH NOTES / 这一版的创作过程</span>{isOwner && <span>{selected?.isPublic ? <Globe2 size={13}/> : <LockKeyhole size={13}/>} {selected?.isPublic && work.visibility === 'public' ? '此历史节点已公开' : '过程仅自己可见'}</span>}</div>{processFields.map(field => <article key={field.key}><div><field.icon size={16}/><h3>{field.title}</h3></div><p>{snapshot[field.key]}</p></article>)}</section>}
    </section><aside className="detail-info"><div className="eyebrow">{snapshot.direction}<span>/</span>{snapshot.format || (snapshot.videoUrl ? 'VIDEO' : snapshot.audioUrl ? 'AUDIO' : snapshot.interactiveUrl ? 'INTERACTIVE' : 'CREATIVE ARCHIVE')}</div><h1>{snapshot.title}</h1>{snapshot.subtitle && <p className="detail-subtitle">{snapshot.subtitle}</p>}<a href={`#/u/${work.author.slug}`} className="detail-author"><span className="mini-avatar">{work.author.displayName.slice(0, 1)}</span><span>{work.author.displayName}<small>查看个人作品集</small></span><ArrowUpRight size={15}/></a><div className="detail-info-rule"/><div className="description-label">关于这份创作 <span className="down-right">↘</span></div><p className="detail-description">{snapshot.description || '有些想法还在长大，故事也可以慢慢再写。'}</p><div className="tag-list">{snapshot.tags.map(tag => <span key={tag}>#{tag}</span>)}</div><div className={`detail-version-status ${snapshot.status}`}><span>{snapshot.status === 'final' ? <CheckCircle2 size={15}/> : <Sprout size={15}/>} {snapshot.status === 'final' ? '这一版已定稿' : '正在生长'}</span><small>{snapshot.status === 'final' ? '定稿之后，依然可以继续创作。' : '还没完成，也值得被记录。'}</small></div><dl className="work-facts"><div><dt>作品方向</dt><dd>{snapshot.direction}</dd></div><div><dt>{isOwner ? '当前版本' : '展示节点'}</dt><dd>第 {selected?.number || work.versionNumber} 版{isDisplay && ' · 公开展示'}</dd></div><div><dt>保存时间</dt><dd>{dateLabel(selected?.savedAt || work.updatedAt)}</dd></div>{snapshot.fileName && <><div><dt>文件格式</dt><dd>{snapshot.format || '源文件'}</dd></div><div><dt>原件大小</dt><dd>{sizeLabel(snapshot.fileSize)}</dd></div></>}{snapshot.objects !== undefined && <div><dt>场景对象</dt><dd>{snapshot.objects} 个</dd></div>}{snapshot.dimensions && <div><dt>模型尺寸</dt><dd>{snapshot.dimensions}</dd></div>}</dl>
      {snapshot.fileUrl && <a href={snapshot.fileUrl} download={snapshot.fileName || true} className="button button-dark download-button"><Download size={18}/><span>{isOwner && !snapshot.allowSourceDownload ? '下载我的原文件' : '下载原始文件'}<small>{snapshot.fileName}</small></span><ArrowUpRight size={19}/></a>}{snapshot.modelUrl && <a href={snapshot.modelUrl} download className="preview-download">下载网页预览模型 <Download size={13}/></a>}{work.visibility === 'public' ? <button className="button button-outline share-button" onClick={share}><Link2 size={16}/>分享公开展示<ArrowUpRight size={17}/></button> : <div className="private-share-note"><LockKeyhole size={14}/>作品仍为私密，选择展示版本后即可分享。</div>}
      {shareFallback && <div className="share-fallback detail-share"><label htmlFor="work-share">复制公开分享链接</label><input id="work-share" readOnly value={shareFallback} onFocus={event => event.target.select()}/><button className="icon-button" aria-label="关闭分享链接" onClick={() => setShareFallback('')}><X size={14}/></button></div>}
      {isOwner && selected && <div className="publication-panel"><div className="publication-heading"><Globe2 size={16}/><h3>选一个时刻，被看见</h3>{pending && <LoaderCircle size={15} className="spin"/>}</div><p>{isDisplay ? `第 ${selected.number} 版正作为公开展示，新的私密保存不会自动替换它。` : `你正在查看第 ${selected.number} 版。将它设为展示版，只公开这版作品内容；过程是否公开单独选择。`}</p><button className={`button ${isDisplay ? 'button-outline' : 'button-dark'}`} disabled={pending || isDisplay} onClick={() => void publication({ displayVersionId: selected.id }, `已将第 ${selected.number} 版设为公开展示。`)}>{isDisplay ? <Check size={15}/> : <Globe2 size={15}/>} {isDisplay ? '这版正在公开展示' : `公开展示第 ${selected.number} 版`}</button><label className="publication-check"><input type="checkbox" disabled={pending} checked={selected.isPublic} onChange={() => toggleNode(selected, 'public')}/><span>公开这一版的历史节点与过程<small>会让访客看到此版的修改、困难、办法与心得。</small></span></label><label className="publication-check"><input type="checkbox" disabled={pending} checked={selected.important} onChange={() => toggleNode(selected, 'important')}/><span><Star size={13}/>标记为重要节点<small>帮助你在完整历史里找到重要的时刻。</small></span></label>{work.visibility === 'public' && <button className="set-private-button" disabled={pending} onClick={() => void publication({ displayVersionId: null, publicVersionIds: [] }, '作品和历史节点已收回私密空间。')}><LockKeyhole size={12}/>收回这件作品的全部公开展示</button>}</div>}
    </aside></div>
    {(isOwner || shownVersions.length > 0) && <section className="section version-history-section" id="version-history"><div className="section-top"><div><span className="eyebrow">{isOwner ? 'YOUR COMPLETE STORY / 你的完整创作轨迹' : 'CHAPTERS THE CREATOR SHARED / 创作者公开的历程'}</span><h2 className="section-title">每一版，<span>都留下生长的痕迹。</span></h2></div>{isOwner && <span className="history-private-badge"><LockKeyhole size={13}/>完整历史仅自己可见</span>}</div><p className="history-explanation">{isOwner ? '点击节点回看当时的内容；重要标记与公开设置不会创建内容新版本。只有主动保存作品才会留一个新版本。' : '这些节点由创作者选择公开。点击可以回看那个时刻的作品与创作故事。'}</p><div className="version-timeline">{shownVersions.map(version => <article className={`version-node ${selectedId === version.id ? 'selected' : ''}`} key={version.id}><div className="version-node-dot">{version.status === 'final' ? <Check size={12}/> : version.important ? <Star size={12} fill="currentColor"/> : <span/>}</div><div className="version-node-main"><button className="version-select" onClick={() => { chooseVersion(version); document.querySelector('.detail-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><div><strong>第 {version.number} 版</strong>{version.status === 'final' && <span className="version-chip final">这版定稿</span>}{version.important && <span className="version-chip"><Star size={10}/>重要</span>}{work.displayVersionId === version.id && <span className="version-chip public"><Globe2 size={10}/>公开展示</span>}{version.isPublic && <span className="version-chip public">{work.visibility === 'public' ? '过程已公开' : '已选公开节点'}</span>}{isOwner && !version.isPublic && work.displayVersionId !== version.id && <span className="version-chip private"><LockKeyhole size={10}/>私密</span>}</div><time>{dateLabel(version.savedAt, true)}</time><p>{version.process || version.description || (version.status === 'final' ? '在这一刻，给这份创作标记一个定稿。' : '这一版的内容与想法，已经被留下。')}</p><span className="version-open">{selectedId === version.id ? '正在查看这一版' : '回看这一版'}<ArrowUpRight size={14}/></span></button>{isOwner && <div className="version-node-controls"><label><input type="checkbox" checked={version.important} disabled={pending} onChange={() => toggleNode(version, 'important')}/><Star size={12}/>重要节点</label><label><input type="checkbox" checked={version.isPublic} disabled={pending} onChange={() => toggleNode(version, 'public')}/><Globe2 size={12}/>公开过程</label></div>}</div></article>)}</div></section>}
    {isOwner && !work.builtIn && <section className="work-danger-zone"><details><summary><Trash2 size={13}/>管理这件作品</summary>{confirmDelete ? <div><p>删除后，作品、全部版本及对应上传文件都会被移除。此操作无法撤销。</p><button className="danger-button" disabled={deleting} onClick={() => void remove()}>{deleting ? <LoaderCircle size={14} className="spin"/> : <Trash2 size={14}/>}确认删除全部版本</button><button className="text-icon" disabled={deleting} onClick={() => setConfirmDelete(false)}>取消</button></div> : <div><p>继续修改请使用“继续创作”，不必先删除作品。</p><button className="text-icon" onClick={() => setConfirmDelete(true)}><Trash2 size={13}/>删除作品及全部历史</button></div>}</details></section>}
    {lightbox && <div className="lightbox" role="dialog" aria-modal="true" aria-label="作品图片大图" onClick={() => setLightbox(false)}><button autoFocus className="lightbox-close icon-button" aria-label="关闭大图" onClick={() => setLightbox(false)}><X size={25}/></button><img src={images[imageIndex]} alt={snapshot.title} onClick={event => event.stopPropagation()}/>{images.length > 1 && <><button className="lightbox-prev icon-button" aria-label="上一张" onClick={event => { event.stopPropagation(); setImageIndex((imageIndex - 1 + images.length) % images.length); }}><ChevronLeft/></button><button className="lightbox-next icon-button" aria-label="下一张" onClick={event => { event.stopPropagation(); setImageIndex((imageIndex + 1) % images.length); }}><ChevronRight/></button></>}<span>{snapshot.title} · {imageIndex + 1} / {images.length}</span></div>}
  </main>;
}
