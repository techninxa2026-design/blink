import { useEffect, useState } from 'react';
import { compactReelCount, reelMediaUrl, reelRequest, type Reel } from './reelApi';
import './ProfileReels.css';

type Props = {
  userId?: string;
  owner?: boolean;
  onOpenReel: (id: string) => void;
};

export default function ProfileReels({ userId, owner = false, onOpenReel }: Props) {
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState('');
  useEffect(() => {
    let live = true;
    setLoading(true);setError('');
    const path = userId ? '/reels/user/' + encodeURIComponent(userId) : '/reels/mine';
    void reelRequest<Reel[]>(path).then((data) => { if (live) setReels(data); })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : 'Cannot load Reels.');
      }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [userId]);

  async function remove(reel: Reel) {
    if (!owner || deletingId) return;
    if (!window.confirm('Permanently delete this Reel, including all its reactions, comments and views?')) return;
    setDeletingId(reel.id);setError('');
    try {
      await reelRequest('/reels/' + encodeURIComponent(reel.id), 'DELETE');
      setReels((items) => items.filter((item) => item.id !== reel.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete Reel.');
    } finally { setDeletingId(''); }
  }

  return <section className="profile-reels" aria-label={owner ? 'My Reels' : 'Creator Reels'}>
    <div className="profile-reels-header">
      <div><h2>{owner ? 'My Reels' : 'Reels'}</h2>
        <p>Vertical videos you can revisit and share</p></div>
      <span>{reels.length} Reels</span>
    </div>
    {error && <p className="profile-reels-error" role="alert">{error}</p>}
    {loading ? <p>Loading Reels…</p> : reels.length === 0
      ? <div className="profile-reels-empty">{owner ? 'You have not posted any Reels yet.' : 'No Reels posted yet.'}</div>
      : <div className="profile-reels-grid">
        {reels.map((reel) => <article key={reel.id} className="profile-reel-card">
          <button type="button" className="profile-reel-open" aria-label={'Open Reel ' + (reel.caption || '')}
            onClick={() => onOpenReel(reel.id)}>
            <img src={reelMediaUrl(reel.thumbnailUrl)} alt={reel.caption || 'Reel thumbnail'} loading="lazy"/>
            <span className="profile-reel-play">▶</span>
            <span className="profile-reel-views">◉ {compactReelCount(reel.views)} views</span>
          </button>
          {owner && <button type="button" className="profile-reel-delete" disabled={Boolean(deletingId)}
            title="Delete this Reel" aria-label="Delete Reel" onClick={() => void remove(reel)}>
            {deletingId === reel.id ? '…' : '🗑'}
          </button>}
        </article>)}
      </div>}
  </section>;
}
