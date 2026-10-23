
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import BlinkSocialLayout from './BlinkSocialLayout';

import {
  friendlyDate,
  socialApi,
  socialAvatar,
  type SocialPerson,
} from './blinkSocialApi';

type HeartMessage = {
  id: string;
  text: string;
  fromMe: boolean;
  createdAt: string;
  editedAt: string | null;
};

type HeartThread = {
  id: string;
  side: 'incoming' | 'sent';
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  revealed: boolean;
  blockedByMe: boolean;
  person: SocialPerson | null;
  createdAt: string;
  updatedAt: string;
  messages: HeartMessage[];
};

type Props = {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onBack: () => void;
  onSecrets: () => void;
  onOpenProfile: (userId: string) => void;
};

export default function HeartPage({
  theme,
  onToggleTheme,
  onBack,
  onSecrets,
  onOpenProfile,
}: Props) {
  const [tab, setTab] =
    useState<'incoming' | 'sent'>('incoming');

  const [incoming, setIncoming] =
    useState<HeartThread[]>([]);

  const [sent, setSent] =
    useState<HeartThread[]>([]);

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [detail, setDetail] =
    useState<HeartThread | null>(null);

  const [search, setSearch] = useState('');
  const [people, setPeople] =
    useState<SocialPerson[]>([]);

  const [person, setPerson] =
    useState<SocialPerson | null>(null);

  const [compose, setCompose] = useState(false);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [modal, setModal] =
    useState<'reveal' | 'block' | null>(null);

  // NEW: Message editing state.
  const [editingMessageId, setEditingMessageId] =
    useState<string | null>(null);

  const [editText, setEditText] = useState('');

  const refresh = useCallback(async () => {
    const [received, sentThreads] =
      await Promise.all([
        socialApi<HeartThread[]>('/hearts/incoming'),
        socialApi<HeartThread[]>('/hearts/sent'),
      ]);

    setIncoming(received);
    setSent(sentThreads);
  }, []);

  const openThread = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setCompose(false);
      setError('');
      setEditingMessageId(null);
      setEditText('');

      const thread = await socialApi<HeartThread>(
        `/hearts/${id}`,
      );

      setDetail(thread);
    },
    [],
  );

  useEffect(() => {
    void refresh().catch(err => {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load Hearts.',
      );
    });
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) return;

    let active = true;

    void socialApi<HeartThread>(
      `/hearts/${selectedId}`,
    )
      .then(thread => {
        if (active) setDetail(thread);
      })
      .catch(err => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load this Heart.',
          );
        }
      });

    return () => {
      active = false;
    };
  }, [selectedId]);

  // Search users when composing a Heart.
  useEffect(() => {
    if (search.trim().length < 2) {
      setPeople([]);
      return;
    }

    let active = true;

    const timer = window.setTimeout(() => {
      void socialApi<SocialPerson[]>(
        `/hearts/people?search=${
          encodeURIComponent(search.trim())
        }`,
      )
        .then(results => {
          if (active) setPeople(results);
        })
        .catch(() => {
          if (active) setPeople([]);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  async function execute(
    fn: () => Promise<unknown>,
    success: string,
    closeModal = false,
  ): Promise<boolean> {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await fn();
      await refresh();

      if (selectedId) {
        const updated = await socialApi<HeartThread>(
          `/hearts/${selectedId}`,
        );

        setDetail(updated);
      }

      setNotice(success);

      if (closeModal) {
        setModal(null);
      }

      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Please try again.',
      );

      return false;
    } finally {
      setBusy(false);
    }
  }

  function startCompose() {
    setCompose(true);
    setSelectedId(null);
    setDetail(null);
    setEditingMessageId(null);
    setEditText('');
    setError('');
    setNotice('');
  }

  async function sendNewHeart() {
    if (!person || !draft.trim() || busy) {
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const thread = await socialApi<HeartThread>(
        '/hearts',
        'POST',
        {
          receiverId: person.id,
          text: draft.trim(),
        },
      );

      await refresh();

      setSelectedId(thread.id);
      setDetail(thread);
      setTab('sent');

      setCompose(false);
      setDraft('');
      setSearch('');
      setPerson(null);

      setNotice(
        'Your Heart has been sent anonymously.',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not send Heart.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!detail || !message.trim() || busy) {
      return;
    }

    const ok = await execute(
      () => socialApi(
        `/hearts/${detail.id}/messages`,
        'POST',
        { text: message.trim() },
      ),
      'Heart sent.',
    );

    if (ok) {
      setMessage('');
    }
  }

  async function respond(
    status: 'ACCEPTED' | 'DECLINED',
  ) {
    if (!detail) return;

    await execute(
      () => socialApi(
        `/hearts/${detail.id}/respond`,
        'POST',
        { status },
      ),

      status === 'ACCEPTED'
        ? 'Request accepted. You can reply now.'
        : 'Request quietly declined.',
    );
  }

  async function confirmReveal() {
    if (!detail) return;

    await execute(
      () => socialApi(
        `/hearts/${detail.id}/reveal`,
        'POST',
      ),
      'Your Blink identity is now visible to this recipient.',
      true,
    );
  }

  async function confirmBlock() {
    if (!detail) return;

    await execute(
      () => socialApi(
        `/hearts/${detail.id}/block`,
        'POST',
      ),
      'Sender blocked. New Hearts are prevented.',
      true,
    );
  }

  // =====================================
  // NEW: START EDITING HEART MESSAGE
  // =====================================
  function beginMessageEdit(
    heartMessage: HeartMessage,
  ) {
    if (!heartMessage.fromMe || busy) {
      return;
    }

    setEditingMessageId(heartMessage.id);
    setEditText(heartMessage.text);

    setError('');
    setNotice('');
  }

  function cancelMessageEdit() {
    setEditingMessageId(null);
    setEditText('');
  }

  // =====================================
  // NEW: SAVE EDITED HEART MESSAGE
  // =====================================
  async function saveMessageEdit() {
    if (
      !selectedId ||
      !editingMessageId ||
      !editText.trim() ||
      busy
    ) {
      return;
    }

    const ok = await execute(
      () => socialApi(
        `/hearts/${selectedId}/messages/${editingMessageId}`,
        'PATCH',
        { text: editText.trim() },
      ),
      'Heart message updated.',
    );

    if (ok) {
      cancelMessageEdit();
    }
  }

  function switchTab(
    next: 'incoming' | 'sent',
  ) {
    setTab(next);
    setCompose(false);
    setDetail(null);
    setSelectedId(null);
    cancelMessageEdit();
  }

  const list =
    tab === 'incoming' ? incoming : sent;

  const selected =
    detail?.id === selectedId
      ? detail
      : null;

  return (
    <BlinkSocialLayout
      active="hearts"
      title="A Heart, Without a Name."
      subtitle="Be brave enough to say it. Stay anonymous until you decide otherwise."
      theme={theme}
      onToggleTheme={onToggleTheme}
      onBack={onBack}
      onSecrets={onSecrets}
      onHearts={() => {}}
    >
      {/* Existing Heart statistics */}
      <div className="bs-stats">
        <div className="bs-stat bs-stat-orange">
          <span>🖤 HEART INBOX</span>

          <strong>{incoming.length}</strong>

          <small>
            Hearts people sent to you
          </small>
        </div>

        <div className="bs-stat">
          <span>WAITING FOR YOUR DECISION</span>

          <strong>
            {incoming.filter(
              thread =>
                thread.status === 'PENDING' &&
                !thread.blockedByMe,
            ).length}
          </strong>

          <small>
            Accept, decline, or leave pending
          </small>
        </div>

        <div className="bs-stat">
          <span>HEARTS YOU SENT</span>

          <strong>{sent.length}</strong>

          <small>
            Keep the conversation going
          </small>
        </div>
      </div>

      {/* Section header */}
      <div className="bs-sectionbar">
        <div>
          <h2>🖤 Blink Heart</h2>

          <p>
            Private requests. No pressure.
            Your identity, your decision.
          </p>
        </div>

        <button
          type="button"
          className="bs-primary"
          onClick={startCompose}
        >
          + Send a Heart
        </button>
      </div>

      {error && (
        <div
          className="bs-alert"
          role="alert"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          className="bs-notice"
          role="status"
        >
          {notice}
        </div>
      )}

      {/* Original inbox layout */}
      <div className="bs-inbox">
        <aside className="bs-inbox-list">
          <div className="bs-tabs bs-inbox-tabs">
            <button
              type="button"
              className={
                tab === 'incoming' ? 'active' : ''
              }
              onClick={() =>
                switchTab('incoming')
              }
            >
              Received ({incoming.length})
            </button>

            <button
              type="button"
              className={
                tab === 'sent' ? 'active' : ''
              }
              onClick={() =>
                switchTab('sent')
              }
            >
              Sent ({sent.length})
            </button>
          </div>

          <div className="bs-thread-list">
            {list.length === 0 && (
              <div className="bs-mini-empty">
                No Hearts here yet.

                <button
                  type="button"
                  className="bs-text-btn"
                  onClick={startCompose}
                >
                  Send the first one →
                </button>
              </div>
            )}

            {list.map(thread => (
              <button
                key={thread.id}
                type="button"
                className={
                  `bs-thread ${
                    thread.id === selectedId
                      ? 'active'
                      : ''
                  }`
                }
                onClick={() =>
                  void openThread(thread.id).catch(
                    err => setError(
                      err instanceof Error
                        ? err.message
                        : 'Could not open Heart.',
                    ),
                  )
                }
              >
                <span className="bs-avatar bs-thread-avatar">
                  {thread.person?.avatarKey ? (
                    <img
                      src={
                        socialAvatar(
                          thread.person.avatarKey,
                        ) || ''
                      }
                      alt=""
                    />
                  ) : thread.side === 'incoming' ? (
                    '🖤'
                  ) : (
                    '✦'
                  )}
                </span>

                <span className="bs-thread-content">
                  <strong>
                    {thread.person?.name ||
                      'Someone anonymous'}
                  </strong>

                  <span>
                    {thread.messages[
                      thread.messages.length - 1
                    ]?.text || 'Heart request'}
                  </span>

                  <small>
                    {thread.blockedByMe
                      ? 'Blocked'
                      : thread.status === 'ACCEPTED'
                        ? thread.revealed
                          ? 'Identity revealed'
                          : 'Accepted · anonymous'
                        : thread.status === 'DECLINED'
                          ? 'Declined privately'
                          : 'Pending'}
                    {' · '}
                    {friendlyDate(thread.updatedAt)}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="bs-conversation">
          {/* New Heart composer */}
          {compose ? (
            <div className="bs-compose">
              <div className="bs-conversation-top">
                <span className="bs-avatar">
                  🖤
                </span>

                <div>
                  <strong>
                    Send an anonymous Heart
                  </strong>

                  <small>
                    Only you can reveal your identity
                    after acceptance.
                  </small>
                </div>
              </div>

              <div className="bs-compose-body">
                <div className="bs-label">
                  FIND SOMEONE ON BLINK
                </div>

                <input
                  className="bs-search"
                  value={search}
                  maxLength={80}
                  placeholder="Search by Blink name…"
                  onChange={event => {
                    setSearch(event.target.value);
                    setPerson(null);
                  }}
                />

                {person && (
                  <p className="bs-selected-person">
                    ✓ Sending to{' '}
                    <strong>{person.name}</strong>

                    <button
                      type="button"
                      onClick={() => setPerson(null)}
                    >
                      Change
                    </button>
                  </p>
                )}

                {!person && (
                  <div className="bs-people">
                    {people.map(user => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setPerson(user);
                          setPeople([]);
                        }}
                      >
                        <span className="bs-avatar">
                          {user.avatarKey ? (
                            <img
                              src={
                                socialAvatar(
                                  user.avatarKey,
                                ) || ''
                              }
                              alt=""
                            />
                          ) : (
                            user.name
                              .slice(0, 1)
                              .toUpperCase()
                          )}
                        </span>

                        <span>{user.name}</span>
                        <b>Choose →</b>
                      </button>
                    ))}
                  </div>
                )}

                <div className="bs-label">
                  YOUR MESSAGE
                </div>

                <textarea
                  rows={6}
                  maxLength={2000}
                  value={draft}
                  placeholder="There's something I've always wanted to tell you…"
                  onChange={event =>
                    setDraft(event.target.value)
                  }
                />

                <p className="bs-privacy-note">
                  🔐 Your Blink ID, name and photo
                  stay hidden until you choose
                  to reveal them after acceptance.
                </p>

                <button
                  type="button"
                  className="bs-primary"
                  disabled={
                    busy ||
                    !person ||
                    !draft.trim()
                  }
                  onClick={() =>
                    void sendNewHeart()
                  }
                >
                  {busy
                    ? 'Sending…'
                    : 'Send anonymously →'}
                </button>
              </div>
            </div>
          ) : selected ? (
            <>
              {/* Selected conversation header */}
              <header className="bs-conversation-top">
                <span className="bs-avatar bs-avatar-lg">
                  {selected.person?.avatarKey ? (
                    <img
                      src={
                        socialAvatar(
                          selected.person.avatarKey,
                        ) || ''
                      }
                      alt=""
                    />
                  ) : (
                    '🖤'
                  )}
                </span>

                <div>
                  <strong>
                    {selected.person?.name ||
                      'Anonymous Heart'}
                  </strong>

                  <small>
                    {selected.blockedByMe
                      ? 'You blocked this account'
                      : selected.status === 'ACCEPTED'
                        ? selected.revealed
                          ? 'Identity revealed'
                          : 'Connected anonymously'
                        : selected.status === 'DECLINED'
                          ? 'Quietly declined'
                          : 'Waiting for acceptance'}
                  </small>
                </div>

                {selected.side === 'incoming' &&
                  !selected.blockedByMe && (
                    <button
                      type="button"
                      className="bs-danger-ghost"
                      onClick={() =>
                        setModal('block')
                      }
                    >
                      Block
                    </button>
                  )}
              </header>

              {/* Heart messages */}
              <div className="bs-messages">
                <div className="bs-privacy-divider">
                  🔐 Private Blink Heart ·
                  No read receipts
                </div>

                {selected.messages.map(heartMessage => (
                  <div
                    key={heartMessage.id}
                    className={
                      `bs-bubble ${
                        heartMessage.fromMe
                          ? 'mine'
                          : ''
                      }`
                    }
                  >
                    {editingMessageId ===
                    heartMessage.id ? (
                      /* NEW: Inline message editor */
                      <div className="bs-edit-message">
                        <textarea
                          rows={3}
                          maxLength={2000}
                          value={editText}
                          aria-label="Edit your Heart message"
                          onChange={event =>
                            setEditText(
                              event.target.value,
                            )
                          }
                        />

                        <div className="bs-edit-message-actions">
                          <button
                            type="button"
                            className="bs-secondary"
                            disabled={busy}
                            onClick={cancelMessageEdit}
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            className="bs-primary"
                            disabled={
                              busy ||
                              !editText.trim()
                            }
                            onClick={() =>
                              void saveMessageEdit()
                            }
                          >
                            {busy
                              ? 'Saving…'
                              : 'Save edit'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p>{heartMessage.text}</p>

                        <div className="bs-bubble-actions">
                          <small>
                            {friendlyDate(
                              heartMessage.createdAt,
                            )}
                            {heartMessage.editedAt
                              ? ' · edited'
                              : ''}
                          </small>

                          {heartMessage.fromMe &&
                            !selected.blockedByMe && (
                              <button
                                type="button"
                                className="bs-bubble-edit"
                                disabled={busy}
                                onClick={() =>
                                  beginMessageEdit(
                                    heartMessage,
                                  )
                                }
                              >
                                ✎ Edit
                              </button>
                            )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Accept / decline */}
              {selected.side === 'incoming' &&
                selected.status === 'PENDING' &&
                !selected.blockedByMe && (
                  <div className="bs-decision">
                    <strong>
                      Someone wants to connect with you
                    </strong>

                    <p>
                      You can leave this pending
                      indefinitely. Declining does
                      not notify the sender.
                    </p>

                    <div>
                      <button
                        type="button"
                        className="bs-primary"
                        disabled={busy}
                        onClick={() =>
                          void respond('ACCEPTED')
                        }
                      >
                        ✓ Accept Heart
                      </button>

                      <button
                        type="button"
                        className="bs-secondary"
                        disabled={busy}
                        onClick={() =>
                          void respond('DECLINED')
                        }
                      >
                        Decline quietly
                      </button>
                    </div>
                  </div>
                )}

              {/* Sender-controlled reveal */}
              {selected.side === 'sent' &&
                selected.status === 'ACCEPTED' &&
                !selected.revealed && (
                  <div className="bs-reveal-strip">
                    <div>
                      ✦{' '}
                      <strong>
                        They accepted your Heart.
                      </strong>

                      <p>
                        You're still anonymous.
                        Reveal your Blink ID only
                        when you feel ready.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="bs-primary"
                      onClick={() =>
                        setModal('reveal')
                      }
                    >
                      Reveal my Blink ID
                    </button>
                  </div>
                )}

              {/* Revealed identity */}
              {selected.side === 'incoming' &&
                selected.revealed &&
                selected.person && (
                  <div className="bs-reveal-strip">
                    <div>
                      🧡{' '}
                      <strong>
                        {selected.person.name}
                        {' '}revealed their identity
                      </strong>

                      <p>
                        Their Blink profile is now
                        available to you.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="bs-primary"
                      onClick={() =>
                        onOpenProfile(
                          selected.person!.id,
                        )
                      }
                    >
                      View Blink profile →
                    </button>
                  </div>
                )}

              {/* Send additional Hearts or replies */}
              {!selected.blockedByMe &&
                (
                  selected.side === 'sent' ||
                  selected.status === 'ACCEPTED'
                ) && (
                  <div className="bs-reply">
                    <textarea
                      rows={2}
                      maxLength={2000}
                      value={message}
                      placeholder={
                        selected.side === 'sent' &&
                        selected.status === 'PENDING'
                          ? 'Send another Heart while pending…'
                          : 'Write a private reply…'
                      }
                      onChange={event =>
                        setMessage(
                          event.target.value,
                        )
                      }
                    />

                    <button
                      type="button"
                      className="bs-primary"
                      disabled={
                        busy ||
                        !message.trim()
                      }
                      onClick={() =>
                        void sendReply()
                      }
                    >
                      Send ↗
                    </button>
                  </div>
                )}
            </>
          ) : (
            <div className="bs-empty bs-detail-empty">
              <span>🖤</span>

              <strong>
                Some words are worth sharing.
              </strong>

              <p>
                Select a Heart from your inbox
                or write your own anonymous message.
              </p>

              <button
                type="button"
                className="bs-primary"
                onClick={startCompose}
              >
                Send a Heart →
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Existing Reveal / Block modal */}
      {modal && (
        <div
          className="bs-modal-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (
              event.target === event.currentTarget
            ) {
              setModal(null);
            }
          }}
        >
          <div
            className="bs-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === 'reveal'
                ? 'Reveal Blink identity'
                : 'Block sender'
            }
          >
            <span className="bs-modal-icon">
              {modal === 'reveal'
                ? '🧡'
                : '⛔'}
            </span>

            <h2>
              {modal === 'reveal'
                ? 'Reveal your Blink identity?'
                : 'Block this Heart sender?'}
            </h2>

            <p>
              {modal === 'reveal'
                ? 'This will permanently show your Blink name, profile picture and clickable profile link to this recipient. You cannot undo it.'
                : 'You will not receive future Hearts from this account. This also uses Blink’s existing user-block system.'}
            </p>

            <div className="bs-modal-actions">
              <button
                type="button"
                className="bs-secondary"
                disabled={busy}
                onClick={() =>
                  setModal(null)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="bs-primary"
                disabled={busy}
                onClick={() =>
                  void (
                    modal === 'reveal'
                      ? confirmReveal()
                      : confirmBlock()
                  )
                }
              >
                {busy
                  ? 'Working…'
                  : modal === 'reveal'
                    ? 'Yes, reveal me'
                    : 'Block sender'}
              </button>
            </div>
          </div>
        </div>
      )}
    </BlinkSocialLayout>
  );
}
