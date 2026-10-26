import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, ArrowLeft, Plus, Box, Layers3, Heart, Search, SlidersHorizontal, ChevronDown, LockKeyhole, Globe2, Sprout, UserRound, PencilLine, Link2, LoaderCircle, Check, Pause, Play, RotateCcw, MousePointer2, LogOut, X } from 'lucide-react';
import { DIRECTIONS, type Direction, type Work, type User, type Profile, type ProfileResponse, type WorksResponse } from '../shared/portfolio';
import MediaPreview from './MediaPreview';
import ModelViewer from './ModelViewer';
import { api, copyShare, dateLabel, errorMessage, go, jsonBody, signInHref } from './ui-utils';

type CommonProps = { favorites: string[]; onFavorite: (id: string) => void };
type Notify = (message: string) => void;
export function StateNotice({ title, message, retry }: { title: string; message: string; retry?: () => void }) {
  return <div className="empty-state"><Sprout size={39} strokeWidth={1.1}/><h2>{title}</h2><p>{message}</p>{retry && <button className="button button-outline" onClick={retry}>重新加载 <RotateCcw size={16}/></button>}</div>;
}
export function LoadingState({ text = '正在打开这个创作空间…' }: { text?: string }) {
  return <div className="page-loading" role="status"><LoaderCircle className="spin" size={23}/><span>{text}</span></div>;
}
export function SignInPanel({ path = '/space', title = '给你的创作，留一个空间。' }: { path?: string; title?: string }) {
  return <main className="section sign-in-page"><span className="eyebrow">YOUR CREATIVE SPACE / 你的创作档案</span><h1>{title}</h1><div className="sign-in-card"><div className="sign-in-symbol"><Sprout size={54} strokeWidth={1}/></div><h2>从一个念头，到树莓成熟时。</h2><p>登录后拥有自己的作品集，私密保存灵感与每一次修改，<br/>准备好时，再选择一个版本分享出去。</p><a className="button button-dark button-large" href={signInHref(path)} target="_top">登录并进入我的空间 <ArrowUpRight size={18}/></a><a href="#/works" className="text-link">先看看公开作品 <ArrowUpRight size={15}/></a><span className="sign-in-caption"><LockKeyhole size={13}/>新作品默认仅自己可见，封面与过程说明均可稍后补充。</span></div></main>;
}

export function WorkCard({ work, index, favorite, onFavorite, active, onActivate, onDeactivate, own = false }: { work: Work; index: number; favorite: boolean; onFavorite: () => void; active: boolean; onActivate: () => void; onDeactivate: () => void; own?: boolean }) {
  const path = `/work/${encodeURIComponent(work.id)}`;
  return <article className={`work-card tone-${index % 4} ${active ? 'card-is-active' : ''}`}>
    <div className="card-image wenxin-card-image"><MediaPreview work={work} mode="card" active={active} onActivate={onActivate} onDeactivate={onDeactivate} onViewFull={() => go(path)}/><button className={`favorite-button ${favorite ? 'is-favorite' : ''}`} aria-label={`${favorite ? '取消收藏' : '收藏'}${work.title}`} aria-pressed={favorite} onClick={onFavorite}><Heart size={17} fill={favorite ? 'currentColor' : 'none'}/></button></div>
    <div className="card-info"><div className="card-meta"><span>{work.direction}{own && <span className={`inline-visibility ${work.visibility}`} title={work.visibility === 'public' ? '已选择公开展示版本；新保存版本仍保持私密' : '仅你可见'}>{work.visibility === 'public' ? <Globe2 size={10}/> : <LockKeyhole size={10}/>} {work.visibility === 'public' ? '有公开版本' : '仅自己'}</span>}</span><span className="growth-status">{work.status === 'final' ? '这一版定稿' : '生长中'}</span></div><a href={`#${path}`} className="work-title-link"><h3>{work.title}<ArrowUpRight size={20}/></h3></a><p>{work.subtitle || work.description?.slice(0, 70) || (work.contentText ? work.contentText.slice(0, 70) : '每一次尝试，都值得被留下。')}</p><div className="card-credit"><a href={`#/u/${encodeURIComponent(work.author.slug)}`}><span className="mini-avatar">{work.author.displayName.slice(0, 1)}</span>{work.author.displayName}</a>{own ? <span>第 {work.versionNumber} 版</span> : <a href={`#${path}`} className="card-detail-link">查看作品 <ArrowUpRight size={12}/></a>}</div></div>
  </article>;
}
export function WorkGrid({ works, favorites, onFavorite, own = false, className = 'library-grid' }: { works: Work[]; own?: boolean; className?: string } & CommonProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => { setActiveId(null); }, [works]);
  return <div className={className}>{works.map((work, index) => <WorkCard key={work.id} work={work} index={index} favorite={favorites.includes(work.id)} onFavorite={() => onFavorite(work.id)} active={activeId === work.id} onActivate={() => setActiveId(work.id)} onDeactivate={() => setActiveId(value => value === work.id ? null : value)} own={own}/>)}</div>;
}

