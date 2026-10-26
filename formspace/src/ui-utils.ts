import { useEffect, useState } from 'react';
import type { ApiError, MeResponse, SessionResponse, Snapshot, Work } from '../shared/portfolio';

export class RequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
async function requestJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  let data: unknown;
  try { data = await response.json(); } catch { throw new RequestError('服务暂时没有响应，请稍后重试。', response.status); }
  if (!response.ok) throw new RequestError((data as ApiError)?.error || '操作没有完成，请重试。', response.status);
  return data as T;
}
let preparingSpace: Promise<MeResponse> | null = null;
let currentSpaceId = '';
async function prepareSpace(): Promise<MeResponse> {
  // Idempotent: reuse the current space and allow the server's near-expiry renewal.
  const opened = await requestJSON<SessionResponse>('/api/session', { method: 'POST' });
  const confirmed = await requestJSON<MeResponse>('/api/me');
  if (!confirmed.user) throw new RequestError('当前浏览器未能保存空间访问凭证。请允许本站保存 Cookie 后重试；作品文件仍保存在服务端。', 401);
  if (!opened.user || opened.user.id !== confirmed.user.id) throw new RequestError('当前浏览器的空间凭证发生变化，请重新打开空间确认后再操作。', 409);
  return confirmed;
}
/** Same-tab singleflight and cross-tab locking prevent duplicate first-open spaces. */
export function ensureBrowserSpace(): Promise<MeResponse> {
  if (!preparingSpace) {
    const run = () => prepareSpace();
    const operation = (async () => await (typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request('changxu-session', run) : run()))();
    preparingSpace = operation.then(response => {
      currentSpaceId = response.user?.id || '';
      window.dispatchEvent(new CustomEvent<MeResponse>('changxu:space-ready', { detail: response }));
      return response;
    }).finally(() => { preparingSpace = null; });
  }
  return preparingSpace;
}
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  try { return await requestJSON<T>(url, init); }
  catch (error) {
    if (!(error instanceof RequestError) || error.status !== 401 || /^\/api\/(session|me)(\?|$)/.test(url)) throw error;
    const oldSpaceId = currentSpaceId;
    const ready = await ensureBrowserSpace();
    const method = (init?.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD'].includes(method) && oldSpaceId && oldSpaceId !== ready.user?.id) {
      throw new RequestError('当前浏览器进入了一个新的创作空间。旧空间的内容不会自动转入，本次修改尚未保存，请重新打开空间后确认。', 409);
    }
    // At most one retry. A protected old work remains protected by the server.
    return requestJSON<T>(url, init);
  }
}
export const jsonBody = (value: unknown): RequestInit => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
export const go = (path: string) => { location.hash = path; };
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
    if (navigator.share) { try { await navigator.share({ title: '长序 · 树莓成熟时', url }); return true; } catch {} }
    return false;
  }
}
