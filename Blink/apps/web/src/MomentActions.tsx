
import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import { createPortal } from 'react-dom';

import './MomentActions.css';

const API = (
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const EMOJIS = [
  '❤️', '🧡', '😂', '😮', '🔥', '👏',
];

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
  myBalance: number;
  reactionTotal?: number;
  reactionCounts?: Record<string, number>;
  myReaction?: string | null;
};

type Friend = {
  id: string;
  name: string;
  avatarKey: string | null;
};

type Panel = 'comments' | 'bp' | 'share' | null;

type Props = {
  momentId: string;
  caption: string;
  currentUserId?: string;
  momentOwnerId?: string;
  onOpenProfile?: (id: string) => void;
  onBpTransferred?: () => void;
};

function token() {
  return (
    localStorage.getItem('blink-access-token') ||
    sessionStorage.getItem('blink-access-token')
  );
}

function avatar(key?: string | null) {
  if (!key) return '';

  return /^https?:\/\//i.test(key)
    ? key
    : `${API}${key.startsWith('/')
      ? key
      : `/uploads/${encodeURIComponent(key)}`}`;
}

async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const jwt = token();

  if (!jwt) throw new Error('Please sign in again.');

  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(body === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });

  const text = await response.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Use the HTTP status if no JSON was returned.
  }

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message;

    throw new Error(
      message || `Request failed (${response.status})`,
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
  onBpTransferred,
}: Props) {
  const [activity, setActivity] =
    useState<Activity | null>(null);

  const [panel, setPanel] = useState<Panel>(null);
  const [showEmojis, setShowEmojis] = useState(false);

  const [comment, setComment] = useState('');
  const [giftAmount, setGiftAmount] = useState(5);

  const [friends, setFriends] =
    useState<Friend[]>([]);

  const [friendId, setFriendId] = useState('');
  const [friendsLoading, setFriendsLoading] =
    useState(false);

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const result = await request<Activity>(
      `/moments/${encodeURIComponent(momentId)}/activity`,
    );

    setActivity({
      ...result,
      comments: result.comments ?? [],
      commentCount: Number(result.commentCount ?? 0),
      bpTotal: Number(result.bpTotal ?? 0),
      myBalance: Number(result.myBalance ?? 0),
      reactionTotal: Number(result.reactionTotal ?? 0),
      reactionCounts: result.reactionCounts ?? {},
      myReaction: result.myReaction ?? null,
    });
  }

  useEffect(() => {
    let mounted = true;

    setActivity(null);
    setPanel(null);
    setShowEmojis(false);
    setLoading(true);
    setError('');

    void request<Activity>(
      `/moments/${encodeURIComponent(momentId)}/activity`,
    )
      .then((result) => {
        if (!mounted) return;

        setActivity({
          ...result,
          comments: result.comments ?? [],
          commentCount: Number(result.commentCount ?? 0),
          bpTotal: Number(result.bpTotal ?? 0),
          myBalance: Number(result.myBalance ?? 0),
          reactionTotal: Number(result.reactionTotal ?? 0),
          reactionCounts: result.reactionCounts ?? {},
          myReaction: result.myReaction ?? null,
        });
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load activity.',
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

  async function react(emoji: string) {
    if (busy) return;

    setBusy(true);
    setError('');

    try {
      await request(
        `/moments/${encodeURIComponent(momentId)}/react`,
        'POST',
        { emoji },
      );

      await refresh();
      setShowEmojis(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Reaction failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function postComment(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!comment.trim() || busy) return;

    setBusy(true);
    setError('');

    try {
      await request(
        `/moments/${encodeURIComponent(momentId)}/comments`,
        'POST',
        { body: comment.trim() },
      );

      setComment('');
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not post comment.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(id: string) {
    if (busy) return;

    setBusy(true);
    setError('');

    try {
      await request(
        `/moments/comments/${encodeURIComponent(id)}`,
        'DELETE',
      );

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not delete comment.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendBp() {
    if (busy || momentOwnerId === currentUserId) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      await request(
        `/moments/${encodeURIComponent(momentId)}/bp`,
        'POST',
        { amount: giftAmount },
      );

      await refresh();
      onBpTransferred?.();
      setNotice(`${giftAmount} BP sent successfully.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to send BP.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function openShare() {
    setPanel('share');
    setShowEmojis(false);
    setFriends([]);
    setFriendId('');
    setFriendsLoading(true);
    setError('');

    try {
      setFriends(
        await request<Friend[]>('/inbox/friends'),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load friends.',
      );
    } finally {
      setFriendsLoading(false);
    }
  }

  async function sendToInbox() {
    if (!friendId || busy) return;

    setBusy(true);
    setError('');

    try {
      const conversation = await request<{
        conversationId: string;
      }>(
        '/inbox/conversations',
        'POST',
        { friendId },
      );

      const link =
        `${window.location.origin}/home?moment=` +
        encodeURIComponent(momentId);

      await request(
        `/inbox/conversations/${
          encodeURIComponent(conversation.conversationId)
        }/messages`,
        'POST',
        {
          body:
            `📸 Blink Moment shared\n` +
            (caption ? `${caption.slice(0, 180)}\n` : '') +
            link,
        },
      );

      setPanel(null);
      setNotice('Moment shared to Inbox.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to share Moment.',
      );
    } finally {
      setBusy(false);
    }
  }

  const myReaction = activity?.myReaction;
  const reactionTotal = activity?.reactionTotal ?? 0;

  return createPortal(
    <div
      className="bma-root"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        pointerEvents: 'none',
      }}
    >
      {/* VISIBLE RIGHT-SIDE ACTION BAR */}

      <div
        className="bma-rail"
        style={{
          position: 'absolute',
          right: 24,
          bottom: 115,
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          pointerEvents: 'auto',
          visibility: 'visible',
        }}
      >
        <button
          type="button"
          className={`bma-action ${
            myReaction === '❤️' ? 'active' : ''
          }`}
          disabled={busy}
          onClick={() => void react('❤️')}
          title="Like Moment"
        >
          <span className="bma-icon">
            {myReaction === '❤️' ? '❤️' : '♡'}
          </span>
          <small>{loading ? '…' : reactionTotal}</small>
        </button>

        <div className="bma-reaction-wrap">
          <button
            type="button"
            className="bma-action"
            onClick={() => {
              setShowEmojis((value) => !value);
              setPanel(null);
            }}
            title="React to Moment"
          >
            <span className="bma-icon">
              {myReaction && myReaction !== '❤️'
                ? myReaction
                : '😊'}
            </span>
            <small>React</small>
          </button>

          {showEmojis && (
            <div className="bma-emojis">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  disabled={busy}
                  className={
                    myReaction === emoji ? 'selected' : ''
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
          className="bma-action"
          onClick={() => {
            setPanel('comments');
            setShowEmojis(false);
          }}
          title="Comments"
        >
          <span className="bma-icon">💬</span>
          <small>{activity?.commentCount ?? 0}</small>
        </button>

        <button
          type="button"
          className="bma-action"
          onClick={() => {
            setPanel('bp');
            setShowEmojis(false);
          }}
          title="Give Blink Points"
        >
          <span className="bma-icon">🧡</span>
          <small>BP</small>
        </button>

        <button
          type="button"
          className="bma-action"
          onClick={() => void openShare()}
          title="Share to Inbox"
        >
          <span className="bma-icon">↗</span>
          <small>Share</small>
        </button>
      </div>

      {/* ERRORS AND NOTICES */}

      {(error || notice) && !panel && (
        <div
          className="bma-message"
          role={error ? 'alert' : 'status'}
        >
          {error || notice}
          <button
            type="button"
            onClick={() => {
              setError('');
              setNotice('');
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* COMMENT / BP / SHARE PANEL */}

      {panel && (
        <>
          <button
            type="button"
            className="bma-backdrop"
            onClick={() => setPanel(null)}
            aria-label="Close panel"
          />

          <section
            className="bma-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Moment interaction panel"
          >
            <header className="bma-panel-header">
              <div>
                <span>BLINK MOMENTS</span>
                <h2>
                  {panel === 'comments'
                    ? `Comments (${activity?.commentCount ?? 0})`
                    : panel === 'bp'
                      ? 'Give Blink Points'
                      : 'Share Moment'}
                </h2>
              </div>

              <button
                type="button"
                className="bma-close"
                onClick={() => setPanel(null)}
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

            {panel === 'comments' && (
              <>
                <div className="bma-comments">
                  {loading ? (
                    <p>Loading comments…</p>
                  ) : activity?.comments.length === 0 ? (
                    <div className="bma-empty">
                      <span>💬</span>
                      <strong>No comments yet</strong>
                      <p>Start the conversation!</p>
                    </div>
                  ) : (
                    activity?.comments.map((item) => (
                      <article
                        key={item.id}
                        className="bma-comment"
                      >
                        <button
                          type="button"
                          className="bma-avatar"
                          onClick={() =>
                            onOpenProfile?.(item.authorId)
                          }
                        >
                          {item.author.avatarKey ? (
                            <img
                              src={avatar(
                                item.author.avatarKey,
                              )}
                              alt=""
                            />
                          ) : (
                            item.author.name[0]
                              ?.toUpperCase() ?? 'B'
                          )}
                        </button>

                        <div className="bma-comment-text">
                          <strong>{item.author.name}</strong>
                          <p>{item.body}</p>
                        </div>

                        {(item.authorId === currentUserId ||
                          momentOwnerId === currentUserId) && (
                          <button
                            type="button"
                            className="bma-delete"
                            disabled={busy}
                            onClick={() =>
                              void deleteComment(item.id)
                            }
                          >
                            ×
                          </button>
                        )}
                      </article>
                    ))
                  )}
                </div>

                <form
                  className="bma-compose"
                  onSubmit={(event) =>
                    void postComment(event)
                  }
                >
                  <input
                    value={comment}
                    maxLength={500}
                    placeholder="Write a comment…"
                    onChange={(event) =>
                      setComment(event.target.value)
                    }
                  />

                  <button
                    type="submit"
                    disabled={busy || !comment.trim()}
                  >
                    Post
                  </button>
                </form>
              </>
            )}

            {panel === 'bp' && (
              <div className="bma-content">
                <div className="bma-large-emoji">🧡</div>

                <p>
                  Appreciate this Moment by sending
                  Blink Points.
                </p>

                <div className="bma-balance">
                  Your balance
                  <strong>
                    {Number(
                      activity?.myBalance ?? 0,
                    ).toFixed(1)} BP
                  </strong>
                </div>

                <div className="bma-bp-options">
                  {[1, 5, 10, 25, 50, 100].map(
                    (amount) => (
                      <button
                        type="button"
                        key={amount}
                        className={
                          giftAmount === amount
                            ? 'selected'
                            : ''
                        }
                        onClick={() =>
                          setGiftAmount(amount)
                        }
                      >
                        {amount} BP
                      </button>
                    ),
                  )}
                </div>

                <button
                  type="button"
                  className="bma-primary"
                  disabled={
                    busy ||
                    !activity ||
                    momentOwnerId === currentUserId ||
                    Number(activity.myBalance) < giftAmount
                  }
                  onClick={() => void sendBp()}
                >
                  Send {giftAmount} BP
                </button>
              </div>
            )}

            {panel === 'share' && (
              <div className="bma-content">
                <div className="bma-large-emoji">↗</div>

                <p>
                  Share this Moment with your connections.
                </p>

                {friendsLoading ? (
                  <p>Loading friends…</p>
                ) : friends.length === 0 ? (
                  <p>No friends available for sharing.</p>
                ) : (
                  <>
                    <select
                      aria-label="Select friend"
                      value={friendId}
                      onChange={(event) =>
                        setFriendId(event.target.value)
                      }
                    >
                      <option value="">Choose a friend</option>

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
                        void sendToInbox()
                      }
                    >
                      {busy
                        ? 'Sending…'
                        : 'Share to Inbox →'}
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
