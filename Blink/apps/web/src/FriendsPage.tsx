
import { useEffect, useState } from 'react';
import './FriendsPage.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

type PublicUser = {
  id: string;
  name: string;
  avatarKey: string | null;
  bio: string | null;
};

type FriendRequest = {
  id: string;
  sender?: PublicUser;
  receiver?: PublicUser;
  createdAt: string;
};

type Friend = {
  friendshipId: string;
  user: PublicUser;
};

type Tab = 'discover' | 'requests' | 'friends';

type Props = {
onOpenProfile: (userId: string) => void;
  onBack: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

function getToken() {
  return (
    localStorage.getItem('blink-access-token') ||
    sessionStorage.getItem('blink-access-token')
  );
}

function avatarUrl(key: string) {
  if (key.startsWith('http')) return key;
  return `${API_URL}${key.startsWith('/') ? key : `/uploads/${key}`}`;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  if (!token) {
    throw new Error('Please sign in to use Connections.');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;

    try {
      const data = (await response.json()) as {
        message?: string | string[];
      };

      if (typeof data.message === 'string') {
        message = data.message;
      } else if (Array.isArray(data.message)) {
        message = data.message.join(', ');
      }
    } catch {
      // Keep the default message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function UserAvatar({ user }: { user: PublicUser }) {
  return (
    <div className="friends-avatar">
      {user.avatarKey ? (
        <img src={avatarUrl(user.avatarKey)} alt="" />
      ) : (
        <span>
          {user.name
            .split(' ')
            .map((part) => part[0] || '')
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </span>
      )}
    </div>
  );
}

export default function FriendsPage({
  onBack,
  onOpenProfile,
  theme,
  onToggleTheme,
}: Props) {
  const [tab, setTab] = useState<Tab>('discover');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUser[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadConnections() {
    try {
      const [received, sent, connections] = await Promise.all([
        apiRequest<FriendRequest[]>('/friends/requests/incoming'),
        apiRequest<FriendRequest[]>('/friends/requests/outgoing'),
        apiRequest<Friend[]>('/friends'),
      ]);

      setIncoming(received);
      setOutgoing(sent);
      setFriends(connections);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load connections.',
      );
    }
  }

  useEffect(() => {
    void loadConnections();
  }, []);

  useEffect(() => {
    const search = query.trim();
    let cancelled = false;
    const controller = new AbortController();
    // Show every public Blink member immediately, then filter as they type.
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const auth = getToken();
        if (!auth) throw new Error('Please sign in again.');
        const response = await fetch(
          `${API_URL}/friends/search?q=${encodeURIComponent(search)}`,
          { headers: { Authorization: `Bearer ${auth}` }, signal: controller.signal },
        );
        if (!response.ok) throw new Error('Could not load Blink users.');
        const users = (await response.json()) as PublicUser[];
        if (!cancelled) { setResults(users); setError(''); }
      } catch (err) {
        if (!cancelled && !controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Could not load Blink users.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, search ? 200 : 0);
    return () => { cancelled = true; window.clearTimeout(timeout); controller.abort(); };

  }, [query]);



async function unfriend(userId: string, name: string) {
  const confirmed = window.confirm(
    `Remove ${name} from your friends?`,
  );

  if (!confirmed) return;

  setBusyId(userId);
  setError('');
  setNotice('');

  try {
    const result = await apiRequest<{ message: string }>(
      `/friends/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    );

    setNotice(result.message || `${name} was removed from your friends.`);
    await loadConnections();
  } catch (err) {
    setError(
      err instanceof Error ? err.message : 'Could not unfriend this user.',
    );
  } finally {
    setBusyId(null);
  }
}



  async function performAction(
    id: string,
    path: string,
    body?: object,
  ) {
    setBusyId(id);
    setError('');
    setNotice('');

    try {
      const result = await apiRequest<{ message?: string }>(path, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      setNotice(result.message || 'Updated successfully.');
      await loadConnections();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong.',
      );
    } finally {
      setBusyId(null);
    }
  }

  function isFriend(userId: string) {
    return friends.some((friend) => friend.user.id === userId);
  }

  function isPending(userId: string) {
    return (
      outgoing.some((request) => request.receiver?.id === userId) ||
      incoming.some((request) => request.sender?.id === userId)
    );
  }

  return (
    <main className="blink-friends">
      <header className="friends-topbar">
        <button type="button" onClick={onBack}>← Back</button>
        <img src="/blink-logo.png" alt="Blink" />
        <button type="button" onClick={onToggleTheme}>
          {theme === 'light' ? '☾' : '☀'}
        </button>
      </header>

      <div className="friends-container">
        <div className="friends-heading">
          <p>YOUR PEOPLE, YOUR BLINK</p>
          <h1>Connections</h1>
          <span>Find your people and stay connected.</span>
        </div>

        <div className="friends-tabs" role="tablist" aria-label="Connections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'discover'}
            className={tab === 'discover' ? 'active' : ''}
            onClick={() => setTab('discover')}
          >
            Find People
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'requests'}
            className={tab === 'requests' ? 'active' : ''}
            onClick={() => setTab('requests')}
          >
            Requests ({incoming.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'friends'}
            className={tab === 'friends' ? 'active' : ''}
            onClick={() => setTab('friends')}
          >
            Friends ({friends.length})
          </button>
        </div>

        {error && <p className="friends-error" role="alert">{error}</p>}
        {notice && <p className="friends-notice" role="status">{notice}</p>}

        {tab === 'discover' && (
          <section className="friends-section">
            <label htmlFor="friends-search">Search Blink users</label>
            <input
              id="friends-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name..."
              maxLength={80}
            />

            {loading ? (
              <p className="friends-empty">Loading Blink members…</p>
            ) : !query.trim() ? (
              <p className="friends-empty">
                Enter a name to find someone on Blink.
              </p>
            ) : results.length === 0 ? (
              <p className="friends-empty">No users found.</p>
            ) : (
              <div className="friends-list">
                {results.map((user) => (
                  <div className="friends-user" key={user.id}>
                    <UserAvatar user={user} />
                    <div className="friends-user-info">
                      <button
  type="button"
  className="friends-profile-link"
  onClick={() => onOpenProfile(user.id)}
>
  {user.name}
</button>
                      <span>{user.bio || 'Blink member'}</span>
                    </div>

                    {isFriend(user.id) ? (
                      <span className="friends-status">Friends ✓</span>
                    ) : isPending(user.id) ? (
                      <span className="friends-status">Pending</span>
                    ) : (
                      <button
                        type="button"
                        className="friends-primary"
                        disabled={busyId !== null}
                        onClick={() =>
                          void performAction(
                            user.id,
                            '/friends/requests',
                            { receiverId: user.id },
                          )
                        }
                      >
                        {busyId === user.id ? 'Sending...' : '+ Connect'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'requests' && (
          <section className="friends-section">
            <h2>Received requests</h2>

            {incoming.length === 0 ? (
              <p className="friends-empty">No incoming requests.</p>
            ) : (
              <div className="friends-list">
                {incoming.map((request) => (
                  <div className="friends-user" key={request.id}>
                    {request.sender && <UserAvatar user={request.sender} />}
                    <div className="friends-user-info">
                      <button
  type="button"
  className="friends-profile-link"
  onClick={() => request.sender && onOpenProfile(request.sender.id)}
>
  {request.sender?.name || 'Blink user'}
</button>
                      <span>Wants to connect with you</span>
                    </div>
                    <div className="friends-actions">
                      <button
                        type="button"
                        className="friends-primary"
                        disabled={busyId !== null}
                        onClick={() =>
                          void performAction(
                            request.id,
                            `/friends/requests/${request.id}/accept`,
                          )
                        }
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="friends-secondary"
                        disabled={busyId !== null}
                        onClick={() =>
                          void performAction(
                            request.id,
                            `/friends/requests/${request.id}/decline`,
                          )
                        }
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h2>Sent requests</h2>

            {outgoing.length === 0 ? (
              <p className="friends-empty">No outgoing requests.</p>
            ) : (
              <div className="friends-list">
                {outgoing.map((request) => (
                  <div className="friends-user" key={request.id}>
                    {request.receiver && (
                      <UserAvatar user={request.receiver} />
                    )}
                    <div className="friends-user-info">
                      <button
  type="button"
  className="friends-profile-link"
  onClick={() => request.receiver && onOpenProfile(request.receiver.id)}
>
  {request.receiver?.name || 'Blink user'}
</button>
                      <span>Waiting for a response</span>
                    </div>
                    <span className="friends-status">Pending</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'friends' && (
          <section className="friends-section">
            <h2>My Friends</h2>

            {friends.length === 0 ? (
              <p className="friends-empty">
                No connections yet. Find people and send a request!
              </p>
            ) : (
              <div className="friends-list">
                {friends.map((friend) => (
                  <div className="friends-user" key={friend.friendshipId}>
                    <UserAvatar user={friend.user} />
                    <div className="friends-user-info">
                      <button
  type="button"
  className="friends-profile-link"
  onClick={() => onOpenProfile(friend.user.id)}
>
  {friend.user.name}
</button>
                      <span>{friend.user.bio || 'Blink member'}</span>
                    </div>
                    <button
  type="button"
  className="friends-secondary"
  disabled={busyId !== null}
  onClick={() => void unfriend(friend.user.id, friend.user.name)}
>
  {busyId === friend.user.id ? 'Removing...' : 'Unfriend'}
</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
