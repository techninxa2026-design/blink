import { useEffect, useState, type FormEvent } from 'react';
import { SOCIAL_API_URL as API_URL, socialAvatar } from './blinkSocialApi';
import './MomentActions.css';

type Comment = {
  id: string; authorId: string; body: string; createdAt: string;
  author: { id: string; name: string; avatarKey: string | null };
};
type Activity = {
  comments: Comment[]; commentCount: number; bpTotal: number; myBalance: number;
};
type Friend = { id: string; name: string; avatarKey: string | null };

function token() {
  return localStorage.getItem('blink-access-token') ||
    sessionStorage.getItem('blink-access-token');
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const accessToken = token();
  if (!accessToken) throw new Error('Please sign in again.');
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  let data: unknown;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'message' in data
      ? (data as { message: string | string[] }).message : undefined;
    throw new Error(Array.isArray(message) ? message.join(' ') :
      message || `Request failed (${response.status}).`);
  }
  return data as T;
}

export default function MomentActions({
  momentId, caption, currentUserId,
}: {
  momentId: string; caption: string; currentUserId?: string;
}) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [giftAmount, setGiftAmount] = useState(5);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [friendId, setFriendId] = useState('');
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState('');

  async function refresh() {
    const result = await request<Activity>(`/moments/${encodeURIComponent(momentId)}/activity`);
    setActivity(result);
  }

  useEffect(() => {
    let active = true;
    setActivity(null); setLoading(true); setError(''); setComment('');
    void request<Activity>(`/moments/${encodeURIComponent(momentId)}/activity`)
      .then(data => { if (active) setActivity(data); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load activity.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [momentId]);

  async function addComment(event: FormEvent) {
    event.preventDefault();
    if (!comment.trim() || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`/moments/${encodeURIComponent(momentId)}/comments`, 'POST', { body: comment.trim() });
      setComment('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comment failed.');
    } finally { setBusy(false); }
  }

  async function giftBp() {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`/moments/${encodeURIComponent(momentId)}/bp`, 'POST', { amount: giftAmount });
      await refresh();
      setNotice(`${giftAmount} BP delivered.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'BP transfer failed.');
    } finally { setBusy(false); }
  }

  async function removeComment(id: string) {
    setBusy(true); setError('');
    try {
      await request(`/moments/comments/${encodeURIComponent(id)}`, 'DELETE');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove comment.');
    } finally { setBusy(false); }
  }

  async function openShare() {
    setSharing(true); setFriends(null); setError(''); setFriendId('');
    try {
      setFriends(await request<Friend[]>('/inbox/friends'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load friends.');
      setSharing(false);
    }
  }

  async function sendToInbox() {
    if (!friendId || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const conversation = await request<{ conversationId: string }>(
        '/inbox/conversations', 'POST', { friendId },
      );
      // Only real friends can be messaged; the Inbox server enforces
      // friendship and blocking on both requests.
      const link = `${window.location.origin}/home?moment=${encodeURIComponent(momentId)}`;
      await request(
        `/inbox/conversations/${encodeURIComponent(conversation.conversationId)}/messages`,
        'POST',
        { body: `📸 Blink Moment shared\n${caption ? caption.slice(0, 180) + '\n' : ''}${link}` },
      );
      setSharing(false); setNotice('Shared to your friend’s Inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share this Moment.');
    } finally { setBusy(false); }
  }

  return (
    <aside className="moment-interactions" aria-label="Moment interactions">
      <div className="mi-summary">
        <strong>Connect with this Moment</strong>
        <span>🧡 {activity?.bpTotal ?? 0} BP · 💬 {activity?.commentCount ?? 0}</span>
      </div>
      {loading && <p className="mi-muted">Loading activity…</p>}
      {error && <p role="alert" className="mi-error">{error}</p>}
      {notice && <p role="status" className="mi-success">{notice}</p>}

      {activity && (
        <>
          <div className="mi-gift">
            <div className="mi-gift-head"><strong>Gift Blink Points</strong><span>Balance: {activity.myBalance} BP</span></div>
            <div className="mi-gift-actions">
              <select aria-label="Gift amount" value={giftAmount} onChange={e => setGiftAmount(Number(e.target.value))}>
                {[1, 5, 10, 25, 50, 100].map(n => <option key={n} value={n}>{n} BP</option>)}
              </select>
              <button type="button" disabled={busy || activity.myBalance < giftAmount} onClick={() => void giftBp()}>
                Give BP 🧡
              </button>
            </div>
          </div>
          <div className="mi-comments">
            <strong>Comments ({activity.commentCount})</strong>
            <div className="mi-comment-list" aria-label="Recent comments">
              {activity.comments.length === 0 && <p className="mi-muted">Be the first to comment.</p>}
              {activity.comments.map(item => (
                <div className="mi-comment" key={item.id}>
                  <span className="mi-avatar">
                    {item.author.avatarKey ? <img src={socialAvatar(item.author.avatarKey) ?? undefined} alt="" /> : item.author.name[0]?.toUpperCase()}
                  </span>
                  <div><strong>{item.author.name}</strong><p>{item.body}</p></div>
                  {item.authorId === currentUserId && (
                    <button type="button" className="mi-delete" disabled={busy} onClick={() => void removeComment(item.id)} aria-label="Delete comment">×</button>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={e => void addComment(e)}>
              <input aria-label="Write a comment" placeholder="Write a comment…" maxLength={500} value={comment} onChange={e => setComment(e.target.value)} />
              <button disabled={busy || !comment.trim()} type="submit">Post</button>
            </form>
          </div>
        </>
      )}
      <div className="mi-share">
        {!sharing ? (
          <button type="button" onClick={() => void openShare()} disabled={busy}>↗ Share in Inbox</button>
        ) : (
          <div className="mi-share-form">
            <strong>Share with a friend</strong>
            {!friends ? <p className="mi-muted">Loading friends…</p> : friends.length === 0
              ? <p className="mi-muted">Add a connection before sharing Moments.</p>
              : <select value={friendId} aria-label="Select a friend" onChange={e => setFriendId(e.target.value)}>
                <option value="">Choose a friend</option>
                {friends.map(friend => <option key={friend.id} value={friend.id}>{friend.name}</option>)}
              </select>}
            <div><button type="button" onClick={() => setSharing(false)}>Cancel</button>
              <button type="button" disabled={!friendId || busy} onClick={() => void sendToInbox()}>{busy ? 'Sending…' : 'Send Moment'}</button></div>
          </div>
        )}
      </div>
    </aside>
  );
}
