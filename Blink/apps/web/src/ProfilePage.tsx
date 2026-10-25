
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import './ProfilePage.css';
import ProfileReels from './ProfileReels';
import { NotesRow, useActiveCheckins } from './CheckinPreview';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

type Profile = {
  id: string;
  name: string;
  bio: string | null;
  email?: string;
  phoneNumber?: string;
  college?: string | null;
  highSchool?: string | null;
  occupation?: string | null;
  workplace?: string | null;
  avatarKey: string | null;
  coverKey: string | null;
  followersCount: number;
  followingCount: number;
  connectionsCount: number;
};

type ProfileFriend = { friendshipId: string; user: { id: string; name: string; bio: string | null; avatarKey: string | null } };

type ProfileMoment = {
  id: string;
  mediaUrl: string;
  mediaType: 'photo' | 'video';
  caption: string | null;
};

type ProfilePageProps = {
  onBack: () => void;
  onOpenReel: (id: string) => void;
  onOpenProfile: (id: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

function mediaUrl(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('/')) {
    return `${API_URL}${value}`;
  }

  return `${API_URL}/uploads/${encodeURIComponent(value)}`;
}

export default function ProfilePage({
  onBack,
  onOpenReel,
  onOpenProfile,
  theme,
  onToggleTheme,
}: ProfilePageProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const { items: activeCheckins } = useActiveCheckins();
  const [moments, setMoments] = useState<ProfileMoment[]>([]);
  const [profileTab, setProfileTab] = useState<'All' | 'About' | 'Friends' | 'Moments' | 'Reels' | 'Check-ins' | 'More'>('All');
  const [friends, setFriends] = useState<ProfileFriend[]>([]);
  const [peopleModal, setPeopleModal] = useState<'Followers' | 'Following' | 'Connections' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCollege, setEditCollege] = useState('');
  const [editHighSchool, setEditHighSchool] = useState('');
  const [editOccupation, setEditOccupation] = useState('');
  const [editWorkplace, setEditWorkplace] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
const coverInputRef = useRef<HTMLInputElement>(null);

const [uploadingImage, setUploadingImage] = useState<
  'avatar' | 'cover' | null
>(null);

const [uploadError, setUploadError] = useState('');
const [uploadSuccess, setUploadSuccess] = useState('');
const [momentToDelete, setMomentToDelete] =
  useState<ProfileMoment | null>(null);

const [deletingMomentId, setDeletingMomentId] =
  useState<string | null>(null);

const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const token =
      localStorage.getItem('blink-access-token') ||
      sessionStorage.getItem('blink-access-token');

    if (!token) {
      setError('Please sign in to view your profile.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      try {
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [profileResponse, momentsResponse, friendsResponse] = await Promise.all([
          fetch(`${API_URL}/profile/me`, { headers }),
          fetch(`${API_URL}/moments/mine`, { headers }),
          fetch(`${API_URL}/friends`, { headers }),
        ]);

        if (!profileResponse.ok || !momentsResponse.ok) {
          throw new Error('Could not load your profile.');
        }

        const profileData = (await profileResponse.json()) as Profile;
        const momentsData =
          (await momentsResponse.json()) as ProfileMoment[];

        if (!cancelled) {
          setProfile(profileData);
          setMoments(momentsData);
          if (friendsResponse.ok) setFriends((await friendsResponse.json()) as ProfileFriend[]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Something went wrong.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  // Open Edit Profile and populate the form.
  function startEditing() {
    if (!profile) return;

    setEditName(profile.name);
    setEditBio(profile.bio || '');
    setEditCollege(profile.college || '');
    setEditHighSchool(profile.highSchool || '');
    setEditOccupation(profile.occupation || '');
    setEditWorkplace(profile.workplace || '');
    setSaveError('');
    setSaveSuccess('');
    setIsEditing(true);
  }

  // Close Edit Profile without saving.
  function cancelEditing() {
    setIsEditing(false);
    setSaveError('');
  }

  // Save display name and bio to the backend.
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) return;

    const name = editName.trim();
    const bio = editBio.trim();

    if (name.length < 2 || name.length > 80) {
      setSaveError('Name must be between 2 and 80 characters.');
      return;
    }

    if (bio.length > 300) {
      setSaveError('Bio cannot exceed 300 characters.');
      return;
    }

    const token =
      localStorage.getItem('blink-access-token') ||
      sessionStorage.getItem('blink-access-token');

    if (!token) {
      setSaveError('Please sign in again.');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      const response = await fetch(`${API_URL}/profile/me`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          bio,
          college: editCollege.trim(),
          highSchool: editHighSchool.trim(),
          occupation: editOccupation.trim(),
          workplace: editWorkplace.trim(),
        }),
      });

      if (!response.ok) {
        let message = 'Could not save profile.';

        try {
          const result = (await response.json()) as {
            message?: string | string[];
          };

          if (Array.isArray(result.message)) {
            message = result.message.join(', ');
          } else if (typeof result.message === 'string') {
            message = result.message;
          }
        } catch {
          // Use the default error message if JSON is unavailable.
        }

        throw new Error(message);
      }

      const updatedProfile = (await response.json()) as Profile;

      setProfile(updatedProfile);
      setIsEditing(false);
      setSaveSuccess('Profile updated successfully.');

      // Synchronize the stored user name with the updated profile.
      for (const storage of [localStorage, sessionStorage]) {
        const storedUser = storage.getItem('blink-user');

        if (!storedUser) continue;

        try {
          const parsedUser = JSON.parse(storedUser) as Record<
            string,
            unknown
          >;

          storage.setItem(
            'blink-user',
            JSON.stringify({
              ...parsedUser,
              name: updatedProfile.name,
            }),
          );
        } catch {
          // Ignore malformed stored user data.
        }
      }
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Could not save profile.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  
async function handleImageUpload(
  event: ChangeEvent<HTMLInputElement>,
  kind: 'avatar' | 'cover',
) {
  const file = event.target.files?.[0];

  // Allow selecting the same file again later.
  event.target.value = '';

  if (!file) return;

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  const maxBytes =
    kind === 'avatar'
      ? 5 * 1024 * 1024
      : 10 * 1024 * 1024;

  if (!allowedTypes.includes(file.type)) {
    setUploadError('Please select a JPG, PNG, or WebP image.');
    return;
  }

  if (file.size > maxBytes) {
    setUploadError(
      kind === 'avatar'
        ? 'Profile picture must be 5 MB or smaller.'
        : 'Cover photo must be 10 MB or smaller.',
    );
    return;
  }

  const token =
    localStorage.getItem('blink-access-token') ||
    sessionStorage.getItem('blink-access-token');

  if (!token) {
    setUploadError('Please sign in again.');
    return;
  }

  setUploadingImage(kind);
  setUploadError('');
  setUploadSuccess('');

  try {
    const formData = new FormData();
    formData.append('file', file);

    const endpoint =
      kind === 'avatar'
        ? `${API_URL}/profile/me/avatar`
        : `${API_URL}/profile/me/cover`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      let message = 'Image upload failed.';

      try {
        const result = (await response.json()) as {
          message?: string | string[];
        };

        if (Array.isArray(result.message)) {
          message = result.message.join(', ');
        } else if (typeof result.message === 'string') {
          message = result.message;
        }
      } catch {
        // Keep the default message.
      }

      throw new Error(message);
    }

    const updatedProfile = (await response.json()) as Profile;

    setProfile(updatedProfile);
    setUploadSuccess(
      kind === 'avatar'
        ? 'Profile picture updated successfully.'
        : 'Cover photo updated successfully.',
    );
  } catch (err) {
    setUploadError(
      err instanceof Error
        ? err.message
        : 'Could not upload image.',
    );
  } finally {
    setUploadingImage(null);
  }
}

async function deleteMoment() {
  if (!momentToDelete || deletingMomentId) return;

  const token =
    localStorage.getItem('blink-access-token') ||
    sessionStorage.getItem('blink-access-token');

  if (!token) {
    setDeleteError('Please sign in again.');
    return;
  }

  const momentId = momentToDelete.id;

  setDeletingMomentId(momentId);
  setDeleteError('');

  try {
    const response = await fetch(
      `${API_URL}/moments/${encodeURIComponent(momentId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      let message = 'Could not delete Moment.';

      try {
        const result = (await response.json()) as {
          message?: string | string[];
        };

        if (Array.isArray(result.message)) {
          message = result.message.join(', ');
        } else if (typeof result.message === 'string') {
          message = result.message;
        }
      } catch {
        // Keep the default error message.
      }

      throw new Error(message);
    }

    // Update the grid without refreshing the page.
    setMoments((currentMoments) =>
      currentMoments.filter(
        (moment) => moment.id !== momentId,
      ),
    );

    setMomentToDelete(null);
  } catch (err) {
    setDeleteError(
      err instanceof Error
        ? err.message
        : 'Could not delete Moment.',
    );
  } finally {
    setDeletingMomentId(null);
  }
}


  return (
    <main className="blink-profile">
      <header className="profile-topbar">
        <button type="button" onClick={onBack}>
          ← Back
        </button>

        <img src="/blink-logo.png" alt="Blink" />

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={
            theme === 'light'
              ? 'Switch to dark mode'
              : 'Switch to light mode'
          }
        >
          {theme === 'light' ? '☾' : '☀'}
        </button>
      </header>

      {loading && (
        <p className="profile-message">Loading profile…</p>
      )}

      {error && (
        <p className="profile-message" role="alert">
          {error}
        </p>
      )}

      {profile && (
        <div className="profile-container">
          {/* Profile cover */}
          
<div className="profile-cover">
  {profile.coverKey && (
    <img
      src={mediaUrl(profile.coverKey)}
      alt="Profile cover"
    />
  )}

  <input
    ref={coverInputRef}
    className="profile-hidden-file-input"
    type="file"
    accept="image/jpeg,image/png,image/webp"
    aria-label="Select cover photo"
    onChange={(event) => {
      void handleImageUpload(event, 'cover');
    }}
    disabled={uploadingImage !== null}
  />

  <button
    type="button"
    className="profile-cover-edit"
    onClick={() => coverInputRef.current?.click()}
    disabled={uploadingImage !== null}
  >
    {uploadingImage === 'cover'
      ? 'Uploading...'
      : '📷 Edit Cover'}
  </button>
</div>


          {/* Profile information */}
          <section className="profile-details">
           
<div className="profile-avatar-wrapper">
  <div className="profile-avatar">
    {profile.avatarKey ? (
      <img
        src={mediaUrl(profile.avatarKey)}
        alt={profile.name}
      />
    ) : (
      <span>
        {profile.name
          .split(' ')
          .filter(Boolean)
          .map((part) => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()}
      </span>
    )}
  </div>

  <input
    ref={avatarInputRef}
    className="profile-hidden-file-input"
    type="file"
    accept="image/jpeg,image/png,image/webp"
    aria-label="Select profile picture"
    onChange={(event) => {
      void handleImageUpload(event, 'avatar');
    }}
    disabled={uploadingImage !== null}
  />

  <button
    type="button"
    className="profile-avatar-edit"
    aria-label="Change profile picture"
    title="Change profile picture"
    onClick={() => avatarInputRef.current?.click()}
    disabled={uploadingImage !== null}
  >
    {uploadingImage === 'avatar' ? '…' : <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h3l2-2h6l2 2h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>}
  </button>
</div>
{uploadError && (
  <p className="profile-save-error" role="alert">
    {uploadError}
  </p>
)}

{uploadSuccess && (
  <p className="profile-save-success" role="status">
    {uploadSuccess}
  </p>
)}

            <div className="profile-name-row">
              <h1>{profile.name}</h1>

              {!isEditing && (
                <button
                  type="button"
                  className="profile-edit-button"
                  onClick={startEditing}
                >
                  <span aria-hidden="true">✎</span> Edit Profile
                </button>
              )}
            </div>

            <p className="profile-bio">
              {profile.bio || 'Your Blink bio will appear here.'}
            </p>
            <div className="profile-stats" aria-label="Profile connections">
              {([
                ['Followers', profile.followersCount],
                ['Following', profile.followingCount],
                ['Connections', profile.connectionsCount],
              ] as const).map(([label, count]) => (
                <button key={label} type="button" className="profile-stat-button" onClick={() => setPeopleModal(label)}>
                  <strong>{count}</strong><span>{label}</span>
                </button>
              ))}
            </div>

            {saveSuccess && (
              <p
                className="profile-save-success"
                role="status"
              >
                {saveSuccess}
              </p>
            )}

            {/* Edit Profile form */}
            {isEditing && (
              <form
                className="profile-edit-form"
                onSubmit={saveProfile}
              >
                <label htmlFor="profile-edit-name">
                  Name
                </label>

                <input
                  id="profile-edit-name"
                  type="text"
                  value={editName}
                  onChange={(event) =>
                    setEditName(event.target.value)
                  }
                  maxLength={80}
                  minLength={2}
                  required
                  disabled={isSaving}
                />

                <label htmlFor="profile-edit-bio">
                  Bio
                </label>

                <textarea
                  id="profile-edit-bio"
                  value={editBio}
                  onChange={(event) =>
                    setEditBio(event.target.value)
                  }
                  maxLength={300}
                  rows={4}
                  placeholder="Tell people a little about yourself..."
                  disabled={isSaving}
                />

                <span className="profile-bio-counter">
                  {editBio.length}/300
                </span>
                <div className="profile-edit-group-label">🎓 Education</div>
                <label htmlFor="profile-edit-college">College or university</label>
                <input id="profile-edit-college" maxLength={160} value={editCollege} placeholder="Add your college" onChange={e => setEditCollege(e.target.value)} disabled={isSaving} />
                <label htmlFor="profile-edit-high-school">High school</label>
                <input id="profile-edit-high-school" maxLength={160} value={editHighSchool} placeholder="Add your high school" onChange={e => setEditHighSchool(e.target.value)} disabled={isSaving} />
                <div className="profile-edit-group-label">💼 Work</div>
                <label htmlFor="profile-edit-occupation">Occupation</label>
                <input id="profile-edit-occupation" maxLength={160} value={editOccupation} placeholder="What do you do?" onChange={e => setEditOccupation(e.target.value)} disabled={isSaving} />
                <label htmlFor="profile-edit-workplace">Workplace (optional)</label>
                <input id="profile-edit-workplace" maxLength={160} value={editWorkplace} placeholder="Where do you work?" onChange={e => setEditWorkplace(e.target.value)} disabled={isSaving} />

                {saveError && (
                  <p
                    className="profile-save-error"
                    role="alert"
                  >
                    {saveError}
                  </p>
                )}

                <div className="profile-edit-actions">
                  <button
                    type="button"
                    className="profile-cancel-button"
                    onClick={cancelEditing}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="profile-save-button"
                    disabled={isSaving}
                  >
                    {isSaving
                      ? 'Saving...'
                      : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

          </section>

          <nav className="profile-sections-nav" aria-label="Profile sections">
            {(['All','About','Friends','Moments','Reels','Check-ins','More'] as const).map(tab => (
              <button key={tab} type="button" className={profileTab === tab ? 'active' : ''} aria-current={profileTab === tab ? 'page' : undefined} onClick={() => setProfileTab(tab)}>{tab}</button>
            ))}
          </nav>
          {(profileTab === 'All' || profileTab === 'About') && (
            <section className="profile-about-card" aria-label="About me">
              <h2>About me</h2>
              <p className="profile-about-intro">{profile.bio || 'Share a little about yourself with your Blink connections.'}</p>
              <div className="profile-about-grid">
                <div><span>🎓 College / University</span><strong>{profile.college || 'Not added yet'}</strong></div>
                <div><span>🏫 High school</span><strong>{profile.highSchool || 'Not added yet'}</strong></div>
                <div><span>💼 Occupation</span><strong>{profile.occupation || 'Not added yet'}</strong></div>
                <div><span>🏢 Workplace</span><strong>{profile.workplace || 'Not added yet'}</strong></div>
                <div><span>✉ Email</span><strong>{profile.email || 'Not available'}</strong></div>
                <div><span>☎ Phone</span><strong>{profile.phoneNumber || 'Not available'}</strong></div>
              </div>
              <button type="button" className="profile-about-edit" onClick={startEditing}>✎ Edit About</button>
            </section>
          )}
          {(profileTab === 'All' || profileTab === 'Friends') && (
            <section className="profile-about-card" aria-label="My friends">
              <h2>Friends <small>({friends.length})</small></h2>
              {friends.length ? <div className="profile-friends-list">{friends.map(friend => (
                <button key={friend.friendshipId} type="button" onClick={() => onOpenProfile(friend.user.id)}>
                  {friend.user.avatarKey ? <img src={mediaUrl(friend.user.avatarKey)} alt="" /> : <span>{friend.user.name.slice(0,1).toUpperCase()}</span>}
                  <strong>{friend.user.name}</strong>
                </button>
              ))}</div> : <p className="profile-empty">Your connections will appear here.</p>}
            </section>
          )}
          {(profileTab === 'All' || profileTab === 'Check-ins') && (
          <section className="blink-ci-profile" aria-label="My Check-In">
            <div className="blink-ci-preview-head"><h2>🧡 My Check-In</h2></div>
            {activeCheckins.find(item => item.userId === profile.id) ?
              <NotesRow items={activeCheckins.filter(item => item.userId === profile.id)} ownId={profile.id} /> :
              <p className="blink-ci-preview-empty">You have no active Check-In.</p>}
          </section>
          )}

          {(profileTab === 'All' || profileTab === 'Moments') && <section className="profile-moments">
            <div className="profile-section-heading">
              <h2>My Moments</h2>
              <span>{moments.length} moments</span>
            </div>

            {moments.length === 0 ? (
              <p className="profile-empty">
                You haven't shared any moments yet.
              </p>
            ) : (
              <div className="profile-moments-grid">
                {moments.map((moment) => (
                  <div
                    className="profile-moment-card"
                    key={moment.id}
                  >
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
                        alt={moment.caption || 'My moment'}
                        loading="lazy"
                      />
                    )}

                    <span className="profile-moment-kind">
                      {moment.mediaType === 'video'
                        ? '▶'
                        : '▧'}
                    </span>

                        <button
  type="button"
  className="profile-moment-delete"
  aria-label="Delete Moment"
  title="Delete Moment"
  onClick={() => {
    setDeleteError('');
    setMomentToDelete(moment);
  }}
>
  🗑
</button>



                  </div>
                ))}
              </div>
            )}
          </section>}
          {(profileTab === 'All' || profileTab === 'Reels') && <section className="profile-reels-section"><h2>My Reels</h2><ProfileReels owner onOpenReel={onOpenReel} /></section>}
          {profileTab === 'More' && <section className="profile-about-card"><h2>More</h2><p className="profile-empty">More Blink features will appear here.</p></section>}

{peopleModal && (
          <div className="profile-people-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setPeopleModal(null); }}>
            <section className="profile-people-dialog" role="dialog" aria-modal="true" aria-label={peopleModal}>
              <header><h2>{peopleModal} <span>({friends.length})</span></h2><button type="button" aria-label="Close" onClick={() => setPeopleModal(null)}>×</button></header>
              <p>Friends on Blink are automatically your followers and following.</p>
              <div className="profile-people-list">
                {friends.map(friend => <button type="button" key={friend.friendshipId} onClick={() => { setPeopleModal(null); onOpenProfile(friend.user.id); }}>
                  {friend.user.avatarKey ? <img alt="" src={mediaUrl(friend.user.avatarKey)} /> : <span>{friend.user.name.slice(0,1).toUpperCase()}</span>}
                  <strong>{friend.user.name}</strong><small>View profile ›</small>
                </button>)}
                {!friends.length && <p>No connections yet.</p>}
              </div>
            </section>
          </div>
        )}
{momentToDelete && (
  <div
    className="profile-delete-overlay"
    role="presentation"
  >
    <div
      className="profile-delete-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-delete-title"
      aria-describedby="profile-delete-description"
    >
      <div className="profile-delete-icon">🗑</div>

      <h2 id="profile-delete-title">
        Delete this Moment?
      </h2>

      <p id="profile-delete-description">
        This Moment will be permanently deleted from Blink.
        This action cannot be undone.
      </p>

      {deleteError && (
        <p className="profile-save-error" role="alert">
          {deleteError}
        </p>
      )}

      <div className="profile-delete-actions">
        <button
          type="button"
          className="profile-delete-cancel"
          onClick={() => {
            setMomentToDelete(null);
            setDeleteError('');
          }}
          disabled={deletingMomentId !== null}
        >
          Cancel
        </button>

        <button
          type="button"
          className="profile-delete-confirm"
          onClick={() => {
            void deleteMoment();
          }}
          disabled={deletingMomentId !== null}
        >
          {deletingMomentId
            ? 'Deleting...'
            : 'Delete Moment'}
        </button>
      </div>
    </div>
  </div>
)}




        </div>
      )}
    </main>
  );
}
