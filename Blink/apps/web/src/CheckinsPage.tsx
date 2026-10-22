import { NotesRow } from './CheckinPreview';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import './CheckinsPage.css';
import './CheckinsOwnerActions.css';

const API = 'http://localhost:3000';
const EMOJIS = ['🧡', '❤️', '😊', '🥹', '🔥', '✨', '🌿', '😴', '🎉', '💪', '🫶', '😂'];
type Checkin = { id: string; userId: string; emoji: string; status: string; note: string | null; duration: string; expiresAt: string | null; createdAt: string; user?: { id: string; name: string; avatarKey?: string | null } };
type Props = { onBack: () => void; onOpenProfile: (id: string) => void; theme: 'light' | 'dark'; onToggleTheme: () => void };
function currentUserId() { try { const raw = sessionStorage.getItem('blink-user') || localStorage.getItem('blink-user'); return raw ? (JSON.parse(raw) as { id?: string }).id : undefined; } catch { return undefined; } }
function token() { return localStorage.getItem('blink-access-token') || sessionStorage.getItem('blink-access-token'); }
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = token();
  if (!auth) throw new Error('Please sign in to use Check-Ins.');
  const response = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${auth}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try { const data = await response.json() as { message?: string | string[] }; if (data.message) message = Array.isArray(data.message) ? data.message.join(', ') : data.message; } catch { /* use default */ }
    throw new Error(message);
  }
  const text = await response.text();
return (text.trim() ? JSON.parse(text) : null) as T;
}
function timeLeft(item: Checkin, now: number) {
  if (!item.expiresAt) return 'Until removed';
  const remaining = Math.max(0, new Date(item.expiresAt).getTime() - now);
  if (!remaining) return 'Expired';
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.ceil((remaining % 3600000) / 60000);
  return hours ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}
