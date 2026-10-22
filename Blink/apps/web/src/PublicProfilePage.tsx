
import { useEffect, useState } from 'react';
import './PublicProfilePage.css';
import { NotesRow, useActiveCheckins } from './CheckinPreview';

const API_URL = 'http://localhost:3000';

type PublicMoment = {
  id: string;
  mediaUrl: string;
  mediaType: 'photo' | 'video';
  caption: string | null;
};

type PublicProfile = {
  id: string;
  name: string;
  bio: string | null;
  avatarKey: string | null;
  coverKey: string | null;
  connectionsCount: number;
  relationship:
    | 'SELF'
    | 'FRIENDS'
    | 'OUTGOING_PENDING'
    | 'INCOMING_PENDING'
    | 'NONE';
  incomingRequestId: string | null;
  moments: PublicMoment[];
};

type Props = {
  userId: string;
  onBack: () => void;
  onMyProfile: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

function mediaUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return `${API_URL}${value}`;
  return `${API_URL}/uploads/${encodeURIComponent(value)}`;
}

function getToken() {
  return (
    localStorage.getItem('blink-access-token') ||
    sessionStorage.getItem('blink-access-token')
  );
}

export default function PublicProfilePage({
  userId,
  onBack,
  onMyProfile,
  theme,
  onToggleTheme,
}: Props) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const { items: activeCheckins } = useActiveCheckins();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadProfile() {
    const token = getToken();
    if (!token) throw new Error('Please sign in again.');

    const response = await fetch(
      `${API_URL}/profile/${encodeURIComponent(userId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!response.ok) {
      throw new Error(
        response.status === 404
          ? 'This user could not be found.'
          : 'Could not load this profile.',
      );
    }

    return (await response.json()) as PublicProfile;
  }

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');
    setProfile(null);

    void loadProfile()
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load profile.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);



async function unfriend() {
  if (!profile) return;

  const confirmed = window.confirm(
    `Remove ${profile.name} from your friends?`,
  );

  if (!confirmed) return;

  setBusy(true);
  setError('');
  setNotice('');

  try {
    const token = getToken();

    if (!token) {
      throw new Error('Please sign in again.');
    }

    const response = await fetch(
      `${API_URL}/friends/${encodeURIComponent(profile.id)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        message?: string | string[];
      };

      throw new Error(
        Array.isArray(data.message)
          ? data.message.join(' ')
          : data.message || 'Could not remove friend.',
      );
    }

    const updated = await loadProfile();
    setProfile(updated);
    setNotice('You are no longer friends.');
  } catch (err) {
    setError(
      err instanceof Error ? err.message : 'Could not remove friend.',
    );
  } finally {
    setBusy(false);
  }
}


  async function performAction(
    path: string,
    body?: Record<string, string>,
  ) {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const token = getToken();
      if (!token) throw new Error('Please sign in again.');

      const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          message?: string | string[];
        };
        const message = Array.isArray(data.message)
          ? data.message.join(' ')
          : data.message;
        throw new Error(message || 'Could not update connection.');
      }

      const updated = await loadProfile();
      setProfile(updated);
      setNotice('Connection updated successfully.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong.',
      );
    } finally {
      setBusy(false);
    }
  }

  function renderConnectionAction() {
    if (!profile) return null;

    switch (profile.relationship) {
      case 'SELF':
        return (
          <button className="public-profile-primary" onClick={onMyProfile}>
            My Profile
          </button>
        );
      case 'FRIENDS':
  return (
    <div className="public-profile-actions">
      <span className="public-profile-status">✓ Friends</span>

      <button
        type="button"
        className="public-profile-secondary"
        disabled={busy}
        onClick={() => void unfriend()}
      >
        {busy ? 'Removing...' : 'Unfriend'}
      </button>
    </div>
  );
      case 'OUTGOING_PENDING':
        return <span className="public-profile-status">Request pending</span>;
      case 'INCOMING_PENDING':
        return (
          <div className="public-profile-actions">
            <button
              className="public-profile-primary"
              disabled={busy || !profile.incomingRequestId}
              onClick={() =>
                void performAction(
                  `/friends/requests/${profile.incomingRequestId}/accept`,
                )
              }
            >
              {busy ? 'Please wait...' : 'Accept Request'}
            </button>
            <button
              className="public-profile-secondary"
              disabled={busy || !profile.incomingRequestId}
              onClick={() =>
                void performAction(
                  `/friends/requests/${profile.incomingRequestId}/decline`,
                )
              }
            >
              Decline
            </button>
          </div>
        );
      default:
        return (
          <button
            className="public-profile-primary"
            disabled={busy}
            onClick={() =>
              void performAction('/friends/requests', {
                receiverId: profile.id,
              })
            }
          >
            {busy ? 'Sending...' : '+ Connect'}
          </button>
        );
    }
  }

  return (
    <main className="blink-public-profile">
      <header className="public-profile-topbar">
        <button type="button" onClick={onBack}>← Back</button>
        <img src="/blink-logo.png" alt="Blink" />
        <button type="button" onClick={onToggleTheme}>
          {theme === 'light' ? '☾' : '☀'}
        </button>
      </header>

      <div className="public-profile-container">
        {loading && <p className="public-profile-message">Loading profile...</p>}
        {error && <p className="public-profile-error" role="alert">{error}</p>}

        {profile && (
          <>
            <div className="public-profile-cover">
              {profile.coverKey && (
                <img src={mediaUrl(profile.coverKey)} alt="" />
              )}
            </div>

            <section className="public-profile-info">
              <div className="public-profile-avatar">
                {profile.avatarKey ? (
                  <img src={mediaUrl(profile.avatarKey)} alt="" />
                ) : (
                  <span>{profile.name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>

              <h1>{profile.name}</h1>
              <p>{profile.bio || 'No bio added yet.'}</p>

              <div className="public-profile-count">
                <strong>{profile.connectionsCount}</strong>
                <span>Connections</span>
              </div>

              {renderConnectionAction()}
              {notice && <p className="public-profile-notice">{notice}</p>}
            </section>

            {(profile.relationship === 'FRIENDS' || profile.relationship === 'SELF') && activeCheckins.some(item => item.userId === profile.id) &&
              <section className="blink-ci-profile" aria-label="Active Check-In">
                <div className="blink-ci-preview-head"><h2>🧡 Active Check-In</h2></div>
                <NotesRow items={activeCheckins.filter(item => item.userId === profile.id)} />
              </section>}

            <section className="public-profile-moments">
              <div className="public-profile-moments-heading">
                <h2>Moments</h2>
                <span>{profile.moments.length} public moments</span>
              </div>

              {profile.moments.length === 0 ? (
                <p className="public-profile-message">
                  No public Moments to show yet.
                </p>
              ) : (
                <div className="public-profile-grid">
                  {profile.moments.map((moment) => (
                    <div className="public-profile-moment" key={moment.id}>
                      {moment.mediaType === 'video' ? (
                        <video
                          src={mediaUrl(moment.mediaUrl)}
                          controls
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={mediaUrl(moment.mediaUrl)}
                          alt={moment.caption || 'Public Moment'}
                          loading="lazy"
                        />
                      )}
                      {moment.caption && (
                        <p className="public-profile-caption">
                          {moment.caption}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
