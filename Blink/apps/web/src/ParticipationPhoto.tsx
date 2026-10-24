import { useEffect, useState } from 'react';
import { TASK_API, taskToken } from './creatorTaskApi';

export default function ParticipationPhoto({ id, alt = 'Evidence image' }: {
  id: string; alt?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const aborter = new AbortController();
    let url: string | null = null;
    const jwt = taskToken();
    if (!jwt) return;
    void fetch(TASK_API + '/task-participations/images/' + encodeURIComponent(id), {
      headers: { Authorization: 'Bearer ' + jwt }, signal: aborter.signal,
    }).then((response) => {
      if (!response.ok) throw new Error('Unable to load evidence photo.');
      return response.blob();
    }).then((blob) => {
      if (!aborter.signal.aborted) {
        url = URL.createObjectURL(blob);
        setSrc(url);
      }
    }).catch(() => {});
    return () => {
      aborter.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return src
    ? <img src={src} alt={alt} loading="lazy" />
    : <div className="ct-image-placeholder" aria-label={alt}>🖼️</div>;
}
