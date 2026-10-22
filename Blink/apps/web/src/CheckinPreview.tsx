import { useEffect, useState, type FormEvent } from 'react';
import './CheckinPreview.css';

const API = 'http://localhost:3000';
export type ActiveCheckin = { id: string; userId: string; emoji: string; status: string; note: string | null; expiresAt: string | null; createdAt: string; user?: { id: string; name: string; avatarKey?: string | null } };

function getToken() { return localStorage.getItem('blink-access-token') || sessionStorage.getItem('blink-access-token'); }
export function useActiveCheckins(enabled = true) {
  const [items, setItems] = useState<ActiveCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!enabled) { setItems([]); setLoading(false); return; }
    let cancelled = false;
    async function refresh() {
      const token = getToken();
      if (!token) { if (!cancelled) { setItems([]); setLoading(false); } return; }
      try {
        const response = await fetch(`${API}/checkins`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        if (!response.ok) throw new Error('Could not load Check-Ins');
        const body = await response.text();
        const data: unknown = body.trim() ? JSON.parse(body) : [];
        if (!cancelled) setItems(Array.isArray(data) ? data as ActiveCheckin[] : []);
      } catch { if (!cancelled) setItems([]); }
      finally { if (!cancelled) setLoading(false); }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('blink:checkins-changed', onFocus);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('focus', onFocus); window.removeEventListener('blink:checkins-changed', onFocus); };
  }, [enabled]);
  return { items: items.filter(item => !item.expiresAt || new Date(item.expiresAt).getTime() > Date.now()), loading };
}

export function CheckinTile({ item, onClick }: { item: ActiveCheckin; onClick?: () => void }) {
  const contents = <><span className="blink-ci-tile-emoji">{item.emoji}</span><span className="blink-ci-tile-copy"><strong>{item.user?.name || 'Blink friend'}</strong><span>{item.status}</span>{item.note && <small>{item.note}</small>}</span></>;
  return onClick ? <button type="button" className="blink-ci-tile" onClick={onClick}>{contents}<span aria-hidden="true">›</span></button> : <div className="blink-ci-tile">{contents}</div>;
}


