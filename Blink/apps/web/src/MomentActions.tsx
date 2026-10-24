
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import './MomentActions.css';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMOJIS = ['❤️', '🧡', '😂', '😮', '🔥', '👏'];
const BP_AMOUNTS = [1, 5, 10, 25, 50, 100];

type Comment = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  parentId?: string | null;
  deletedAt?: string | null;
  replies?: Comment[];
  author: { id: string; name: string; avatarKey?: string | null };
};

type Activity = {
  comments: Comment[];
  commentCount: number;
  bpTotal: number;
  myBalance: number;
  reactionTotal?: number;
  reactionCounts?: Record<string, number>;
  myReaction?: string | null;
};

type Friend = { id: string; name: string; avatarKey: string | null };
type Panel = 'comments' | 'bp' | 'share' | null;
type ReplyTarget = { id: string; name: string };

type Props = {
  momentId: string;
  caption: string;
  currentUserId?: string;
  momentOwnerId?: string;
  onOpenProfile?: (id: string) => void;
  onBpTransferred?: () => void;
  onShowViewers?: () => void;
};

function token(): string | null {
  return (
    localStorage.getItem('blink-access-token') ||
    sessionStorage.getItem('blink-access-token')
  );
}

function avatar(key?: string | null): string {
  if (!key) return '';
  return /^https?:\/\//i.test(key)
    ? key
    : `${API}${key.startsWith('/') ? key : `/uploads/${encodeURIComponent(key)}`}`;
}

