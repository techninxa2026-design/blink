export type TaskChecklist = { id: string; name: string; items: { id: string; text: string; rewardBp: number }[] };
export type CreatorTask = {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  rewardBp: number;
  images: { id: string; url: string | null }[];
  status: 'DRAFT' | 'PUBLISHED';
  videoUrl: string | null;
  hasVideo: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  creator: { id: string; name: string; avatarKey?: string | null };
  checklists: TaskChecklist[];
};
export type DraftChecklist = {
  key: number;
  id?: string;
  name: string;
  items: { key: number; id?: string; text: string; rewardBp: string }[];
};
export const TASK_API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export function taskToken() {
  return localStorage.getItem('blink-access-token') || sessionStorage.getItem('blink-access-token');
}
export function taskSteps(task: Pick<CreatorTask, 'checklists'>) {
  return task.checklists.reduce((sum, group) => sum + group.items.length, 0);
}
export async function taskRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const token = taskToken();
  if (!token) throw new Error('Please sign in again.');
  const response = await fetch(TASK_API + '/creator-tasks' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null) as { message?: string | string[] } | null;
  if (!response.ok) {
    throw new Error(
      (Array.isArray(data?.message) ? data.message.join(', ') : data?.message) ||
      'Task request failed (' + response.status + ').',
    );
  }
  return data as T;
}

type UploadInfo = { uploadId: string; chunkBytes: number; totalChunks: number; nextChunk: number };
export async function uploadTaskVideo(file: File, progress: (percent: number) => void): Promise<string> {
  const ext = file.name.toLowerCase();
  const mimeType = ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)
    ? file.type : ext.endsWith('.mp4') ? 'video/mp4'
    : ext.endsWith('.webm') ? 'video/webm'
    : ext.endsWith('.mov') ? 'video/quicktime' : '';
  if (!mimeType || !file.size) throw new Error('Choose a nonempty MP4, WebM or MOV video.');
  const started = await taskRequest<UploadInfo>('/uploads', 'POST', {
    filename: file.name, mimeType, totalBytes: file.size,
  });
  const jwt = taskToken();
  if (!jwt) throw new Error('Please sign in again.');
  let index = started.nextChunk;
  while (index < started.totalChunks) {
    const blob = file.slice(index * started.chunkBytes, (index + 1) * started.chunkBytes);
    const chunk = new FormData();
    chunk.append('chunk', blob, 'video-chunk');
    let complete = false;
    let error: unknown;
    for (let attempt = 0; attempt < 3 && !complete; attempt++) {
      try {
        const response = await fetch(
          TASK_API + '/creator-tasks/uploads/' + encodeURIComponent(started.uploadId) + '/chunks/' + index,
          { method: 'POST', headers: { Authorization: 'Bearer ' + jwt }, body: chunk },
        );
        const result = await response.json().catch(() => null) as { nextChunk?: number; message?: string } | null;
        if (!response.ok) throw new Error(result?.message || 'Video chunk upload failed (' + response.status + ').');
        index = result?.nextChunk ?? index + 1;
        complete = true;
      } catch (err) {
        error = err;
        try {
          const resumed = await taskRequest<{ nextChunk: number }>('/uploads/' + started.uploadId);
          if (resumed.nextChunk > index) {
            index = resumed.nextChunk;
            complete = true;
          }
        } catch {
          // Retry failed network requests without advancing the offset.
        }
      }
    }
    if (!complete) {
      await taskRequest('/uploads/' + started.uploadId, 'DELETE').catch(() => {});
      throw error instanceof Error ? error : new Error('Video upload interrupted.');
    }
    progress(Math.round((index * 100) / started.totalChunks));
  }
  try {
    await taskRequest('/uploads/' + started.uploadId + '/complete', 'POST');
  } catch (error) {
    await taskRequest('/uploads/' + started.uploadId, 'DELETE').catch(() => {});
    throw error;
  }
  return started.uploadId;
}

export async function uploadTaskImage(file: File): Promise<string> {
  const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
  if (!allowed.includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error('Task images must be JPEG, PNG, WebP or GIF, each under 10 MB.');
  }
  const jwt = taskToken();
  if (!jwt) throw new Error('Please sign in again.');
  const body = new FormData();
  body.append('image', file, file.name);
  const response = await fetch(TASK_API + '/creator-tasks/images', {
    method: 'POST', headers: { Authorization: 'Bearer ' + jwt }, body,
  });
  const result = await response.json().catch(() => null) as { id?: string; message?: string | string[] } | null;
  if (!response.ok || !result?.id) {
    throw new Error((Array.isArray(result?.message) ? result.message.join(', ') : result?.message) || 'Unable to upload task image.');
  }
  return result.id;
}
