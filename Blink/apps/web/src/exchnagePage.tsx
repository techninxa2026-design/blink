import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import './ExchangePage.css';

// Keep this consistent with ExchangePostPage.tsx.
// If using a Vite proxy, change both to '/blink-api'.
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const kinds = [
  'OFFER',
  'REQUEST',
  'ADVICE',
  'COLLABORATION',
] as const;

type Kind = (typeof kinds)[number];
type Status = 'OPEN' | 'CLOSED';

type ExchangeMedia = {
  id: string;
  mimeType: string;
};

type ExchangePost = {
  id: string;
  authorId: string;
  title: string;
  description: string;
  kind: Kind;
  status: Status;
  createdAt: string;

  author: {
    id: string;
    name: string;
    avatarKey?: string | null;
  };

  media: ExchangeMedia[];
};

type PostsResult = {
  items: ExchangePost[];
  page: number;
  pages: number;
  total: number;
};

type Props = {
  onBack: () => void;
  onOpenPost: (postId: string) => void;
  onOpenProfile?: (userId: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

const kindLabels: Record<Kind, string> = {
  OFFER: 'Offering help',
  REQUEST: 'Looking for help',
  ADVICE: 'Advice',
  COLLABORATION: 'Collaboration',
};

function accessToken(): string | null {
  try {
    return (
      localStorage.getItem('blink-access-token') ||
      sessionStorage.getItem('blink-access-token')
    );
  } catch {
    return null;
  }
}

function myUserId(): string {
  try {
    const value =
      sessionStorage.getItem('blink-user') ||
      localStorage.getItem('blink-user');

    return value
      ? String(JSON.parse(value).id ?? '')
      : '';
  } catch {
    return '';
  }
}

async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = accessToken();

  if (!token) {
    throw new Error(
      'Please sign in to use Blink Market.',
    );
  }

  const headers = new Headers(options.headers);

  headers.set(
    'Authorization',
    `Bearer ${token}`,
  );

  if (
    options.body &&
    !(options.body instanceof FormData)
  ) {
    headers.set(
      'Content-Type',
      'application/json',
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `${API_URL}${path}`,
      {
        ...options,
        headers,
      },
    );
  } catch {
    throw new Error(
      'Could not connect to the Blink API. Check that NestJS is running.',
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const data = (await response.json()) as {
        message?: string | string[];
      };

      message = Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message || message;
    } catch {
      // Keep HTTP error message.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

function dateLabel(value: string): string {
  return new Date(value).toLocaleDateString(
    undefined,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  );
}

export default function ExchangePage({
  onBack,
  onOpenPost,
  onOpenProfile,
  theme,
  onToggleTheme,
}: Props) {
  const [result, setResult] =
    useState<PostsResult | null>(null);

  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<Kind | ''>('');
  const [mine, setMine] = useState(false);

  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [composerOpen, setComposerOpen] =
    useState(false);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [title, setTitle] = useState('');

  const [description, setDescription] =
    useState('');

  const [draftKind, setDraftKind] =
    useState<Kind>('OFFER');

  const [draftStatus, setDraftStatus] =
    useState<Status>('OPEN');

  const [files, setFiles] = useState<File[]>([]);

  const [fileInputVersion, setFileInputVersion] =
    useState(0);

  const currentId = myUserId();

  // ==============================
  // LOAD Exchange POSTS
  // ==============================

  const load = useCallback(async () => {
    const query = new URLSearchParams({
      page: String(page),
    });

    if (search.trim()) {
      query.set('search', search.trim());
    }

    if (kind) {
      query.set('kind', kind);
    }

    if (mine) {
      query.set('mine', 'true');
    }

    return api<PostsResult>(
      `/Exchange?${query.toString()}`,
    );
  }, [search, kind, mine, page]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');

    void load()
      .then((data) => {
        if (!cancelled) {
          setResult(data);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : 'Could not load posts.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [load, version]);

  function refresh() {
    setVersion((v) => v + 1);
  }

  // ==============================
  // CREATE / EDIT COMPOSER
  // ==============================

  function closeComposer() {
    setComposerOpen(false);
    setEditingId(null);
    setFiles([]);
  }

  function startCreate() {
    setEditingId(null);
    setTitle('');
    setDescription('');

    setDraftKind('OFFER');
    setDraftStatus('OPEN');

    setFiles([]);
    setFileInputVersion((v) => v + 1);

    setError('');
    setNotice('');
    setComposerOpen(true);
  }

  function startEdit(post: ExchangePost) {
    setEditingId(post.id);

    setTitle(post.title);
    setDescription(post.description);

    setDraftKind(post.kind);
    setDraftStatus(post.status);

    setFiles([]);
    setFileInputVersion((v) => v + 1);

    setError('');
    setNotice('');
    setComposerOpen(true);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  // ==============================
  // SAVE POST
  // ==============================

  async function savePost(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const form = new FormData();

      form.append('title', title.trim());

      form.append(
        'description',
        description.trim(),
      );

      form.append('kind', draftKind);

      if (editingId) {
        form.append('status', draftStatus);
      }

      files.forEach((file) => {
        form.append('files', file);
      });

      await api<ExchangePost>(
        editingId
          ? `/Exchange/${encodeURIComponent(editingId)}`
          : '/Exchange',
        {
          method: editingId ? 'PATCH' : 'POST',
          body: form,
        },
      );

      setNotice(
        editingId
          ? 'Your post was updated.'
          : 'Your post is live on Blink Market.',
      );

      closeComposer();
      setPage(1);
      refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not save your post.',
      );
    } finally {
      setBusy(false);
    }
  }

  // ==============================
  // DELETE POST
  // ==============================

  async function deletePost(post: ExchangePost) {
    if (
      busy ||
      !window.confirm(
        `Delete "${post.title}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      await api(
        `/Exchange/${encodeURIComponent(post.id)}`,
        {
          method: 'DELETE',
        },
      );

      setNotice(
        'Your Market post was deleted.',
      );

      refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not delete your post.',
      );
    } finally {
      setBusy(false);
    }
  }

  // ==============================
  // PAGE UI
  // ==============================

  return (
    <main className="Exchange-page">
      <header className="Exchange-topbar">
        <button
          type="button"
          className="Exchange-back"
          onClick={onBack}
        >
          ← Back
        </button>

        <span className="Exchange-brand">
          Blink <strong>Market</strong>
        </span>

        <button
          type="button"
          className="Exchange-mode"
          onClick={onToggleTheme}
        >
          {theme === 'dark'
            ? '☀ Light'
            : '☾ Dark'}
        </button>
      </header>

      <div className="Exchange-shell">

        {/* HERO SECTION */}

        <section className="Exchange-hero">
          <div>
            <span className="Exchange-eyebrow">
              PEOPLE HELPING PEOPLE
            </span>

            <h1>
              Small Markets.
              <br />
              <em>Real opportunities.</em>
            </h1>

            <p>
              Share what you know, ask for what
              you need, and meet people who can
              help you move forward.
            </p>
          </div>

          <button
            type="button"
            className="Exchange-primary"
            onClick={() =>
              composerOpen
                ? closeComposer()
                : startCreate()
            }
          >
            {composerOpen
              ? '× Close'
              : '+ Create Market'}
          </button>
        </section>

        {/* STATUS MESSAGES */}

        {notice && (
          <p
            className="Exchange-alert success"
            role="status"
          >
            ✓ {notice}
          </p>
        )}

        {error && (
          <p
            className="Exchange-alert error"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* CREATE / EDIT POST */}

        {composerOpen && (
          <section className="Exchange-composer">
            <div className="Exchange-section-head">
              <h2>
                {editingId
                  ? 'Edit your Market'
                  : 'What would you like to share?'}
              </h2>
            </div>

            <form onSubmit={savePost}>

              <label>
                Market type

                <select
                  value={draftKind}
                  onChange={(e) =>
                    setDraftKind(
                      e.target.value as Kind,
                    )
                  }
                >
                  {kinds.map((k) => (
                    <option
                      key={k}
                      value={k}
                    >
                      {kindLabels[k]}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Title

                <input
                  value={title}
                  required
                  minLength={6}
                  maxLength={140}
                  placeholder="e.g. I can help with React and Next.js"
                  onChange={(e) =>
                    setTitle(e.target.value)
                  }
                />
              </label>

              <label>
                Description

                <textarea
                  value={description}
                  required
                  rows={5}
                  minLength={20}
                  maxLength={5000}
                  placeholder="Explain what you can offer or what you need."
                  onChange={(e) =>
                    setDescription(
                      e.target.value,
                    )
                  }
                />
              </label>

              {editingId && (
                <label>
                  Availability

                  <select
                    value={draftStatus}
                    onChange={(e) =>
                      setDraftStatus(
                        e.target.value as Status,
                      )
                    }
                  >
                    <option value="OPEN">
                      Open to conversations
                    </option>

                    <option value="CLOSED">
                      Closed / completed
                    </option>
                  </select>
                </label>
              )}

              <label className="Exchange-file-control">
                Photos or video (up to 4 files,
                40 MB each)

                <input
                  key={fileInputVersion}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                  onChange={(e) => {
                    const selected = Array.from(
                      e.target.files || [],
                    );

                    if (selected.length > 4) {
                      setError(
                        'Choose no more than 4 files.',
                      );

                      e.target.value = '';
                      return;
                    }

                    if (
                      selected.some(
                        (f) =>
                          f.size >
                          40 * 1024 * 1024,
                      )
                    ) {
                      setError(
                        'Each file must be 40 MB or less.',
                      );

                      e.target.value = '';
                      return;
                    }

                    setError('');
                    setFiles(selected);
                  }}
                />

                <small>
                  {files.length
                    ? files
                        .map((file) => file.name)
                        .join(' · ')
                    : editingId
                      ? 'Leave empty to keep existing media. New files replace existing media.'
                      : 'Optional: add photos or a short video.'}
                </small>
              </label>

              <div className="Exchange-form-actions">
                <button
                  type="button"
                  className="Exchange-quiet"
                  onClick={closeComposer}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="Exchange-primary"
                  disabled={busy}
                >
                  {busy
                    ? 'Saving…'
                    : editingId
                      ? 'Save changes'
                      : 'Publish Market'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* SEARCH AND FILTER */}

        <section className="Exchange-toolbar">
          <div className="Exchange-section-head">
            <h2>Explore Markets</h2>

            <span>
              {result?.total ?? 0} posts
            </span>
          </div>

          <div className="Exchange-filterbar">
            <input
              aria-label="Search Markets"
              placeholder="Search skills, services or opportunities…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />

            <select
              aria-label="Exchange type"
              value={kind}
              onChange={(e) => {
                setKind(
                  e.target.value as Kind | '',
                );
                setPage(1);
              }}
            >
              <option value="">
                All types
              </option>

              {kinds.map((k) => (
                <option
                  key={k}
                  value={k}
                >
                  {kindLabels[k]}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={
                mine
                  ? 'Exchange-quiet active'
                  : 'Exchange-quiet'
              }
              onClick={() => {
                setMine((v) => !v);
                setPage(1);
              }}
            >
              {mine
                ? '✓ My posts'
                : 'My posts'}
            </button>
          </div>
        </section>

        {/* LOADING */}

        {loading && (
          <p className="Exchange-state">
            Loading Markets…
          </p>
        )}

        {/* EMPTY STATE */}

        {!loading &&
          !error &&
          result?.items.length === 0 && (
            <div className="Exchange-empty">
              No matching Markets yet.
              Be the first to create one!
            </div>
          )}

        {/* POSTS GRID */}

        {!loading && !error && (
          <div className="Exchange-grid">
            {result?.items.map((post) => {
              const isMine =
                currentId === post.authorId;

              return (
                <article
                  className="Exchange-card Exchange-card-clickable"
                  key={post.id}
                  onClick={(event) => {
                    const target =
                      event.target as HTMLElement;

                    // Do not interfere with edit,
                    // delete, profile or video controls.
                    if (
                      target.closest(
                        'button, a, input, select, textarea, video',
                      )
                    ) {
                      return;
                    }

                    onOpenPost(post.id);
                  }}
                >
                  {/* AUTHOR */}

                  <div className="Exchange-card-header">
                    <button
                      type="button"
                      className="Exchange-author"
                      onClick={() =>
                        onOpenProfile?.(
                          post.authorId,
                        )
                      }
                      disabled={!onOpenProfile}
                    >
                      <span className="Exchange-avatar">
                        {post.author.name
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>

                      <span>
                        <strong>
                          {post.author.name}
                        </strong>

                        <small>
                          {dateLabel(
                            post.createdAt,
                          )}
                        </small>
                      </span>
                    </button>

                    <span
                      className={`Exchange-tag ${post.kind.toLowerCase()}`}
                    >
                      {kindLabels[post.kind]}
                    </span>
                  </div>

                  {/* POST TITLE */}

                  <h3>{post.title}</h3>

                  {/* POST DESCRIPTION */}

                  <p className="Exchange-description">
                    {post.description}
                  </p>

                  {/* IMAGES AND VIDEOS */}

                  {post.media.length > 0 && (
                    <div className="Exchange-media-grid">
                      {post.media.map((media) => {
                        const url =
                          `${API_URL}/Exchange/media/${encodeURIComponent(media.id)}`;

                        return media.mimeType.startsWith(
                          'video/',
                        ) ? (
                          <video
                            key={media.id}
                            controls
                            playsInline
                            preload="metadata"
                            src={url}
                          />
                        ) : (
                          <img
                            key={media.id}
                            alt={`Attachment for ${post.title}`}
                            loading="lazy"
                            src={url}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* POST STATUS / OWNER ACTIONS */}

                  <div className="Exchange-card-meta">
                    <span
                      className={
                        post.status === 'OPEN'
                          ? 'Exchange-open'
                          : 'Exchange-closed'
                      }
                    >
                      {post.status === 'OPEN'
                        ? '● Open'
                        : '● Closed'}
                    </span>

                    <span>
                      Open post to connect privately
                    </span>

                    {isMine && (
                      <span className="Exchange-actions">
                        <button
                          type="button"
                          onClick={() =>
                            startEdit(post)
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void deletePost(post)
                          }
                        >
                          Delete
                        </button>
                      </span>
                    )}
                  </div>

                  {/* OPEN DETAILS PAGE */}

                  <button
                    type="button"
                    className="Exchange-open-post"
                    onClick={() =>
                      onOpenPost(post.id)
                    }
                  >
                    <span>
                      View details &amp; private chat
                    </span>

                    <span aria-hidden="true">
                      →
                    </span>
                  </button>
                </article>
              );
            })}
          </div>
        )}

        {/* PAGINATION */}

        {result &&
          !loading &&
          result.pages > 1 && (
            <div className="Exchange-pagination">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() =>
                  setPage((p) => p - 1)
                }
              >
                ← Previous
              </button>

              <span>
                Page {page} of {result.pages}
              </span>

              <button
                type="button"
                disabled={
                  page >= result.pages
                }
                onClick={() =>
                  setPage((p) => p + 1)
                }
              >
                Next →
              </button>
            </div>
          )}
      </div>
    </main>
  );
}