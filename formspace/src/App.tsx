import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Plus, Sprout, CheckCircle2, RotateCcw, Menu, X } from 'lucide-react';
import type { MeResponse, User, Work, WorkResponse, WorksResponse } from '../shared/portfolio';
import initialWorks from '../data/works.json';
import { About, CreatorSpace, Home, Library, LoadingState, SignInPanel } from './PortfolioViews';
import WorkDetail from './WorkDetail';
import WorkForm from './WorkForm';
import { api, emptySnapshot, go, safeFavorites, useRoute } from './ui-utils';
import './styles.css';
import './wenxin.css';

const systemProfile = { slug: 'wenxin-exhibits', displayName: '文心 · 系统展品', bio: '从真实三维工程收录的展示作品。', createdAt: '2026-10-25T00:00:00.000Z', updatedAt: '2026-10-25T00:00:00.000Z', system: true };
const initialPublic: Work[] = initialWorks.map(raw => ({ ...emptySnapshot(), ...raw, direction: '三维', category: '三维', tags: [...new Set([raw.category, ...raw.tags])], createdAt: raw.date + 'T00:00:00.000Z', updatedAt: raw.date + 'T00:00:00.000Z', revision: 1, versionId: 'initial', versionNumber: 1, versionCount: 1, displayVersionId: 'initial', visibility: 'public', isOwner: false, author: systemProfile, builtIn: true, allowSourceDownload: true }));
const decode = (value: string) => { try { return decodeURIComponent(value); } catch { return ''; } };

export default function App() {
  const route = useRoute();
  const [works, setWorks] = useState<Work[]>(initialPublic);
  const [user, setUser] = useState<User>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [favorites, setFavorites] = useState<string[]>(safeFavorites);
  const [toast, setToast] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => { setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 4800); }, []);
  const refresh = useCallback(async () => {
    try { const response = await api<WorksResponse>('/api/works?scope=public'); setWorks(response.works); setApiError(''); setUser(response.user); }
    catch { setApiError('暂时无法连接创作档案。当前显示最近可用的公开展品，操作前请重新连接。'); }
  }, []);
  useEffect(() => { void refresh(); api<MeResponse>('/api/me').then(response => setUser(response.user)).catch(() => {}).finally(() => setAuthLoading(false)); return () => { if (toastTimer.current) clearTimeout(toastTimer.current); }; }, [refresh]);
  useEffect(() => { setMenuOpen(false); }, [route.full]);
  useEffect(() => { document.title = route.path === '/space' ? '我的创作空间 · 文心' : route.path === '/upload' || route.path.startsWith('/edit/') ? '记录创作 · 文心' : '文心 · 树莓成熟时'; }, [route.path]);
  const onFavorite = (id: string) => {
    setFavorites(previous => { const next = previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]; try { localStorage.setItem('formspace-favorites', JSON.stringify(next)); } catch { notify('这台浏览器暂未允许保存收藏。'); } return next; });
  };
  const onSaved = (response: WorkResponse) => { notify(`第 ${response.work.versionNumber} 版已保存，新的内容先只留给你。`); void refresh(); go(`/work/${encodeURIComponent(response.work.id)}`); };
  const isDetail = route.path.startsWith('/work/');
  const editId = route.path.startsWith('/edit/') ? decode(route.path.slice(6)) : undefined;
  const creatorSlug = route.path.startsWith('/u/') ? decode(route.path.slice(3)) : undefined;
  const needsAuth = route.path === '/space' || route.path === '/upload' || Boolean(editId);
  let page;
  if (needsAuth && authLoading) page = <main className="section"><LoadingState text="正在打开你的创作空间…"/></main>;
  else if (route.path === '/') page = <Home works={works} favorites={favorites} onFavorite={onFavorite}/>;
  else if (route.path === '/works') page = <Library works={works} favorites={favorites} onFavorite={onFavorite}/>;
  else if (route.path === '/space') page = user ? <CreatorSpace key={`mine-${user.id}`} mine user={user} favorites={favorites} onFavorite={onFavorite} notify={notify} onUser={setUser}/> : <SignInPanel/>;
  else if (creatorSlug) page = <CreatorSpace key={creatorSlug} slug={creatorSlug} user={user} favorites={favorites} onFavorite={onFavorite} notify={notify} onUser={setUser}/>;
  else if (route.path === '/upload' || editId) page = <WorkForm key={route.path} id={editId} user={user} onSaved={onSaved}/>;
  else if (isDetail && decode(route.path.slice(6))) { const id = decode(route.path.slice(6)); page = <WorkDetail key={id} id={id} requestedVersion={route.query.get('version') || undefined} favorite={favorites.includes(id)} onFavorite={() => onFavorite(id)} notify={notify} onChange={() => void refresh()}/>; }
  else if (route.path === '/about') page = <About count={works.length}/>;
  else page = <main className="not-found"><span className="eyebrow">A LITTLE OFF THE PATH</span><h1>这个角落，<br/>还没有故事。</h1><p>可以回作品展厅看看，也许会遇见下一颗灵感。</p><a href="#/works" className="button button-dark">回到作品展厅 <ArrowUpRight size={18}/></a></main>;
  return <div className="site-shell wenxin-site"><header className="header"><a href="#/" className="brand wenxin-brand" aria-label="文心，树莓成熟时，返回首页"><span className="brand-mark"><Sprout size={24} strokeWidth={1.5}/></span><span className="brand-word">文心<span className="brand-cn">树莓成熟时</span></span><span className="brand-en">WENXIN</span></a><nav className={menuOpen ? 'nav-links is-open' : 'nav-links'} aria-label="主导航"><a href="#/" className={route.path === '/' ? 'active' : ''}>首页</a><a href="#/works" className={route.path === '/works' || isDetail ? 'active' : ''}>作品展厅<span className="nav-count">{String(works.length).padStart(2, '0')}</span></a><a href="#/space" className={route.path === '/space' || creatorSlug ? 'active' : ''}>我的空间</a><a href="#/about" className={route.path === '/about' ? 'active' : ''}>关于文心</a></nav><div className="header-actions"><a href="#/upload" className="button button-dark header-upload"><Plus size={16}/><span>记录创作</span></a>{user && <a href="#/space" className="header-avatar" aria-label={`进入 ${user.profile?.displayName || user.name} 的空间`} title={user.profile?.displayName || user.name}>{(user.profile?.displayName || user.name).slice(0, 1)}</a>}<button className="menu-button icon-button" aria-label={menuOpen ? '关闭菜单' : '打开菜单'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button></div></header>
    {apiError && <div className="api-notice" role="status">{apiError}<button onClick={() => void refresh()}>重新连接 <RotateCcw size={12}/></button></div>}{page}
    <footer className="footer"><div><a href="#/" className="footer-logo">WENXIN / 文心<span>树莓成熟时</span></a><p>每一份用心，都有自己的成熟时。</p></div><div className="footer-right"><span className="online-dot"/>为文之用心，让创作继续生长<a href="#/upload">下一颗灵感，等你留下 <ArrowUpRight size={15}/></a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} 文心 · 数字媒体创作档案</span><span>EVERY IDEA HAS A SEASON.</span><a href="#/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>回到首页 ↑</a></div></footer>{toast && <div className="toast" role="status"><CheckCircle2 size={18}/>{toast}</div>}</div>;
}
