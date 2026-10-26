import { useEffect, useState } from 'react';
import type { ApiError, Snapshot, Work } from '../shared/portfolio';

export class RequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  let data: unknown;
  try { data = await response.json(); } catch { throw new RequestError('服务暂时没有响应，请稍后重试。', response.status); }
  if (!response.ok) throw new RequestError((data as ApiError)?.error || '操作没有完成，请重试。', response.status);
  return data as T;
}
export const jsonBody = (value: unknown): RequestInit => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
export const go = (path: string) => { location.hash = path; };
export const signInHref = (path = '/space') => '/signin-with-chatgpt?return_to=' + encodeURIComponent('/#' + path);
export const sizeLabel = (n?: number) => n ? n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB` : '—';
export const dateLabel = (date?: string, time = false) => {
  if (!date) return '尚未记录';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return date.slice(0, 10);
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', ...(time ? { hour: '2-digit', minute: '2-digit' } as const : {}) }).format(value);
};
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : '操作没有完成，请稍后再试。';
export function useRoute() {
  const [route, setRoute] = useState(location.hash.replace(/^#/, '') || '/');
  useEffect(() => {
    const listener = () => { setRoute(location.hash.replace(/^#/, '') || '/'); window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); };
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);
  const [path, query = ''] = route.split('?');
  return { path, query: new URLSearchParams(query), full: route };
}
export function emptySnapshot(): Snapshot {
  return { title: '', direction: '其他', category: '其他', tags: [], subtitle: '', description: '', contentText: '', process: '', difficulties: '', solutions: '', reflection: '', status: 'in-progress', fileName: '', fileSize: 0, fileUrl: '', format: '', modelUrl: '', coverUrl: '', images: [], videoUrl: '', audioUrl: '', demoVideoUrl: '', interactiveUrl: '', allowSourceDownload: false };
}
export function safeFavorites(): string[] {
  try { const data: unknown = JSON.parse(localStorage.getItem('formspace-favorites') || '[]'); return Array.isArray(data) ? data.filter(item => typeof item === 'string') : []; } catch { return []; }
}
export function publicSharePath(work: Work, versionId?: string) { return `/work/${encodeURIComponent(work.id)}${versionId ? '?version=' + encodeURIComponent(versionId) : ''}`; }
export async function copyShare(path: string): Promise<boolean> {
  const url = `${location.origin}${location.pathname}#${path}`;
  try { await navigator.clipboard.writeText(url); return true; } catch {
    if (navigator.share) { try { await navigator.share({ title: '文心 · 树莓成熟时', url }); return true; } catch {} }
    return false;
  }
}
