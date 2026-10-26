import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Plus, Box, UploadCloud, X, FileBox, Image as ImageIcon, Film, Music2, Link2, LockKeyhole, Check, LoaderCircle, Sprout, ChevronDown, ChevronUp, FileText, History, RotateCcw } from 'lucide-react';
import { DIRECTIONS, type Direction, type Snapshot, type Work, type WorkResponse, type User } from '../shared/portfolio';
import { api, emptySnapshot, ensureBrowserSpace, errorMessage, sizeLabel } from './ui-utils';
import { BrowserAccessNote, BrowserSpacePanel, LoadingState, StateNotice } from './PortfolioViews';
import { extractVideoCover, extractModelCover } from './media-cover';

type FileField = 'source' | 'previewModel' | 'video' | 'demoVideo' | 'audio';
type ClearField = 'clearSource' | 'clearModel' | 'clearVideo' | 'clearDemoVideo' | 'clearAudio' | 'clearImages';
const sourceExtensions = ['max', 'blend', 'fbx', 'obj', 'stl', 'glb', 'gltf', 'zip'];
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
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);
  const demoRef = useRef<HTMLInputElement>(null);
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
    const allowed = field === 'previewModel' ? ['glb', 'obj', 'stl'] : field === 'video' || field === 'demoVideo' ? videoExtensions : field === 'audio' ? audioExtensions : sourceExtensions;
    if (!allowed.includes(ext(file.name))) { setError(`${fileLabels[field]}格式不支持，请选择 ${allowed.map(value => value.toUpperCase()).join('、')}。`); return; }
    if (file.size > maxTotal) { setError('单个文件不能超过 40 MB；大工程可先上传轻量预览或文字灵感。'); return; }
    setFiles(previous => ({ ...previous, [field]: file })); setCleared(previous => ({ ...previous, [clearKeys[field]]: false }));
    if (!draft.title) update('title', file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').slice(0, 80));
  };
  const acceptFiles = (incoming: File[]) => {
    setError('');
    const pictures = incoming.filter(file => imageExtensions.includes(ext(file.name)));
    if (pictures.length) addImages(pictures);
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
    if (spaceChanged) { setError('当前浏览器空间已经变化。未保存的文字和文件仍保留在此页，请先复制或保留，再打开当前空间；本次没有自动转移旧空间内容。'); return; }
    if (!draft.title.trim() || !direction) { setError('请填写作品名称，并选择一个主方向。'); return; }
    if (!hasContent()) { setError('至少留下一份内容：文件、图片、影音、文字灵感或交互链接，任选一种就能开始。'); return; }
    if (total > maxTotal) { setError('本次新上传的文件总计不能超过 40 MB；保留的旧文件不占本次额度。'); return; }
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
        const model = files.previewModel || (files.source && ['glb', 'obj', 'stl'].includes(ext(files.source.name)) ? files.source : null);
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
  return <main className="upload-page section"><div className="upload-heading"><a className="text-link" href={existing ? `#/work/${existing.id}` : '#/space'}><ArrowLeft size={15}/>{existing ? '回到作品' : '我的创作空间'}</a><span className="eyebrow">{existing ? 'KEEP THE STORY GROWING / 让故事继续' : 'PLANT THE FIRST IDEA / 种下一颗灵感'}</span><h1>{existing ? <>继续写下，<br/><span className="serif-italic">这一页也会留下。</span></> : <>不必等到完成，<br/><span className="serif-italic">现在就值得记录。</span></>}<span className="upload-star">✳</span></h1><p>{existing ? `沿用第 ${existing.versionNumber} 版的内容，无需重新上传文件。保存后生成私密新版本，原公开展示与旧定稿保持原样。` : '名称、主方向与一份内容就够了。封面、标签和过程故事，都可以以后再补。'}</p></div>
    {spaceChanged && <div className="form-error" role="alert"><span>!</span><div>浏览器空间已变化，未保存的文字和文件仍保留在此页。请先复制或保留；旧空间中的作品不会自动转入。<a href="#/space">查看当前空间（将离开此页）<ArrowUpRight size={14}/></a></div></div>}
    <div className="upload-layout"><form className="upload-form" onSubmit={submit}><fieldset disabled={submitting} className="work-form-fieldset"><section className="form-section"><div className="form-section-heading"><span>01</span><h2>给灵感一个名字</h2><small>只需要两个小信息</small></div><div className="form-field"><label htmlFor="work-title">作品名称 <span>*</span></label><input id="work-title" value={draft.title} maxLength={80} required placeholder="这个念头，叫什么名字？" onChange={event => update('title', event.target.value)}/></div><div className="form-field"><label htmlFor="work-direction">主方向 <span>*</span><small>一个方向，可添加多个标签</small></label><div className="form-select"><select id="work-direction" value={direction} required onChange={event => setDirection(event.target.value as Direction)}><option value="" disabled>选择一个创作方向</option>{DIRECTIONS.map(value => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={15}/></div></div><div className="form-field"><label htmlFor="work-tags">灵感标签 <small>选填，逗号分隔</small></label><input id="work-tags" value={tags} maxLength={240} placeholder="例如：家具设计，角色动画，实验影像" onChange={event => setTags(event.target.value)}/></div></section>
      <section className="form-section"><div className="form-section-heading"><span>02</span><h2>留下一份创作内容</h2><small>{existing ? '也可以沿用已有内容，只更新文字' : '文件、文字、链接，任选一种即可'}</small></div><input hidden ref={inputRef} type="file" multiple accept=".max,.blend,.fbx,.obj,.stl,.glb,.gltf,.zip,image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4,.m4a" onChange={event => { acceptFiles(Array.from(event.target.files || [])); event.target.value = ''; }}/><div className={`drop-zone content-drop ${dragOver ? 'drag-over' : ''}`} onDragOver={event => { event.preventDefault(); if (!submitting) setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={drop}><button type="button" className="drop-content" onClick={() => inputRef.current?.click()}><span className="upload-icon"><UploadCloud size={29} strokeWidth={1.2}/><span>+</span></span><strong>把想法，放到这里。</strong><span>拖入文件，或 <u>点击选择内容</u></span><small>三维工程 / 图片 / MP4、WebM / MP3、WAV、OGG、M4A<br/>单次新文件共 ≤ 40 MB，图片每张 ≤ 12 MB</small></button></div>
        <div className="selected-media-list">{(Object.keys(fileLabels) as FileField[]).map(field => { const file = files[field]; const retained = hasInherited(field); if (!file && !retained) return null; return <div className="selected-media" key={field}><span className="selected-media-icon">{field === 'video' || field === 'demoVideo' ? <Film size={20}/> : field === 'audio' ? <Music2 size={20}/> : <FileBox size={20}/>}</span><div><small>{fileLabels[field]} · {file ? '本次上传' : '沿用上一版'}</small><strong>{file?.name || (field === 'source' ? existing?.fileName : `${fileLabels[field]}已保留`)}</strong>{file && <small>{sizeLabel(file.size)}</small>}</div><button type="button" className="icon-button" aria-label={`移除${fileLabels[field]}`} onClick={() => file ? removeFile(field) : setCleared(previous => ({ ...previous, [clearKeys[field]]: true }))}><X size={15}/></button></div>; })}</div>
        {(Object.keys(fileLabels) as FileField[]).some(field => cleared[clearKeys[field]]) && <div className="removed-media">本次已移除部分沿用文件，旧版本仍保留。<button type="button" onClick={() => setCleared(previous => ({ ...previous, clearSource: false, clearModel: false, clearVideo: false, clearDemoVideo: false, clearAudio: false }))}><RotateCcw size={12}/>恢复沿用</button></div>}
        <div className="image-upload-label"><span>作品图片与封面<small>选填 · 第一张作为封面，可点图片上的「设为封面」调整</small></span><span>{images.length || (!cleared.clearImages ? inheritedImages.length : 0)} / 8</span></div><input ref={imageRef} hidden type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif" onChange={event => { addImages(Array.from(event.target.files || [])); event.target.value = ''; }}/><div className="image-preview-grid">{previews.map((url, index) => <div className="upload-preview" key={url}><img src={url} alt={`本次上传的图片 ${index + 1}`}/><button type="button" className="image-cover-choice" onClick={() => setImages(previous => [previous[index], ...previous.filter((_, i) => i !== index)])}>{index === 0 ? '封面' : '设为封面'}</button><button type="button" className="icon-button" aria-label={`移除第 ${index + 1} 张图片`} onClick={() => setImages(previous => previous.filter((_, i) => i !== index))}><X size={12}/></button></div>)}{!images.length && !cleared.clearImages && inheritedImages.map((image, index) => <div className="upload-preview inherited-image" key={image}><img src={image} alt={`沿用的作品图片 ${index + 1}`}/><span>{index === 0 ? '沿用封面' : '沿用'}</span></div>)}{images.length < 8 && <button type="button" className="add-image" onClick={() => imageRef.current?.click()}><Plus size={23}/><span>添加图片</span><small>图片可稍后补充</small></button>}</div>{images.length > 0 && inheritedImages.length > 0 && <p className="field-help">新图片将替换这一版的图片集，旧版本里的图片仍然保留。</p>}{!images.length && inheritedImages.length > 0 && <button type="button" className="inline-clear" onClick={() => setCleared(previous => ({ ...previous, clearImages: !previous.clearImages }))}>{cleared.clearImages ? <RotateCcw size={12}/> : <X size={12}/>} {cleared.clearImages ? '恢复沿用图片' : '本次不沿用旧图片'}</button>}
        <label className="form-check auto-cover-check"><input type="checkbox" checked={autoCover} onChange={event => setAutoCover(event.target.checked)}/><span>没有手工封面时，尝试从作品取一帧<small>支持的视频或 GLB / OBJ / STL 会自动取画面；失败也能正常保存。</small></span></label>
        <div className="upload-limits"><span>保留旧内容不占本次上传额度</span><span className={total > maxTotal ? 'over-limit' : ''}>{sizeLabel(total)} / 40 MB</span></div>
        <div className="form-field content-text-field"><label htmlFor="content-text"><FileText size={14}/>文字灵感 <small>也可以只从一段文字开始</small></label><textarea id="content-text" rows={4} maxLength={20000} value={draft.contentText} placeholder="还没来得及做成文件？先把现在的想法写下来。" onChange={event => update('contentText', event.target.value)}/></div><div className="form-field"><label htmlFor="interactive-url"><Link2 size={14}/>交互体验链接 <small>选填，仅支持 HTTPS</small></label><input id="interactive-url" type="url" value={draft.interactiveUrl} placeholder="https://你的可运行作品地址" onChange={event => update('interactiveUrl', event.target.value)}/><p className="field-help">能在网页运行的作品可直接体验；暂不能嵌入的链接会提供新窗口入口，也可上传演示视频。</p></div>
        <details className="form-disclosure"><summary><Box size={15}/>补充网页预览或演示视频 <span>选填</span><ChevronDown size={15}/></summary><div className="disclosure-body"><p className="field-help">MAX / BLEND / FBX 原件不会在浏览器中自动运行。可另加一个 GLB / OBJ / STL 轻量预览，或一段交互演示。</p><input hidden ref={modelRef} type="file" accept=".glb,.obj,.stl" onChange={event => { chooseFile('previewModel', event.target.files?.[0]); event.target.value = ''; }}/><input hidden ref={demoRef} type="file" accept="video/mp4,video/webm" onChange={event => { chooseFile('demoVideo', event.target.files?.[0]); event.target.value = ''; }}/><div className="extra-media-actions"><button type="button" className="button button-outline" onClick={() => modelRef.current?.click()}><Box size={15}/>选择网页三维模型</button><button type="button" className="button button-outline" onClick={() => demoRef.current?.click()}><Film size={15}/>选择交互演示视频</button></div></div></details>
        {(files.video || files.demoVideo || existing?.videoUrl || existing?.demoVideoUrl || direction === '影视') && <details className="form-disclosure"><summary><Film size={15}/>卡片上的预览片段 <span>选填</span><ChevronDown size={15}/></summary><div className="disclosure-body"><p className="field-help">默认从公开正片开头预览约 20 秒，短于预览长度的作品播放到结尾。详情页始终播放完整视频，不用另外制作预告片。</p><div className="preview-range"><div className="form-field"><label htmlFor="preview-start">开始秒数</label><input id="preview-start" type="number" min="0" step="0.1" value={previewStart} placeholder="0" onChange={event => setPreviewStart(event.target.value)}/></div><div className="form-field"><label htmlFor="preview-end">结束秒数</label><input id="preview-end" type="number" min="0" step="0.1" value={previewEnd} placeholder="默认 20" onChange={event => setPreviewEnd(event.target.value)}/></div></div></div></details>}
      </section>
      <section className="form-section"><div className="form-section-heading"><span>03</span><h2>写给这一版的话</h2><small>以下全部选填</small></div><div className="form-field"><label htmlFor="work-subtitle">一句话描述 <small>选填</small></label><input id="work-subtitle" maxLength={160} value={draft.subtitle} placeholder="用一句话，描述这份创作。" onChange={event => update('subtitle', event.target.value)}/></div><div className="form-field"><label htmlFor="work-description">作品介绍 <small>选填</small></label><textarea id="work-description" maxLength={4000} rows={4} value={draft.description} placeholder="关于灵感、表达、材质或你的尝试…" onChange={event => update('description', event.target.value)}/></div>
        <details className="form-disclosure process-disclosure"><summary><Sprout size={16}/>记录修改、难题与心得 <span>想写时再写</span><ChevronDown size={15}/></summary><div className="disclosure-body"><div className="process-privacy"><LockKeyhole size={14}/>这些过程记录默认私密，只有明确公开该历史节点才会向访客展示。</div>{([{ key: 'process', label: '这次做了什么', placeholder: '从初稿到这一版，留下重要的改动或想法。' }, { key: 'difficulties', label: '遇到的困难', placeholder: '卡住的地方、反复尝试过的问题…' }, { key: 'solutions', label: '怎样解决', placeholder: '用过的方法，成功或未成功的尝试…' }, { key: 'reflection', label: '此刻的心得', placeholder: '学到了什么？下一次想试试什么？' }] as const).map(field => <div className="form-field" key={field.key}><label htmlFor={`process-${field.key}`}>{field.label}<small>选填</small></label><textarea id={`process-${field.key}`} rows={3} maxLength={4000} value={draft[field.key]} placeholder={field.placeholder} onChange={event => update(field.key, event.target.value)}/></div>)}</div></details>
        <div className="version-status-field"><span>这一版的状态</span><div role="group" aria-label="当前创作状态"><button type="button" className={draft.status === 'in-progress' ? 'active' : ''} aria-pressed={draft.status === 'in-progress'} onClick={() => update('status', 'in-progress')}><Sprout size={16}/><span>继续生长<small>未完成也值得留下</small></span>{draft.status === 'in-progress' && <Check size={15}/>}</button><button type="button" className={draft.status === 'final' ? 'active' : ''} aria-pressed={draft.status === 'final'} onClick={() => update('status', 'final')}><Check size={16}/><span>这版定稿<small>之后仍然可以继续修改</small></span>{draft.status === 'final' && <Check size={15}/>}</button></div></div>
        <label className="form-check source-download-check"><input type="checkbox" checked={draft.allowSourceDownload} onChange={event => update('allowSourceDownload', event.target.checked)}/><span>公开这版时，允许访客下载原始文件<small>默认关闭。用于网页展示的模型、图片与影音预览在该版本公开后可被访客读取。</small></span></label>
      </section></fieldset>
      {error && <div className="form-error" role="alert"><span>!</span><div>{error}</div></div>}
      <div className="save-private-note"><LockKeyhole size={16}/><span>{existing ? `将保存为第 ${existing.versionCount + 1} 个私密版本` : '先存进你的私密空间'}<small>{existing ? '每次主动保存都会留一个版本。公开展示不会自动跟着变化。' : '保存后，再决定是否公开以及展示哪一版。'}</small></span></div><div className="submit-row"><span><span className="online-dot"/>保存这一页，续写创作的来路。</span><button type="submit" className="button button-dark button-large" disabled={submitting || spaceChanged}>{submitting ? <><LoaderCircle size={18} className="spin"/>{preparing ? '正在取作品画面…' : progress < 100 ? `上传中 ${progress}%` : '正在保存这一版…'}</> : <>{existing ? '保存这一版' : '先保存这一刻'}<ArrowUpRight size={20}/></>}</button></div>{submitting && <div className="progress-track" role="progressbar" aria-label="上传进度" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }}/></div>}
    </form><aside className="upload-sidebar"><div className="upload-aside-card"><span className="eyebrow">EVERY STAGE IS WORTH KEEPING.</span><h3>先留下，<br/>再慢慢<span>长成。</span></h3><div className="upload-tip"><span>↗</span><div><strong>有一份内容，就够了</strong><p>文字、图片、模型、影音或可运行链接，任意一种都能作为起点。</p></div></div><div className="upload-tip"><span>↗</span><div><strong>不必为封面等太久</strong><p>手工封面选填。能取画面就自动取，暂时取不到也可以先保存。</p></div></div><div className="upload-tip"><span>↗</span><div><strong>旧定稿也会一直在</strong><p>每次主动保存留下一个版本，继续修改不会覆盖曾经的定稿。</p></div></div><div className="cloud-note"><LockKeyhole size={23} strokeWidth={1.2}/><span>每个新版本，先只留给你<small>准备好时，再选择要公开的时刻。</small></span></div></div><div className="workspace-byline"><History size={17}/><span>{existing ? `正在继续「${existing.title}」` : `当前空间：${user.profile?.displayName || '我的创作空间'}`}<small>离开前记得保存这一页，让创作的来路留下。</small></span></div><BrowserAccessNote compact/></aside></div></main>;
}
