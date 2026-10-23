import { useCallback, useEffect, useState, type FormEvent } from 'react';
import './IrlPage.css';
const API = 'http://localhost:3000';
type Interest = { id: string; userId: string; reply: string; user: { id: string; name: string } };
type Invitation = { id: string; recipientId: string; status: 'PENDING' | 'ACCEPTED' | 'DECLINED'; recipient?: { id: string; name: string }; plan?: { id: string; title: string; startsAt: string; creator: { name: string } } };
type IrlChatMessage = { id: string; senderId: string; text: string; createdAt: string; sender: { id: string; name: string } };
type InboxData = { plan: { id: string; title: string; place: string | null; meetupLat: number | null; meetupLng: number | null; meetupUrl: string | null; startsAt: string }; messages: IrlChatMessage[] };
type Plan = { id: string; creatorId: string; title: string; category: string; description: string | null; place: string | null; meetupLat: number | null; meetupLng: number | null; meetupUrl: string | null; startsAt: string; creator: { id: string; name: string }; interests: Interest[]; invitations: Invitation[]; participants: { id: string; name: string }[] };
const categories = ['Hangout', 'Sports', 'Gaming', 'Food', 'Shopping', 'Other'];
const icons: Record<string, string> = { Hangout: '☕', Sports: '⚽', Gaming: '🎮', Food: '🍕', Shopping: '🛍️', Other: '✨' };
function mapsUrl(lat: number, lng: number) { return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`; }
function token() { return localStorage.getItem('blink-access-token') || sessionStorage.getItem('blink-access-token'); }
function ownId() { try { const raw = sessionStorage.getItem('blink-user') || localStorage.getItem('blink-user'); return raw ? JSON.parse(raw).id as string : ''; } catch { return ''; } }
async function request(path: string, method = 'GET', body?: object) {
  const res = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const raw = await res.text(); let data: any = null; try { data = raw ? JSON.parse(raw) : null; } catch { /* non-json error */ }
  if (!res.ok) throw new Error(Array.isArray(data?.message) ? data.message.join(', ') : data?.message || `Request failed (${res.status})`);
  return data;
}
export default function IrlPage({ onBack, theme, onToggleTheme }: { onBack: () => void; theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const [plans, setPlans] = useState<Plan[]>([]); const [tab, setTab] = useState<'feed' | 'mine'>('feed');
  const [filter, setFilter] = useState('All'); const [compose, setCompose] = useState(false);
  const [title, setTitle] = useState(''); const [category, setCategory] = useState('Hangout');
  const [description, setDescription] = useState(''); const [place, setPlace] = useState(''); const [startsAt, setStartsAt] = useState('');
  const [reply, setReply] = useState<Record<string, string>>({}); const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [locationPlan, setLocationPlan] = useState<Plan | null>(null);
  const [locationName, setLocationName] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [inboxPlanId, setInboxPlanId] = useState<string | null>(null);
  const [inbox, setInbox] = useState<InboxData | null>(null);
  const [draft, setDraft] = useState('');
  const [inboxBusy, setInboxBusy] = useState(false);
  function editLocation(plan: Plan) {
    setLocationPlan(plan); setLocationName(plan.place || '');
    setLocationUrl(plan.meetupUrl || '');
  }
  async function saveLocation(e: FormEvent) {
    e.preventDefault(); if (!locationPlan || saving) return;
    if (!locationName.trim() || !locationUrl.trim()) { setError('Enter a place name and Google Maps link.'); return; }
    setSaving(true); setError('');
    try {
      await request(`/irl/plans/${encodeURIComponent(locationPlan.id)}/location`, 'PATCH', { place: locationName, meetupUrl: locationUrl });
      setLocationPlan(null); setMessage('Meetup location saved.'); await refresh();
      if (inboxPlanId === locationPlan.id) await openInbox(locationPlan.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save meetup location.'); }
    finally { setSaving(false); }
  }
  const me = ownId();
  const openInbox = useCallback(async (planId: string) => {
    setError('');
    try {
      const data = await request(`/irl/plans/${encodeURIComponent(planId)}/messages`) as InboxData;
      setInbox(data);
      setInboxPlanId(planId);
    } catch (e) { setInbox(null); setInboxPlanId(null); setError(e instanceof Error ? e.message : 'Could not open IRL Inbox.'); }
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
  const refresh = useCallback(async () => { try { const nextPlans = await request('/irl/plans'); setPlans(nextPlans || []); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load plans.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function create(e: FormEvent) { e.preventDefault(); setSaving(true); setError(''); try {
    await request('/irl/plans', 'POST', { title, category, description, place, startsAt: new Date(startsAt).toISOString() });
    setCompose(false); setTitle(''); setDescription(''); setPlace(''); setStartsAt(''); setMessage('Your IRL plan is live!'); await refresh();
  } catch (e) { setError(e instanceof Error ? e.message : 'Could not create plan.'); } finally { setSaving(false); } }
  async function respond(id: string, text: string) { setSaving(true); setError(''); try { await request(`/irl/plans/${id}/interest`, 'POST', { reply: text }); setMessage('Your interest was sent!'); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not send reply.'); } finally { setSaving(false); } }
  async function withdraw(id: string) { setSaving(true); try { await request(`/irl/plans/${id}/interest`, 'DELETE'); if (inboxPlanId === id) { setInboxPlanId(null); setInbox(null); } setMessage('You left the plan.'); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not withdraw.'); } finally { setSaving(false); } }
  async function remove(id: string) { if (!window.confirm('Delete this IRL plan and its replies?')) return; setSaving(true); try { await request(`/irl/plans/${id}`, 'DELETE'); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete.'); } finally { setSaving(false); } }
  async function invite(planId: string, recipientId: string) { setSaving(true); setError(''); try { await request(`/irl/plans/${planId}/invitations`, 'POST', { recipientId }); setMessage('Friend approved and joined!'); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not invite friend.'); } finally { setSaving(false); } }
  async function removeParticipant(planId: string, participantId: string, name: string) {
    if (!window.confirm(`Remove ${name} from this plan? Their IRL messages in this plan will be permanently deleted. This cannot be undone.`)) return;
    setSaving(true); setError('');
    try {
      await request(`/irl/plans/${encodeURIComponent(planId)}/participants/${encodeURIComponent(participantId)}`, 'DELETE');
      setMessage(`${name} was removed and their IRL messages in this plan were deleted.`);
      await refresh();
      if (inboxPlanId === planId) await openInbox(planId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove participant.'); }
    finally { setSaving(false); }
  }
  const visible = plans.filter(p => (tab === 'feed' || (tab === 'mine' && p.creatorId === me)) && (filter === 'All' || p.category === filter));
  return <main className="irl-page">
    <header className="irl-top"><button onClick={onBack} className="irl-back">← Blink</button><strong>IRL <span>✦</span></strong><button onClick={onToggleTheme}>{theme === 'dark' ? '☀ Light' : '☾ Dark'}</button></header>
    <div className="irl-layout"><aside className="irl-sidebar"><div className="irl-sidebar-brand">✦ <strong>IRL</strong><small>Make plans. Make memories.</small></div><button className={tab === 'feed' ? 'active' : ''} onClick={() => setTab('feed')}>◫ Discover plans</button><button className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>♧ My plans</button><div className="irl-sidebar-note">Your plans are visible to your Blink friends only.<br/><br/>Invitations and private IRL Inbox are available. Live maps are coming later.</div></aside>
    <section className="irl-main"><div className="irl-hero"><div><span className="irl-eyebrow">YOUR PEOPLE. REAL PLANS.</span><h1>Let's do something <em>IRL.</em></h1><p>From a quick coffee to a weekend adventure. Post an idea and see who's in.</p></div><button className="irl-primary" onClick={() => setCompose(true)}>＋ Create a plan</button></div>
    <div className="irl-heading"><div><h2>{tab === 'mine' ? 'My plans' : 'Plans from your circle'}</h2><p>Find your next favorite memory together.</p></div><span>{`${visible.length} plans`}</span></div>
    {<div className="irl-filters">{['All', ...categories].map(c => <button key={c} className={filter === c ? 'selected' : ''} onClick={() => setFilter(c)}>{c === 'All' ? '✦' : icons[c]} {c}</button>)}</div>}
    {error && <p className="irl-alert" role="alert">{error}</p>}{message && <p className="irl-success" role="status">{message} <button onClick={() => setMessage('')}>×</button></p>}
    {loading ? <div className="irl-empty">Loading plans…</div> : !visible.length ? <div className="irl-empty"><div>🌤️</div><h3>No plans here yet</h3><p>Be the first to bring your friends together.</p><button className="irl-primary" onClick={() => setCompose(true)}>Create a plan</button></div> : <div className="irl-grid">{visible.map(p => { const mine = p.creatorId === me; const myInterest = p.interests.find(i => i.userId === me); return <article className="irl-card" key={p.id}><div className="irl-card-top"><span className="irl-category">{icons[p.category] || '✨'} {p.category}</span><span className="irl-avatar">{p.creator.name.slice(0, 1).toUpperCase()}</span></div><p className="irl-by">{mine ? 'Your plan' : `By ${p.creator.name}`}</p><h3>{p.title}</h3>{p.description && <p className="irl-description">{p.description}</p>}<div className="irl-meta"><span>📅 {new Date(p.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span><span>📍 {p.place || 'Location to be decided'}</span><span>🙌 {p.interests.length} interested</span></div>{(mine || (myInterest && p.invitations.some(inv => inv.recipientId === me && inv.status === 'ACCEPTED'))) && <button type="button" className="irl-primary" onClick={() => void openInbox(p.id)}>✉ Open IRL Inbox</button>}{(p.meetupUrl || (p.meetupLat != null && p.meetupLng != null)) && <a className="irl-primary" href={p.meetupUrl || mapsUrl(p.meetupLat!, p.meetupLng!)} target="_blank" rel="noopener noreferrer">🧭 Open directions</a>}{mine ? <><button type="button" className="irl-muted-button" onClick={() => editLocation(p)}>📍 Set meetup pin</button><div className="irl-replies"><strong>Approved participants ({p.interests.filter(i => p.invitations.some(inv => inv.recipientId === i.userId && inv.status === 'ACCEPTED')).length})</strong>{p.interests.filter(i => p.invitations.some(inv => inv.recipientId === i.userId && inv.status === 'ACCEPTED')).map(i => <div key={i.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><span>✓ {i.user.name}</span><button type="button" className="irl-muted-button" disabled={saving} onClick={() => void removeParticipant(p.id, i.userId, i.user.name)}>Remove</button></div>)}</div><div className="irl-replies"><strong>Interested friends</strong>{p.interests.length ? p.interests.map(i => <div key={i.id}><b>{i.user.name}</b>{i.reply.trim() && <p>{i.reply}</p>}{(() => { const existing = p.invitations?.find(inv => inv.recipientId === i.userId); return existing ? <p className="irl-interested">{existing.status === 'ACCEPTED' ? '✓ Joined' : 'Awaiting approval'}</p> : <button type="button" className="irl-primary" disabled={saving} onClick={() => void invite(p.id, i.userId)}>Approve & join</button>; })()}</div>) : <p>No replies yet. Your friends can respond here.</p>}</div><button className="irl-muted-button" disabled={saving} onClick={() => void remove(p.id)}>Delete plan</button></> : <div className="irl-respond">{myInterest && p.invitations.some(inv => inv.recipientId === me && inv.status === 'ACCEPTED') && <div className="irl-replies"><strong>Approved participants</strong><p>{p.participants.map(i => i.name).join(', ') || 'No other participants yet'}</p></div>}{myInterest && <p className="irl-interested">✓ You're interested{myInterest.reply.trim() ? ` — ${myInterest.reply}` : ''}</p>}<label htmlFor={`reply-${p.id}`}>Your reply (optional)</label><textarea id={`reply-${p.id}`} maxLength={500} rows={2} placeholder="I'm in! What time should we meet?" value={reply[p.id] ?? myInterest?.reply ?? ''} onChange={e => setReply(v => ({ ...v, [p.id]: e.target.value }))}/><div className="irl-actions"><button className="irl-primary" disabled={saving} onClick={() => void respond(p.id, reply[p.id] ?? myInterest?.reply ?? '')}>{myInterest ? 'Update reply' : '🙌 I’m interested'}</button>{myInterest && <button className="irl-muted-button" disabled={saving} onClick={() => void withdraw(p.id)}>Withdraw</button>}</div></div>}</article>; })}</div>}</section>
    </div>
    {locationPlan && <div className="irl-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setLocationPlan(null); }}>
      <section className="irl-modal" role="dialog" aria-modal="true" aria-label="Set meetup location">
        <div className="irl-modal-head"><h2>📍 Set meetup location</h2><button type="button" aria-label="Close" onClick={() => setLocationPlan(null)}>×</button></div>
        <p>Choose a place in Google Maps, copy its Share link, and paste it below.</p>
        {error && <p className="irl-alert" role="alert">{error}</p>}
        <form onSubmit={e => void saveLocation(e)}>
          <label>Meetup place<input required maxLength={180} value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="Main gate, Dhanmondi Lake" /></label>
                     <a className="irl-muted-button" href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer">🗺️ Go to Google Maps ↗</a>
           <label>Google Maps location link<input required type="url" maxLength={2048} value={locationUrl} onChange={e => setLocationUrl(e.target.value)} placeholder="https://maps.app.goo.gl/..." /></label>
<button type="submit" className="irl-primary irl-submit" disabled={saving}>{saving ? 'Saving…' : 'Save meetup pin'}</button>
        </form>
      </section>
    </div>}
    {inboxPlanId && <div className="irl-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setInboxPlanId(null); }}>
      <section className="irl-modal" role="dialog" aria-modal="true" aria-label="IRL Inbox">
        <div className="irl-modal-head"><div><span className="irl-eyebrow">PRIVATE IRL INBOX</span><h2>{inbox?.plan.title || 'IRL Inbox'}</h2></div><button type="button" aria-label="Close inbox" onClick={() => setInboxPlanId(null)}>×</button></div>
        <p>📅 {inbox?.plan.startsAt ? new Date(inbox.plan.startsAt).toLocaleString() : ''} · 📍 {inbox?.plan.place || 'Location TBD'}</p>
        {(inbox?.plan.meetupUrl || (inbox?.plan.meetupLat != null && inbox?.plan.meetupLng != null)) && <p><a className="irl-primary" href={inbox!.plan.meetupUrl || mapsUrl(inbox!.plan.meetupLat!, inbox!.plan.meetupLng!)} target="_blank" rel="noopener noreferrer">🧭 Open directions in Google Maps</a></p>}
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
