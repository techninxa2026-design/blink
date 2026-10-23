
export const SOCIAL_API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000'
).replace(/\/$/, '');

export type SocialPerson = {
  id: string;
  name: string;
  avatarKey: string | null;
};

export function socialAvatar(
  key: string | null | undefined
): string | null {
  if (!key) return null;

  if (/^https?:\/\//i.test(key)) {
    return key;
  }

  return `${SOCIAL_API_URL}${
    key.startsWith('/') ? key : `/uploads/${key}`
  }`;
}

export async function socialApi<T>(
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  const token =
    localStorage.getItem('blink-access-token') ||
    sessionStorage.getItem('blink-access-token');

  if (!token) {
    throw new Error('Please sign in to continue.');
  }

  const response = await fetch(
    `${SOCIAL_API_URL}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body) }),
    }
  );

  // Safely read response regardless of content type.
  const raw = await response.text();

  let data: unknown = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorData =
      data && typeof data === 'object'
        ? (data as {
            message?: string | string[];
          })
        : null;

    const message = Array.isArray(errorData?.message)
      ? errorData.message.join(' ')
      : errorData?.message;

    const missingRoute =
      response.status === 404 &&
      (
        path === '/secrets' ||
        path === '/secrets/points' ||
        path === '/hearts/incoming' ||
        path === '/hearts/sent' ||
        path.startsWith('/hearts/people')
      );

    if (missingRoute) {
      throw new Error(
        `Blink API route ${path.split('?')[0]} ` +
        `is not registered on ${SOCIAL_API_URL}. ` +
        'Check SecretsModule and HeartsModule in ' +
        'apps/api/src/app.module.ts, restart NestJS, ' +
        'and verify VITE_API_URL.'
      );
    }

    throw new Error(
      message || `Request failed (${response.status}).`
    );
  }

  return data as T;
}

export function friendlyDate(value: string): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
