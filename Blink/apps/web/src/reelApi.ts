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

/**
 * Capture a video frame when the browser can decode one. Duration metadata is
 * optional (recorded WebM may report Infinity). If frame decoding is unavailable
 * locally, still upload the Reel with a branded fallback cover.
 */
export async function videoCoverJpeg(videoFile: File, atSecond: number): Promise<Blob> {
  const url = URL.createObjectURL(videoFile);
  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  try {
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => settle(false), 9000);
        const settle = (success: boolean) => {
          window.clearTimeout(timer);
          video.onloadeddata = null;
          video.onerror = null;
          if (success) resolve();
          else reject(new Error('Video frame not available for cover.'));
        };
        video.onloadeddata = () => settle(true);
        video.onerror = () => settle(false);
        video.src = url;
        video.load();
      });

      const target = Number.isFinite(atSecond) && atSecond > 0 ? atSecond : 0;
      if (target > 0.01 && video.seekable.length > 0) {
        await new Promise<void>((resolve) => {
          const finish = () => {
            window.clearTimeout(timer);
            video.onseeked = null;
            resolve();
          };
          const timer = window.setTimeout(finish, 3000);
          video.onseeked = finish;
          try { video.currentTime = target; } catch { finish(); }
        });
      }

      const naturalWidth = video.videoWidth || 720;
      const naturalHeight = video.videoHeight || 1280;
      const scale = Math.min(1, 900 / Math.max(naturalWidth, naturalHeight));
      canvas.width = Math.max(1, Math.round(naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable.');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    } catch {
      // An unsupported local decoder should not block video upload.
      canvas.width = 540;
      canvas.height = 960;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Cannot create a Reel cover in this browser.');
      const background = context.createLinearGradient(0, 0, 540, 960);
      background.addColorStop(0, '#ff782a');
      background.addColorStop(0.48, '#bf3a50');
      background.addColorStop(1, '#191529');
      context.fillStyle = background;
      context.fillRect(0, 0, 540, 960);
      context.textAlign = 'center';
      context.fillStyle = '#ffffff';
      context.font = '900 80px sans-serif';
      context.fillText('blink.', 270, 430);
      context.font = '700 36px sans-serif';
      context.fillText('REEL', 270, 498);
      context.font = '24px sans-serif';
      context.fillText('Tap to watch', 270, 555);
    }
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) :
        reject(new Error('Could not generate the thumbnail image.')), 'image/jpeg', .85);
    });
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

export async function uploadReel(video: File, cover: Blob, caption: string,
  duration: number | null, coverTime: number): Promise<Reel> {
  const jwt = reelToken();
  if (!jwt) throw new Error('Sign in to publish a Reel.');
  const form = new FormData();
  form.append('video', video, video.name);
  form.append('thumbnail', cover, 'cover.jpg');
  form.append('caption', caption.trim());
  if (duration !== null && Number.isFinite(duration) && duration > 0) {
    form.append('duration', String(duration));
  }
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
