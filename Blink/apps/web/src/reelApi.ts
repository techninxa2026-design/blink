export const REELS_API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
export type Reel = {
  id: string;
  authorId: string;
  author: { id: string; name: string; avatarKey: string | null };
  caption: string | null;
  createdAt: string;
  durationSeconds: number | null;
  coverTimeSeconds: number;
  videoUrl: string;
  thumbnailUrl: string;
  views: number;
  reactionCount: number;
  commentCount: number;
  myReaction: string | null;
};
export type ReelComment = {
  id: string; reelId: string; authorId: string; parentId: string | null;
  body: string; deletedAt: string | null; createdAt: string;
  author: { id: string; name: string; avatarKey: string | null };
  replies: ReelComment[];
};
export type ReelFriend = { id: string; name: string; avatarKey: string | null };

export const reelToken = () =>
  localStorage.getItem('blink-access-token') || sessionStorage.getItem('blink-access-token');
export const reelMediaUrl = (value: string) =>
  value.startsWith('http') ? value : REELS_API + value;

export async function reelRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const jwt = reelToken();
  if (!jwt) throw new Error('Sign in to continue.');
  const response = await fetch(REELS_API + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + jwt,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  const value = await response.json().catch(() => null) as { message?: string | string[] } | null;
  if (!response.ok) throw new Error(
    (Array.isArray(value?.message) ? value.message.join(', ') : value?.message) ||
      'Request failed (' + response.status + ').',
  );
  return value as T;
}

/** Extract a selected frame from any point in the uploaded video. */
export async function videoCoverJpeg(videoFile: File, atSecond: number): Promise<Blob> {
  const url = URL.createObjectURL(videoFile);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Unable to read the video for thumbnail.'));
      video.src = url;
      video.load();
    });
    if (!Number.isFinite(video.duration) || !video.duration ||
        !Number.isFinite(atSecond) || atSecond < 0 || atSecond > video.duration) {
      throw new Error('Choose a valid cover frame.');
    }
    const target = Math.min(atSecond, Math.max(0, video.duration - 0.05));
    await new Promise<void>((resolve, reject) => {
      const done = () => {
        video.onseeked = null;
        video.onloadeddata = null;
        video.onerror = null;
        resolve();
      };
      const fail = () => reject(new Error('Could not decode the selected cover frame.'));
      video.onerror = fail;
      if (target < 0.01) {
        // Seeking to the already-current first frame need not fire 'seeked'.
        if (video.readyState >= 2) done();
        else video.onloadeddata = done;
      } else {
        video.onseeked = done;
        video.currentTime = target;
      }
    });
    const canvas = document.createElement('canvas');
    const naturalWidth = video.videoWidth || 720, naturalHeight = video.videoHeight || 1280;
    const scale = Math.min(1, 900 / Math.max(naturalWidth, naturalHeight));
    canvas.width = Math.max(1, Math.round(naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Thumbnail processing is unavailable.');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not generate JPG cover.')),
        'image/jpeg', .85));
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

export async function uploadReel(video: File, cover: Blob, caption: string,
  duration: number, coverTime: number): Promise<Reel> {
  const jwt = reelToken();
  if (!jwt) throw new Error('Sign in to publish a Reel.');
  const form = new FormData();
  form.append('video', video, video.name);
  form.append('thumbnail', cover, 'cover.jpg');
  form.append('caption', caption.trim());
  form.append('duration', String(duration));
  form.append('coverTime', String(coverTime));
  const response = await fetch(REELS_API + '/reels/upload', {
    method: 'POST', headers: { Authorization: 'Bearer ' + jwt }, body: form,
  });
  const data = await response.json().catch(() => null) as { message?: string | string[] } | null;
  if (!response.ok) throw new Error(
    (Array.isArray(data?.message) ? data.message.join(', ') : data?.message) ||
      'Unable to publish Reel.');
  return data as Reel;
}

export function compactReelCount(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}