function avatarSrc(key: string) { return key.startsWith('http') ? key : `${API}${key.startsWith('/') ? key : `/uploads/${key}`}`; }
export default function CheckinsPage({ onBack, onOpenProfile, theme, onToggleTheme }: Props) {
  const [feed, setFeed] = useState<Checkin[]>([]);
  const [mine, setMine] = useState<Checkin | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [composer, setComposer] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [emoji, setEmoji] = useState('🧡');
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [duration, setDuration] = useState('24h');
  const [filter, setFilter] = useState<'all' | 'friends' | 'mine'>('all');
  const [now, setNow] = useState(Date.now());
  const refresh = useCallback(async () => {
    try {
      const [items, own] = await Promise.all([request<Checkin[]>('/checkins'), request<Checkin | null>('/checkins/mine')]);
      setFeed(items); setMine(own); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load Check-Ins.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); const interval = window.setInterval(() => { setNow(Date.now()); void refresh(); }, 60000); return () => window.clearInterval(interval); }, [refresh]);
  useEffect(() => { if (!composer) return; const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) setComposer(false); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [composer, busy]);
  function openEdit(item: Checkin) {
    setEditingId(item.id); setEmoji(item.emoji); setStatus(item.status); setNote(item.note || ''); setDuration(item.duration); setError(''); setComposer(true);
  }
  function openCreate() {
    setEditingId(null); setEmoji('🧡'); setStatus(''); setNote(''); setDuration('24h'); setError(''); setComposer(true);
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy || !status.trim() || (!editingId && mine)) return;
    setBusy(true); setError(''); setNotice('');
    try { await request(editingId ? `/checkins/${encodeURIComponent(editingId)}` : '/checkins', { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify({ emoji, status: status.trim(), note: note.trim(), duration }) }); setComposer(false); setEditingId(null); setStatus(''); setNote(''); setFilter('all'); setNotice(editingId ? 'Your Check-In was updated.' : 'Your Check-In is live!'); window.dispatchEvent(new Event('blink:checkins-changed')); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not publish Check-In.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!mine || busy || !window.confirm('Remove your active Check-In?')) return;
    setBusy(true); setError(''); setNotice('');
    try { await request(`/checkins/${encodeURIComponent(mine.id)}`, { method: 'DELETE' }); setMine(null); setNotice('Your Check-In was removed.'); window.dispatchEvent(new Event('blink:checkins-changed')); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not remove Check-In.'); }
    finally { setBusy(false); }
  }
  const ownId = currentUserId() || mine?.userId;
  const visible = feed.filter(item => (!item.expiresAt || new Date(item.expiresAt).getTime() > now) && (filter === 'all' || (filter === 'mine' ? item.userId === ownId : item.userId !== ownId)));
  return <main className="ci-page">
    <header className="ci-topbar"><button className="ci-back" type="button" onClick={onBack}>← Back to Home</button><strong className="ci-brand">blink<span>.</span></strong><button className="ci-theme" type="button" onClick={onToggleTheme}>{theme === 'light' ? '☾ Dark' : '☀ Light'}</button></header>
    <div className="ci-container"><section className="ci-hero"><div><span className="ci-eyebrow">A LITTLE UPDATE, A LOT OF CONNECTION</span><h1>Check-Ins <span>🧡</span></h1><p>Let your friends know how you're feeling, right now.</p></div><button className="ci-primary" type="button" onClick={openCreate} disabled={Boolean(mine) || busy}>＋ {mine ? 'Already checked in' : 'New Check-In'}</button></section>
    {error && <div className="ci-alert" role="alert">{error}</div>}{notice && <div className="ci-success" role="status">{notice}</div>}
    {mine && <section className="ci-own"><div><span className="ci-own-label">YOUR ACTIVE CHECK-IN</span><div className="ci-own-content"><span className="ci-own-emoji">{mine.emoji}</span><div><strong>{mine.status}</strong>{mine.note && <p>{mine.note}</p>}<small>{timeLeft(mine, now)}</small></div></div></div><div className="ci-own-actions"><button className="ci-edit" type="button" onClick={() => openEdit(mine)} disabled={busy}>✎ Edit</button><button className="ci-remove" type="button" onClick={() => void remove()} disabled={busy}>{busy ? 'Working…' : 'Delete'}</button></div></section>}
    <div className="ci-section-heading"><div><h2>Friends' updates</h2><p>Only you and your friends can see your Check-Ins.</p></div><button className="ci-refresh" type="button" onClick={() => { setLoading(true); void refresh(); }}>↻ Refresh</button></div>
    <div className="ci-tabs" role="group" aria-label="Filter Check-Ins">{(['all', 'friends', 'mine'] as const).map(tab => <button type="button" key={tab} className={filter === tab ? 'active' : ''} onClick={() => setFilter(tab)}>{tab === 'all' ? 'All' : tab === 'friends' ? 'Friends' : 'Mine'}</button>)}</div>
    {loading ? <div className="ci-empty">Loading Check-Ins…</div> : <NotesRow items={visible} onCreate={() => { if (!mine) openCreate(); }} onEditOwn={item => { if (mine && item.id === mine.id) openEdit(mine); }} onDeleteOwn={() => void remove()} ownId={ownId} onOpenProfile={onOpenProfile} />}
    </div>
    {composer && <div className="ci-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !busy) setComposer(false); }}><section className="ci-modal" role="dialog" aria-modal="true" aria-labelledby="ci-dialog-title"><div className="ci-modal-header"><div><span className="ci-eyebrow">SHARE YOUR MOMENT</span><h2 id="ci-dialog-title">{editingId ? 'Edit Check-In' : 'New Check-In'}</h2></div><button className="ci-close" type="button" aria-label="Close" onClick={() => setComposer(false)} disabled={busy}>×</button></div><form onSubmit={e => void submit(e)}><label className="ci-label">How are you feeling?</label><div className="ci-emojis">{EMOJIS.map(value => <button type="button" key={value} className={emoji === value ? 'selected' : ''} aria-label={`Select ${value}`} aria-pressed={emoji === value} onClick={() => setEmoji(value)}>{value}</button>)}</div><label className="ci-label" htmlFor="ci-status">Your status <small>{status.length}/80</small></label><input id="ci-status" autoFocus maxLength={80} value={status} onChange={e => setStatus(e.target.value)} placeholder="What's on your mind?" required /><label className="ci-label" htmlFor="ci-note">Add a note (optional) <small>{note.length}/280</small></label><textarea id="ci-note" rows={3} maxLength={280} value={note} onChange={e => setNote(e.target.value)} placeholder="Tell your friends a little more…"/><label className="ci-label" htmlFor="ci-duration">Keep it visible for</label><select id="ci-duration" value={duration} onChange={e => setDuration(e.target.value)}><option value="24h">24 hours</option><option value="48h">48 hours</option><option value="until_removed">Until I remove it</option></select><p className="ci-privacy">🔒 Visible to friends only</p><button className="ci-primary ci-submit" type="submit" disabled={busy || !status.trim()}>{busy ? 'Saving…' : editingId ? 'Save Changes →' : 'Publish Check-In →'}</button></form></section></div>}
  </main>;
}
