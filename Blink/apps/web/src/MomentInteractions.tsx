
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import './MomentActions.css';

const API = (
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const EMOJIS = [
  '❤️', '🧡', '😂', '😮', '🔥', '👏',
] as const;

type Emoji = (typeof EMOJIS)[number];
type Tab = 'comments' | 'bp' | 'share' | null;

type Comment = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatarKey?: string | null;
  };
};

type Activity = {
  comments: Comment[];
  commentCount: number;
  bpTotal: number;
  myBalance: number | string;
  reactionCounts: Record<string, number>;
  reactionTotal: number;
  myReaction: string | null;
};

type Friend = {
  id: string;
  name: string;
  avatarKey: string | null;
};

type Props = {
  momentId: string;
  caption: string;
  currentUserId?: string;
  momentOwnerId?: string;
  onOpenProfile?: (id: string) => void;
};

function getToken() {
  return (
    localStorage.getItem('blink-access-token') ||
    sessionStorage.getItem('blink-access-token')
  );
}

function mediaUrl(key?: string | null) {
  if (!key) return '';

  return /^https?:\/\//i.test(key)
    ? key
    : `${API}${
        key.startsWith('/')
          ? key
          : `/uploads/${encodeURIComponent(key)}`
      }`;
}

function since(date: string) {
  const time = new Date(date).getTime();

  if (!Number.isFinite(time)) return '';

  const mins = Math.max(
    0,
    Math.floor((Date.now() - time) / 60000),
  );

  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;

  return new Date(date).toLocaleDateString();
}

