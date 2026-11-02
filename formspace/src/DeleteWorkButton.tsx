import { useEffect, useId, useRef, useState } from 'react';
import { FileBox, LoaderCircle, Trash2 } from 'lucide-react';
import type { Work } from '../shared/portfolio';
import { api, errorMessage } from './ui-utils';
import './work-actions.css';

export default function DeleteWorkButton({ work, onDeleted, compact = false, disabled = false }: { work: Work; onDeleted: (id: string) => void; compact?: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null), cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId(), descriptionId = useId();
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current, before = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; dialog.showModal(); cancelRef.current?.focus();
    return () => { if (dialog.open) dialog.close(); document.body.style.overflow = before; };
  }, [open]);
  if (!work.isOwner || work.builtIn) return null;
  const remove = async () => {
    if (pending) return;
    setPending(true); setError('');
    try {
      const response = await api<{ ok: boolean }>(`/api/works/${encodeURIComponent(work.id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('删除尚未完成，请重试。');
      setOpen(false); onDeleted(work.id);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setPending(false); }
  };
  return <>
    <button type="button" className={`delete-work-trigger ${compact ? 'compact' : ''}`} disabled={disabled} aria-label={compact ? `删除作品：${work.title}` : '删除作品'} onClick={() => { setError(''); setOpen(true); }}><Trash2 size={15}/>{compact ? '删除' : '删除作品'}</button>
    <dialog ref={dialogRef} className="delete-work-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); if (!pending) setOpen(false); }}>
      <div className="delete-dialog-icon"><Trash2 size={25} strokeWidth={1.5}/></div>
      <span className="eyebrow">MANAGE YOUR WORK / 作品管理</span>
      <h2 id={titleId}>删除这件作品？</h2>
      <div className="delete-work-preview"><FileBox size={23}/><div><strong>{work.title}</strong><small>{work.versionCount} 个版本 · {work.visibility === 'public' ? '包含公开展示' : '仅自己可见'}</small></div></div>
      <p id={descriptionId}>作品、全部版本和上传文件将一并删除，无法恢复。{work.visibility === 'public' && '公开分享链接也会失效。'}</p>
      {error && <p className="delete-dialog-error" role="alert">{error}</p>}
      <div className="delete-dialog-actions"><button ref={cancelRef} type="button" className="button button-outline" disabled={pending} onClick={() => setOpen(false)}>保留作品</button><button type="button" className="button delete-confirm" disabled={pending} onClick={() => void remove()}>{pending ? <LoaderCircle size={16} className="spin"/> : <Trash2 size={16}/>} {pending ? '正在删除…' : '确认删除'}</button></div>
    </dialog>
  </>;
}
