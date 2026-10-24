import { useEffect, useState, type FormEvent } from 'react';
import './BusinessMatchPage.css';

type DashboardPath = '/creator-dashboard' | '/business-dashboard';
type Props = {
  onBack: () => void;
  onOpenDashboard: (path: DashboardPath) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  initialView?: 'match' | 'settings';
};
type ProfileType = 'PROFESSIONAL' | 'COMPANY';
type Profile = {
  id: string; type: ProfileType; name: string; headline: string; industry: string;
  location: string; skills: string; about: string; lookingFor: string;
  active?: boolean;
};
type Draft = Omit<Profile, 'id' | 'active'>;
type BusinessRequest = { id: string; direction: 'incoming' | 'outgoing'; status: string; profile: Profile };
type ChatMessage = { id: string; senderId: string; text: string; createdAt: string };
type BusinessMeeting = { id: string; connectionId: string; title: string; agenda: string; location: string; startsAt: string; endsAt: string; status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELED'; role: 'organizer' | 'attendee'; counterpartName: string };
type BusinessConnection = { id: string; profile: Profile };
const blank: Draft = { type: 'PROFESSIONAL', name: '', headline: '', industry: '', location: '', skills: '', about: '', lookingFor: '' };
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
function token() { return localStorage.getItem('blink-access-token') || sessionStorage.getItem('blink-access-token'); }
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const jwt = token();
  if (!jwt) throw new Error('Please sign in again.');
  let response: Response;
  try {
    response = await fetch(`${API_URL}/business-match${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${jwt}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
  } catch { throw new Error('Could not reach the Blink API. Check that the backend is running.'); }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body = data as { message?: string | string[] } | null;
    const detail = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    throw new Error(detail || `Request failed (${response.status}).`);
  }
  return data as T;
}
function toDraft(profile: Profile): Draft {
  return { type: profile.type, name: profile.name, headline: profile.headline, industry: profile.industry,
    location: profile.location, skills: profile.skills, about: profile.about, lookingFor: profile.lookingFor };
}
export default function BusinessMatchPage({
  onBack, onOpenDashboard, theme, onToggleTheme, initialView = 'match',
}: Props) {
  const [view, setView] = useState<'match' | 'settings'>(initialView);
  const [tab, setTab] = useState<'discover' | 'connections' | 'chats' | 'meetings'>('discover');
  const [draft, setDraft] = useState<Draft>(blank);
  const [saved, setSaved] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | ProfileType>('all');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [page, setPage] = useState(1);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [requests, setRequests] = useState<BusinessRequest[]>([]);
  const [connections, setConnections] = useState<BusinessConnection[]>([]);
  const [meetings, setMeetings] = useState<BusinessMeeting[]>([]);
  const [meetingConnection, setMeetingConnection] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingAgenda, setMeetingAgenda] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [meetingStart, setMeetingStart] = useState('');
  const [meetingEnd, setMeetingEnd] = useState('');
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [meetingError, setMeetingError] = useState('');
  const [meetingVersion, setMeetingVersion] = useState(0);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatHasOlder, setChatHasOlder] = useState(false);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [relationBusy, setRelationBusy] = useState(false);
  const [relationVersion, setRelationVersion] = useState(0);
  useEffect(() => {
    if (!saved?.active || view !== 'match' || tab !== 'meetings') return;
    let alive = true;
    api<BusinessMeeting[]>('/meetings').then(data => { if (alive) setMeetings(data); })
      .catch(err => { if (alive) setMeetingError(err instanceof Error ? err.message : 'Could not load meetings.'); });
    return () => { alive = false; };
  }, [saved?.active, view, tab, meetingVersion]);

  async function createMeeting(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMeetingError(''); setMeetingBusy(true);
    try {
      await api('/meetings', { method: 'POST', body: JSON.stringify({ connectionId: meetingConnection, title: meetingTitle,
        agenda: meetingAgenda, location: meetingLocation, startsAt: new Date(meetingStart).toISOString(), endsAt: new Date(meetingEnd).toISOString() }) });
      setMeetingTitle(''); setMeetingAgenda(''); setMeetingLocation(''); setMeetingStart(''); setMeetingEnd('');
      setMeetingVersion(v => v + 1);
    } catch (err) { setMeetingError(err instanceof Error ? err.message : 'Could not schedule meeting.'); }
    finally { setMeetingBusy(false); }
  }
  async function changeMeeting(id: string, action: 'accept' | 'decline' | 'cancel') {
    setMeetingBusy(true); setMeetingError('');
    try { await api(`/meetings/${encodeURIComponent(id)}/${action}`, { method: 'PATCH' }); setMeetingVersion(v => v + 1); }
    catch (err) { setMeetingError(err instanceof Error ? err.message : 'Could not update meeting.'); }
    finally { setMeetingBusy(false); }
  }
  useEffect(() => {
    if (!saved?.active || view !== 'match') return;
    let alive = true;
    setRelationsLoading(true);
    Promise.all([api<BusinessRequest[]>('/requests'), api<BusinessConnection[]>('/connections')])
      .then(([r, c]) => { if (alive) { setRequests(r); setConnections(c); } })
      .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'Could not load connections.'); })
      .finally(() => { if (alive) setRelationsLoading(false); });
    return () => { alive = false; };
  }, [saved?.active, view, relationVersion]);
  useEffect(() => {
    if (tab !== 'chats' || !saved?.active || !chatId) return;
    let alive = true;
    const load = async () => {
      try {
        const rows = await api<ChatMessage[]>(`/chats/${encodeURIComponent(chatId)}/messages`);
        if (alive) { setChatMessages(rows); setChatHasOlder(rows.length === 30); setChatError(''); }
      } catch (err) { if (alive) setChatError(err instanceof Error ? err.message : 'Chat unavailable.'); }
      finally { if (alive) setChatLoading(false); }
    };
    setChatLoading(true);
    void load();
    const interval = window.setInterval(() => { void load(); }, 5000);
    return () => { alive = false; window.clearInterval(interval); };
  }, [tab, saved?.active, chatId]);
  async function sendChat(e: FormEvent) {
    e.preventDefault();
    if (!chatId || !chatDraft.trim() || chatBusy) return;
    setChatBusy(true); setChatError('');
    try {
      const row = await api<ChatMessage>(`/chats/${encodeURIComponent(chatId)}/messages`, { method: 'POST', body: JSON.stringify({ text: chatDraft.trim() }) });
      setChatMessages(old => old.some(m => m.id === row.id) ? old : [...old, row]);
      setChatDraft('');
    } catch (err) { setChatError(err instanceof Error ? err.message : 'Message not sent.'); }
    finally { setChatBusy(false); }
  }
  async function loadOlderChat() {
    if (!chatId || !chatMessages.length || chatLoading) return;
    setChatLoading(true);
    try {
      const rows = await api<ChatMessage[]>(`/chats/${encodeURIComponent(chatId)}/messages?before=${encodeURIComponent(chatMessages[0].id)}`);
      setChatMessages(old => [...rows.filter(m => !old.some(o => o.id === m.id)), ...old]);
      setChatHasOlder(rows.length === 30);
    } catch (err) { setChatError(err instanceof Error ? err.message : 'Could not load older messages.'); }
    finally { setChatLoading(false); }
  }
  async function relationAction(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: object) {
    if (relationBusy) return;
    setRelationBusy(true); setError(''); setMessage('');
    try {
      await api(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      setRelationVersion(v => v + 1);
      setSelected(null);
      setMessage('Business connection updated.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update connection.'); }
    finally { setRelationBusy(false); }
  }
  function connectionStatus(profileId: string) {
    if (connections.some(c => c.profile.id === profileId)) return 'connected';
    return requests.find(r => r.profile.id === profileId)?.direction ?? null;
  }
  useEffect(() => { setView(initialView); }, [initialView]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<Profile | null>('/me').then(profile => {
      if (!alive) return;
      setSaved(profile);
      setDraft(profile ? toDraft(profile) : blank);
      setError('');
    }).catch(err => { if (alive) setError(err instanceof Error ? err.message : 'Could not load profile.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (view !== 'match' || tab !== 'discover' || !saved?.active) return;
    let alive = true;
    setDirectoryLoading(true);
    setDirectoryError('');
    const params = new URLSearchParams({ page: String(page) });
    if (query.trim()) params.set('q', query.trim());
    if (filter !== 'all') params.set('type', filter);
    // Debounce typing; stale responses are ignored on cleanup.
    const timer = window.setTimeout(() => {
      api<Profile[]>(`/discover?${params.toString()}`).then(result => {
        if (!alive) return;
        setProfiles(previous => page === 1 ? result : [...previous, ...result.filter(p => !previous.some(old => old.id === p.id))]);
        setHasMore(result.length === 20);
      }).catch(err => { if (alive) setDirectoryError(err instanceof Error ? err.message : 'Could not load directory.'); })
        .finally(() => { if (alive) setDirectoryLoading(false); });
    }, page === 1 ? 250 : 0);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [view, tab, saved?.active, page, query, filter]);
  function changeSearch(value: string) { setQuery(value); setPage(1); setProfiles([]); setHasMore(false); }
  function changeFilter(value: 'all' | ProfileType) { setFilter(value); setPage(1); setProfiles([]); setHasMore(false); }
  function update<K extends keyof Draft>(field: K, value: Draft[K]) { setDraft(old => ({ ...old, [field]: value })); setMessage(''); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); setError('');
    try {
      const profile = await api<Profile>('/me', { method: 'PUT', body: JSON.stringify(draft) });
      setSaved(profile); setDraft(toDraft(profile)); setMessage('Business Profile saved to Blink.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save profile.'); }
    finally { setBusy(false); }
  }
  async function toggleActive() {
    if (!saved || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const profile = await api<Profile>('/me/activation', { method: 'PATCH', body: JSON.stringify({ active: !saved.active }) });
      setSaved(profile); setDraft(toDraft(profile));
      setProfiles([]); setPage(1); setSelected(null);
      setMessage(profile.active ? 'Your Business Profile is active and discoverable.' : 'Your Business Profile is now hidden from discovery.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not change activation.'); }
    finally { setBusy(false); }
  }
  async function openProfile(id: string) {
    setSelectedLoading(true); setError('');
    try { setSelected(await api<Profile>(`/profiles/${encodeURIComponent(id)}`)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load public profile.'); }
    finally { setSelectedLoading(false); }
  }
  function settings() { setView('settings'); setMessage(''); setSelected(null); }
  return <main className="bm-page" data-bm-theme={theme}>
    <header className="bm-topbar"><button className="bm-back" type="button" onClick={onBack}>← Back to Blink</button><img src="/blink-logo.png" alt="Blink" className="bm-logo"/><button type="button" className="bm-theme" onClick={onToggleTheme}>{theme === 'light' ? '☾ Dark mode' : '☀ Light mode'}</button></header>
    <div className="bm-container">
      <div className="bm-utility"><span className="bm-eyebrow">BLINK / Blink Business</span><div className="bm-utility-links"><button type="button" className={view === 'match' ? 'bm-link active' : 'bm-link'} onClick={() => { setView('match'); setMessage(''); }}>Blink Business</button><button type="button" className={view === 'settings' ? 'bm-link active' : 'bm-link'} onClick={settings}>⚙ Business Profile Settings</button></div></div>
      {error && <p className="bm-notice bm-error" role="alert">{error}</p>}
      {message && <p className="bm-notice" role="status">{message}</p>}
      {loading ? <section className="bm-card bm-empty"><h2>Loading your Business Profile…</h2></section> : view === 'settings' ? <>
        <section className="bm-heading"><span className="bm-eyebrow">SETTINGS / BUSINESS PROFILE</span><h1>Build your business identity.</h1><p>Your Business Profile is stored securely in Blink and becomes visible to other activated members when you activate it.</p></section>
        <div className="bm-settings-grid"><section className="bm-card"><div className="bm-section-heading"><div><span className="bm-eyebrow">PROFILE DETAILS</span><h2>Business profile</h2></div><span className="bm-status">{saved ? 'Saved to Blink' : 'New profile'}</span></div>
          <form className="bm-form" onSubmit={save}><fieldset className="bm-type-fieldset"><legend>Profile type</legend><div className="bm-type-options"><label className={draft.type === 'PROFESSIONAL' ? 'bm-type selected' : 'bm-type'}><input type="radio" name="bm-type" checked={draft.type === 'PROFESSIONAL'} onChange={() => update('type', 'PROFESSIONAL')}/><strong>Individual Professional</strong><small>Freelancer, specialist, founder, consultant</small></label><label className={draft.type === 'COMPANY' ? 'bm-type selected' : 'bm-type'}><input type="radio" name="bm-type" checked={draft.type === 'COMPANY'} onChange={() => update('type', 'COMPANY')}/><strong>Business / Company</strong><small>Agency, studio, organization, startup</small></label></div></fieldset>
            <label>{draft.type === 'COMPANY' ? 'Business / company name' : 'Professional display name'}<input required maxLength={100} value={draft.name} onChange={e => update('name', e.target.value)}/></label>
            <label>Headline<input required maxLength={120} value={draft.headline} onChange={e => update('headline', e.target.value)}/></label>
            <div className="bm-form-row"><label>Industry<input required maxLength={80} value={draft.industry} onChange={e => update('industry', e.target.value)}/></label><label>City / region<input maxLength={100} value={draft.location} onChange={e => update('location', e.target.value)}/></label></div>
            <label>Skills / services (comma-separated)<input maxLength={240} value={draft.skills} onChange={e => update('skills', e.target.value)}/></label>
            <label>About<textarea rows={4} maxLength={600} value={draft.about} onChange={e => update('about', e.target.value)}/></label>
            <label>Looking for<textarea rows={3} maxLength={400} value={draft.lookingFor} onChange={e => update('lookingFor', e.target.value)}/></label>
            <button className="bm-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save Business Profile'}</button>
          </form></section>
          <aside className="bm-settings-side"><section className="bm-card"><span className="bm-eyebrow">PROFILE VISIBILITY</span><h2>Blink Business access</h2><p className="bm-muted">Only activated profiles can browse other activated profiles. Your account's activation is enforced by the server.</p><span className={saved?.active ? 'bm-activation on' : 'bm-activation'}>{saved?.active ? '● Active' : '○ Inactive'}</span><button className="bm-primary bm-full" type="button" disabled={busy || !saved} onClick={() => void toggleActive()}>{busy ? 'Updating…' : saved?.active ? 'Deactivate profile' : 'Activate profile'}</button>
          {saved && (
            <button
              type="button"
              className="bm-dashboard-link"
              disabled={busy || draft.type !== saved.type}
              onClick={() => onOpenDashboard(saved.type === 'PROFESSIONAL'
                ? '/creator-dashboard'
                : '/business-dashboard'
              )}
            >
              <span className="bm-dashboard-link-icon" aria-hidden="true">▦</span>
              <span>{saved.type === 'PROFESSIONAL' ? 'Creator Dashboard' : 'Business Dashboard'}</span>
              <span className="bm-dashboard-link-arrow" aria-hidden="true">→</span>
            </button>
          )}
          {saved && draft.type !== saved.type && (
            <p className="bm-muted bm-small">Save your changed profile type to open its dashboard.</p>
          )}{!saved && <p className="bm-muted bm-small">Save your profile first to enable activation.</p>}</section><section className="bm-card"><span className="bm-eyebrow">PROFILE PREVIEW</span><div className="bm-preview-avatar">{(draft.name.trim() || 'B').slice(0,1).toUpperCase()}</div><h3>{draft.name || 'Your name or business'}</h3><p>{draft.headline || 'Your professional headline'}</p><p className="bm-muted">{draft.industry || 'Industry'} · {draft.location || 'Location'}</p><p className="bm-muted">{draft.about || 'Your description will appear here.'}</p></section></aside></div>
      </> : !saved?.active ? <section className="bm-gate bm-card"><span className="bm-gate-icon">🤝</span><span className="bm-eyebrow">ACTIVATION REQUIRED</span><h1>Grow your network with Blink Business.</h1><p>Create and activate a Professional or Company profile to discover other active Blink Business members.</p><button className="bm-primary" type="button" onClick={settings}>Go to Business Profile Settings →</button></section> : <>
        <section className="bm-hero"><span className="bm-eyebrow">YOUR NEXT OPPORTUNITY STARTS HERE</span><h1>Find your next <span>business connection.</span></h1><p>Discover real, activated professionals and companies beyond your Blink friends list.</p><button type="button" className="bm-secondary" onClick={settings}>Manage business profile →</button></section>
        <nav className="bm-tabs" aria-label="Blink Business sections">{(['discover','connections','chats','meetings'] as const).map(item => <button type="button" key={item} className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setSelected(null); }}>{item[0].toUpperCase() + item.slice(1)}</button>)}</nav>
        {tab === 'discover' ? <><div className="bm-discover-tools"><label className="bm-search-label">Search profiles<input type="search" maxLength={100} value={query} onChange={e => changeSearch(e.target.value)} placeholder="Search name, industry, skills or city…"/></label><label className="bm-filter-label">Profile type<select value={filter} onChange={e => changeFilter(e.target.value as typeof filter)}><option value="all">All profiles</option><option value="PROFESSIONAL">Professionals</option><option value="COMPANY">Businesses</option></select></label></div><p className="bm-demo-note">LIVE DIRECTORY · Activated Business Profiles · Page {page}</p>{directoryError && <p role="alert" className="bm-notice bm-error">{directoryError} <button type="button" onClick={() => { setPage(1); setProfiles([]); setView('settings'); window.setTimeout(() => setView('match'), 0); }}>Retry</button></p>}<div className="bm-discover-grid">{profiles.map(item => <article className="bm-card bm-person" key={item.id}><div className="bm-person-top"><span className="bm-avatar">{item.name.slice(0,1).toUpperCase()}</span><span className="bm-kind">{item.type === 'COMPANY' ? 'Business' : 'Professional'}</span></div><h2>{item.name}</h2><p className="bm-person-headline">{item.headline}</p><p className="bm-muted bm-small">⌖ {item.location || 'Location not specified'} · {item.industry}</p><div className="bm-chips">{item.skills.split(',').map(s => s.trim()).filter(Boolean).map((skill, i) => <span key={i}>{skill}</span>)}</div><button type="button" className="bm-outline" disabled={selectedLoading} onClick={() => void openProfile(item.id)}>View business profile →</button></article>)}</div>{directoryLoading && <p className="bm-muted">Loading profiles…</p>}{!directoryLoading && !directoryError && profiles.length === 0 && <section className="bm-card bm-empty"><h2>No profiles found.</h2><p>Try another search or invite another Blink user to activate their Business Profile.</p></section>}{hasMore && !directoryLoading && !directoryError && <button className="bm-primary bm-load-more" type="button" onClick={() => setPage(p => p + 1)}>Load more profiles</button>}</> : tab === 'connections' ? <section className="bm-card bm-relations"><h2>Business connections</h2><p className="bm-muted">Requests and accepted connections are separate from Blink friendships.</p>{relationsLoading && <p>Loading connections…</p>}
          <h3>Incoming requests</h3>{requests.filter(r => r.direction === 'incoming').map(r => <div className="bm-relation-row" key={r.id}><div><strong>{r.profile.name}</strong><p className="bm-muted">{r.profile.headline}</p></div><div className="bm-relation-actions"><button className="bm-primary" disabled={relationBusy} onClick={() => void relationAction(`/requests/${encodeURIComponent(r.id)}`, 'PATCH', { accept: true })}>Accept</button><button className="bm-outline" disabled={relationBusy} onClick={() => void relationAction(`/requests/${encodeURIComponent(r.id)}`, 'PATCH', { accept: false })}>Decline</button></div></div>)}{!requests.some(r => r.direction === 'incoming') && <p className="bm-muted">No incoming requests.</p>}
          <h3>Sent requests</h3>{requests.filter(r => r.direction === 'outgoing').map(r => <div className="bm-relation-row" key={r.id}><div><strong>{r.profile.name}</strong><p className="bm-muted">Awaiting response</p></div><button className="bm-outline" disabled={relationBusy} onClick={() => void relationAction(`/requests/${encodeURIComponent(r.id)}`, 'DELETE')}>Cancel request</button></div>)}{!requests.some(r => r.direction === 'outgoing') && <p className="bm-muted">No pending sent requests.</p>}
          <h3>Connected profiles</h3>{connections.map(c => <div className="bm-relation-row" key={c.id}><div><strong>{c.profile.name}</strong><p className="bm-muted">{c.profile.headline}</p></div><button className="bm-outline" onClick={() => void openProfile(c.profile.id)}>View profile</button></div>)}{connections.length === 0 && <p className="bm-muted">No accepted business connections yet.</p>}</section> : tab === 'chats' ? <section className="bm-card bm-chat-section"><h2>Business chats</h2><p className="bm-muted">Private conversations with accepted Business Connections only. Separate from Blink Inbox.</p><div className="bm-chat-layout"><aside className="bm-chat-contacts">{connections.map(c => <button type="button" key={c.id} className={chatId === c.id ? 'bm-chat-contact active' : 'bm-chat-contact'} onClick={() => { setChatId(c.id); setChatMessages([]); setChatHasOlder(false); }}>{c.profile.name}</button>)}{connections.length === 0 && <p className="bm-muted">Connect with a business to start chatting.</p>}</aside><div className="bm-chat-conversation">{chatId ? <><h3>{connections.find(c => c.id === chatId)?.profile.name ?? 'Conversation'}</h3>{chatError && <p role="alert" className="bm-notice bm-error">{chatError}</p>}{chatHasOlder && <button type="button" className="bm-outline" disabled={chatLoading} onClick={() => void loadOlderChat()}>Load older messages</button>}<div className="bm-chat-messages" aria-live="polite">{chatMessages.map(m => <div key={m.id} className="bm-chat-bubble"><p>{m.text}</p><small>{new Date(m.createdAt).toLocaleString()}</small></div>)}{chatMessages.length === 0 && <p className="bm-muted">{chatLoading ? 'Loading messages…' : 'No messages yet.'}</p>}</div><form className="bm-chat-compose" onSubmit={sendChat}><label htmlFor="bm-chat-text">Message</label><textarea id="bm-chat-text" maxLength={2000} rows={2} value={chatDraft} onChange={e => setChatDraft(e.target.value)} placeholder="Write a business message…"/><button className="bm-primary" disabled={chatBusy || !chatDraft.trim()} type="submit">{chatBusy ? 'Sending…' : 'Send'}</button></form></> : <p className="bm-muted">Select a connection to open its private chat.</p>}</div></div></section> : <section className="bm-card bm-meetings"><h2>Business meetings</h2><p className="bm-muted">Invite accepted Business Connections to a meeting. All times are displayed in your local timezone.</p>
          {meetingError && <p role="alert" className="bm-notice bm-error">{meetingError}</p>}
          <form className="bm-meeting-form" onSubmit={e => void createMeeting(e)}>
            <label>Invite connection<select required value={meetingConnection} onChange={e => setMeetingConnection(e.target.value)}><option value="">Select connection</option>{connections.map(c => <option key={c.id} value={c.id}>{c.profile.name}</option>)}</select></label>
            <label>Meeting title<input required maxLength={120} value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} placeholder="Project discussion" /></label>
            <label>Start time<input required type="datetime-local" value={meetingStart} onChange={e => setMeetingStart(e.target.value)} /></label>
            <label>End time<input required type="datetime-local" value={meetingEnd} onChange={e => setMeetingEnd(e.target.value)} /></label>
            <label>Location or meeting link<input maxLength={300} value={meetingLocation} onChange={e => setMeetingLocation(e.target.value)} placeholder="Office, phone, or video link" /></label>
            <label>Agenda<textarea maxLength={1000} rows={3} value={meetingAgenda} onChange={e => setMeetingAgenda(e.target.value)} /></label>
            <button className="bm-primary" type="submit" disabled={meetingBusy || !meetingConnection || !meetingStart || !meetingEnd}>{meetingBusy ? 'Saving…' : 'Send meeting invitation'}</button>
          </form>
          <h3>Meeting invitations and schedule</h3>
          {meetings.length === 0 && <p className="bm-muted">No meetings scheduled yet.</p>}
          <div className="bm-meeting-list">{meetings.map(m => <article className="bm-meeting-item" key={m.id}><div><strong>{m.title}</strong><p className="bm-muted">With {m.counterpartName} · {new Date(m.startsAt).toLocaleString()} – {new Date(m.endsAt).toLocaleString()}</p><p>Status: <strong>{m.status}</strong> · {m.role === 'organizer' ? 'Sent invitation' : 'Received invitation'}</p>{m.location && <p>Location/link: {m.location}</p>}{m.agenda && <p>Agenda: {m.agenda}</p>}</div><div className="bm-meeting-actions">{m.role === 'attendee' && m.status === 'PENDING' && <><button type="button" className="bm-primary" disabled={meetingBusy} onClick={() => void changeMeeting(m.id, 'accept')}>Accept</button><button type="button" className="bm-outline" disabled={meetingBusy} onClick={() => void changeMeeting(m.id, 'decline')}>Decline</button></>}{m.role === 'organizer' && (m.status === 'PENDING' || m.status === 'ACCEPTED') && <button type="button" className="bm-outline" disabled={meetingBusy} onClick={() => void changeMeeting(m.id, 'cancel')}>Cancel</button>}</div></article>)}</div>
          </section>}
        {selected && <div className="bm-modal-backdrop" onClick={() => setSelected(null)}><section className="bm-modal bm-card" role="dialog" aria-modal="true" aria-label="Business profile" onClick={e => e.stopPropagation()}><button type="button" className="bm-modal-close" onClick={() => setSelected(null)} aria-label="Close">×</button><span className="bm-kind">{selected.type === 'COMPANY' ? 'Business' : 'Professional'}</span><h2>{selected.name}</h2><h3>{selected.headline}</h3><p className="bm-muted">{selected.industry} · {selected.location || 'Location not specified'}</p><p>{selected.about}</p>{selected.lookingFor && <p><strong>Looking for:</strong> {selected.lookingFor}</p>}<div className="bm-chips">{selected.skills.split(',').map(s => s.trim()).filter(Boolean).map((s,i) => <span key={i}>{s}</span>)}</div><button className="bm-primary" type="button" disabled={relationBusy || relationsLoading || !!connectionStatus(selected.id)} onClick={() => void relationAction('/requests', 'POST', { profileId: selected.id })}>{connectionStatus(selected.id) === 'connected' ? 'Connected' : connectionStatus(selected.id) === 'incoming' ? 'Respond in Connections tab' : connectionStatus(selected.id) === 'outgoing' ? 'Request pending' : relationBusy ? 'Sending…' : 'Send connection request'}</button></section></div>}
      </>}
      <p className="bm-footnote">BM-6 · Private business chats and meetings</p>
    </div>
  </main>;
}
