import { useEffect, useRef, useState, type FormEvent } from 'react';
import './BusinessMatchPage.css';
import './CreatorTasks.css';
import './TaskParticipationPage.css';
import { CreatorNewImage, CreatorTaskImage } from './CreatorTaskImages';
import { TASK_API, taskRequest, type CreatorTask } from './creatorTaskApi';
import ParticipationPhoto from './ParticipationPhoto';
import {
  participationRequest, uploadEvidence, uploadParticipationVideo, videoPlaybackUrl,
  type TaskItemResponse, type TaskParticipation,
} from './taskParticipationApi';

type Props = {
  taskId: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onBack: () => void;
  onBrowse: () => void;
};
type TaskItem = { id: string; text: string; group: string; rewardBp: number };
type PhotoDraft = { file: File; id?: string };

export default function TaskParticipationPage({
  taskId, theme, onToggleTheme, onBack, onBrowse,
}: Props) {
  const [task, setTask] = useState<CreatorTask | null>(null);
  const [saved, setSaved] = useState<TaskParticipation | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [explanation, setExplanation] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<PhotoDraft[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null);
  const [removeSavedVideo, setRemoveSavedVideo] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [playback, setPlayback] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [editing, setEditing] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const items: TaskItem[] = task
    ? task.checklists.flatMap((group) => group.items.map((item) => ({
        id: item.id, text: item.text, group: group.name, rewardBp: item.rewardBp ?? 0,
      }))) : [];
  const selected = items.find((item) => item.id === selectedId);
  const response = saved?.steps.find((step) => step.checklistItemId === selectedId);
  const savedCount = items.filter((item) => saved?.steps.some((step) => step.checklistItemId === item.id)).length;
  const completedCount = items.filter((item) => checked.includes(item.id)).length;

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    setTask(null);
    setSaved(null);
    void Promise.all([
      taskRequest<CreatorTask>('/' + encodeURIComponent(taskId)),
      participationRequest<TaskParticipation | null>('/' + encodeURIComponent(taskId) + '/me'),
    ]).then(([details, own]) => {
      if (!live) return;
      setTask(details);
      setSaved(own);
      setChecked(own?.checkedItemIds ?? []);
      const first = details.checklists.flatMap((group) => group.items)[0]?.id ?? '';
      setSelectedId(first);
      const selected = own?.steps.find((step) => step.checklistItemId === first);
      setExplanation(selected?.explanation ?? '');
      setPhotos(selected?.images.map((image) => image.id) ?? []);
      setNewPhotos([]);
      setVideo(null);
      setUploadedVideoId(null);
      setRemoveSavedVideo(false);
      setEditing(!selected);
      setDirty(false);
    }).catch((err: unknown) => {
      if (live) setError(err instanceof Error ? err.message : 'Could not load this participation.');
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [taskId]);

  useEffect(() => {
    if (!video) { setPreview(null); return; }
    const url = URL.createObjectURL(video);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [video]);

  useEffect(() => {
    setPlayback(null);
    if (!response?.videoUploadId || removeSavedVideo) return;
    let live = true;
    void videoPlaybackUrl(response.videoUploadId).then((url) => {
      if (live) setPlayback(url);
    }).catch(() => {});
    return () => { live = false; };
  }, [response?.videoUploadId, removeSavedVideo]);

  function restore(itemId: string) {
    const record = saved?.steps.find((step) => step.checklistItemId === itemId);
    setSelectedId(itemId);
    setExplanation(record?.explanation ?? '');
    setPhotos(record?.images.map((image) => image.id) ?? []);
    setNewPhotos([]);
    setVideo(null);
    setUploadedVideoId(null);
    setRemoveSavedVideo(false);
    setPercent(null);
    setMessage('');
    setError('');
    setNotice('');
    setDirty(false);
    setEditing(!record);
  }

  function selectItem(itemId: string) {
    if (saving || checking || itemId === selectedId) return;
    if (dirty && !window.confirm('Discard unsaved edits to this checklist item?')) return;
    restore(itemId);
  }

  function addImages(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files);
    if (photos.length + newPhotos.length + incoming.length > 8) {
      setError('Each checklist item allows up to eight supporting photos.');
      return;
    }
    if (incoming.some((file) =>
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      !file.size || file.size > 10 * 1024 * 1024
    )) {
      setError('Use JPG, PNG or WebP images under 10 MB each.');
      return;
    }
    setNewPhotos((old) => [...old, ...incoming.map((file) => ({ file }))]);
    setDirty(true);
    setError('');
  }

  async function saveStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const imageIds = [...photos];
      const uploaded: PhotoDraft[] = [...newPhotos];
      for (let i = 0; i < uploaded.length; i++) {
        if (!uploaded[i].id) {
          setMessage('Uploading photo ' + (i + 1) + ' of ' + uploaded.length + '…');
          uploaded[i] = { ...uploaded[i], id: await uploadEvidence(uploaded[i].file) };
          setNewPhotos([...uploaded]);
        }
        imageIds.push(uploaded[i].id as string);
      }

      let videoId = removeSavedVideo ? null : response?.videoUploadId ?? null;
      if (video) {
        if (!uploadedVideoId) {
          setPercent(0);
          setMessage('Uploading your checklist video…');
          videoId = await uploadParticipationVideo(video, setPercent);
          setUploadedVideoId(videoId);
        } else videoId = uploadedVideoId;
      }
      setMessage('Saving this checklist item…');
      await participationRequest(
        '/' + encodeURIComponent(taskId) + '/steps/' + encodeURIComponent(selected.id),
        'PUT',
        { explanation: explanation.trim(), imageIds, videoUploadId: videoId },
      );
      const updated = await participationRequest<TaskParticipation>(
        '/' + encodeURIComponent(taskId) + '/me',
      );
      setSaved(updated);
      setChecked(updated.checkedItemIds);
      setPhotos(updated.steps.find((step) => step.checklistItemId === selected.id)?.images.map((photo) => photo.id) ?? []);
      setNewPhotos([]);
      setVideo(null);
      setUploadedVideoId(null);
      setRemoveSavedVideo(false);
      setPercent(null);
      setMessage('');
      setDirty(false);
      setEditing(false);
      setNotice('Response saved for "' + selected.text + '". Other items were not changed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this item.');
      setMessage('');
    } finally { setSaving(false); }
  }

  async function toggleComplete(itemId: string, value: boolean) {
    if (saving || checking) return;
    const next = value ? [...new Set([...checked, itemId])] : checked.filter((id) => id !== itemId);
    setChecking(true);
    setError('');
    try {
      const result = await participationRequest<{ checkedItemIds: string[] }>(
        '/' + encodeURIComponent(taskId) + '/checklist',
        'PUT',
        { checkedItemIds: next },
      );
      setChecked(result.checkedItemIds);
      setSaved((old) => old ? { ...old, checkedItemIds: result.checkedItemIds } : old);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update the checklist.');
    } finally { setChecking(false); }
  }

  const currentStep: TaskItemResponse | undefined = response;

  return (
    <main className="bm-page ct-page tp-page" data-bm-theme={theme}>
      <header className="bm-topbar">
        <button className="bm-back" type="button" onClick={onBack}>← Task details</button>
        <img src="/blink-logo.png" alt="Blink" className="bm-logo" />
        <button className="bm-theme" type="button" onClick={onToggleTheme}>
          {theme === 'light' ? '☾ Dark mode' : '☀ Light mode'}
        </button>
      </header>
      <div className="bm-container ct-container tp-container">
        {loading ? (
          <section className="bm-card bm-empty"><h2>Loading checklist responses…</h2></section>
        ) : !task ? (
          <section className="bm-card bm-empty">
            <h2>Participation unavailable</h2>
            {error && <p role="alert">{error}</p>}
            <button className="bm-primary" type="button" onClick={onBrowse}>Explore Tasks</button>
          </section>
        ) : <>
          <div className="tp-heading">
            <div>
              <span className="bm-eyebrow">BLINK TASKS / MY PARTICIPATION</span>
              <h1>Complete each checklist item</h1>
              <p>{task.title} · by {task.creator.name}</p>
            </div>
            <button type="button" className="bm-outline" onClick={onBack}>← Task details</button>
          </div>
          {notice && <div className="ct-notice ct-success" role="status">{notice}</div>}
          {error && <div className="ct-notice ct-error" role="alert">{error}</div>}
          <div className="tp-summary">
            <div><strong>{savedCount}/{items.length}</strong><span>Responses saved</span></div>
            <div><strong>{completedCount}/{items.length}</strong><span>Items checked</span></div>
            <div><strong>{Number(task.rewardBp ?? 0).toFixed(2)} BP</strong><span>Total of all item rewards; not yet awarded</span></div>
          </div>
          <div className="tp-layout">
            <aside className="tp-reference">
              <section className="bm-card tp-card">
                <h2>Choose a checklist item</h2>
                <p>Every step has a separate explanation, image gallery and video. Click an item to work on it.</p>
                {task.checklists.map((group) => (
                  <div className="tp-group-picker" key={group.id}>
                    <h3>{group.name}</h3>
                    {group.items.map((item) => {
                      const isSaved = saved?.steps.some((step) => step.checklistItemId === item.id);
                      return <div className={'tp-picker-row' + (selectedId === item.id ? ' active' : '')} key={item.id}>
                        <input type="checkbox" aria-label={'Mark ' + item.text + ' completed'}
                          checked={checked.includes(item.id)} disabled={checking || saving}
                          onChange={(event) => void toggleComplete(item.id, event.target.checked)} />
                        <button type="button" className="tp-picker-button"
                          aria-current={selectedId === item.id ? 'step' : undefined}
                          onClick={() => selectItem(item.id)}>
                          <span className="tp-picker-title">{item.text}</span>
                          <strong className="tp-item-reward">{Number(item.rewardBp ?? 0).toFixed(2)} BP</strong>
                          <small>{isSaved ? 'Response saved' : 'Add response'} →</small>
                        </button>
                      </div>;
                    })}
                  </div>
                ))}
              </section>
              <section className="bm-card tp-card">
                <h2>Creator's instructions</h2>
                <div className="tp-video-wrap">
                  {task.videoUrl
                    ? <video src={TASK_API + task.videoUrl} controls playsInline preload="metadata" />
                    : <span>Instruction video unavailable</span>}
                </div>
                <p className="tp-description">{task.description}</p>
                {task.images?.length > 0 && <div className="tp-task-photos">
                  {task.images.map((image) => <CreatorTaskImage key={image.id} image={image} alt="Creator task image" />)}
                </div>}
                <div className="tp-reward-note">Saving a response does not earn BP yet. Verification and payouts are separate.</div>
              </section>
              {(saved?.explanation || saved?.images.length) ? (
                <section className="bm-card tp-card tp-legacy">
                  <h2>Earlier task-wide response</h2>
                  <p>This was saved before separate checklist responses were introduced. It remains available for reference.</p>
                  {saved.explanation && <p className="tp-description">{saved.explanation}</p>}
                  {saved.images.length > 0 && <div className="tp-photo-grid">
                    {saved.images.map((image) => <div className="tp-photo-tile" key={image.id}>
                      <ParticipationPhoto id={image.id} />
                    </div>)}
                  </div>}
                </section>
              ) : null}
            </aside>
            <div className="tp-form-column">
              {selected ? (
                <section className="bm-card tp-card tp-selected-card">
                  <span className="bm-eyebrow">SELECTED CHECKLIST ITEM</span>
                  <h2>{selected.text}</h2>
                  <div className="tp-selected-meta">
                    <p>{selected.group}</p>
                    <span className="ct-reward-pill">🟠 {Number(selected.rewardBp ?? 0).toFixed(2)} BP for this item</span>
                  </div>
                  {currentStep && !editing ? (
                    <div className="tp-saved-response">
                      <span className="tp-draft-badge">Saved for this item</span>
                      <h3>Your explanation</h3>
                      <p className="tp-description">{currentStep.explanation || 'No explanation yet.'}</p>
                      <h3>Supporting images ({currentStep.images.length})</h3>
                      {currentStep.images.length ? <div className="tp-photo-grid">
                        {currentStep.images.map((image) => <div className="tp-photo-tile" key={image.id}>
                          <ParticipationPhoto id={image.id} />
                        </div>)}
                      </div> : <p>No images added yet.</p>}
                      <h3>Video evidence</h3>
                      {currentStep.videoUploadId && playback
                        ? <video className="tp-evidence-video" src={playback} controls playsInline preload="metadata" />
                        : <p>{currentStep.videoUploadId ? 'Preparing private video playback…' : 'No video added yet.'}</p>}
                      <button type="button" className="bm-primary" onClick={() => setEditing(true)}>✎ Edit this item's response</button>
                    </div>
                  ) : (
                    <form className="tp-item-editor" onSubmit={(event) => void saveStep(event)}>
                      <div className="tp-section-title"><span>01</span><h3>Explanation for this item</h3></div>
                      <p>Explain exactly what you completed for <strong>{selected.text}</strong>.</p>
                      <textarea rows={6} maxLength={6000} value={explanation}
                        placeholder="For this checklist item, I completed the work by…"
                        onChange={(event) => { setExplanation(event.target.value); setDirty(true); }} />
                      <small className="tp-counter">{explanation.length}/6000</small>
                      <div className="tp-section-title"><span>02</span><h3>Images for this item</h3></div>
                      <p>Attach up to 8 JPG, PNG or WebP images (10 MB each). Images on other checklist items stay separate.</p>
                      <input ref={photoInput} type="file" hidden multiple accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => { addImages(event.target.files); event.target.value = ''; }} />
                      <button className="bm-outline" type="button" disabled={saving || photos.length + newPhotos.length >= 8}
                        onClick={() => photoInput.current?.click()}>＋ Add images ({photos.length + newPhotos.length}/8)</button>
                      {(photos.length > 0 || newPhotos.length > 0) && <div className="tp-photo-grid">
                        {photos.map((id) => <div className="tp-photo-tile" key={id}>
                          <ParticipationPhoto id={id} />
                          <button type="button" disabled={saving} aria-label="Remove image"
                            onClick={() => { setPhotos((old) => old.filter((value) => value !== id)); setDirty(true); }}>×</button>
                        </div>)}
                        {newPhotos.map((photo, i) => <div className="tp-photo-tile" key={i}>
                          <CreatorNewImage file={photo.file} />
                          <button type="button" disabled={saving} aria-label="Remove new image"
                            onClick={() => { setNewPhotos((old) => old.filter((_, index) => index !== i)); setDirty(true); }}>×</button>
                        </div>)}
                      </div>}
                      <div className="tp-section-title"><span>03</span><h3>Video for this item</h3></div>
                      <p>Upload an original-quality MP4, MOV or WebM video. Large videos are sent in 8 MB chunks.</p>
                      <input ref={videoInput} type="file" hidden accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm"
                        onChange={(event) => {
                          setVideo(event.target.files?.[0] ?? null);
                          setUploadedVideoId(null);
                          setRemoveSavedVideo(false);
                          setPercent(null);
                          setDirty(true);
                          event.target.value = '';
                        }}/>
                      {preview
                        ? <video className="tp-evidence-video" src={preview} controls playsInline preload="metadata" />
                        : currentStep?.videoUploadId && !removeSavedVideo && playback
                          ? <video className="tp-evidence-video" src={playback} controls playsInline preload="metadata" />
                          : null}
                      {video && <small className="tp-video-name">{video.name} · {(video.size / (1024 * 1024)).toFixed(1)} MB</small>}
                      <div className="tp-video-actions">
                        <button type="button" className="bm-outline" disabled={saving}
                          onClick={() => videoInput.current?.click()}>＋ {video || currentStep?.videoUploadId ? 'Replace video' : 'Add video'}</button>
                        {(video || (currentStep?.videoUploadId && !removeSavedVideo)) && (
                          <button type="button" className="bm-outline" disabled={saving}
                            onClick={() => { setVideo(null); setUploadedVideoId(null); setRemoveSavedVideo(true); setDirty(true); }}>
                            Remove video
                          </button>
                        )}
                      </div>
                      {percent !== null && <div className="tp-video-upload-progress">
                        <span>Video upload {percent}%</span><progress max={100} value={percent} />
                      </div>}
                      {message && <p className="tp-upload-progress" role="status">{message}</p>}
                      <div className="tp-savebar">
                        <div><strong>Save this checklist response</strong><p>Only "{selected.text}" will be updated.</p></div>
                        <div className="tp-actions">
                          {currentStep && <button type="button" className="bm-outline" disabled={saving}
                            onClick={() => { restore(selected.id); setEditing(false); }}>Cancel</button>}
                          <button className="bm-primary" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save Item Response'}</button>
                        </div>
                      </div>
                    </form>
                  )}
                </section>
              ) : <section className="bm-card tp-card"><h2>No checklist items</h2><p>This creator task does not have checklist items yet.</p></section>}
            </div>
          </div>
        </>}
      </div>
    </main>
  );
}