async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const access = getToken();

  if (!access) {
    throw new Error('Please sign in again.');
  }

  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${access}`,
      ...(body === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });

  const raw = await response.text();

  let data: any = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // Use HTTP status for malformed error responses.
  }

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message;

    throw new Error(
      message || `Request failed (${response.status}).`,
    );
  }

  return data as T;
}

export default function MomentActions({
  momentId,
  caption,
  currentUserId,
  momentOwnerId,
  onOpenProfile,
}: Props) {
  const [activity, setActivity] =
    useState<Activity | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [tab, setTab] = useState<Tab>(null);
  const [emojiPicker, setEmojiPicker] = useState(false);

  const [comment, setComment] = useState('');
  const [giftAmount, setGiftAmount] = useState(5);

  const [friends, setFriends] =
    useState<Friend[] | null>(null);

  const [friendId, setFriendId] = useState('');

  const refresh = useCallback(async () => {
    const data = await api<Activity>(
      `/moments/${encodeURIComponent(momentId)}/activity`,
    );

    setActivity({
      ...data,
      comments: Array.isArray(data.comments)
        ? data.comments
        : [],
      commentCount: Number(data.commentCount ?? 0),
      bpTotal: Number(data.bpTotal ?? 0),
      myBalance: Number(data.myBalance ?? 0),
      reactionCounts: data.reactionCounts ?? {},
      reactionTotal: Number(data.reactionTotal ?? 0),
      myReaction: data.myReaction ?? null,
    });
  }, [momentId]);

  useEffect(() => {
    let mounted = true;

    setActivity(null);
    setLoading(true);
    setError('');
    setNotice('');
    setTab(null);
    setEmojiPicker(false);

    void api<Activity>(
      `/moments/${encodeURIComponent(momentId)}/activity`,
    )
      .then((data) => {
        if (!mounted) return;

        setActivity({
          ...data,
          comments: Array.isArray(data.comments)
            ? data.comments
            : [],
          commentCount: Number(data.commentCount ?? 0),
          bpTotal: Number(data.bpTotal ?? 0),
          myBalance: Number(data.myBalance ?? 0),
          reactionCounts: data.reactionCounts ?? {},
          reactionTotal: Number(data.reactionTotal ?? 0),
          myReaction: data.myReaction ?? null,
        });
      })
      .catch((e) => {
        if (mounted) {
          setError(
            e instanceof Error
              ? e.message
              : 'Could not load Moment activity.',
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [momentId]);

  useEffect(() => {
    if (!tab && !emojiPicker) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTab(null);
        setEmojiPicker(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () =>
      window.removeEventListener('keydown', onKeyDown);
  }, [tab, emojiPicker]);

  // REAL EMOJI REACTIONS

  async function react(emoji: Emoji) {
    if (busy) return;

    setBusy(true);
    setError('');
    setNotice('');

    try {
      await api(
        `/moments/${encodeURIComponent(momentId)}/react`,
        'POST',
        { emoji },
      );

      await refresh();
      setEmojiPicker(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Reaction failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  // REAL COMMENTS

  async function postComment(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!comment.trim() || busy) return;

    setBusy(true);
    setError('');

    try {
      await api(
        `/moments/${encodeURIComponent(momentId)}/comments`,
        'POST',
        { body: comment.trim() },
      );

      setComment('');
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Comment could not be sent.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(id: string) {
    if (
      busy ||
      !window.confirm('Delete this comment?')
    ) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      await api(
        `/moments/comments/${encodeURIComponent(id)}`,
        'DELETE',
      );

      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Comment could not be deleted.',
      );
    } finally {
      setBusy(false);
    }
  }

  // EXISTING BP GIFT FEATURE

  async function giftBp() {
    if (busy) return;

    setBusy(true);
    setError('');
    setNotice('');

    try {
      await api(
        `/moments/${encodeURIComponent(momentId)}/bp`,
        'POST',
        { amount: giftAmount },
      );

      await refresh();

      setNotice(`${giftAmount} BP sent successfully!`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'BP gift failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  // EXISTING INBOX SHARING FEATURE

  async function openShare() {
    setTab('share');
    setEmojiPicker(false);
    setError('');
    setFriendId('');
    setFriends(null);

    try {
      setFriends(
        await api<Friend[]>('/inbox/friends'),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not load friends.',
      );
    }
  }

  async function shareMoment() {
    if (!friendId || busy) return;

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const conversation = await api<{
        conversationId: string;
      }>(
        '/inbox/conversations',
        'POST',
        { friendId },
      );

      const url =
        `${window.location.origin}/home?moment=` +
        encodeURIComponent(momentId);

      await api(
        `/inbox/conversations/${
          encodeURIComponent(conversation.conversationId)
        }/messages`,
        'POST',
        {
          body:
            `📸 Blink Moment shared\n` +
            (caption
              ? `${caption.slice(0, 180)}\n`
              : '') +
            url,
        },
      );

      setNotice('Moment shared to Inbox!');
      setTab(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Unable to share Moment.',
      );
    } finally {
      setBusy(false);
    }
  }

  const myReaction = activity?.myReaction;
  const balance = Number(activity?.myBalance ?? 0);

  return (
    <div className="bma-root">

      {/* FLOATING ACTIONS */}

      <div
        className="bma-rail"
        role="group"
        aria-label="Moment interactions"
      >
        <button
          type="button"
          className={`bma-action ${
            myReaction === '❤️' ? 'active' : ''
          }`}
          aria-label={
            myReaction === '❤️'
              ? 'Remove heart reaction'
              : 'React with heart'
          }
          aria-pressed={myReaction === '❤️'}
          disabled={busy}
          onClick={() => void react('❤️')}
        >
          <span className="bma-action-icon">
            {myReaction === '❤️' ? '❤️' : '♡'}
          </span>

          <span>
            {loading
              ? '…'
              : activity?.reactionTotal ?? 0}
          </span>
        </button>

        <div className="bma-picker-anchor">
          <button
            type="button"
            className="bma-action"
            aria-label="Choose a reaction"
            aria-expanded={emojiPicker}
            onClick={() => {
              setEmojiPicker(!emojiPicker);
              setTab(null);
            }}
          >
            <span className="bma-action-icon">
              {myReaction && myReaction !== '❤️'
                ? myReaction
                : '☺'}
            </span>

            <span>React</span>
          </button>

          {emojiPicker && (
            <div
              className="bma-emoji-picker"
              role="group"
              aria-label="Choose emoji reaction"
            >
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  disabled={busy}
                  aria-label={`React ${emoji}`}
                  aria-pressed={myReaction === emoji}
                  title={`${activity?.reactionCounts?.[emoji] ?? 0} reactions`}
                  className={
                    myReaction === emoji ? 'chosen' : ''
                  }
                  onClick={() => void react(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className={`bma-action ${
            tab === 'comments' ? 'active' : ''
          }`}
          aria-expanded={tab === 'comments'}
          aria-label="Open comments"
          onClick={() => {
            setTab('comments');
            setEmojiPicker(false);
          }}
        >
          <span className="bma-action-icon">💬</span>

          <span>
            {loading
              ? '…'
              : activity?.commentCount ?? 0}
          </span>
        </button>

        <button
          type="button"
          className="bma-action"
          aria-label="Gift Blink Points"
          aria-expanded={tab === 'bp'}
          onClick={() => {
            setTab('bp');
            setEmojiPicker(false);
          }}
        >
          <span className="bma-action-icon">🧡</span>
          <span>BP</span>
        </button>

        <button
          type="button"
          className="bma-action"
          aria-label="Share Moment to Inbox"
          aria-expanded={tab === 'share'}
          onClick={() => void openShare()}
        >
          <span className="bma-action-icon">↗</span>
          <span>Share</span>
        </button>
      </div>

      {/* NOTIFICATIONS */}

      {(error || notice) && !tab && (
        <div
          className={`bma-toast ${
            error ? 'error' : ''
          }`}
          role={error ? 'alert' : 'status'}
        >
          {error || notice}

          <button
            type="button"
            onClick={() => {
              setError('');
              setNotice('');
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* FLOATING PANEL */}

      {tab && (
        <>
          <button
            type="button"
            className="bma-backdrop"
            onClick={() => setTab(null)}
            aria-label="Close Moment panel"
          />

          <section
            className="bma-panel"
            role="dialog"
            aria-modal="true"
            aria-label={
              tab === 'comments'
                ? 'Moment comments'
                : tab === 'bp'
                  ? 'Gift Blink Points'
                  : 'Share Moment'
            }
          >
            <header className="bma-panel-header">
              <div>
                <span className="bma-eyebrow">
                  BLINK MOMENTS
                </span>

                <h2>
                  {tab === 'comments'
                    ? 'Comments'
                    : tab === 'bp'
                      ? 'Send some love'
                      : 'Share a Moment'}

                  {tab === 'comments' && (
                    <em>
                      {activity?.commentCount ?? 0}
                    </em>
                  )}
                </h2>
              </div>

              <button
                type="button"
                className="bma-close"
                onClick={() => setTab(null)}
                aria-label="Close panel"
              >
                ×
              </button>
            </header>

            {error && (
              <p className="bma-error" role="alert">
                {error}
              </p>
            )}

            {notice && (
              <p className="bma-notice" role="status">
                {notice}
              </p>
            )}

            {/* COMMENTS PANEL */}

            {tab === 'comments' && (
              <>
                <div
                  className="bma-comment-list"
                  aria-label="Moment comments"
                >
                  {loading && (
                    <p className="bma-muted">
                      Loading comments…
                    </p>
                  )}

                  {!loading &&
                    (activity?.comments.length ?? 0) === 0 && (
                      <div className="bma-empty">
                        <span>💬</span>

                        <strong>
                          Start the conversation
                        </strong>

                        <p>
                          Be the first to comment
                          on this Moment.
                        </p>
                      </div>
                    )}

                  {activity?.comments.map((item) => (
                    <article
                      className="bma-comment"
                      key={item.id}
                    >
                      <button
                        className="bma-avatar"
                        type="button"
                        onClick={() =>
                          onOpenProfile?.(item.authorId)
                        }
                        title="Open profile"
                      >
                        {item.author?.avatarKey ? (
                          <img
                            src={mediaUrl(
                              item.author.avatarKey,
                            )}
                            alt=""
                          />
                        ) : (
                          (item.author?.name?.[0] || 'B')
                            .toUpperCase()
                        )}
                      </button>

                      <div className="bma-comment-body">
                        <div className="bma-comment-meta">
                          <button
                            type="button"
                            onClick={() =>
                              onOpenProfile?.(item.authorId)
                            }
                          >
                            {item.author?.name ||
                              'Blink user'}
                          </button>

                          <time dateTime={item.createdAt}>
                            {since(item.createdAt)}
                          </time>
                        </div>

                        <p>{item.body}</p>
                      </div>

                      {(item.authorId === currentUserId ||
                        momentOwnerId === currentUserId) && (
                        <button
                          type="button"
                          disabled={busy}
                          className="bma-comment-delete"
                          onClick={() =>
                            void deleteComment(item.id)
                          }
                          title="Delete comment"
                          aria-label="Delete comment"
                        >
                          ×
                        </button>
                      )}
                    </article>
                  ))}
                </div>

                <form
                  className="bma-compose"
                  onSubmit={(e) => void postComment(e)}
                >
                  <label
                    className="bma-sr-only"
                    htmlFor={`bma-text-${momentId}`}
                  >
                    Write a comment
                  </label>

                  <input
                    id={`bma-text-${momentId}`}
                    maxLength={500}
                    placeholder="Write a comment…"
                    value={comment}
                    onChange={(e) =>
                      setComment(e.target.value)
                    }
                    disabled={busy}
                  />

                  <button
                    type="submit"
                    disabled={busy || !comment.trim()}
                    aria-label="Post comment"
                  >
                    ➤
                  </button>
                </form>
              </>
            )}

            {/* BP GIFT PANEL */}

            {tab === 'bp' && (
              <div className="bma-panel-content">
                <div className="bma-gift-hero">🧡</div>

                <p className="bma-panel-description">
                  Send Blink Points to appreciate
                  this Moment.
                </p>

                <div className="bma-balance">
                  Your balance
                  <strong>
                    {balance.toFixed(1)} BP
                  </strong>
                </div>

                <div className="bma-bp-options">
                  {[1, 5, 10, 25, 50, 100].map(
                    (n) => (
                      <button
                        key={n}
                        type="button"
                        className={
                          giftAmount === n
                            ? 'selected'
                            : ''
                        }
                        onClick={() =>
                          setGiftAmount(n)
                        }
                      >
                        {n} BP
                      </button>
                    ),
                  )}
                </div>

                <button
                  type="button"
                  className="bma-primary"
                  disabled={
                    busy ||
                    balance < giftAmount ||
                    momentOwnerId === currentUserId
                  }
                  onClick={() => void giftBp()}
                >
                  {busy
                    ? 'Sending…'
                    : `Send ${giftAmount} BP 🧡`}
                </button>

                {momentOwnerId === currentUserId && (
                  <p className="bma-muted">
                    You cannot gift BP to your own Moment.
                  </p>
                )}

                <p className="bma-muted">
                  This transfers BP from your balance.
                  It is not a free reaction.
                </p>
              </div>
            )}

            {/* INBOX SHARING */}

            {tab === 'share' && (
              <div className="bma-panel-content">
                <div className="bma-gift-hero">
                  ↗
                </div>

                <p className="bma-panel-description">
                  Share this Moment privately
                  with a Blink connection.
                </p>

                {!friends ? (
                  <p className="bma-muted">
                    Loading friends…
                  </p>
                ) : friends.length === 0 ? (
                  <p className="bma-muted">
                    No connections available
                    for sharing.
                  </p>
                ) : (
                  <>
                    <label
                      className="bma-share-label"
                      htmlFor={`share-${momentId}`}
                    >
                      Choose a friend
                    </label>

                    <select
                      id={`share-${momentId}`}
                      value={friendId}
                      onChange={(e) =>
                        setFriendId(e.target.value)
                      }
                    >
                      <option value="">
                        Select a connection
                      </option>

                      {friends.map((friend) => (
                        <option
                          key={friend.id}
                          value={friend.id}
                        >
                          {friend.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="bma-primary"
                      disabled={!friendId || busy}
                      onClick={() =>
                        void shareMoment()
                      }
                    >
                      {busy
                        ? 'Sending…'
                        : 'Send to Inbox →'}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
