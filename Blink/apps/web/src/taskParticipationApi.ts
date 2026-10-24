import { TASK_API, taskToken } from './creatorTaskApi';

export type TaskParticipation = {
  id: string;
  taskId: string;
  explanation: string;
  checkedItemIds: string[];
  images: { id: string }[];
  status: 'DRAFT';
  createdAt: string;
  updatedAt: string;
};

export async function participationRequest<T>(
  path: string,
  method: 'GET' | 'PUT' | 'DELETE' = 'GET',
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