export function Collection({ works, favorites, onFavorite, own = false }: { works: Work[]; own?: boolean } & CommonProps) {
  const [direction, setDirection] = useState<Direction | '全部'>('全部');
  const [tag, setTag] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('default');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [visibility, setVisibility] = useState('all');
  const tags = useMemo(() => direction === '全部' ? [] : [...new Set(works.filter(w => w.direction === direction).flatMap(w => w.tags).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh')), [works, direction]);
  useEffect(() => { if (tag && !tags.includes(tag)) setTag(''); }, [tags, tag]);
  const filtered = useMemo(() => works.filter(work => (direction === '全部' || work.direction === direction) && (!tag || work.tags.includes(tag)) && (!onlyFavorites || favorites.includes(work.id)) && (visibility === 'all' || work.visibility === visibility) && `${work.title} ${work.description} ${work.tags.join(' ')} ${work.author.displayName}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'newest' ? b.updatedAt.localeCompare(a.updatedAt) : sort === 'title' ? a.title.localeCompare(b.title, 'zh') : 0), [works, direction, tag, query, favorites, onlyFavorites, sort, visibility]);
  const clear = () => { setDirection('全部'); setTag(''); setQuery(''); setOnlyFavorites(false); setVisibility('all'); };
  return <><div className="collection-toolbar"><div className="search-field"><Search size={18}/><input aria-label="搜索作品、标签或创作者" placeholder="搜索作品、标签、创作者…" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button className="icon-button" aria-label="清空搜索" onClick={() => setQuery('')}><X size={15}/></button>}</div>{own && <label className="visibility-filter"><LockKeyhole size={14}/><select aria-label="按公开范围筛选" value={visibility} onChange={e => setVisibility(e.target.value)}><option value="all">全部可见范围</option><option value="private">仅自己可见</option><option value="public">有公开版本</option></select><ChevronDown size={12}/></label>}<button className={`favorite-filter ${onlyFavorites ? 'active' : ''}`} onClick={() => setOnlyFavorites(!onlyFavorites)} aria-pressed={onlyFavorites}><Heart size={16} fill={onlyFavorites ? 'currentColor' : 'none'}/>收藏<small>{favorites.length}</small></button><label className="sort-select"><SlidersHorizontal size={15}/><select aria-label="作品排序" value={sort} onChange={e => setSort(e.target.value)}><option value="default">展厅顺序</option><option value="newest">最近更新</option><option value="title">名称排序</option></select><ChevronDown size={12}/></label></div>
    <div className="direction-row"><div role="group" aria-label="作品主方向">{(['全部', ...DIRECTIONS] as const).map(value => <button className={direction === value ? 'active' : ''} key={value} aria-pressed={direction === value} onClick={() => { setDirection(value); setTag(''); }}>{value}<small>{value === '全部' ? works.length : works.filter(w => w.direction === value).length}</small></button>)}</div><span>{filtered.length} 件作品</span></div>
    {direction !== '全部' && <div className="secondary-tags"><span>灵感标签</span>{tags.length ? <div role="group" aria-label={`${direction}作品的标签筛选`}><button className={!tag ? 'active' : ''} aria-pressed={!tag} onClick={() => setTag('')}>不限标签</button>{tags.map(value => <button key={value} className={tag === value ? 'active' : ''} aria-pressed={tag === value} onClick={() => setTag(value)}>#{value}</button>)}</div> : <p>这个方向还没有标签，创作者可以随时补充。</p>}</div>}
    {filtered.length ? <WorkGrid works={filtered} favorites={favorites} onFavorite={onFavorite} own={own}/> : <div className="empty-state"><Sprout size={39} strokeWidth={1}/><h2>{onlyFavorites ? '喜欢的灵感，等你留下。' : own && !works.length ? '第一颗灵感，等你种下。' : '这个方向，还在等待新的用心。'}</h2><p>{onlyFavorites ? '轻点作品右上角的爱心，收藏会留在这台设备。' : own && !works.length ? '一段文字、一张图片或一份文件，都可以作为开始。' : '这里展示真实创作，也给尚未出现的作品留着位置。'}</p>{own && !works.length ? <a href="#/upload" className="button button-dark">记录第一件作品 <Plus size={16}/></a> : <button className="button button-outline" onClick={clear}>查看全部作品 <ArrowUpRight size={16}/></button>}</div>}
    <div className="collection-end"><span/>每一段生长，都有自己的时间。<span/></div>
  </>;
}

export function Home({ works, favorites, onFavorite }: { works: Work[] } & CommonProps) {
  const featured = works.find(work => work.id === 'lamp') || works.find(work => work.modelUrl) || works[0];
  const [rotate, setRotate] = useState(true);
  const [heroKey, setHeroKey] = useState(0);
  return <main><section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="tiny-square"/>WENXIN / A SPACE FOR CREATIVE GROWTH</div><h1>让创作，<br/>慢慢<span className="outlined-word">成熟</span><span className="title-dot">.</span></h1><p className="hero-description">从第一个念头，到每一次改动。<br/>属于数字媒体创作者的作品集，也收藏还没完成的你。</p><div className="hero-cta"><a href="#/works" className="button button-dark button-large">走进作品展厅 <ArrowUpRight size={21}/></a><a href="#/upload" className="text-link">种下一个灵感 <Plus size={17}/></a></div><div className="hero-bottom-note"><span className="stacked-symbol"><Sprout size={18}/><Layers3 size={18}/></span><span>未完成，也是一种诚实的创作状态。<small>{String(works.length).padStart(2, '0')} 件公开作品 · 每一份用心，都值得留下</small></span></div></div><div className="hero-art"><div className="hero-art-top"><span className="pill"><span className="online-dot"/>GROWING WITH EVERY IDEA</span><span className="edition">树莓成熟时 / WENXIN</span></div><div className="hero-stage"><div className="stage-orbit orbit-one"/><div className="stage-orbit orbit-two"/><span className="axis-label axis-x">X</span><span className="axis-label axis-y">Y</span><div className="stage-platform"/>{featured && (featured.modelUrl ? <ModelViewer key={heroKey} src={featured.modelUrl} poster={featured.coverUrl} interactive autoRotate={rotate} className="hero-viewer"/> : <MediaPreview work={featured} mode="detail"/>)}<div className="floating-annotation annotation-one"><span/>细节，藏在每一份用心里</div>{featured?.modelUrl && <><div className="stage-controls"><button className={rotate ? 'icon-button selected' : 'icon-button'} aria-label={rotate ? '暂停自动旋转' : '开启自动旋转'} onClick={() => setRotate(!rotate)}>{rotate ? <Pause size={16}/> : <Play size={16}/>}</button><button className="icon-button" aria-label="重置展示角度" onClick={() => setHeroKey(heroKey + 1)}><RotateCcw size={16}/></button></div><div className="stage-instruction"><MousePointer2 size={13}/>拖动旋转 · 滚轮缩放</div></>}</div>{featured && <a className="hero-art-caption" href={`#/work/${featured.id}`}><div><span className="eyebrow">一份正在被看见的用心 / FEATURED WORK</span><h2>{featured.title}<span>{featured.subtitle}</span></h2></div><span className="round-arrow"><ArrowUpRight size={24}/></span></a>}</div></section>
    <div className="ticker" aria-hidden="true"><div>{[0, 1, 2, 3].map(i => <span key={i}>IDEAS TAKE THEIR TIME <span className="ticker-flower">✳</span> 树莓成熟时 <span className="ticker-flower">✳</span> WENXIN / 文心 <span className="ticker-flower">✳</span></span>)}</div></div>
    <section className="section works-section"><div className="section-top"><div><div className="eyebrow">SELECTED WORKS / 被看见的创作</div><h2 className="section-title">在作品之间，<span>遇见用心。</span><sup>({String(works.length).padStart(2, '0')})</sup></h2></div><a href="#/works" className="text-link">浏览全部作品 <ArrowUpRight size={18}/></a></div><WorkGrid works={works.slice(0, 4)} favorites={favorites} onFavorite={onFavorite} className="home-grid"/></section>
    <section className="growth-principles section"><div><span className="eyebrow">NOT JUST THE FINISH LINE.</span><h2>作品会成熟，<br/>过程也值得<span>被收藏。</span></h2></div><div className="growth-principle"><span>01 / 留下</span><h3>先保存，再慢慢完善</h3><p>一个名称、一个方向、一份内容，就能记下现在。封面与创作故事，晚一点也没关系。</p></div><div className="growth-principle"><span>02 / 生长</span><h3>每次保存，都留下来</h3><p>保留初稿、修改与旧定稿。难题、办法和心得想写时再写，不急着给创作划上句号。</p></div><div className="growth-principle"><span>03 / 分享</span><h3>公开哪一刻，由你决定</h3><p>新作品默认私密。选一个版本展示，或公开某个过程节点，让用心被恰好地看见。</p></div></section>
    <section className="explore-strip"><div className="explore-symbol"><Sprout strokeWidth={.8}/><span>+</span></div><div><span className="eyebrow">EVERY IDEA HAS A SEASON.</span><h2>还没完成，<br/>也可以<span>开始记录。</span></h2><p>这里给每一个灵感，留一个慢慢生长的位置。</p></div><a href="#/upload" className="button button-dark button-large">记录我的创作 <Plus size={20}/></a><span className="strip-corner">LET IT GROW.<br/>UNTIL IT RIPENS. ↗</span></section></main>;
}

export function Library({ works, favorites, onFavorite }: { works: Work[] } & CommonProps) {
  return <main className="library-page section"><div className="page-intro"><div><span className="eyebrow">THE COLLECTION / 公开作品展厅</span><h1>每一份用心，<span className="serif-italic">都有回声。</span><sup>({String(works.length).padStart(2, '0')})</sup></h1><p>在交互、影像与三维之间，遇见真实的创作与细节。</p></div><div className="page-intro-symbol"><Layers3 size={65} strokeWidth={1}/><span>EVERY WORK<br/>HAS A STORY.</span></div></div><Collection works={works} favorites={favorites} onFavorite={onFavorite}/></main>;
}

export function CreatorSpace({ slug, user, mine = false, favorites, onFavorite, notify, onUser }: { slug?: string; user: User; mine?: boolean; notify: Notify; onUser: (user: User) => void } & CommonProps) {
  const [data, setData] = useState<{ profile: Profile; works: Work[]; isOwner: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [shareFallback, setShareFallback] = useState(false);
  const load = async () => {
    setLoading(true); setError('');
    try {
      if (mine) {
        const response = await api<WorksResponse>('/api/works?scope=mine');
        const profile = response.profile || response.user?.profile;
        if (!profile) throw new Error('个人空间暂未准备好，请刷新后重试。');
        setData({ profile, works: response.works, isOwner: true }); setName(profile.displayName); setBio(profile.bio);
      } else {
        const response = await api<ProfileResponse>(`/api/profiles/${encodeURIComponent(slug || '')}`);
        setData(response); setName(response.profile.displayName); setBio(response.profile.bio);
      }
    } catch (error) { setError(errorMessage(error)); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); setEditing(false); setShareFallback(false); }, [slug, mine, user?.id]);
  const share = async () => { if (!data) return; if (await copyShare(`/u/${data.profile.slug}`)) notify('个人作品集链接已复制，可以分享给朋友。'); else setShareFallback(true); };
  const saveProfile = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); setError(''); try { const response = await api<{ profile: Profile; user: User }>('/api/me/profile', { method: 'PATCH', ...jsonBody({ displayName: name.trim(), bio: bio.trim() }) }); setData(previous => previous ? { ...previous, profile: response.profile } : previous); onUser(response.user); setEditing(false); notify('个人介绍已更新，分享链接保持不变。'); } catch (error) { setError(errorMessage(error)); } finally { setSaving(false); } };
  if (loading) return <main className="section"><LoadingState/></main>;
  if (!data) return <main className="section"><StateNotice title="这个空间暂时打不开。" message={error || '可以稍后再来看看。'} retry={load}/></main>;
  const publicCount = data.works.filter(work => work.visibility === 'public').length;
  return <main className="creator-page section"><a href="#/works" className="text-link creator-back"><ArrowLeft size={15}/>公开作品展厅</a><div className="creator-heading"><div className="creator-avatar">{data.profile.displayName.slice(0, 1)}<span><Sprout size={15}/></span></div><div className="creator-intro"><span className="eyebrow">{mine ? 'MY CREATIVE SPACE / 我的创作空间' : 'A PERSONAL PORTFOLIO / 个人作品集'}</span><h1>{data.profile.displayName}<span>{mine ? <LockKeyhole size={15}/> : <Globe2 size={15}/>}</span></h1><p>{data.profile.bio || '这里记录灵感、尝试，以及每一个慢慢成熟的作品。'}</p><div className="creator-small"><span>{data.works.length} 件{mine ? '创作' : '公开作品'}</span>{mine && <span>{publicCount} 件有公开版本</span>}<span>加入于 {dateLabel(data.profile.createdAt)}</span></div></div><div className="creator-actions"><button className="button button-dark" onClick={share}><Link2 size={15}/>分享作品集</button>{mine ? <><button className="button button-outline" onClick={() => { setEditing(!editing); setError(''); }} aria-expanded={editing}><PencilLine size={14}/>{editing ? '收起编辑' : '编辑个人介绍'}</button><a className="text-link" href={`#/u/${data.profile.slug}`}>查看访客视角 <ArrowUpRight size={14}/></a></> : data.isOwner && <a href="#/space" className="button button-outline">管理我的创作 <PencilLine size={14}/></a>}</div></div>
    {shareFallback && <div className="share-fallback"><span>复制下面的链接，分享你的公开作品集：</span><input aria-label="个人作品集分享链接" readOnly value={`${location.origin}${location.pathname}#/u/${data.profile.slug}`} onFocus={event => event.target.select()}/><button className="icon-button" aria-label="关闭分享链接" onClick={() => setShareFallback(false)}><X size={16}/></button></div>}
    {editing && mine && <form className="profile-editor" onSubmit={saveProfile}><div className="form-field"><label htmlFor="profile-name">你的创作者名称</label><input id="profile-name" maxLength={80} required value={name} onChange={event => setName(event.target.value)} disabled={saving}/></div><div className="form-field"><label htmlFor="profile-bio">一句话介绍 <small>选填</small></label><textarea id="profile-bio" maxLength={600} rows={3} value={bio} placeholder="介绍一下你的创作方向，或最近在探索的事。" onChange={event => setBio(event.target.value)} disabled={saving}/></div><div className="profile-editor-bottom"><span>只影响个人介绍，不改变作品的公开范围。</span><button className="button button-dark" disabled={saving || !name.trim()}>{saving ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>}保存介绍</button></div></form>}
    {error && <div className="form-error" role="alert">{error}<button type="button" className="text-icon" onClick={load}>重新加载</button></div>}
    {mine ? <div className="private-space-banner"><div><LockKeyhole size={19}/><span>这是你的完整创作空间。<small>新作品与新保存的版本默认私密；访客只看到你选定的展示版本和公开过程节点。</small></span></div><a href="#/upload" className="button button-dark"><Plus size={16}/>记录新作品</a></div> : <div className="public-space-caption"><Globe2 size={14}/><span>{data.profile.system ? '这些是从真实工程收录的展品，点击封面可直接预览。' : '这里展示创作者亲自选择公开的作品与时刻。'}</span></div>}
    <Collection works={data.works} favorites={favorites} onFavorite={onFavorite} own={mine}/>{mine && <div className="space-account"><span><UserRound size={14}/>{user?.name || '已登录创作者'}</span><a href="/signout-with-chatgpt?return_to=/" target="_top"><LogOut size={13}/>退出登录</a></div>}</main>;
}

export function About({ count }: { count: number }) {
  return <main className="about-page section"><span className="eyebrow">为文之用心 / ABOUT WENXIN</span><h1>每一段生长，<br/><span className="serif-italic">都有自己的成熟时。</span></h1><div className="about-composition"><div className="about-art"><Sprout size={180} strokeWidth={.6}/><span>LET IT<br/>GROW.<br/><i>WENXIN.</i></span><div>文心 · 树莓成熟时</div></div><div className="about-copy"><span className="eyebrow">给数字媒体创作者的作品集</span><h2>作品之外，<br/>也收藏用心的过程。</h2><p>一段交互、一帧影像、一个模型，或一个还没成形的念头。创作从来不只发生在定稿那一刻。</p><p>文心想陪你从初稿走到下一次修改，记住碰到的难题、试过的办法，以及依然值得留下的未完成。完整历史默认私密，愿意分享多少，由你自己决定。</p><div className="about-numbers"><strong>{String(count).padStart(2, '0')}<span>件真实公开作品</span></strong><strong>4<span>个创作方向，无限可能</span></strong></div><a className="button button-dark" href="#/space">进入我的创作空间 <ArrowUpRight size={18}/></a></div></div><div className="about-features"><div><span>01 / 开始</span><h3>轻一点开始</h3><p>名称、主方向和一份内容就够了。封面、标签、过程说明都可以慢慢补充。</p></div><div><span>02 / 留痕</span><h3>让每一版留下来</h3><p>每次主动保存生成一个版本。定稿后仍可继续生长，旧定稿不会因此消失。</p></div><div><span>03 / 选择</span><h3>分享你准备好的时刻</h3><p>私密归档与公开作品集相互独立，选择展示版本，再决定是否公开其中的过程节点。</p></div></div></main>;
}
