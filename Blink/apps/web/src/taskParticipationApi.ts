import { TASK_API, taskToken } from './creatorTaskApi';

export type TaskParticipation = {
  id: string;
  taskId: string;
  explanation: string;
  checkedItemIds: string[];
  images: { id: string }[];
  status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED';
  submittedAt: string | null;
  reviewedAt: string | null;
  earnedBp: number;
  steps: TaskItemResponse[];
  createdAt: string;
  updatedAt: string;
};

export async function participationRequest<T>(
  path: string,
  method: 'GET' | 'PUT' | 'POST' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const jwt = taskToken();
  if (!jwt) throw new Error('Please sign in again.');
  const response = await fetch(TASK_API + '/task-participations' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + jwt,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  const value = await response.json().catch(() => null) as { message?: string | string[] } | null;
  if (!response.ok) {
    throw new Error((Array.isArray(value?.message) ? value.message.join(', ') : value?.message) ||
      'Participation request failed (' + response.status + ').');
  }
  return value as T;
}

export async function uploadEvidence(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error('Use a JPEG, PNG, or WebP image under 10 MB.');
  }
  const jwt = taskToken();
  if (!jwt) throw new Error('Please sign in again.');
  const body = new FormData();
  body.append('image', file, file.name);
  const response = await fetch(TASK_API + '/task-participations/images', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + jwt },
    body,
  });
  const result = await response.json().catch(() => null) as
    { id?: string; message?: string | string[] } | null;
  if (!response.ok || !result?.id) {
    throw new Error((Array.isArray(result?.message) ? result.message.join(', ') : result?.message) ||
      'Evidence upload failed.');
  }
  return result.id;
}

export type TaskItemResponse = {
  id: string;
  checklistItemId: string;
  explanation: string;
  videoUploadId: string | null;
  images: { id: string }[];
  updatedAt: string;
  reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null;
  rewardBpSnapshot: number;
};

export async function uploadParticipationVideo(
  file: File, progress: (percent: number) => void,
): Promise<string> {
  const filename = file.name.toLowerCase();
  const mimeType = ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)
    ? file.type : filename.endsWith('.mp4') ? 'video/mp4'
      : filename.endsWith('.webm') ? 'video/webm'
        : filename.endsWith('.mov') ? 'video/quicktime' : '';
  if (!mimeType || !file.size) throw new Error('Choose an MP4, MOV or WebM video.');
  const session = await participationRequest<{
    uploadId: string; chunkBytes: number; nextChunk: number; totalChunks: number;
  }>('/videos', 'POST', { filename: file.name, mimeType, totalBytes: file.size });
  let index = session.nextChunk;
  const jwt = taskToken();
  if (!jwt) throw new Error('Please sign in again.');
  while (index < session.totalChunks) {
    const chunk = new FormData();
    chunk.append('chunk', file.slice(index * session.chunkBytes, (index + 1) * session.chunkBytes), 'chunk');
    let sent = false;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3 && !sent; attempt++) {
      try {
        const response = await fetch(
          TASK_API + '/task-participations/videos/' + session.uploadId + '/chunks/' + index,
          { method: 'POST', headers: { Authorization: 'Bearer ' + jwt }, body: chunk },
        );
        const result = await response.json().catch(() => null) as { nextChunk?: number; message?: string } | null;
        if (!response.ok) throw new Error(result?.message || 'Video chunk upload failed (' + response.status + ').');
        index = result?.nextChunk ?? index + 1;
        sent = true;
      } catch (err) {
        lastError = err;
        try {
          const status = await participationRequest<{ nextChunk: number }>('/videos/' + session.uploadId);
          if (status.nextChunk > index) { index = status.nextChunk; sent = true; }
        } catch {
          // Retry interrupted chunks.
        }
      }
    }
    if (!sent) {
      await participationRequest('/videos/' + session.uploadId, 'DELETE').catch(() => {});
      throw lastError instanceof Error ? lastError : new Error('Video upload interrupted.');
    }
    progress(Math.round(100 * index / session.totalChunks));
  }
  try {
    await participationRequest('/videos/' + session.uploadId + '/complete', 'POST');
  } catch (error) {
    // Do not detach files from a saved participation; this upload is unlinked.
    await participationRequest('/videos/' + session.uploadId, 'DELETE').catch(() => {});
    throw error;
  }
  return session.uploadId;
}

export async function videoPlaybackUrl(videoId: string): Promise<string> {
  const result = await participationRequest<{ url: string }>('/videos/' + encodeURIComponent(videoId) + '/playback');
  return TASK_API + result.url;
}
