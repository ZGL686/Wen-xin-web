import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Box, Expand, ExternalLink, FileBox, Image as ImageIcon, MousePointer2, Music2, Play, RotateCcw, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Snapshot } from '../shared/portfolio';
import ModelViewer from './ModelViewer';
import './media-preview.css';

type Props = {
  work: Snapshot; mode: 'card' | 'detail'; active?: boolean;
  onActivate?: () => void; onDeactivate?: () => void; onViewFull?: () => void;
  autoRotate?: boolean; wireframe?: boolean; className?: string;
};
type Kind = 'model' | 'video' | 'audio' | 'web' | 'image' | 'file';

function mediaKind(work: Snapshot): Kind {
  if (work.direction === '交互' && work.interactiveUrl) return 'web';
  if (work.direction === '影视' && (work.videoUrl || work.demoVideoUrl)) return 'video';
  if (work.direction === '交互' && (work.demoVideoUrl || work.videoUrl)) return 'video';
  if (work.modelUrl) return 'model';
  if (work.videoUrl || work.demoVideoUrl) return 'video';
  if (work.audioUrl) return 'audio';
  if (work.images.length || work.coverUrl) return 'image';
  return 'file';
}

/** Only receives an already-authorized snapshot; private revisions are never fetched here. */
export default function MediaPreview({ work, mode, active: controlledActive, onActivate, onDeactivate, onViewFull, autoRotate = true, wireframe = false, className = '' }: Props) {
  const [localActive, setLocalActive] = useState(mode === 'detail');
  const active = controlledActive ?? localActive;
  const [webStarted, setWebStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLVideoElement | null>(null);
  const audioPlayer = useRef<HTMLAudioElement | null>(null);
  const closeZoom = useRef<HTMLButtonElement>(null);
  const zoomOpener = useRef<HTMLButtonElement | null>(null);
  const callbacks = useRef({ onDeactivate }); callbacks.current = { onDeactivate };
  const kind = mediaKind(work);
  const poster = work.coverUrl || work.images[0];
  const images = work.images.length ? work.images : poster ? [poster] : [];
  const videoSrc = work.direction === '交互' ? work.demoVideoUrl || work.videoUrl : work.videoUrl || work.demoVideoUrl;
  const start = Number.isFinite(work.previewStart) ? Math.max(0, work.previewStart || 0) : 0;
  const activate = () => { setLocalActive(true); setEnded(false); setMediaError(false); if (kind === 'web') setWebStarted(true); onActivate?.(); };
  const deactivate = () => { player.current?.pause(); audioPlayer.current?.pause(); setLocalActive(false); setWebStarted(false); setZoom(false); onDeactivate?.(); };

  useEffect(() => { setEnded(false); setMediaError(false); setImageIndex(0); setZoom(false); setWebStarted(false); }, [work.modelUrl, videoSrc, work.interactiveUrl, work.coverUrl, work.audioUrl]);
  useEffect(() => {
    if (!active) { player.current?.pause(); audioPlayer.current?.pause(); setWebStarted(false); }
  }, [active]);
  useEffect(() => {
    const element = host.current; if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) return;
      player.current?.pause(); audioPlayer.current?.pause();
      if (mode === 'card') { setLocalActive(false); setWebStarted(false); callbacks.current.onDeactivate?.(); }
    }, { threshold: .02 });
    observer.observe(element);
    const hidden = () => { if (document.hidden) { player.current?.pause(); audioPlayer.current?.pause(); setWebStarted(false); } };
    document.addEventListener('visibilitychange', hidden);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', hidden); };
  }, [mode]);
  useEffect(() => {
    if (!zoom) return;
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoom(false);
      if (event.key === 'Tab') { event.preventDefault(); closeZoom.current?.focus(); }
    };
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('keydown', close); document.body.style.overflow = previousOverflow; if (zoomOpener.current?.isConnected) zoomOpener.current.focus(); };
  }, [zoom]);

  const previewReady = () => {
    const video = player.current; if (!video || mode !== 'card') return;
    video.currentTime = Math.min(start, Math.max(0, (Number.isFinite(video.duration) ? video.duration : start + 1) - .1));
    video.play().catch(() => { /* Native play controls remain available. */ });
  };
  const checkPreview = () => {
    const video = player.current; if (!video || mode !== 'card') return;
    const proposedEnd = work.previewEnd && work.previewEnd > start ? work.previewEnd : start + 20;
    const end = Number.isFinite(video.duration) ? Math.min(proposedEnd, video.duration) : proposedEnd;
    if (video.currentTime >= end) { video.pause(); setEnded(true); }
  };
  const clampPreview = () => {
    const video = player.current; if (!video || mode !== 'card') return;
    const end = Math.min(work.previewEnd && work.previewEnd > start ? work.previewEnd : start + 20, Number.isFinite(video.duration) ? video.duration : Infinity);
    if (video.currentTime < start && video.duration > start) video.currentTime = start;
    if (video.currentTime > end) { video.currentTime = end; video.pause(); setEnded(true); }
  };
  const replay = () => { setEnded(false); if (player.current) { player.current.currentTime = start; player.current.play().catch(() => {}); } };
  const icon = kind === 'model' ? <Box size={15}/> : kind === 'video' ? <Play size={15}/> : kind === 'audio' ? <Music2 size={15}/> : kind === 'web' ? <MousePointer2 size={15}/> : <ImageIcon size={15}/>;
  const label = kind === 'model' ? '三维可交互' : kind === 'video' ? (work.direction === '交互' ? '演示视频' : '影片预览') : kind === 'web' ? '在线体验' : kind === 'audio' ? '声音作品' : kind === 'image' ? '作品原图' : '创作档案';
  const action = kind === 'model' ? '转一转，看看细节' : kind === 'web' ? '开始体验' : kind === 'audio' ? '打开声音预览' : kind === 'video' ? '播放预览' : kind === 'image' ? '查看作品原图' : '查看作品内容';

  return <div ref={host} className={`media-preview media-preview--${mode} media-preview--${kind} ${active ? 'is-active' : ''} ${className}`}>
    {!active && <>
      {poster ? <img className="media-poster" src={poster} alt={work.title} loading="lazy"/> : <div className="media-placeholder">{kind === 'audio' ? <Music2/> : kind === 'video' ? <Play/> : kind === 'web' ? <MousePointer2/> : <FileBox/>}<span>{work.title}</span><small>{kind === 'file' ? '灵感与工程，已留在这里。' : '点击，展开这件作品。'}</small></div>}
      <span className="media-kind">{icon}{label}</span>
      {kind !== 'file' && <button type="button" className="media-activate" onClick={activate} aria-label={`${action}：${work.title}`}>{kind === 'video' || kind === 'audio' ? <Play size={18} fill="currentColor"/> : icon}<span>{action}</span><ArrowUpRight size={17}/></button>}
    </>}

    {active && kind === 'model' && <><ModelViewer src={work.modelUrl} poster={poster} interactive autoRotate={autoRotate} wireframe={wireframe}/><span className="media-hint">拖动旋转 · 双指缩放</span></>}
    {active && kind === 'video' && <>
      <video ref={player} src={videoSrc} poster={poster || undefined} controls playsInline muted preload="metadata" onLoadedMetadata={previewReady} onTimeUpdate={checkPreview} onSeeking={clampPreview} onEnded={() => mode === 'card' && setEnded(true)} onError={() => setMediaError(true)} aria-label={`${work.title}${mode === 'card' ? '片段预览' : '完整视频'}`}/>
      {mode === 'card' && !ended && <span className="media-hint">片段预览 · 点击音量键开启声音</span>}
      {mode === 'card' && ended && <div className="media-finished"><span>这一帧之后，还有故事。</span><button type="button" onClick={replay}><RotateCcw size={15}/>再看一次</button>{onViewFull && <button type="button" className="media-full-button" onClick={onViewFull}>查看完整作品 <ArrowUpRight size={16}/></button>}</div>}
    </>}
    {active && kind === 'audio' && <div className="media-audio">{poster ? <img src={poster} alt={work.title}/> : <Music2 size={58}/>}<span>{work.title}</span><audio ref={audioPlayer} src={work.audioUrl} controls preload="metadata" onError={() => setMediaError(true)} aria-label={`${work.title}音频`}/></div>}
    {active && kind === 'web' && <>
      {webStarted ? <iframe src={work.interactiveUrl} title={`${work.title}在线体验`} sandbox="allow-scripts allow-forms allow-pointer-lock allow-modals" allow="fullscreen" referrerPolicy="no-referrer" allowFullScreen/> : <div className="media-web-start">{poster && <img className="media-poster" src={poster} alt={work.title}/>}<button type="button" className="button button-dark" onClick={activate}><MousePointer2 size={17}/>开始体验</button></div>}
      <div className="media-web-tools"><span>如作品限制嵌入，可在新窗口体验</span><a href={work.interactiveUrl} target="_blank" rel="noopener noreferrer">打开原体验 <ExternalLink size={13}/></a></div>
    </>}
    {active && kind === 'image' && <>
      <img className="media-full-image" src={images[imageIndex % images.length]} alt={`${work.title} · 图 ${imageIndex + 1}`}/>
      <button type="button" className="media-zoom" onClick={event => { zoomOpener.current = event.currentTarget; setZoom(true); }} aria-label="放大作品原图"><Expand size={18}/></button>
      {images.length > 1 && <div className="media-image-tools"><button type="button" aria-label="上一张" onClick={() => setImageIndex((imageIndex - 1 + images.length) % images.length)}><ChevronLeft size={17}/></button><span>{imageIndex + 1} / {images.length}</span><button type="button" aria-label="下一张" onClick={() => setImageIndex((imageIndex + 1) % images.length)}><ChevronRight size={17}/></button></div>}
    </>}
    {active && kind === 'file' && <div className="media-placeholder"><FileBox/><span>{work.title}</span><small>{work.contentText ? '从一份灵感开始。向下阅读作品内容。' : '原始工程已归档，可继续添加作品预览。'}</small></div>}
    {mediaError && <div className="media-finished"><span>暂时无法播放，可能是格式或网络问题。</span><button type="button" onClick={() => { setMediaError(false); player.current?.load(); audioPlayer.current?.load(); }}><RotateCcw size={15}/>重新加载</button></div>}
    {mode === 'card' && active && <button type="button" className="media-close" onClick={deactivate} aria-label={`停止预览：${work.title}`}><X size={16}/></button>}
    {zoom && createPortal(<div className="media-lightbox" role="dialog" aria-modal="true" aria-label="作品原图"><button ref={closeZoom} type="button" className="media-close" autoFocus onClick={() => setZoom(false)} aria-label="关闭原图"><X size={23}/></button><img src={images[imageIndex % images.length]} alt={work.title}/></div>, document.body)}
  </div>;
}