function currentUserId(): string | null {
  try { const raw = sessionStorage.getItem('blink-user') || localStorage.getItem('blink-user'); return raw ? (JSON.parse(raw) as {id?:string}).id || null : null; } catch { return null; }
}
function avatar(key?: string | null) { if (!key) return ''; return /^https?:\/\//.test(key) ? key : `${API}${key.startsWith('/') ? key : `/uploads/${encodeURIComponent(key)}`}`; }
async function postJson<T>(path: string, body: object): Promise<T> {
  const token = getToken(); if (!token) throw new Error('Please sign in again.');
  const response = await fetch(`${API}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await response.text(); let data: any = null;
  try { data = text.trim() ? JSON.parse(text) : null; } catch { /* default error */ }
  if (!response.ok) throw new Error(Array.isArray(data?.message) ? data.message.join(', ') : data?.message || `Request failed (${response.status})`);
  return data as T;
}
export function NotesRow({ items, onOpenProfile, onCreate, onEditOwn, onDeleteOwn, ownId, showEmpty = true }: { items: ActiveCheckin[]; onOpenProfile?: (id: string) => void; onCreate?: () => void; onEditOwn?: (item: ActiveCheckin) => void; onDeleteOwn?: (item: ActiveCheckin) => void; ownId?: string | null; showEmpty?: boolean }) {
  const me = ownId === undefined ? currentUserId() : ownId;
  const [selected, setSelected] = useState<ActiveCheckin | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [sentKind, setSentKind] = useState<'reply' | 'reaction'>('reply');
  const active = items.filter(item => !item.expiresAt || new Date(item.expiresAt).getTime() > Date.now());
  const sorted = [...active].sort((a,b) => Number(b.userId === me) - Number(a.userId === me));
  async function sendToNote(message: string, kind: 'reply' | 'reaction') {
    if (!selected || selected.userId === me || sending) return;
    setSending(true); setError(''); setSent(false);
    try {
      // Confirm the note is still visible to this account before messaging.
      const token = getToken(); if (!token) throw new Error('Please sign in again.');
      const response = await fetch(`${API}/checkins`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) throw new Error('Could not verify the Check-In.');
      const text = await response.text();
      const current: unknown = text.trim() ? JSON.parse(text) : [];
      if (!Array.isArray(current) || !current.some((item: ActiveCheckin) => item.id === selected.id && (!item.expiresAt || new Date(item.expiresAt).getTime() > Date.now()))) {
        throw new Error('This Check-In is no longer available.');
      }
      const opened = await postJson<{ conversationId: string }>('/inbox/conversations', { friendId: selected.userId });
      if (!opened?.conversationId) throw new Error('Could not open conversation.');
      await postJson(`/inbox/conversations/${encodeURIComponent(opened.conversationId)}/messages`, {
        body: `${kind === 'reaction' ? 'Reacted to' : '↪ Reply to'} Check-In ${selected.emoji} ${selected.status}\n${message}`,
      });
      setSentKind(kind); setReply(''); setSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send message.'); }
    finally { setSending(false); }
  }
  function send(e: FormEvent) {
    e.preventDefault();
    if (reply.trim()) void sendToNote(reply.trim(), 'reply');
  }
  return <>
    <div className="blink-notes-row" aria-label="Friends' notes">
      {onCreate && !sorted.some(item => item.userId === me) && <button type="button" className="blink-note-person" onClick={onCreate}><span className="blink-note-bubble blink-note-add">Write a note +</span><span className="blink-note-avatar blink-note-avatar-empty">＋</span><span className="blink-note-name">Your note</span></button>}
      {sorted.map(item => <button type="button" key={item.id} className="blink-note-person" onClick={() => { setSelected(item); setReply(''); setError(''); setSent(false); }} aria-label={`Open ${item.user?.name || 'friend'}'s Check-In`}>
        <span className="blink-note-bubble"><span>{item.emoji} {item.status}</span></span>
        <span className="blink-note-avatar">{item.user?.avatarKey ? <img src={avatar(item.user.avatarKey)} alt="" /> : <span>{(item.user?.name || 'B').slice(0,1).toUpperCase()}</span>}</span>
        <span className="blink-note-name">{item.userId === me ? 'You' : item.user?.name || 'Friend'}</span>
      </button>)}
      {showEmpty && !sorted.length && !onCreate && <p className="blink-ci-preview-empty">No active notes yet.</p>}
    </div>
    {selected && <div className="blink-note-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !sending) setSelected(null); }}>
      <section className="blink-note-dialog" role="dialog" aria-modal="true" aria-label="Check-In note">
        <button type="button" className="blink-note-close" aria-label="Close" onClick={() => setSelected(null)}>×</button>
        <div className="blink-note-dialog-avatar">{selected.user?.avatarKey ? <img src={avatar(selected.user.avatarKey)} alt=""/> : (selected.user?.name || 'B').slice(0,1)}</div>
        <h3>{selected.userId === me ? 'Your note' : `${selected.user?.name || 'Friend'}'s note`}</h3>
        <div className="blink-note-dialog-content"><strong>{selected.emoji} {selected.status}</strong>{selected.note && <p>{selected.note}</p>}</div>
        {selected.userId === me && (onEditOwn || onDeleteOwn) && <div className="blink-note-own-actions">{onEditOwn && <button type="button" onClick={() => { const item = selected; setSelected(null); onEditOwn(item); }}>✎ Edit note</button>}{onDeleteOwn && <button type="button" className="blink-note-delete" onClick={() => { const item = selected; setSelected(null); onDeleteOwn(item); }}>Delete note</button>}</div>}
        {selected.userId !== me && <div>
          {sent ? <div><p role="status" className="blink-note-success">{sentKind === 'reaction' ? 'Reaction' : 'Reply'} sent privately to Blink Inbox! 🧡</p><button type="button" className="blink-note-profile-link" onClick={() => { window.location.assign('/inbox'); }}>Open Inbox →</button><button type="button" className="blink-note-profile-link" onClick={() => setSent(false)}>Send another</button></div> : <>
            <p style={{ marginBottom: 8, color: 'inherit' }}>Quick reaction</p>
            <div role="group" aria-label="React privately to Check-In" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {['❤️', '😂', '🔥', '🥹', '👍'].map(emoji => <button key={emoji} type="button" disabled={sending} aria-label={`Send ${emoji} reaction`} onClick={() => void sendToNote(emoji, 'reaction')} style={{ background: 'transparent', color: 'inherit', border: '1px solid currentColor', borderRadius: 12, padding: '7px 11px', cursor: sending ? 'wait' : 'pointer', fontSize: 20 }}>{emoji}</button>)}
            </div>
            <form onSubmit={send}><label htmlFor="blink-note-reply">Reply privately</label><div className="blink-note-reply-row"><input id="blink-note-reply" maxLength={1000} autoFocus value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a reply…" disabled={sending}/><button type="submit" disabled={!reply.trim() || sending}>{sending ? 'Sending…' : 'Send ↗'}</button></div></form>
          </>}
          {error && <p role="alert" className="blink-note-error">{error}</p>}
        </div>}
        {onOpenProfile && <button type="button" className="blink-note-profile-link" onClick={() => { const id=selected.userId; setSelected(null); onOpenProfile(id); }}>View profile →</button>}
      </section>
    </div>}
  </>;
}
