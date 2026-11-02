import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Plus, Box, UploadCloud, X, FileBox, Image as ImageIcon, Film, Music2, Link2, LockKeyhole, Check, LoaderCircle, Sprout, ChevronDown, FileText, History, RotateCcw } from 'lucide-react';
import { DIRECT_MODEL_EXTENSIONS, MODEL_PREVIEW_EXTENSIONS, DIRECTIONS, type Direction, type Snapshot, type Work, type WorkResponse, type User } from '../shared/portfolio';
import { api, emptySnapshot, ensureBrowserSpace, errorMessage, sizeLabel } from './ui-utils';
import { BrowserAccessNote, BrowserSpacePanel, LoadingState, StateNotice } from './PortfolioViews';
import { extractVideoCover, extractModelCover } from './media-cover';
import './work-form.css';

type FileField = 'source' | 'previewModel' | 'video' | 'demoVideo' | 'audio';
type ClearField = 'clearSource' | 'clearModel' | 'clearVideo' | 'clearDemoVideo' | 'clearAudio' | 'clearImages';
const directModelExtensions = DIRECT_MODEL_EXTENSIONS as readonly string[];
const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'];
const videoExtensions = ['mp4', 'webm'];
const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a'];
const ext = (name: string) => name.split('.').pop()?.toLowerCase() || '';
const maxTotal = 40 * 1024 * 1024;
const fileLabels: Record<FileField, string> = { source: '原始文件', previewModel: '网页三维模型', video: '作品视频', demoVideo: '交互演示视频', audio: '音频作品' };
const clearKeys: Record<FileField, ClearField> = { source: 'clearSource', previewModel: 'clearModel', video: 'clearVideo', demoVideo: 'clearDemoVideo', audio: 'clearAudio' };
const snapshotKeys: Record<FileField, keyof Snapshot> = { source: 'fileUrl', previewModel: 'modelUrl', video: 'videoUrl', demoVideo: 'demoVideoUrl', audio: 'audioUrl' };
const emptyFiles = (): Record<FileField, File | null> => ({ source: null, previewModel: null, video: null, demoVideo: null, audio: null });
const emptyClear = (): Record<ClearField, boolean> => ({ clearSource: false, clearModel: false, clearVideo: false, clearDemoVideo: false, clearAudio: false, clearImages: false });

