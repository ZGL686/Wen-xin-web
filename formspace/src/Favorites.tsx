import { useEffect, useState } from 'react';
import { ArrowUpRight, Heart, LockKeyhole, RotateCcw } from 'lucide-react';
import type { Work, WorkResponse } from '../shared/portfolio';
import { Collection, LoadingState, StateNotice } from './PortfolioViews';
import { api, RequestError } from './ui-utils';
import './favorites.css';

export default function Favorites({ favorites, onFavorite, ownerId, spaceLoading }: { favorites: string[]; onFavorite: (id: string) => void; ownerId: string; spaceLoading: boolean }) {
  const [result, setResult] = useState<{ ownerId: string; works: Work[]; unavailable: number; failed: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (spaceLoading) return;
    const controller = new AbortController();
    setLoading(true);
    void (async () => {
      const works: Work[] = [];
      let unavailable = 0, failed = 0;
      // Read through the existing permission-checked endpoint, including the author's private works.
      for (let start = 0; start < favorites.length && !controller.signal.aborted; start += 4) {
        await Promise.all(favorites.slice(start, start + 4).map(async id => {
          try { const response = await api<WorkResponse>(`/api/works/${encodeURIComponent(id)}`, { signal: controller.signal }); works.push(response.work); }
          catch (error) { if (error instanceof RequestError && [403, 404].includes(error.status)) unavailable++; else failed++; }
        }));
      }
      if (!controller.signal.aborted) { setResult({ ownerId, works, unavailable, failed }); setLoading(false); }
    })();
    return () => controller.abort();
  }, [favorites, ownerId, spaceLoading, attempt]);
  const current = result?.ownerId === ownerId && !spaceLoading ? result : null;
  const savedWorks = [...favorites].reverse().flatMap(id => { const work = current?.works.find(work => work.id === id); return work ? [work] : []; });
  const pending = loading || spaceLoading;
  const retry = () => setAttempt(value => value + 1);
  return <main className="favorites-page library-page section">
    <div className="page-intro"><div><span className="eyebrow">SAVED INSPIRATION / 我的收藏</span><h1>我的<span className="serif-italic">收藏。</span><sup>({String(favorites.length).padStart(2, '0')})</sup></h1><p>把喜欢的创作留下，随时回来，接着看。</p></div><div className="page-intro-symbol"><Heart size={65} strokeWidth={1}/><span>KEEP WHAT<br/>INSPIRES YOU.</span></div></div>
    <div className="favorites-note"><LockKeyhole size={14}/><span>收藏保存在当前浏览器，刷新后仍在；更换浏览器或清除站点数据后不会同步。</span><a href="#/works" className="text-link">继续发现 <ArrowUpRight size={15}/></a></div>
    {pending && favorites.length > 0 && <LoadingState text="正在打开你的收藏…"/>}
    {!pending && current && current.unavailable > 0 && <p className="favorites-status" role="status">有 {current.unavailable} 件收藏暂不可查看，可能已撤回、删除，或不属于当前浏览器空间。收藏记录仍保留。</p>}
    {!pending && current && current.failed > 0 && savedWorks.length > 0 && <div className="favorites-status" role="alert"><span>有 {current.failed} 件收藏加载失败。</span><button className="text-icon" onClick={retry}>重试 <RotateCcw size={14}/></button></div>}
    {savedWorks.length > 0 ? <Collection works={savedWorks} favorites={favorites} onFavorite={onFavorite} favoritesView/> : !favorites.length ? <div className="empty-state favorites-empty"><Heart size={42} strokeWidth={1}/><h2>喜欢的创作，等你留下。</h2><p>轻点作品封面右上角的爱心，都会收在这里。</p><a href="#/works" className="button button-dark">去作品展厅看看 <ArrowUpRight size={17}/></a></div> : !pending && (current?.failed ? <StateNotice title="收藏暂时没有完整打开。" message="收藏记录仍在，重新加载后再试一次。" retry={retry}/> : <div className="empty-state favorites-empty"><Heart size={42} strokeWidth={1}/><h2>这些收藏，暂时无法查看。</h2><p>作品的展示范围由作者决定，可以先去发现新的灵感。</p><a href="#/works" className="button button-outline">浏览公开作品 <ArrowUpRight size={17}/></a></div>)}
  </main>;
}
