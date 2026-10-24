import { useEffect, useState } from 'react';
import { TASK_API, taskToken } from './creatorTaskApi';

type Image = { id: string; url: string | null };
export function CreatorTaskImage({ image, alt = 'Task image', className = '' }: {
  image: Image; alt?: string; className?: string;
}) {
  const [privateUrl, setPrivateUrl] = useState<string | null>(null);
  useEffect(() => {
    if (image.url) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    const jwt = taskToken();
    if (!jwt) return;
    void fetch(TASK_API + '/creator-tasks/images/' + encodeURIComponent(image.id), {
      headers: { Authorization: 'Bearer ' + jwt }, signal: controller.signal,
    }).then((response) => {
      if (!response.ok) throw new Error('Image not available');
      return response.blob();
    }).then((blob) => {
      if (!controller.signal.aborted) {
        objectUrl = URL.createObjectURL(blob);
        setPrivateUrl(objectUrl);
      }
    }).catch(() => {});
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPrivateUrl(null);
    };
  }, [image.id, image.url]);
  const source = image.url ? TASK_API + image.url : privateUrl;
  return source
    ? <img className={className} src={source} alt={alt} loading="lazy" />
    : <div className="ct-image-placeholder" aria-label={alt}>🖼️</div>;
}

export function CreatorNewImage({ file, className = '' }: {
  file: File; className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return src
    ? <img src={src} alt={file.name} className={className} loading="lazy" />
    : <div className="ct-image-placeholder">🖼️</div>;
}