function since(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d`;
  return new Date(value).toLocaleDateString();
}

function normalizeActivity(value: Activity): Activity {
  return {
    ...value,
    comments: Array.isArray(value.comments) ? value.comments : [],
    commentCount: Number(value.commentCount ?? 0),
    bpTotal: Number(value.bpTotal ?? 0),
    myBalance: Number(value.myBalance ?? 0),
    reactionTotal: Number(value.reactionTotal ?? 0),
    reactionCounts: value.reactionCounts ?? {},
    myReaction: value.myReaction ?? null,
  };
}

async function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const jwt = token();
  if (!jwt) throw new Error('Please sign in again.');

  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // If the API sends non-JSON, report its HTTP status below.
  }

  if (!response.ok) {
    const details = data as { message?: string | string[] } | null;
    const message = Array.isArray(details?.message)
      ? details.message.join(', ')
      : details?.message;
    throw new Error(message || `Request failed (${response.status})`);
  }

  return data as T;
}

export default function MomentActions({
  momentId,
  caption,
  currentUserId,
  momentOwnerId,
  onOpenProfile,
  onBpTransferred,
  onShowViewers,
}: Props) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [collapsedThreads, setCollapsedThreads] = useState<Record<string, boolean>>({});
  const [giftAmount, setGiftAmount] = useState(5);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendId, setFriendId] = useState('');
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const commentInputRef = useRef<HTMLInputElement>(null);

  async function refresh(): Promise<void> {
    const data = await request<Activity>(`/moments/${encodeURIComponent(momentId)}/activity`);
    setActivity(normalizeActivity(data));
  }

  useEffect(() => {
    let active = true;
    setActivity(null);
    setPanel(null);
    setShowEmojis(false);
    setComment('');
    setReplyTo(null);
    setCollapsedThreads({});
    setLoading(true);
    setError('');
    setNotice('');

    void request<Activity>(`/moments/${encodeURIComponent(momentId)}/activity`)
      .then((data) => {
        if (active) setActivity(normalizeActivity(data));
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load activity.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [momentId]);

  function openPanel(next: Panel): void {
    setPanel(next);
    setShowEmojis(false);
    setError('');
    setNotice('');
  }

  function startReply(rootId: string, name: string): void {
    setReplyTo({ id: rootId, name });
    setError('');
    commentInputRef.current?.focus();
  }

  async function react(emoji: string): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await request(`/moments/${encodeURIComponent(momentId)}/react`, 'POST', { emoji });
      await refresh();
      setShowEmojis(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reaction failed.');
    } finally {
      setBusy(false);
    }
  }

  async function postComment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const text = comment.trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    try {
      await request(`/moments/${encodeURIComponent(momentId)}/comments`, 'POST', {
        body: text,
        ...(replyTo ? { parentId: replyTo.id } : {}),
      });
      setComment('');
      setReplyTo(null);
      await refresh();
      commentInputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post comment.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(id: string): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await request(`/moments/comments/${encodeURIComponent(id)}`, 'DELETE');
      await refresh();
      if (replyTo?.id === id) setReplyTo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete comment.');
    } finally {
      setBusy(false);
    }
  }

  async function sendBp(): Promise<void> {
    if (busy || momentOwnerId === currentUserId) return;
    setBusy(true);
    setError('');
    try {
      await request(`/moments/${encodeURIComponent(momentId)}/bp`, 'POST', { amount: giftAmount });
      await refresh();
      onBpTransferred?.();
      setNotice(`${giftAmount} BP sent successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send BP.');
    } finally {
      setBusy(false);
    }
  }

  async function openShare(): Promise<void> {
    openPanel('share');
    setFriends([]);
    setFriendId('');
    setFriendsLoading(true);
    try {
      setFriends(await request<Friend[]>('/inbox/friends'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load friends.');
    } finally {
      setFriendsLoading(false);
    }
  }

  async function sendToInbox(): Promise<void> {
    if (!friendId || busy) return;
    setBusy(true);
    setError('');
    try {
      const conversation = await request<{ conversationId: string }>(
        '/inbox/conversations', 'POST', { friendId },
      );
      const link = `${window.location.origin}/home?moment=${encodeURIComponent(momentId)}`;
      await request(
        `/inbox/conversations/${encodeURIComponent(conversation.conversationId)}/messages`,
        'POST',
        { body: `📸 Blink Moment shared\n${caption ? `${caption.slice(0, 180)}\n` : ''}${link}` },
      );
      setPanel(null);
      setNotice('Moment shared to Inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to share Moment.');
    } finally {
      setBusy(false);
    }
  }

  function renderComment(item: Comment, rootId: string, isReply = false) {
    const deleted = Boolean(item.deletedAt) || item.body === '[deleted]';
    const visibleReplies = (item.replies ?? []).filter(
      (reply) => !reply.deletedAt && reply.body !== '[deleted]',
    );
    if (deleted && visibleReplies.length === 0) return null;

    const expanded = !collapsedThreads[item.id];
    return (
      <div
        className={`bma-thread${isReply ? ' bma-thread-nested' : ''}`}
        key={item.id}
      >
        <article className="bma-comment">
          {deleted ? (
            <div className="bma-avatar bma-avatar-deleted" aria-hidden="true">–</div>
          ) : (
            <button
              type="button"
              className="bma-avatar"
              title={`View ${item.author.name}'s profile`}
              onClick={() => onOpenProfile?.(item.authorId)}
            >
              {item.author.avatarKey ? (
                <img src={avatar(item.author.avatarKey)} alt="" />
              ) : (
                item.author.name?.[0]?.toUpperCase() ?? 'B'
              )}
            </button>
          )}

          <div className="bma-comment-main">
            <div className={`bma-comment-bubble${deleted ? ' is-deleted' : ''}`}>
              <strong className="bma-comment-name">
                {deleted ? 'Deleted comment' : item.author.name}
              </strong>
              <p className="bma-comment-body">
                {deleted ? 'This comment was deleted.' : item.body}
              </p>
            </div>
            {!deleted && (
              <div className="bma-comment-actions">
                <span className="bma-comment-time">{since(item.createdAt)}</span>
                <button type="button" onClick={() => startReply(rootId, item.author.name)}>
                  Reply
                </button>
                {item.authorId === currentUserId && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void deleteComment(item.id)}
                    aria-label="Delete your comment"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </article>

        {visibleReplies.length > 0 && !isReply && (
          <div className="bma-replies-wrap">
            <button
              type="button"
              className="bma-toggle-replies"
              onClick={() => setCollapsedThreads((current) => ({
                ...current,
                [item.id]: !current[item.id],
              }))}
              aria-expanded={expanded}
            >
              <span aria-hidden="true">↳</span>
              {expanded
                ? `Hide ${visibleReplies.length} ${visibleReplies.length === 1 ? 'reply' : 'replies'}`
                : `View ${visibleReplies.length} ${visibleReplies.length === 1 ? 'reply' : 'replies'}`}
            </button>
            {expanded && (
              <div className="bma-replies">
                {visibleReplies.map((reply) => renderComment(reply, item.id, true))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const myReaction = activity?.myReaction ?? null;
  const reactionTotal = activity?.reactionTotal ?? 0;
  const threads = activity?.comments.filter(
    (item) => (!item.deletedAt && item.body !== '[deleted]') ||
      (item.replies ?? []).some((reply) => !reply.deletedAt && reply.body !== '[deleted]'),
  ) ?? [];

  return createPortal(
    <div className="bma-root">
      <div className="bma-rail" aria-label="Moment actions">
        {onShowViewers && currentUserId && currentUserId === momentOwnerId && (
          <button type="button" className="bma-action bma-viewers-action"
            title="See who viewed this Moment" aria-label="View Moment viewers"
            onClick={onShowViewers}>
            <span className="bma-icon" aria-hidden="true">👥</span>
            <small>Viewers</small>
          </button>
        )}
        <button
          type="button"
          className={`bma-action${myReaction === '❤️' ? ' active' : ''}`}
          disabled={busy}
          onClick={() => void react('❤️')}
          title="Like Moment"
        >
          <span className="bma-icon">{myReaction === '❤️' ? '❤️' : '♡'}</span>
          <small>{loading ? '…' : reactionTotal}</small>
        </button>

        <div className="bma-reaction-wrap">
          <button
            type="button"
            className="bma-action"
            title="React to Moment"
            aria-expanded={showEmojis}
            onClick={() => {
              setShowEmojis((value) => !value);
              setPanel(null);
            }}
          >
            <span className="bma-icon">{myReaction && myReaction !== '❤️' ? myReaction : '😊'}</span>
            <small>React</small>
          </button>
          {showEmojis && (
            <div className="bma-emojis" role="group" aria-label="Choose a reaction">
              {EMOJIS.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  disabled={busy}
                  className={myReaction === emoji ? 'selected' : ''}
                  onClick={() => void react(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button" className="bma-action" title="Comments" onClick={() => openPanel('comments')}>
          <span className="bma-icon">💬</span>
          <small>{activity?.commentCount ?? 0}</small>
        </button>
        <button type="button" className="bma-action" title="Give Blink Points" onClick={() => openPanel('bp')}>
          <span className="bma-icon">🧡</span>
          <small>BP</small>
        </button>
        <button type="button" className="bma-action" title="Share to Inbox" onClick={() => void openShare()}>
          <span className="bma-icon">↗</span>
          <small>Share</small>
        </button>
      </div>

      {(error || notice) && !panel && (
        <div className="bma-message" role={error ? 'alert' : 'status'}>
          <span>{error || notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => { setError(''); setNotice(''); }}>×</button>
        </div>
      )}

      {panel && (
        <>
          <button type="button" className="bma-backdrop" aria-label="Close panel" onClick={() => setPanel(null)} />
          <section className="bma-panel" role="dialog" aria-modal="true" aria-label="Moment interaction panel">
            <header className="bma-panel-header">
              <div>
                <span>BLINK MOMENTS</span>
                <h2>{panel === 'comments'
                  ? `Comments (${activity?.commentCount ?? 0})`
                  : panel === 'bp'
                    ? 'Give Blink Points'
                    : 'Share Moment'}</h2>
              </div>
              <button type="button" className="bma-close" aria-label="Close panel" onClick={() => setPanel(null)}>×</button>
            </header>

            {error && <p className="bma-error" role="alert">{error}</p>}
            {notice && <p className="bma-notice" role="status">{notice}</p>}

            {panel === 'comments' && (
              <>
                <div className="bma-comments">
                  {loading ? (
                    <p className="bma-loading">Loading comments…</p>
                  ) : threads.length === 0 ? (
                    <div className="bma-empty"><span>💬</span><strong>No comments yet</strong><p>Start the conversation!</p></div>
                  ) : (
                    threads.map((item) => renderComment(item, item.id))
                  )}
                </div>

                {replyTo && (
                  <div className="bma-replying-to">
                    <span>Replying to <strong>{replyTo.name}</strong></span>
                    <button type="button" onClick={() => setReplyTo(null)}>Cancel</button>
                  </div>
                )}

                <form className="bma-compose" onSubmit={(event) => void postComment(event)}>
                  <input
                    ref={commentInputRef}
                    value={comment}
                    maxLength={500}
                    aria-label={replyTo ? `Reply to ${replyTo.name}` : 'Write a comment'}
                    placeholder={replyTo ? `Reply to ${replyTo.name}…` : 'Write a comment…'}
                    onChange={(event) => setComment(event.target.value)}
                  />
                  <button type="submit" disabled={busy || !comment.trim()}>
                    {busy ? 'Posting…' : replyTo ? 'Reply' : 'Post'}
                  </button>
                </form>
              </>
            )}

            {panel === 'bp' && (
              <div className="bma-content">
                <div className="bma-large-emoji">🧡</div>
                <p>Appreciate this Moment by sending Blink Points.</p>
                <div className="bma-balance">Your balance <strong>{Number(activity?.myBalance ?? 0).toFixed(1)} BP</strong></div>
                <div className="bma-bp-options">
                  {BP_AMOUNTS.map((amount) => (
                    <button
                      type="button"
                      key={amount}
                      className={giftAmount === amount ? 'selected' : ''}
                      onClick={() => setGiftAmount(amount)}
                    >
                      {amount} BP
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="bma-primary"
                  disabled={busy || !activity || momentOwnerId === currentUserId || Number(activity.myBalance) < giftAmount}
                  onClick={() => void sendBp()}
                >
                  Send {giftAmount} BP
                </button>
              </div>
            )}

            {panel === 'share' && (
              <div className="bma-content">
                <div className="bma-large-emoji">↗</div>
                <p>Share this Moment with your connections.</p>
                {friendsLoading ? (
                  <p>Loading friends…</p>
                ) : friends.length === 0 ? (
                  <p>No friends available for sharing.</p>
                ) : (
                  <>
                    <select aria-label="Select friend" value={friendId} onChange={(event) => setFriendId(event.target.value)}>
                      <option value="">Choose a friend</option>
                      {friends.map((friend) => <option key={friend.id} value={friend.id}>{friend.name}</option>)}
                    </select>
                    <button type="button" className="bma-primary" disabled={!friendId || busy} onClick={() => void sendToInbox()}>
                      {busy ? 'Sending…' : 'Share to Inbox →'}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>,
    document.body,
  );
}
