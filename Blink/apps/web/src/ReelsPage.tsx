import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  compactReelCount, reelMediaUrl, reelRequest, type Reel,
  type ReelComment, type ReelFriend,
} from './reelApi';
import './Reels.css';

type Props = {
  initialReelId?: string;
  currentUserId: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onBack: () => void;
  onCreate: () => void;
  onOpenProfile: (userId: string) => void;
};
const REACTIONS = ['❤️','😂','😍','😮','😢','👍','🔥'];
const formatTime = (value: string) => {
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return '';
  const minutes = Math.floor((Date.now() - t) / 60000);
  return minutes < 1 ? 'just now' : minutes < 60 ? minutes + 'm' :
    minutes < 1440 ? Math.floor(minutes / 60) + 'h' : Math.floor(minutes / 1440) + 'd';
};
type Panel = 'comments' | 'share' | null;
function AuthorAvatar({ name, avatarKey }: { name: string; avatarKey?: string | null }) {
  return avatarKey
    ? <img className="br-avatar" src={reelMediaUrl('/uploads/' + encodeURIComponent(avatarKey))} alt="" />
    : <span className="br-avatar">{name.slice(0, 1).toUpperCase()}</span>;
}

export default function ReelsPage({
  initialReelId, currentUserId, theme, onToggleTheme,
  onBack, onCreate, onOpenProfile,
}: Props) {
  const [reels, setReels] = useState<Reel[]>([]);
  const [index, setIndex] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<Panel>(null);
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ReelComment | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);
  const [reactionPicker, setReactionPicker] = useState(false);
  const [friends, setFriends] = useState<ReelFriend[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [shareBusy, setShareBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seenRef = useRef(new Set<string>());
  const wheelAtRef = useRef(0);
  const touchStartRef = useRef(0);
  const busyMoreRef = useRef(false);

  const reel = reels[index] || null;

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');setReels([]);setIndex(0);
    const first = initialReelId
      ? Promise.all([
          reelRequest<Reel>('/reels/' + encodeURIComponent(initialReelId)),
          reelRequest<{ items: Reel[]; nextOffset: number | null }>('/reels?skip=0'),
        ]).then(([target, feed]) => ({
          items: [target, ...feed.items.filter((item) => item.id !== target.id)],
          nextOffset: feed.nextOffset,
        }))
      : reelRequest<{ items: Reel[]; nextOffset: number | null }>('/reels?skip=0');
    void first.then((data) => {
      if (!alive) return;
      setReels(data.items); setNextOffset(data.nextOffset);
    }).catch((err: unknown) => {
      if (alive) setError(err instanceof Error ? err.message : 'Unable to load Reels.');
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [initialReelId]);

  useEffect(() => {
    if (!reel) return;
    setPanel(null); setComments([]); setReplyTo(null);
    setReactionPicker(false); setNotice('');
    setPlaying(false);
    const video = videoRef.current;
    if (video) { video.muted = muted; void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  }, [reel?.id]);

  async function loadMore() {
    if (nextOffset === null || busyMoreRef.current) return;
    busyMoreRef.current = true;setLoadingMore(true);
    try {
      const next = await reelRequest<{ items: Reel[]; nextOffset: number | null }>(
        '/reels?skip=' + nextOffset,
      );
      setReels((before) => [...before, ...next.items.filter((item) =>
        !before.some((existing) => existing.id === item.id))]);
      setNextOffset(next.nextOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more Reels.');
    } finally { busyMoreRef.current = false; setLoadingMore(false); }
  }
  function navigate(delta: number) {
    if (!reels.length || panel) return;
    const next = Math.max(0, Math.min(reels.length - 1, index + delta));
    setIndex(next);
    if (delta > 0 && reels.length - next < 5) void loadMore();
  }
  function onWheel(delta: number) {
    if (Math.abs(delta) < 16 || panel) return;
    if (performance.now() - wheelAtRef.current < 650) return;
    wheelAtRef.current = performance.now();
    navigate(delta > 0 ? 1 : -1);
  }
  function markViewed() {
    if (!reel || seenRef.current.has(reel.id)) return;
    seenRef.current.add(reel.id);
    void reelRequest<{ views: number }>('/reels/' + encodeURIComponent(reel.id) + '/view','POST')
      .then((data) => setReels((old) => old.map((item) =>
        item.id === reel.id ? { ...item, views: data.views } : item))).catch(() => {
          seenRef.current.delete(reel.id);
        });
  }

  async function react(emoji: string | null) {
    if (!reel) return;
    setReactionPicker(false);
    try {
      const result = await reelRequest<{ myReaction: string | null; reactionCount: number }>(
        '/reels/' + encodeURIComponent(reel.id) + '/react','POST',{ emoji },
      );
      setReels((old) => old.map((item) => item.id === reel.id ? { ...item, ...result } : item));
    } catch (err) { setError(err instanceof Error ? err.message : 'Reaction failed.'); }
  }

  async function showComments() {
    if (!reel) return;
    setPanel('comments');setError('');setReplyTo(null);
    try {
      setComments(await reelRequest<ReelComment[]>('/reels/' + encodeURIComponent(reel.id) + '/comments'));
    } catch (err) { setError(err instanceof Error ? err.message : 'Cannot load comments.'); }
  }

  async function postComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reel || !commentDraft.trim() || commentBusy) return;
    setCommentBusy(true);setError('');
    try {
      await reelRequest('/reels/' + encodeURIComponent(reel.id) + '/comments',
        'POST',{ body: commentDraft.trim(), parentId: replyTo?.id ?? null });
      setComments(await reelRequest<ReelComment[]>('/reels/' + encodeURIComponent(reel.id) + '/comments'));
      setReels((old) => old.map((x) =>
        x.id === reel.id ? { ...x, commentCount: x.commentCount + 1 } : x));
      setCommentDraft('');setReplyTo(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not post comment.'); }
    finally {setCommentBusy(false);}
  }
  async function deleteComment(id: string) {
    if (!reel || !window.confirm('Delete your comment?')) return;
    try {
      await reelRequest('/reels/comments/' + encodeURIComponent(id),'DELETE');
      setComments(await reelRequest<ReelComment[]>('/reels/' + encodeURIComponent(reel.id) + '/comments'));
      setReels((old) => old.map((x) =>
        x.id === reel.id ? { ...x, commentCount: Math.max(0,x.commentCount - 1) } : x));
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete comment.'); }
  }
  function commentNode(comment: ReelComment, nested = false) {
    const deleted = Boolean(comment.deletedAt);
    return <div className={'br-thread' + (nested ? ' nested' : '')} key={comment.id}>
      <div className="br-thread-head">
        <AuthorAvatar name={comment.author.name} avatarKey={comment.author.avatarKey}/>
        <div className="br-thread-main">
          <strong>{deleted ? 'Deleted comment' : comment.author.name}</strong>
          <p>{deleted ? 'This comment has been deleted.' : comment.body}</p>
          {!deleted && <div className="br-thread-opts">
            <span>{formatTime(comment.createdAt)}</span>
            <button type="button" onClick={() => setReplyTo(comment)}>Reply</button>
            {comment.authorId === currentUserId && <button type="button"
              onClick={() => void deleteComment(comment.id)}>Delete</button>}
          </div>}
        </div>
      </div>
      {comment.replies?.map((child) => commentNode(child,true))}
    </div>;
  }

  async function showShare() {
    if (!reel) return;
    setPanel('share');setError('');setRecipients([]);
    try {
      setFriends(await reelRequest<ReelFriend[]>('/inbox/friends'));
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load Inbox friends.'); }
  }
  async function sendShare() {
    if (!reel || !recipients.length || shareBusy) return;
    setShareBusy(true);setError('');
    try {
      const result = await reelRequest<{ sent: number }>(
        '/reels/' + encodeURIComponent(reel.id) + '/share', 'POST',
        { friendIds: recipients },
      );
      setNotice('Sent this Reel with its thumbnail and link to ' + result.sent + ' Inbox friend' +
        (result.sent === 1 ? '.' : 's.'));
      setPanel(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not share this Reel.'); }
    finally { setShareBusy(false); }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowDown') navigate(1);
      if (event.key === 'ArrowUp') navigate(-1);
      if (event.key === 'Escape') setPanel(null);
    }
    window.addEventListener('keydown',onKey);
    return () => window.removeEventListener('keydown',onKey);
  }, [index, reels.length, nextOffset, panel]);

  return <main className="br-page" data-theme={theme}>
    <header className="br-topbar">
      <button type="button" onClick={onBack}>← Home</button>
      <strong>blink<span>●</span> Reels</strong>
      <div><button type="button" onClick={onToggleTheme}>{theme === 'light' ? '☾' : '☀'}</button>
</div>
    </header>
    <div className="br-container br-reels-feed">
      <div className="br-feed-heading">
        <div><span className="br-eyebrow">FOR YOU</span><h1>Reels <span>●</span></h1></div>
        <span className="br-hint">Scroll, swipe or use ↑ ↓ to browse</span>
      </div>
      {error && <div className="br-error" role="alert">{error}</div>}
      {notice && <div className="br-success" role="status">{notice}</div>}
      {loading ? <div className="br-empty">Loading Reels…</div> :
        !reel ? <div className="br-empty">
          <h2>No Reels yet</h2><p>Be the first to share a video with Blink.</p>
          <button type="button" className="br-primary" onClick={onCreate}>Create a Reel</button>
        </div> :
        <div className="br-feed-layout" onWheel={(event) => onWheel(event.deltaY)}
          onTouchStart={(event) => { touchStartRef.current = event.touches[0]?.clientY ?? 0; }}
          onTouchEnd={(event) => {
            const delta = touchStartRef.current - (event.changedTouches[0]?.clientY ?? touchStartRef.current);
            if (Math.abs(delta) > 55) navigate(delta > 0 ? 1 : -1);
          }}>
          <div className="br-feed-arrows">
            <button type="button" aria-label="Previous Reel" disabled={index === 0} onClick={() => navigate(-1)}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 15 6-6 6 6"/></svg></button>
            <span>{index + 1} / {reels.length}{nextOffset !== null ? '+' : ''}</span>
            <button type="button" aria-label="Next Reel" disabled={index === reels.length - 1 && nextOffset === null}
              onClick={() => index === reels.length-1 ? void loadMore() : navigate(1)}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
          </div>
          <article className="br-viewer" aria-label="Current Reel">
            <video key={reel.id} ref={videoRef} className="br-player" playsInline muted={muted}
              autoPlay loop poster={reelMediaUrl(reel.thumbnailUrl)} src={reelMediaUrl(reel.videoUrl)}
              onTimeUpdate={(event) => { if (event.currentTarget.currentTime >= 2) markViewed(); }}
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                if (video.paused) void video.play().catch(() => setPlaying(false));
                else video.pause();
              }} />
            <div className="br-top-badges">
              <span>▶ REELS</span><button type="button" onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                video.muted = !video.muted;setMuted(video.muted);
              }}>{muted ? '🔇 Unmute' : '🔊 Sound'}</button>
            </div>
            {!playing && <button type="button" className="br-center-play" onClick={() =>
              void videoRef.current?.play().catch(() => {})}>▶</button>}
            <div className="br-caption">
              <button className="br-author" type="button" onClick={() => onOpenProfile(reel.authorId)}>
                <AuthorAvatar name={reel.author.name} avatarKey={reel.author.avatarKey}/>
                <strong>{reel.author.name}</strong><span>›</span></button>
              <p>{reel.caption || 'A moment worth sharing ✨'}</p>
              <small>♫ Original video audio · {formatTime(reel.createdAt)}</small>
            </div>
            <div className="br-action-rail">
              <button type="button" aria-label="React to Reel" onClick={() => setReactionPicker((v) => !v)}>
                <span>{reel.myReaction ?? '♡'}</span><small>{compactReelCount(reel.reactionCount)}</small></button>
              {reactionPicker && <div className="br-reactions" role="group" aria-label="Choose reaction">
                {REACTIONS.map((emoji) => <button type="button" key={emoji}
                  onClick={() => void react(emoji === reel.myReaction ? null : emoji)}>{emoji}</button>)}
              </div>}
              <button type="button" aria-label="Comments" onClick={() => void showComments()}>
                <span>▤</span><small>{compactReelCount(reel.commentCount)}</small></button>
              <button type="button" aria-label="Share to Blink Inbox" onClick={() => void showShare()}>
                <span>➤</span><small>Share</small></button>
              <div className="br-views-badge"><span>◉</span><strong>{compactReelCount(reel.views)}</strong><small>Views</small></div>
            </div>
          </article>
          <div className="br-feed-rail">
            <strong>Explore Reels</strong><p>Swipe up for the next Reel.</p>
            
            {loadingMore && <p>Loading more…</p>}
          </div>
        </div>}
      <button type="button" className="br-create-floating" onClick={onCreate}>＋ Create Reel</button>
      {panel && <div className="br-panel-backdrop" onClick={() => setPanel(null)}>
        <section className="br-panel" role="dialog" aria-modal="true"
          aria-label={panel === 'comments' ? 'Reel comments' : 'Share Reel to Inbox'}
          onClick={(event) => event.stopPropagation()}>
          <header><h2>{panel === 'comments' ? 'Comments' : 'Share to Blink Inbox'}</h2>
            <button type="button" onClick={() => setPanel(null)}>✕</button></header>
          {panel === 'comments' ? <>
            <div className="br-panel-scroll">
              {comments.length === 0 ? <p className="br-hint">No comments yet. Start the conversation.</p> :
                comments.map((comment) => commentNode(comment))}
            </div>
            {replyTo && <div className="br-reply-target">Replying to {replyTo.author.name}
              <button type="button" onClick={() => setReplyTo(null)}>Cancel</button></div>}
            <form className="br-comment-form" onSubmit={(event) => void postComment(event)}>
              <input maxLength={600} value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)} placeholder="Write a comment…"/>
              <button type="submit" disabled={!commentDraft.trim() || commentBusy}>
                {commentBusy ? '…' : 'Post'}</button>
            </form>
          </> : <>
            <div className="br-panel-scroll">
              {reel && <div className="br-share-preview">
                <img alt="Reel cover" src={reelMediaUrl(reel.thumbnailUrl)}/>
                <div><strong>{reel.author.name}'s Reel</strong>
                  <p>{reel.caption || 'Watch this video on Blink'}</p>
                  <small>{window.location.origin + '/reels/' + reel.id}</small></div>
              </div>}
              <h3>Choose Inbox friends</h3>
              {friends.length === 0 ? <p className="br-hint">No friends available to share with.</p> :
                friends.map((friend) => <label className="br-friend" key={friend.id}>
                  <input type="checkbox" checked={recipients.includes(friend.id)} onChange={(event) =>
                    setRecipients((old) => event.target.checked ? [...old,friend.id].slice(0,10) :
                      old.filter((id) => id !== friend.id))}/>
                  <AuthorAvatar name={friend.name} avatarKey={friend.avatarKey}/>
                  <span>{friend.name}</span>
                </label>)}
              <p className="br-hint">Friends will receive a thumbnail and clickable Reel link.</p>
            </div>
            <div className="br-share-footer"><button type="button" className="br-primary"
              disabled={shareBusy || recipients.length === 0} onClick={() => void sendShare()}>
              {shareBusy ? 'Sending…' : 'Send Reel → ' + recipients.length}
            </button></div>
          </>}
        </section>
      </div>}
    </div>
  </main>;
}
