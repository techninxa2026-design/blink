import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

import ExchangePriceOfferPanel from './ExchangePriceOfferPanel';
import './ExchangePostPage.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

// ======================================================
// TYPES
// ======================================================

type ExchangePost = {
  id: string;
  authorId: string;
  title: string;
  description: string;
  kind: string;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;

  author: {
    id: string;
    name: string;
    avatarKey?: string | null;
  };

  media: {
    id: string;
    mimeType: string;
  }[];
};

type ExchangeThread = {
  id: string;
  requesterId: string;
  updatedAt: string;

  requester: {
    id: string;
    name: string;
  };

  _count?: {
    messages: number;
  };
};

type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;

  sender?: {
    id: string;
    name: string;
  };
};

type Props = {
  postId: string;
  onBack: () => void;
  onOpenProfile?: (userId: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

// ======================================================
// AUTHENTICATION
// ======================================================

function getToken(): string | null {
  try {
    return (
      localStorage.getItem('blink-access-token') ||
      sessionStorage.getItem('blink-access-token')
    );
  } catch {
    return null;
  }
}

function getCurrentUserId(): string {
  try {
    const raw =
      sessionStorage.getItem('blink-user') ||
      localStorage.getItem('blink-user');

    if (!raw) return '';

    const user = JSON.parse(raw) as {
      id?: string;
    };

    return user.id || '';
  } catch {
    return '';
  }
}

// ======================================================
// API REQUEST
// ======================================================

async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  if (!token) {
    throw new Error('Please sign in to continue.');
  }

  const headers = new Headers(options.headers);

  headers.set('Authorization', `Bearer ${token}`);

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error('Cannot connect to the Blink API.');
  }

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;

    const message = Array.isArray(result?.message)
      ? result.message.join(', ')
      : result?.message;

    throw new Error(
      message || `Request failed (${response.status})`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// ======================================================
// HELPERS
// ======================================================

function initials(value: string): string {
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase() || 'B'
  );
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function dateHeading(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();

  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return formatDate(value);
}

function kindLabel(value: string): string {
  const labels: Record<string, string> = {
    OFFER: 'Offering help',
    REQUEST: 'Looking for help',
    ADVICE: 'Advice',
    COLLABORATION: 'Collaboration',
  };

  return labels[value] || value;
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function ExchangePostPage({
  postId,
  onBack,
  onOpenProfile,
  theme,
  onToggleTheme,
}: Props) {
  const myId = getCurrentUserId();

  // ----------------------------------------------------
  // POST STATE
  // ----------------------------------------------------

  const [post, setPost] = useState<ExchangePost | null>(null);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  // ----------------------------------------------------
  // CONVERSATION STATE
  // ----------------------------------------------------

  const [threads, setThreads] = useState<ExchangeThread[]>([]);

  const [threadId, setThreadId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [loadingMessages, setLoadingMessages] = useState(false);

  const [draft, setDraft] = useState('');

  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);

  const [chatError, setChatError] = useState('');

  const [search, setSearch] = useState('');

  const [mobileView, setMobileView] = useState<'list' | 'chat'>(
    'list',
  );

  // ----------------------------------------------------
  // REFS
  // ----------------------------------------------------

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const activeThreadRef = useRef<string | null>(null);

  const autoScrollRef = useRef(true);

  // ----------------------------------------------------
  // CURRENT USER ROLE
  // ----------------------------------------------------

  const isOwner = Boolean(
    post && post.authorId === myId,
  );

  // Post owner = service provider.
  // Other user = interested customer.

  const chatPath =
    `/Exchange/${encodeURIComponent(postId)}/chats`;

  const selectedThread = threads.find(
    (thread) => thread.id === threadId,
  );

  const contactName = isOwner
    ? selectedThread?.requester?.name || 'Select a conversation'
    : post?.author?.name || 'Post author';

  const contactId = isOwner
    ? selectedThread?.requesterId
    : post?.authorId;

  const filteredThreads = threads.filter((thread) =>
    thread.requester.name
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  // ====================================================
  // LOAD OWNER CONVERSATIONS
  // ====================================================

  const refreshOwnerThreads = useCallback(async () => {
    const result = await api<ExchangeThread[]>(chatPath);

    setThreads(result);

    setThreadId((previous) => {
      if (
        previous &&
        result.some((thread) => thread.id === previous)
      ) {
        return previous;
      }

      return result[0]?.id ?? null;
    });
  }, [chatPath]);

  // ====================================================
  // INITIALIZE PAGE
  // ====================================================

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setPageError('');
    setChatError('');

    setPost(null);
    setThreads([]);
    setThreadId(null);
    setMessages([]);

    setDraft('');
    setSearch('');
    setMobileView('list');

    async function initialize() {
      try {
        const detail = await api<ExchangePost>(
          `/Exchange/${encodeURIComponent(postId)}`,
        );

        if (cancelled) return;

        setPost(detail);

        try {
          if (detail.authorId === getCurrentUserId()) {
            // POST AUTHOR / PROVIDER

            const list = await api<ExchangeThread[]>(chatPath);

            if (!cancelled) {
              setThreads(list);
              setThreadId(list[0]?.id ?? null);
            }
          } else {
            // INTERESTED CUSTOMER

            const mine = await api<{
              threadId?: string | null;
            }>(`${chatPath}/mine`);

            if (!cancelled) {
              setThreadId(mine.threadId ?? null);
              setMobileView('chat');
            }
          }
        } catch (error) {
          if (!cancelled) {
            setChatError(
              error instanceof Error
                ? error.message
                : 'Could not load conversations.',
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(
            error instanceof Error
              ? error.message
              : 'Could not load Exchange post.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [postId, chatPath]);

  // ====================================================
  // REFRESH OWNER SIDEBAR
  // ====================================================

  useEffect(() => {
    if (!isOwner) return;

    const timer = window.setInterval(() => {
      void refreshOwnerThreads().catch(() => {});
    }, 8000);

    return () => window.clearInterval(timer);
  }, [isOwner, refreshOwnerThreads]);

  // ====================================================
  // LOAD CHAT MESSAGES
  // ====================================================

  useEffect(() => {
    activeThreadRef.current = threadId;

    autoScrollRef.current = true;

    setMessages([]);
    setChatError('');

    setLoadingMessages(Boolean(threadId));

    if (!threadId) return;

    const selectedId = threadId;

    let active = true;
    let fetching = false;

    async function loadMessages() {
      if (fetching) return;

      fetching = true;

      try {
        const result = await api<ChatMessage[]>(
          `${chatPath}/${encodeURIComponent(selectedId)}/messages`,
        );

        if (
          active &&
          activeThreadRef.current === selectedId
        ) {
          setMessages(result);
          setChatError('');
        }
      } catch (error) {
        if (active) {
          setChatError(
            error instanceof Error
              ? error.message
              : 'Could not load messages.',
          );
        }
      } finally {
        fetching = false;

        if (active) {
          setLoadingMessages(false);
        }
      }
    }

    void loadMessages();

    const timer = window.setInterval(() => {
      void loadMessages();
    }, 3500);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [threadId, chatPath]);

  // ====================================================
  // AUTO SCROLL
  // ====================================================

  useEffect(() => {
    if (!autoScrollRef.current) return;

    const viewport = scrollRef.current;

    if (!viewport) return;

    viewport.scrollTop = viewport.scrollHeight;
  }, [messages, threadId, mobileView]);

  function handleScroll() {
    const viewport = scrollRef.current;

    if (!viewport) return;

    const remaining =
      viewport.scrollHeight -
      viewport.scrollTop -
      viewport.clientHeight;

    autoScrollRef.current = remaining < 120;
  }

  // ====================================================
  // SWITCH CONVERSATION
  // ====================================================

  function selectConversation(id: string) {
    activeThreadRef.current = id;

    autoScrollRef.current = true;

    setThreadId(id);
    setDraft('');
    setChatError('');
    setMobileView('chat');
  }

  // ====================================================
  // START PRIVATE CONVERSATION
  // ====================================================

  async function startConversation() {
    if (starting || isOwner || post?.status === 'CLOSED') {
      return;
    }

    setStarting(true);
    setChatError('');

    try {
      const result = await api<{
        id?: string;
        threadId?: string;
      }>(chatPath, {
        method: 'POST',
      });

      const newId = result.threadId || result.id;

      if (!newId) {
        throw new Error(
          'The API did not return a conversation ID.',
        );
      }

      activeThreadRef.current = newId;
      autoScrollRef.current = true;

      setThreadId(newId);
      setMobileView('chat');

      inputRef.current?.focus();
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : 'Unable to start private chat.',
      );
    } finally {
      setStarting(false);
    }
  }

  // ====================================================
  // SEND CHAT MESSAGE
  // ====================================================

  async function sendMessage(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const content = draft.trim();
    const currentThread = threadId;

    if (!currentThread || !content || sending) return;

    if (content.length > 2000) return;

    setSending(true);
    setChatError('');
    autoScrollRef.current = true;

    try {
      await api(
        `${chatPath}/${encodeURIComponent(currentThread)}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            text: content,
          }),
        },
      );

      if (activeThreadRef.current === currentThread) {
        setDraft('');

        const updated = await api<ChatMessage[]>(
          `${chatPath}/${encodeURIComponent(currentThread)}/messages`,
        );

        if (activeThreadRef.current === currentThread) {
          setMessages(updated);
        }
      }

      if (isOwner) {
        void refreshOwnerThreads().catch(() => {});
      }

      inputRef.current?.focus();
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : 'Unable to send message.',
      );
    } finally {
      setSending(false);
    }
  }

  // ====================================================
  // ENTER TO SEND
  // ====================================================

  function handleKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();

      if (draft.trim() && !sending) {
        event.currentTarget.form?.requestSubmit();
      }
    }
  }

  function openProfile(id?: string) {
    if (id && onOpenProfile) {
      onOpenProfile(id);
    }
  }

  // ====================================================
  // JSX PAGE
  // ====================================================

  return (
    <main className="ed-page">

      {/* ================================================
          TOP NAVBAR
          ================================================ */}

      <header className="ed-topbar">
        <button
          type="button"
          className="ed-back-link"
          onClick={onBack}
        >
          <span>←</span>
          All Exchanges
        </button>

        <div className="ed-brand">
          Blink <span>Exchange</span>
        </div>

        <button
          type="button"
          className="ed-theme-switch"
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
      </header>

      {loading && (
        <div className="ed-loading">
          Loading Exchange…
        </div>
      )}

      {pageError && (
        <div
          className="ed-page-error"
          role="alert"
        >
          {pageError}
        </div>
      )}

      {post && !loading && (
        <div className="ed-layout">

          {/* ============================================
              LEFT PANEL — SERVICE / POST DETAILS
              ============================================ */}

          <aside className="ed-post-panel">

            <div className="ed-post-heading">

              <div className="ed-post-tags">
                <span className="ed-category-tag">
                  {kindLabel(post.kind)}
                </span>

                <span
                  className={
                    post.status === 'OPEN'
                      ? 'ed-status ed-status-open'
                      : 'ed-status ed-status-closed'
                  }
                >
                  {post.status === 'OPEN'
                    ? 'Open'
                    : 'Closed'}
                </span>
              </div>

              <h1>{post.title}</h1>

              <button
                type="button"
                className="ed-author"
                disabled={!onOpenProfile}
                onClick={() =>
                  openProfile(post.authorId)
                }
              >
                <div className="ed-avatar ed-author-avatar">
                  {initials(post.author.name)}
                </div>

                <div>
                  <strong>
                    {post.author.name}
                  </strong>

                  <span>
                    {formatDate(post.createdAt)}
                  </span>
                </div>

                {onOpenProfile && (
                  <span className="ed-author-arrow">
                    ↗
                  </span>
                )}
              </button>
            </div>

            <div className="ed-post-body">

              <div className="ed-section-label">
                ABOUT THIS Exchange
              </div>

              <p className="ed-description">
                {post.description}
              </p>

              {(post.media || []).length > 0 && (
                <>
                  <div className="ed-section-label">
                    ATTACHMENTS
                  </div>

                  <div className="ed-post-media">
                    {post.media.map((media) => {
                      const src =
                        `${API_URL}/Exchange/media/${encodeURIComponent(media.id)}`;

                      if (
                        media.mimeType.startsWith('video/')
                      ) {
                        return (
                          <video
                            key={media.id}
                            controls
                            playsInline
                            preload="metadata"
                            src={src}
                          />
                        );
                      }

                      return (
                        <img
                          key={media.id}
                          src={src}
                          alt={`Attachment for ${post.title}`}
                          loading="lazy"
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="ed-post-bottom">
              <span className="ed-lock-symbol">
                ♢
              </span>

              Conversations and price offers
              are private.
            </div>
          </aside>

          {/* ============================================
              RIGHT WORKSPACE — MESSENGER
              ============================================ */}

          <section
            className={`ed-workspace ${
              isOwner
                ? 'ed-owner'
                : 'ed-visitor'
            } ${
              mobileView === 'list'
                ? 'mobile-list'
                : 'mobile-chat'
            }`}
          >

            {/* ========================================
                MIDDLE PANEL — CONVERSATION LIST
                ======================================== */}

            <aside className="ed-conversation-pane">

              <div className="ed-sidebar-heading">

                <span className="ed-sidebar-eyebrow">
                  Blink Exchange
                </span>

                <div className="ed-sidebar-title">
                  <h2>Messages</h2>

                  {isOwner && (
                    <span className="ed-thread-count">
                      {threads.length}
                    </span>
                  )}
                </div>

                <p>
                  Private conversations about this post
                </p>
              </div>

              {/* SEARCH CONTACTS */}

              {isOwner && (
                <div className="ed-sidebar-search">

                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <circle
                      cx="11"
                      cy="11"
                      r="7"
                    />

                    <path d="m16 16 5 5" />
                  </svg>

                  <input
                    type="search"
                    value={search}
                    placeholder="Search conversations"
                    aria-label="Search conversations"
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                  />
                </div>
              )}

              <div className="ed-sidebar-section">
                {isOwner
                  ? 'INTERESTED PEOPLE'
                  : 'POST AUTHOR'}
              </div>

              {/* CONVERSATION LIST */}

              <div className="ed-conversation-list">

                {isOwner ? (

                  filteredThreads.length > 0 ? (

                    filteredThreads.map((thread) => {
                      const selected =
                        thread.id === threadId;

                      return (
                        <button
                          type="button"
                          key={thread.id}
                          className={`ed-conversation-item ${
                            selected ? 'selected' : ''
                          }`}
                          onClick={() =>
                            selectConversation(thread.id)
                          }
                        >

                          <div className="ed-avatar ed-list-avatar">
                            {initials(
                              thread.requester.name,
                            )}
                          </div>

                          <div className="ed-conversation-info">

                            <strong>
                              {thread.requester.name}
                            </strong>

                            <small>
                              {typeof thread._count?.messages ===
                              'number'
                                ? `${thread._count.messages} messages`
                                : 'Private conversation'}
                            </small>
                          </div>

                          <div className="ed-conversation-right">

                            <time>
                              {formatTime(
                                thread.updatedAt,
                              )}
                            </time>

                            {selected && (
                              <span className="ed-selected-marker" />
                            )}
                          </div>
                        </button>
                      );
                    })

                  ) : (

                    <div className="ed-sidebar-empty">
                      {search
                        ? 'No matching conversations.'
                        : 'No one has started a private chat yet.'}
                    </div>

                  )

                ) : (

                  <button
                    type="button"
                    className={`ed-conversation-item ${
                      threadId ? 'selected' : ''
                    }`}
                    onClick={() =>
                      setMobileView('chat')
                    }
                  >

                    <div className="ed-avatar ed-list-avatar">
                      {initials(post.author.name)}
                    </div>

                    <div className="ed-conversation-info">

                      <strong>
                        {post.author.name}
                      </strong>

                      <small>
                        {threadId
                          ? 'Open conversation'
                          : 'Start a conversation'}
                      </small>
                    </div>
                  </button>

                )}
              </div>

              <div className="ed-sidebar-footer">
                <span className="ed-security-icon">
                  ✧
                </span>

                Only conversation participants
                can access their chat.
              </div>

            </aside>

            {/* ========================================
                RIGHT PANEL — ACTIVE PRIVATE CHAT
                ======================================== */}

            <div className="ed-chat-pane">

              {/* CHAT CONTACT HEADER */}

              <header className="ed-chat-header">

                <button
                  type="button"
                  className="ed-mobile-chat-back"
                  aria-label="Back to conversations"
                  onClick={() =>
                    setMobileView('list')
                  }
                >
                  ←
                </button>

                <div className="ed-avatar ed-chat-avatar">
                  {initials(
                    threadId || !isOwner
                      ? contactName
                      : 'Blink',
                  )}
                </div>

                <div className="ed-chat-contact">

                  <strong>
                    {threadId || !isOwner
                      ? contactName
                      : 'Select a conversation'}
                  </strong>

                  <span>
                    {threadId
                      ? 'Private Exchange chat'
                      : isOwner
                        ? 'Choose someone from Messages'
                        : 'Discuss this Exchange privately'}
                  </span>
                </div>

                {contactId && onOpenProfile && (
                  <button
                    type="button"
                    className="ed-profile-button"
                    aria-label="View profile"
                    title="View profile"
                    onClick={() =>
                      openProfile(contactId)
                    }
                  >
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="8"
                        r="4"
                      />

                      <path d="M4 21c0-4 3-7 8-7s8 3 8 7" />
                    </svg>
                  </button>
                )}
              </header>

              {/* ======================================
                  PRICE OFFER PANEL

                  CUSTOMER:
                  - Choose currency
                  - Make price offer
                  - Edit pending price and currency

                  SERVICE PROVIDER:
                  - View offered amount
                  - Accept
                  - Decline

                  Visible only after a private chat
                  thread has been created.
                  ====================================== */}

              {threadId && (
                <ExchangePriceOfferPanel
                  key={`${postId}:${threadId}`}
                  postId={postId}
                  threadId={threadId}
                  isOwner={isOwner}
                  postStatus={post.status}
                />
              )}

              {/* ======================================
                  CHAT MESSAGE HISTORY
                  ====================================== */}

              <div
                className="ed-chat-messages"
                ref={scrollRef}
                onScroll={handleScroll}
                role="log"
                aria-label="Private message history"
              >

                {!threadId ? (

                  // NO CONVERSATION

                  <div className="ed-empty-chat">

                    <div className="ed-empty-illustration">
                      <span>✉</span>
                    </div>

                    {isOwner ? (
                      <>
                        <h3>
                          Your private conversations
                        </h3>

                        <p>
                          Select an interested person
                          from the Messages sidebar
                          to read and reply to their chat.
                        </p>
                      </>
                    ) : (
                      <>
                        <h3>
                          Interested in this Exchange?
                        </h3>

                        <p>
                          Start a private conversation
                          with {post.author.name}
                          to discuss their service,
                          requirements and pricing.
                        </p>

                        <button
                          type="button"
                          className="ed-start-chat"
                          disabled={
                            starting ||
                            post.status === 'CLOSED'
                          }
                          onClick={() =>
                            void startConversation()
                          }
                        >
                          {post.status === 'CLOSED'
                            ? 'Exchange closed'
                            : starting
                              ? 'Starting…'
                              : 'Start conversation →'}
                        </button>
                      </>
                    )}
                  </div>

                ) : loadingMessages ? (

                  <div className="ed-empty-chat">
                    <p>Loading messages…</p>
                  </div>

                ) : messages.length === 0 ? (

                  // EMPTY CONVERSATION

                  <div className="ed-empty-chat">

                    <div className="ed-empty-illustration">
                      <span>✦</span>
                    </div>

                    <h3>
                      Start the conversation
                    </h3>

                    <p>
                      Send a message to {contactName}.
                      You can also discuss and offer
                      a service price using the
                      price-offer section above.
                    </p>
                  </div>

                ) : (

                  // MESSAGE LIST

                  <div className="ed-message-stack">

                    {messages.map((message, index) => {
                      const mine =
                        message.senderId === myId;

                      const previous =
                        messages[index - 1];

                      const next =
                        messages[index + 1];

                      const newDay =
                        !previous ||
                        new Date(
                          previous.createdAt,
                        ).toDateString() !==
                          new Date(
                            message.createdAt,
                          ).toDateString();

                      const groupedWithPrevious =
                        previous?.senderId ===
                          message.senderId &&
                        !newDay &&
                        new Date(
                          message.createdAt,
                        ).getTime() -
                          new Date(
                            previous.createdAt,
                          ).getTime() <
                          5 * 60_000;

                      const groupedWithNext =
                        next?.senderId ===
                          message.senderId &&
                        new Date(
                          next.createdAt,
                        ).toDateString() ===
                          new Date(
                            message.createdAt,
                          ).toDateString() &&
                        new Date(
                          next.createdAt,
                        ).getTime() -
                          new Date(
                            message.createdAt,
                          ).getTime() <
                          5 * 60_000;

                      return (
                        <div key={message.id}>

                          {/* DATE DIVIDER */}

                          {newDay && (
                            <div className="ed-day-divider">
                              <span>
                                {dateHeading(
                                  message.createdAt,
                                )}
                              </span>
                            </div>
                          )}

                          {/* MESSAGE */}

                          <div
                            className={`ed-message-line ${
                              mine
                                ? 'sent'
                                : 'received'
                            } ${
                              groupedWithPrevious
                                ? 'grouped'
                                : ''
                            }`}
                          >

                            {!mine && (
                              <div className="ed-message-avatar-space">

                                {!groupedWithNext && (
                                  <div className="ed-avatar ed-small-avatar">
                                    {initials(
                                      message.sender?.name ||
                                        contactName,
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="ed-bubble-column">

                              <div className="ed-chat-bubble">
                                {message.text}
                              </div>

                              {!groupedWithNext && (
                                <time className="ed-bubble-time">
                                  {formatTime(
                                    message.createdAt,
                                  )}
                                </time>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ======================================
                  CHAT ERROR
                  ====================================== */}

              {chatError && (
                <div
                  className="ed-chat-alert"
                  role="alert"
                >
                  <span>
                    {chatError}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setChatError('')
                    }
                    aria-label="Dismiss error"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* ======================================
                  SEND MESSAGE FORM
                  ====================================== */}

              {threadId ? (

                <form
                  className="ed-chat-composer"
                  onSubmit={sendMessage}
                >

                  <div className="ed-composer-field">

                    <textarea
                      ref={inputRef}
                      value={draft}
                      rows={1}
                      maxLength={2000}
                      disabled={sending}
                      aria-label="Write a private message"
                      placeholder="Type a message..."
                      onChange={(event) =>
                        setDraft(
                          event.target.value,
                        )
                      }
                      onKeyDown={handleKeyDown}
                    />

                    <span className="ed-composer-hint">
                      Enter to send · Shift + Enter for a new line
                    </span>
                  </div>

                  <button
                    className="ed-send"
                    type="submit"
                    disabled={
                      sending ||
                      !draft.trim()
                    }
                    aria-label="Send message"
                  >
                    {sending ? (
                      <span>…</span>
                    ) : (
                      <svg
                        width="21"
                        height="21"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m22 2-7 20-4-9-9-4 20-7Z" />
                        <path d="M22 2 11 13" />
                      </svg>
                    )}
                  </button>
                </form>

              ) : (

                <div className="ed-no-composer">
                  {isOwner
                    ? 'Select a conversation to send messages'
                    : 'Start a private conversation to send messages and price offers'}
                </div>

              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}