export default function WorkForm({ id, user, onSaved }: { id?: string; user: User; onSaved: (response: WorkResponse) => void }) {
  const [draft, setDraft] = useState<Snapshot>(emptySnapshot);
  const [direction, setDirection] = useState<Direction | ''>('');
  const [tags, setTags] = useState('');
  const [existing, setExisting] = useState<Work | null>(null);
  const [files, setFiles] = useState(emptyFiles);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [cleared, setCleared] = useState(emptyClear);
  const [previewStart, setPreviewStart] = useState('');
  const [previewEnd, setPreviewEnd] = useState('');
  const [autoCover, setAutoCover] = useState(true);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [contentTab, setContentTab] = useState<'files' | 'images' | 'text' | 'link'>('files');
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);
  const demoRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const originSpaceId = useRef(user?.id || '');
  const spaceChanged = Boolean(originSpaceId.current && user?.id && originSpaceId.current !== user.id);
  const load = async () => {
    if (!id || !user) return;
    setLoading(true); setLoadError('');
    try {
      const response = await api<WorkResponse>(`/api/works/${encodeURIComponent(id)}`);
      if (!response.isOwner) throw new Error('这件作品属于其他创作者，只有作者可以编辑。');
      setExisting(response.work); setDraft({ ...response.work, status: 'in-progress' }); setDirection(response.work.direction); setTags(response.work.tags.join('，')); setPreviewStart(response.work.previewStart?.toString() || ''); setPreviewEnd(response.work.previewEnd?.toString() || '');
      setContentTab(response.work.fileUrl || response.work.modelUrl || response.work.videoUrl || response.work.demoVideoUrl || response.work.audioUrl ? 'files' : response.work.images.length ? 'images' : response.work.contentText ? 'text' : 'link');
    } catch (error) { setLoadError(errorMessage(error)); } finally { setLoading(false); }
  };
  // A changed browser credential must not reload over an unsaved editing session.
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [id]);
  useEffect(() => { const urls = images.map(file => URL.createObjectURL(file)); setPreviews(urls); return () => urls.forEach(url => URL.revokeObjectURL(url)); }, [images]);
  useEffect(() => {
    if (!submitting) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [submitting]);
  const update = <K extends keyof Snapshot>(key: K, value: Snapshot[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  const total = Object.values(files).reduce((sum, file) => sum + (file?.size || 0), 0) + images.reduce((sum, file) => sum + file.size, 0);
  const hasInherited = (field: FileField) => Boolean(existing?.[snapshotKeys[field]]) && !cleared[clearKeys[field]]
    && !(field === 'previewModel' && cleared.clearSource && existing?.modelUrl === existing?.fileUrl);
  const removeFile = (field: FileField) => setFiles(previous => ({ ...previous, [field]: null }));
  const addImages = (incoming: File[]) => {
    const valid = incoming.filter(file => imageExtensions.includes(ext(file.name)) && file.size <= 12 * 1024 * 1024);
    if (valid.length !== incoming.length) setError('部分图片未添加。支持 JPG、PNG、WebP、AVIF、GIF，每张不超过 12 MB。');
    if (valid.length + images.length > 8) setError('每次最多上传 8 张图片，请减少后再保存。');
    setImages(previous => [...previous, ...valid].slice(0, 8));
    if (valid.length) setCleared(previous => ({ ...previous, clearImages: false }));
  };
  const chooseFile = (field: FileField, file?: File) => {
    if (!file) return;
    const allowed: readonly string[] | null = field === 'previewModel' ? MODEL_PREVIEW_EXTENSIONS : field === 'video' || field === 'demoVideo' ? videoExtensions : field === 'audio' ? audioExtensions : null;
    if (allowed && !allowed.includes(ext(file.name))) { setError(`${fileLabels[field]}格式不支持，请选择 ${allowed.map(value => value.toUpperCase()).join('、')}。`); return; }
    if (file.size > maxTotal) { setError('单个文件不能超过 40 MiB；大工程可先上传轻量预览或文字灵感。'); return; }
    setFiles(previous => ({ ...previous, [field]: file })); setCleared(previous => ({ ...previous, [clearKeys[field]]: false }));
    if (!draft.title) update('title', file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').slice(0, 80));
  };
  const chooseModelFiles = async (incoming: File[]) => {
    if (!incoming.length) return;
    setPreparing(true); setError('');
    try { const { bundleModelFiles } = await import('./model-loader'); const file = await bundleModelFiles(incoming); if (mounted.current) chooseFile('previewModel', file); }
    catch (error) { if (mounted.current) setError(errorMessage(error)); }
    finally { if (mounted.current) setPreparing(false); }
  };
  const acceptFiles = (incoming: File[]) => {
    setError('');
    if (incoming.some(file => /\.(bin|mtl)$/i.test(file.name)) && incoming.some(file => directModelExtensions.includes(ext(file.name)))) { void chooseModelFiles(incoming); return; }
    const pictures = incoming.filter(file => imageExtensions.includes(ext(file.name)));
    if (pictures.length) addImages(pictures);
    if (pictures.length === incoming.length && pictures.length) setContentTab('images');
    const consumed = new Set<FileField>();
    for (const file of incoming.filter(file => !imageExtensions.includes(ext(file.name)))) {
      const field: FileField = videoExtensions.includes(ext(file.name)) ? direction === '交互' ? 'demoVideo' : 'video' : audioExtensions.includes(ext(file.name)) ? 'audio' : 'source';
      if (consumed.has(field)) { setError(`一次只保留一份${fileLabels[field]}，其余文件可打包 ZIP 后作为原件上传。`); continue; }
      consumed.add(field); chooseFile(field, file);
    }
  };
  const drop = (event: DragEvent) => { event.preventDefault(); setDragOver(false); if (!submitting) acceptFiles(Array.from(event.dataTransfer.files)); };
  const hasContent = () => Boolean(draft.contentText.trim() || draft.interactiveUrl.trim() || Object.values(files).some(Boolean) || images.length || (!cleared.clearImages && existing?.images.length) || (Object.keys(fileLabels) as FileField[]).some(hasInherited));

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (preparing) return;
    if (spaceChanged) { setError('当前浏览器空间已经变化。未保存的文字和文件仍保留在此页，请先复制或保留，再打开当前空间；本次没有自动转移旧空间内容。'); return; }
    if (!draft.title.trim() || !direction) { setError('请填写作品名称，并选择一个主方向。'); return; }
    if (!hasContent()) { setError('至少留下一份内容：文件、图片、影音、文字灵感或交互链接，任选一种就能开始。'); return; }
    if (total > maxTotal) { setError('本次新上传的文件总计不能超过 40 MiB；保留的旧文件不占本次额度。'); return; }
    if (draft.interactiveUrl.trim()) {
      try { const url = new URL(draft.interactiveUrl.trim()); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); }
      catch { setError('交互链接请使用完整的 HTTPS 网址，例如 https://example.com。'); return; }
    }
    const start = previewStart.trim() ? Number(previewStart) : undefined;
    const end = previewEnd.trim() ? Number(previewEnd) : undefined;
    if ((start !== undefined && (!Number.isFinite(start) || start < 0)) || (end !== undefined && (!Number.isFinite(end) || end <= (start || 0)))) { setError('片段起点应不小于 0，终点应大于起点；不填写也可以使用默认预览。'); return; }
    setSubmitting(true); setProgress(0);
    let autoImage: File | null = null;
    if (autoCover && !images.length && !(existing?.coverUrl && !cleared.clearImages)) {
      setPreparing(true);
      try {
        const video = files.video || files.demoVideo;
        const model = files.previewModel || (files.source && directModelExtensions.includes(ext(files.source.name)) ? files.source : null);
        autoImage = await Promise.race([video ? extractVideoCover(video, start || 0) : model ? extractModelCover(model) : Promise.resolve(null), new Promise<null>(resolve => setTimeout(() => resolve(null), 10000))]);
        if (autoImage && total + autoImage.size > maxTotal) autoImage = null;
      } catch { /* A cover is optional. Saving must continue if extraction is unavailable. */ }
      finally { if (mounted.current) setPreparing(false); }
    }
    if (!mounted.current) return;
    const form = new FormData();
    for (const key of ['title', 'subtitle', 'description', 'contentText', 'process', 'difficulties', 'solutions', 'reflection', 'status', 'interactiveUrl'] as const) form.append(key, typeof draft[key] === 'string' ? draft[key].trim() : String(draft[key]));
    form.append('direction', direction); form.append('tags', tags.replace(/，/g, ',')); form.append('allowSourceDownload', String(draft.allowSourceDownload));
    if (existing) form.append('baseRevision', String(existing.revision));
    form.append('previewStart', start === undefined ? '' : String(start));
    form.append('previewEnd', end === undefined ? '' : String(end));
    for (const field of Object.keys(files) as FileField[]) if (files[field]) form.append(field, files[field]!);
    for (const image of images) form.append('images', image);
    if (autoImage) form.append('images', autoImage);
    for (const [key, value] of Object.entries(cleared)) if (value) form.append(key, 'true');
    const send = (canRetry: boolean) => {
      const xhr = new XMLHttpRequest();
      xhr.open(existing ? 'PUT' : 'POST', existing ? `/api/works/${encodeURIComponent(existing.id)}` : '/api/works');
      xhr.withCredentials = true; xhr.timeout = 180000;
      xhr.upload.onprogress = event => { if (event.lengthComputable && mounted.current) setProgress(Math.round(event.loaded / event.total * 100)); };
      xhr.onload = async () => {
        if (!mounted.current) return;
        if (xhr.status === 401 && canRetry) {
          try {
            const ready = await ensureBrowserSpace();
            if (user?.id && ready.user?.id !== user.id) throw new Error('当前浏览器已进入新的创作空间，本次没有自动保存或转移旧空间内容。请保留输入，并重新打开空间确认。');
            if (mounted.current) { setProgress(0); send(false); }
          } catch (error) { if (mounted.current) { setSubmitting(false); setError(errorMessage(error)); } }
          return;
        }
        setSubmitting(false);
        try {
          const response = JSON.parse(xhr.responseText) as WorkResponse & { error?: string };
          if (xhr.status === 401) throw new Error('当前浏览器空间仍未准备好，本次尚未保存。请允许本站保存 Cookie 后重新打开空间。');
          if (xhr.status === 409) throw new Error('这件作品已在其他页面被更新。你的输入仍在，请先复制需要保留的内容，再重新载入最新版本后保存。');
          if (xhr.status < 200 || xhr.status >= 300 || !response.work) throw new Error(response.error || '保存没有完成，请重试。');
          onSaved(response);
        } catch (error) { setError(errorMessage(error)); }
      };
      xhr.onerror = () => { if (mounted.current) { setSubmitting(false); setError('网络连接中断，本次尚未保存。文件和输入仍在，可直接重试。'); } };
      xhr.ontimeout = () => { if (mounted.current) { setSubmitting(false); setError('上传超时，本次未确认保存成功。请检查网络，刷新我的空间确认后再重试。'); } };
      xhr.send(form);
    };
    send(true);
  };

  if (!user) return <BrowserSpacePanel/>;
  if (loading) return <main className="section"><LoadingState text="正在取回最新的创作版本…"/></main>;
  if (loadError) return <main className="section"><StateNotice title="暂时无法继续编辑。" message={loadError} retry={load}/></main>;
  const inheritedImages = existing?.images || [];
  const nonPreviewSource = Boolean(files.source && !directModelExtensions.includes(ext(files.source.name)))
    || Boolean(!files.source && existing?.fileName && !existing.modelUrl && !cleared.clearSource);
  const coverPreview = previews[0] || (!cleared.clearImages ? existing?.coverUrl : '');
  const selectedCount = Object.values(files).filter(Boolean).length;
  const pictureCount = images.length || (!cleared.clearImages ? inheritedImages.length : 0);
  return <main className="upload-page section creation-editor">
    <div className="upload-heading">
      <a className="text-link" href={existing ? `#/work/${existing.id}` : '#/space'}><ArrowLeft size={15}/>{existing ? '回到作品' : '我的创作空间'}</a>
      <div className="creation-heading-line"><div><span className="eyebrow">{existing ? 'KEEP GROWING / 续写这一页' : 'A NEW CHAPTER / 新的一页'}</span><h1>{existing ? '继续创作' : '记录创作'}<span className="title-dot">.</span></h1><p>{existing ? '沿用已有内容，保存一个新的私密版本。' : '名字、方向、一份内容。其余都可以慢慢补。'}</p></div><span className="creation-header-mark" aria-hidden="true">✳</span></div>
    </div>
    {spaceChanged && <div className="form-error" role="alert">浏览器空间已变化，请先保留当前输入，再<a href="#/space">查看当前空间</a>。</div>}
    <div className="upload-layout creation-layout">
      <form id="creation-form" className="upload-form" onSubmit={submit}>
        {error && <div className="form-error" role="alert"><span>!</span><div>{error}</div></div>}
        <fieldset disabled={submitting || preparing} className="work-form-fieldset">
          <section className="form-section creation-card">
            <div className="form-section-heading"><span>01</span><h2>基本信息</h2><small>必填</small></div>
            <div className="creation-basics">
              <div className="form-field"><label htmlFor="work-title">作品名称 <span>*</span></label><input id="work-title" value={draft.title} maxLength={80} required placeholder="给这份创作起个名字" onChange={event => update('title', event.target.value)}/></div>
              <div className="form-field"><label htmlFor="work-direction">主方向 <span>*</span></label><div className="form-select"><select id="work-direction" value={direction} required onChange={event => setDirection(event.target.value as Direction)}><option value="" disabled>选择方向</option>{DIRECTIONS.map(value => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={15}/></div></div>
            </div>
          </section>
          <section className="form-section creation-card" id="creation-content">
            <div className="form-section-heading"><span>02</span><h2>作品内容</h2><small>至少留下一份</small></div>
            <div className="creation-content-tabs" role="group" aria-label="添加内容的方式">
              {([{ key: 'files', label: '文件', icon: FileBox, count: selectedCount }, { key: 'images', label: '图片', icon: ImageIcon, count: pictureCount }, { key: 'text', label: '文字', icon: FileText, count: draft.contentText.trim() ? 1 : 0 }, { key: 'link', label: '链接', icon: Link2, count: draft.interactiveUrl.trim() ? 1 : 0 }] as const).map(tab => <button key={tab.key} type="button" aria-pressed={contentTab === tab.key} onClick={() => setContentTab(tab.key)}><tab.icon size={16}/>{tab.label}{tab.count > 0 && <small>{tab.count}</small>}</button>)}
            </div>
            <input hidden ref={inputRef} type="file" multiple onChange={event => { acceptFiles(Array.from(event.target.files || [])); event.target.value = ''; }}/>
            <input ref={imageRef} hidden type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif" onChange={event => { addImages(Array.from(event.target.files || [])); event.target.value = ''; }}/>
            <input hidden ref={modelRef} type="file" multiple accept=".glb,.gltf,.obj,.stl,.fbx,.step,.stp,.zip,.bin,.mtl,.png,.jpg,.jpeg,.webp" onChange={event => { void chooseModelFiles(Array.from(event.target.files || [])); event.target.value = ''; }}/>
            <input hidden ref={folderRef} type="file" multiple {...{ webkitdirectory: '' }} onChange={event => { void chooseModelFiles(Array.from(event.target.files || [])); event.target.value = ''; }}/>
            <input hidden ref={demoRef} type="file" accept="video/mp4,video/webm" onChange={event => { chooseFile('demoVideo', event.target.files?.[0]); event.target.value = ''; }}/>
            <div className="creation-content-panel">
              {contentTab === 'files' && <>
                <div className={`drop-zone content-drop ${dragOver ? 'drag-over' : ''}`} onDragOver={event => { event.preventDefault(); if (!submitting) setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={drop}><button type="button" className="drop-content" onClick={() => inputRef.current?.click()}><span className="upload-icon"><UploadCloud size={28} strokeWidth={1.3}/></span><strong>拖入作品，或点击选择</strong><span>工程文件、模型、视频和音频</span><small>单次新增文件合计不超过 40 MiB</small></button></div>
                {nonPreviewSource && <p className="creation-source-note" role="status"><FileBox size={14}/>{files.previewModel || hasInherited('previewModel') ? '原件与网页模型分开保留，请确认预览对应这一版。' : 'MAX 等原件可保存；网页预览请另加模型或图片。'}</p>}
                <details className="creation-media-options"><summary><Box size={15}/>补充三维预览或演示视频<ChevronDown size={14}/></summary><div><p className="field-help">支持 GLB、glTF、OBJ、STL、FBX、STEP 和模型资源 ZIP。外置贴图请随主模型一起选择。</p><div className="extra-media-actions"><button type="button" className="button button-outline" onClick={() => modelRef.current?.click()}><Box size={15}/>选择模型与配套文件</button><button type="button" className="button button-outline" onClick={() => folderRef.current?.click()}>选择模型文件夹</button><button type="button" className="text-link" onClick={() => demoRef.current?.click()}><Film size={15}/>添加演示视频</button></div></div></details>
              </>}
              {contentTab === 'images' && <>
                <p className="creation-panel-hint">第一张作为封面，最多 8 张，每张不超过 12 MB。</p>
                <div className="image-preview-grid">{previews.map((url, index) => <div className="upload-preview" key={url}><img src={url} alt={`本次上传的图片 ${index + 1}`}/><button type="button" className="image-cover-choice" onClick={() => setImages(previous => [previous[index], ...previous.filter((_, i) => i !== index)])}>{index === 0 ? '封面' : '设为封面'}</button><button type="button" className="icon-button" aria-label={`移除第 ${index + 1} 张图片`} onClick={() => setImages(previous => previous.filter((_, i) => i !== index))}><X size={12}/></button></div>)}{!images.length && !cleared.clearImages && inheritedImages.map((image, index) => <div className="upload-preview inherited-image" key={image}><img src={image} alt={`沿用的作品图片 ${index + 1}`}/><span>{index === 0 ? '沿用封面' : '沿用'}</span></div>)}{images.length < 8 && <button type="button" className="add-image" onClick={() => imageRef.current?.click()}><Plus size={24}/><span>添加图片</span></button>}</div>
                {images.length > 0 && inheritedImages.length > 0 && <p className="field-help">新图片只替换这一版，旧版本中的图片保留。</p>}
                {!images.length && inheritedImages.length > 0 && <button type="button" className="inline-clear" onClick={() => setCleared(previous => ({ ...previous, clearImages: !previous.clearImages }))}>{cleared.clearImages ? <RotateCcw size={12}/> : <X size={12}/>} {cleared.clearImages ? '恢复沿用图片' : '本次不沿用旧图片'}</button>}
              </>}
              {contentTab === 'text' && <div className="form-field"><label htmlFor="content-text">写下一段灵感</label><textarea id="content-text" rows={6} maxLength={20000} value={draft.contentText} placeholder="一个念头、一段构思，也是一份创作。" onChange={event => update('contentText', event.target.value)}/><span className="creation-character-count">{draft.contentText.length.toLocaleString()} / 20,000</span></div>}
              {contentTab === 'link' && <div className="form-field"><label htmlFor="interactive-url">交互体验链接</label><input id="interactive-url" type="url" value={draft.interactiveUrl} placeholder="https://" onChange={event => update('interactiveUrl', event.target.value)}/><p className="field-help">填写可运行作品的 HTTPS 地址，也可以附上演示视频。</p><button type="button" className="text-link" onClick={() => demoRef.current?.click()}><Film size={15}/>添加演示视频</button></div>}
            </div>
            <div className="selected-media-list">{(Object.keys(fileLabels) as FileField[]).map(field => { const file = files[field]; const retained = hasInherited(field); if (!file && !retained) return null; return <div className="selected-media" key={field}><span className="selected-media-icon">{field === 'video' || field === 'demoVideo' ? <Film size={20}/> : field === 'audio' ? <Music2 size={20}/> : <FileBox size={20}/>}</span><div><small>{fileLabels[field]} · {file ? '本次上传' : '沿用上一版'}</small><strong>{file?.name || (field === 'source' ? existing?.fileName : `${fileLabels[field]}已保留`)}</strong>{file && <small>{sizeLabel(file.size)}</small>}</div><button type="button" className="icon-button" aria-label={`移除${fileLabels[field]}`} onClick={() => file ? removeFile(field) : setCleared(previous => ({ ...previous, [clearKeys[field]]: true }))}><X size={15}/></button></div>; })}</div>
            {(Object.keys(fileLabels) as FileField[]).some(field => cleared[clearKeys[field]]) && <div className="removed-media">本次不再沿用部分文件，旧版本仍保留。<button type="button" onClick={() => setCleared(previous => ({ ...previous, clearSource: false, clearModel: false, clearVideo: false, clearDemoVideo: false, clearAudio: false }))}><RotateCcw size={12}/>恢复沿用</button></div>}
            {total > 0 && <div className="upload-limits"><span>本次新增</span><span className={total > maxTotal ? 'over-limit' : ''}>{sizeLabel(total)} / 40 MiB</span></div>}
            {(files.video || files.demoVideo || existing?.videoUrl || existing?.demoVideoUrl || direction === '影视') && <details className="creation-media-options"><summary><Film size={15}/>卡片预览片段 <small>选填</small><ChevronDown size={14}/></summary><div><p className="field-help">默认预览开头约 20 秒，详情页播放完整视频。</p><div className="preview-range"><div className="form-field"><label htmlFor="preview-start">开始秒数</label><input id="preview-start" type="number" min="0" step="0.1" value={previewStart} placeholder="0" onChange={event => setPreviewStart(event.target.value)}/></div><div className="form-field"><label htmlFor="preview-end">结束秒数</label><input id="preview-end" type="number" min="0" step="0.1" value={previewEnd} placeholder="默认 20" onChange={event => setPreviewEnd(event.target.value)}/></div></div></div></details>}
          </section>
          <details className="creation-accordion">
            <summary><span className="creation-accordion-icon"><FileText size={18}/></span><span><strong>补充作品介绍</strong><small>标签、一句话描述与作品介绍</small></span><em>选填</em><ChevronDown size={17}/></summary>
            <div className="creation-accordion-body">
              <div className="form-field"><label htmlFor="work-tags">作品标签 <small>用逗号分隔</small></label><input id="work-tags" value={tags} maxLength={240} placeholder="例如：产品设计，家具设计" onChange={event => setTags(event.target.value)}/></div>
              <div className="form-field"><label htmlFor="work-subtitle">一句话描述</label><input id="work-subtitle" maxLength={160} value={draft.subtitle} placeholder="用一句话介绍这份创作" onChange={event => update('subtitle', event.target.value)}/></div>
              <div className="form-field"><label htmlFor="work-description">作品介绍</label><textarea id="work-description" maxLength={4000} rows={4} value={draft.description} placeholder="关于灵感、表达，或你的尝试……" onChange={event => update('description', event.target.value)}/></div>
            </div>
          </details>
          <details className="creation-accordion">
            <summary><span className="creation-accordion-icon"><Sprout size={18}/></span><span><strong>留下创作过程</strong><small>修改记录、遇到的困难与心得</small></span><em>选填</em><ChevronDown size={17}/></summary>
            <div className="creation-accordion-body"><div className="creation-privacy-note"><LockKeyhole size={14}/>过程默认仅自己可见。</div>{([{ key: 'process', label: '这次做了什么', placeholder: '记录这一版的改动或想法' }, { key: 'difficulties', label: '遇到的困难', placeholder: '卡住的地方，或尝试过的问题' }, { key: 'solutions', label: '怎样解决', placeholder: '用过的方法与尝试' }, { key: 'reflection', label: '此刻的心得', placeholder: '学到了什么，下一步想试什么？' }] as const).map(field => <div className="form-field" key={field.key}><label htmlFor={`process-${field.key}`}>{field.label}</label><textarea id={`process-${field.key}`} rows={3} maxLength={4000} value={draft[field.key]} placeholder={field.placeholder} onChange={event => update(field.key, event.target.value)}/></div>)}</div>
          </details>
          <details className="creation-accordion creation-settings">
            <summary><span className="creation-accordion-icon"><LockKeyhole size={18}/></span><span><strong>更多设置</strong><small>创作状态、封面与原件下载</small></span><ChevronDown size={17}/></summary>
            <div className="creation-accordion-body">
              <div className="version-status-field"><span>这一版的状态</span><div role="group" aria-label="当前创作状态"><button type="button" className={draft.status === 'in-progress' ? 'active' : ''} aria-pressed={draft.status === 'in-progress'} onClick={() => update('status', 'in-progress')}><Sprout size={16}/>继续生长{draft.status === 'in-progress' && <Check size={14}/>}</button><button type="button" className={draft.status === 'final' ? 'active' : ''} aria-pressed={draft.status === 'final'} onClick={() => update('status', 'final')}><Check size={16}/>这版定稿</button></div></div>
              <label className="form-check"><input type="checkbox" checked={autoCover} onChange={event => setAutoCover(event.target.checked)}/><span>未上传封面时，尝试自动取画面<small>支持的模型和视频可用；取不到也能保存。</small></span></label>
              <label className="form-check"><input type="checkbox" checked={draft.allowSourceDownload} onChange={event => update('allowSourceDownload', event.target.checked)}/><span>公开这版时，允许下载原始文件<small>只在你选择公开这一版后生效。</small></span></label>
            </div>
          </details>
        </fieldset>
      </form>
      <aside className="upload-sidebar creation-summary">
        <div className="creation-summary-card">
          <div className="creation-summary-top"><span className="eyebrow">THIS CHAPTER / 这一页</span><span><LockKeyhole size={12}/>仅自己</span></div>
          <div className={`creation-summary-cover ${coverPreview ? 'has-cover' : ''}`}>{coverPreview ? <img src={coverPreview} alt="作品封面预览"/> : <><Sprout size={75} strokeWidth={.8}/><span>EVERY IDEA HAS A SEASON.</span></>}</div>
          <div className="creation-summary-content"><span className="creation-summary-direction">{direction || '等待选择方向'}<span>·</span>{draft.status === 'final' ? '这版定稿' : '生长中'}</span><h2>{draft.title.trim() || '未命名的创作'}</h2><p>{draft.subtitle.trim() || '先留下，再慢慢长成。'}</p><div className="creation-save-status"><History size={15}/>{existing ? `将保存为第 ${existing.versionCount + 1} 版` : '保存你的第一个版本'}</div>
            <button type="submit" form="creation-form" className="button button-dark creation-save-button" disabled={submitting || preparing || spaceChanged}>{submitting || preparing ? <><LoaderCircle size={17} className="spin"/>{preparing ? '正在准备作品…' : progress < 100 ? `上传中 ${progress}%` : '正在保存…'}</> : <>{existing ? '保存这一版' : '先保存这一刻'}<ArrowUpRight size={18}/></>}</button>
            {submitting && <div className="progress-track" role="progressbar" aria-label="上传进度" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }}/></div>}
            <small className="creation-save-caption">保存后，再决定是否公开。</small>
          </div>
        </div>
        <details className="creation-space-help"><summary>关于这个浏览器空间<ChevronDown size={13}/></summary><BrowserAccessNote compact/></details>
      </aside>
    </div>
  </main>;
}
