import { useCallback, useEffect, useState, type FormEvent } from 'react';
import './IrlPage.css';
const API = 'http://localhost:3000';
type Interest = { id: string; userId: string; reply: string; user: { id: string; name: string } };
type Invitation = { id: string; recipientId: string; status: 'PENDING' | 'ACCEPTED' | 'DECLINED'; recipient?: { id: string; name: string }; plan?: { id: string; title: string; startsAt: string; creator: { name: string } } };
type IrlChatMessage = { id: string; senderId: string; text: string; createdAt: string; sender: { id: string; name: string } };
type InboxData = { plan: { id: string; title: string; place: string | null; startsAt: string }; messages: IrlChatMessage[] };
type Plan = { id: string; creatorId: string; title: string; category: string; description: string | null; place: string | null; startsAt: string; creator: { id: string; name: string }; interests: Interest[]; invitations: Invitation[] };
const categories = ['Hangout', 'Sports', 'Gaming', 'Food', 'Shopping', 'Other'];
const icons: Record<string, string> = { Hangout: '☕', Sports: '⚽', Gaming: '🎮', Food: '🍕', Shopping: '🛍️', Other: '✨' };
function token() { return localStorage.getItem('blink-access-token') || sessionStorage.getItem('blink-access-token'); }
function ownId() { try { const raw = sessionStorage.getItem('blink-user') || localStorage.getItem('blink-user'); return raw ? JSON.parse(raw).id as string : ''; } catch { return ''; } }
async function request(path: string, method = 'GET', body?: object) {
  const res = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const raw = await res.text(); let data: any = null; try { data = raw ? JSON.parse(raw) : null; } catch { /* non-json error */ }
  if (!res.ok) throw new Error(Array.isArray(data?.message) ? data.message.join(', ') : data?.message || `Request failed (${res.status})`);
  return data;
}
export default function IrlPage({ onBack, theme, onToggleTheme }: { onBack: () => void; theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const [plans, setPlans] = useState<Plan[]>([]); const [invitations, setInvitations] = useState<Invitation[]>([]); const [tab, setTab] = useState<'feed' | 'mine' | 'invitations'>('feed');
  const [filter, setFilter] = useState('All'); const [compose, setCompose] = useState(false);
  const [title, setTitle] = useState(''); const [category, setCategory] = useState('Hangout');
  const [description, setDescription] = useState(''); const [place, setPlace] = useState(''); const [startsAt, setStartsAt] = useState('');
  const [reply, setReply] = useState<Record<string, string>>({}); const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [inboxPlanId, setInboxPlanId] = useState<string | null>(null);
  const [inbox, setInbox] = useState<InboxData | null>(null);
  const [draft, setDraft] = useState('');
  const [inboxBusy, setInboxBusy] = useState(false);
  const me = ownId();
  const openInbox = useCallback(async (planId: string) => {
    setError('');
    try {
      const data = await request(`/irl/plans/${encodeURIComponent(planId)}/messages`) as InboxData;
      setInbox(data);
      setInboxPlanId(planId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open IRL Inbox.'); }
  }, []);
  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!inboxPlanId || !draft.trim() || inboxBusy) return;
    setInboxBusy(true); setError('');
    try {
      await request(`/irl/plans/${encodeURIComponent(inboxPlanId)}/messages`, 'POST', { text: draft.trim() });
      setDraft('');
      await openInbox(inboxPlanId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send message.'); }
    finally { setInboxBusy(false); }
  }
  useEffect(() => {
    if (!inboxPlanId) return;
    const interval = window.setInterval(() => { void openInbox(inboxPlanId); }, 10000);
    return () => window.clearInterval(interval);
  }, [inboxPlanId, openInbox]);
  const refresh = useCallback(async () => { try { const [nextPlans, nextInvitations] = await Promise.all([request('/irl/plans'), request('/irl/invitations')]); setPlans(nextPlans || []); setInvitations(nextInvitations || []); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load plans.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function create(e: FormEvent) { e.preventDefault(); setSaving(true); setError(''); try {
    await request('/irl/plans', 'POST', { title, category, description, place, startsAt: new Date(startsAt).toISOString() });
    setCompose(false); setTitle(''); setDescription(''); setPlace(''); setStartsAt(''); setMessage('Your IRL plan is live!'); await refresh();
  } catch (e) { setError(e instanceof Error ? e.message : 'Could not create plan.'); } finally { setSaving(false); } }
  async function respond(id: string, text: string) { setSaving(true); setError(''); try { await request(`/irl/plans/${id}/interest`, 'POST', { reply: text }); setMessage('Your interest was sent!'); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not send reply.'); } finally { setSaving(false); } }
  async function withdraw(id: string) { setSaving(true); try { await request(`/irl/plans/${id}/interest`, 'DELETE'); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not withdraw.'); } finally { setSaving(false); } }
  async function remove(id: string) { if (!window.confirm('Delete this IRL plan and its replies?')) return; setSaving(true); try { await request(`/irl/plans/${id}`, 'DELETE'); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete.'); } finally { setSaving(false); } }
  async function invite(planId: string, recipientId: string) { setSaving(true); setError(''); try { await request(`/irl/plans/${planId}/invitations`, 'POST', { recipientId }); setMessage('Invitation sent!'); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not invite friend.'); } finally { setSaving(false); } }
  async function answer(invitationId: string, status: 'ACCEPTED' | 'DECLINED') { setSaving(true); setError(''); try { await request(`/irl/invitations/${invitationId}/respond`, 'POST', { status }); setMessage(status === 'ACCEPTED' ? 'Invitation accepted!' : 'Invitation declined.'); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not answer invitation.'); } finally { setSaving(false); } }
  const visible = plans.filter(p => (tab === 'feed' || (tab === 'mine' && p.creatorId === me)) && (filter === 'All' || p.category === filter));
  return <main className="irl-page">
    <header className="irl-top"><button onClick={onBack} className="irl-back">← Blink</button><strong>IRL <span>✦</span></strong><button onClick={onToggleTheme}>{theme === 'dark' ? '☀ Light' : '☾ Dark'}</button></header>
    <div className="irl-layout"><aside className="irl-sidebar"><div className="irl-sidebar-brand">✦ <strong>IRL</strong><small>Make plans. Make memories.</small></div><button className={tab === 'feed' ? 'active' : ''} onClick={() => setTab('feed')}>◫ Discover plans</button><button className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>♧ My plans</button><button className={tab === 'invitations' ? 'active' : ''} onClick={() => setTab('invitations')}>✉ Invitations ({invitations.filter(i => i.status === 'PENDING').length})</button><div className="irl-sidebar-note">Your plans are visible to your Blink friends only.<br/><br/>Invitations and private IRL Inbox are available. Live maps are coming later.</div></aside>
    <section className="irl-main"><div className="irl-hero"><div><span className="irl-eyebrow">YOUR PEOPLE. REAL PLANS.</span><h1>Let's do something <em>IRL.</em></h1><p>From a quick coffee to a weekend adventure. Post an idea and see who's in.</p></div><button className="irl-primary" onClick={() => setCompose(true)}>＋ Create a plan</button></div>
    <div className="irl-heading"><div><h2>{tab === 'mine' ? 'My plans' : tab === 'invitations' ? 'IRL Invitations' : 'Plans from your circle'}</h2><p>Find your next favorite memory together.</p></div><span>{tab === 'invitations' ? `${invitations.length} invitations` : `${visible.length} plans`}</span></div>
    {tab !== 'invitations' && <div className="irl-filters">{['All', ...categories].map(c => <button key={c} className={filter === c ? 'selected' : ''} onClick={() => setFilter(c)}>{c === 'All' ? '✦' : icons[c]} {c}</button>)}</div>}
    {error && <p className="irl-alert" role="alert">{error}</p>}{message && <p className="irl-success" role="status">{message} <button onClick={() => setMessage('')}>×</button></p>}
    {loading ? <div className="irl-empty">Loading plans…</div> : tab === 'invitations' ? <div className="irl-grid">{invitations.length ? invitations.map(inv => <article className="irl-card" key={inv.id}><span className="irl-category">✉ {inv.status}</span><h3>{inv.plan?.title}</h3><p>From {inv.plan?.creator.name}</p><p>📅 {inv.plan?.startsAt ? new Date(inv.plan.startsAt).toLocaleString() : ''}</p>{inv.status === 'ACCEPTED' && inv.plan?.id && <button className="irl-primary" type="button" onClick={() => void openInbox(inv.plan!.id)}>Open IRL Inbox</button>}{inv.status === 'PENDING' && <div className="irl-actions"><button className="irl-primary" disabled={saving} onClick={() => void answer(inv.id, 'ACCEPTED')}>Accept</button><button className="irl-muted-button" disabled={saving} onClick={() => void answer(inv.id, 'DECLINED')}>Decline</button></div>}</article>) : <div className="irl-empty">No invitations yet.</div>}</div> : !visible.length ? <div className="irl-empty"><div>🌤️</div><h3>No plans here yet</h3><p>Be the first to bring your friends together.</p><button className="irl-primary" onClick={() => setCompose(true)}>Create a plan</button></div> : <div className="irl-grid">{visible.map(p => { const mine = p.creatorId === me; const myInterest = p.interests.find(i => i.userId === me); return <article className="irl-card" key={p.id}><div className="irl-card-top"><span className="irl-category">{icons[p.category] || '✨'} {p.category}</span><span className="irl-avatar">{p.creator.name.slice(0, 1).toUpperCase()}</span></div><p className="irl-by">{mine ? 'Your plan' : `By ${p.creator.name}`}</p><h3>{p.title}</h3>{p.description && <p className="irl-description">{p.description}</p>}<div className="irl-meta"><span>📅 {new Date(p.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span><span>📍 {p.place || 'Location to be decided'}</span><span>🙌 {p.interests.length} interested</span></div>{(mine || p.invitations.some(inv => inv.recipientId === me && inv.status === 'ACCEPTED')) && <button type="button" className="irl-primary" onClick={() => void openInbox(p.id)}>✉ Open IRL Inbox</button>}{mine ? <><div className="irl-replies"><strong>Interested friends</strong>{p.interests.length ? p.interests.map(i => <div key={i.id}><b>{i.user.name}</b>{i.reply.trim() && <p>{i.reply}</p>}{(() => { const existing = p.invitations?.find(inv => inv.recipientId === i.userId); return existing ? <p className="irl-interested">Invitation: {existing.status === 'PENDING' ? 'Pending' : existing.status === 'ACCEPTED' ? 'Accepted' : 'Declined'}</p> : <button type="button" className="irl-primary" disabled={saving} onClick={() => void invite(p.id, i.userId)}>Send invitation</button>; })()}</div>) : <p>No replies yet. Your friends can respond here.</p>}</div><button className="irl-muted-button" disabled={saving} onClick={() => void remove(p.id)}>Delete plan</button></> : <div className="irl-respond">{myInterest && <p className="irl-interested">✓ You're interested{myInterest.reply.trim() ? ` — ${myInterest.reply}` : ''}</p>}<label htmlFor={`reply-${p.id}`}>Your reply (optional)</label><textarea id={`reply-${p.id}`} maxLength={500} rows={2} placeholder="I'm in! What time should we meet?" value={reply[p.id] ?? myInterest?.reply ?? ''} onChange={e => setReply(v => ({ ...v, [p.id]: e.target.value }))}/><div className="irl-actions"><button className="irl-primary" disabled={saving} onClick={() => void respond(p.id, reply[p.id] ?? myInterest?.reply ?? '')}>{myInterest ? 'Update reply' : '🙌 I’m interested'}</button>{myInterest && <button className="irl-muted-button" disabled={saving} onClick={() => void withdraw(p.id)}>Withdraw</button>}</div></div>}</article>; })}</div>}</section>
    <aside className="irl-right"><div className="irl-side-card"><span>🧡</span><h3>Good plans start here.</h3><p>Have something in mind? Post it and let your friends respond in their own words.</p><button className="irl-primary" onClick={() => setCompose(true)}>＋ New plan</button></div><div className="irl-side-card irl-side-secondary"><strong>COMING NEXT</strong><p>👥 Choose your crew</p><p>📨 Private IRL Inbox</p><p>📍 Meetup spots & maps</p><p>🧭 Optional live location</p></div></aside></div>
    {inboxPlanId && <div className="irl-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setInboxPlanId(null); }}>
      <section className="irl-modal" role="dialog" aria-modal="true" aria-label="IRL Inbox">
        <div className="irl-modal-head"><div><span className="irl-eyebrow">PRIVATE IRL INBOX</span><h2>{inbox?.plan.title || 'IRL Inbox'}</h2></div><button type="button" aria-label="Close inbox" onClick={() => setInboxPlanId(null)}>×</button></div>
        <p>📅 {inbox?.plan.startsAt ? new Date(inbox.plan.startsAt).toLocaleString() : ''} · 📍 {inbox?.plan.place || 'Location TBD'}</p>
        <div style={{ maxHeight: 330, overflowY: 'auto', display: 'grid', gap: 10, padding: '12px 0' }}>
          {inbox?.messages.length ? inbox.messages.map(m => <div key={m.id} style={{ padding: 10, borderRadius: 10, background: m.senderId === me ? 'rgba(251,108,0,.12)' : 'rgba(128,128,128,.10)' }}>
            <strong>{m.sender.name}</strong> <small>{new Date(m.createdAt).toLocaleString()}</small><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.text}</p>
          </div>) : <p>No messages yet. Start coordinating your meetup!</p>}
        </div>
        <form onSubmit={e => void sendMessage(e)}>
          <label htmlFor="irl-inbox-message">Message your crew</label>
          <textarea id="irl-inbox-message" maxLength={2000} rows={3} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Where should we meet?" />
          <button className="irl-primary irl-submit" type="submit" disabled={inboxBusy || !draft.trim()}>{inboxBusy ? 'Sending…' : 'Send message →'}</button>
        </form>
      </section>
    </div>}
    {compose && <div className="irl-overlay"  onMouseDown={e => { if (e.target === e.currentTarget) setCompose(false); }}><section className="irl-modal" role="dialog" aria-modal="true" aria-label="Create an IRL plan"><div className="irl-modal-head"><div><span className="irl-eyebrow">LET'S MAKE IT HAPPEN</span><h2>Create a plan ✦</h2></div><button onClick={() => setCompose(false)} aria-label="Close">×</button></div><form onSubmit={e => void create(e)}><label>What's the plan?<input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Football this Saturday" /></label><label>Category<select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label>When?<input required type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)}/></label><label>Suggested place (optional)<input maxLength={180} value={place} onChange={e => setPlace(e.target.value)} placeholder="e.g. Dhanmondi Lake" /></label><label>Tell your friends more<textarea rows={4} maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} placeholder="What's the vibe? What should people bring?" /></label><p className="irl-hint">🔒 Only your Blink friends can see and reply.</p><button className="irl-primary irl-submit" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Publish plan →'}</button></form></section></div>}
  </main>;
}
