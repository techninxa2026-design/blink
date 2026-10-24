import { useEffect, useRef, useState, type FormEvent } from 'react';
import './BusinessMatchPage.css';
import './CreatorTasks.css';
import './TaskParticipationPage.css';
import { CreatorTaskImage, CreatorNewImage } from './CreatorTaskImages';
import { TASK_API, taskRequest, taskSteps, type CreatorTask } from './creatorTaskApi';
import ParticipationPhoto from './ParticipationPhoto';
import {
  participationRequest, uploadEvidence, type TaskParticipation,
} from './taskParticipationApi';

type Props = {
  taskId: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onBack: () => void;
  onBrowse: () => void;
};

export default function TaskParticipationPage({
  taskId, theme, onToggleTheme, onBack, onBrowse,
}: Props) {
  const [task, setTask] = useState<CreatorTask | null>(null);
  const [saved, setSaved] = useState<TaskParticipation | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(true);
  const [explanation, setExplanation] = useState('');
  const [checked, setChecked] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [uploaded, setUploaded] = useState<{ file: File; id: string }[]>([]);
  const [uploadMessage, setUploadMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setNotice('');
    setSaved(null);
    setTask(null);
    setEditing(true);
    async function load() {
      const [details, participation] = await Promise.all([
        taskRequest<CreatorTask>('/' + encodeURIComponent(taskId)),
        participationRequest<TaskParticipation | null>('/' + encodeURIComponent(taskId) + '/me'),
      ]);
      if (!alive) return;
      setTask(details);
      setSaved(participation);
      setExplanation(participation?.explanation ?? '');
      setChecked(participation?.checkedItemIds ?? []);
      setImages(participation?.images.map((image) => image.id) ?? []);
      setNewPhotos([]);
      setUploaded([]);
      setEditing(!participation);
    }
    void load().catch((err: unknown) => {
      if (alive) setError(err instanceof Error ? err.message : 'Unable to load this task.');
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [taskId]);

  function resetFromSaved() {
    setExplanation(saved?.explanation ?? '');
    setChecked(saved?.checkedItemIds ?? []);
    setImages(saved?.images.map((image) => image.id) ?? []);
    setNewPhotos([]);
    setUploaded([]);
    setError('');
    setUploadMessage('');
  }

  function selectPhotos(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    if (images.length + newPhotos.length + selected.length > 8) {
      setError('You can attach up to eight supporting images.');
      return;
    }
    if (selected.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      || file.size === 0 || file.size > 10 * 1024 * 1024)) {
      setError('Choose JPG, PNG, or WebP photos, maximum 10 MB each.');
      return;
    }
    setNewPhotos((old) => [...old, ...selected]);
    setError('');
  }

  async function saveParticipation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const imageIds = [...images];
      for (let i = 0; i < newPhotos.length; i++) {
        const file = newPhotos[i];
        let imageId = uploaded.find((entry) => entry.file === file)?.id;
        if (!imageId) {
          setUploadMessage('Uploading evidence photo ' + (i + 1) + ' of ' + newPhotos.length + '…');
          imageId = await uploadEvidence(file);
          setUploaded((old) => [...old, { file, id: imageId as string }]);
        }
        imageIds.push(imageId);
      }
      const updated = await participationRequest<TaskParticipation>(
        '/' + encodeURIComponent(taskId) + '/me',
        'PUT',
        { explanation: explanation.trim(), checkedItemIds: checked, imageIds },
      );
      setSaved(updated);
      setExplanation(updated.explanation);
      setChecked(updated.checkedItemIds);
      setImages(updated.images.map((image) => image.id));
      setNewPhotos([]);
      setUploaded([]);
      setUploadMessage('');
      setEditing(false);
      setNotice('Participation saved. You can edit it whenever you return.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save your participation.');
      setUploadMessage('');
    } finally {
      setBusy(false);
    }
  }

  function toggleStep(id: string, value: boolean) {
    setChecked((old) => value ? [...old.filter((x) => x !== id), id] : old.filter((x) => x !== id));
  }

  const steps = task ? taskSteps(task) : 0;
  const complete = checked.filter((item) =>
    task?.checklists.some((group) => group.items.some((x) => x.id === item)),
  ).length;

  return (
    <main className="bm-page ct-page tp-page" data-bm-theme={theme}>
      <header className="bm-topbar">
        <button className="bm-back" type="button" onClick={onBack}>← Back to Task</button>
        <img src="/blink-logo.png" alt="Blink" className="bm-logo" />
        <button className="bm-theme" type="button" onClick={onToggleTheme}>
          {theme === 'light' ? '☾ Dark mode' : '☀ Light mode'}
        </button>
      </header>
      <div className="bm-container ct-container tp-container">
        {loading ? (
          <section className="bm-card bm-empty"><h2>Loading participation…</h2></section>
        ) : !task ? (
          <section className="bm-card bm-empty">
            <h2>Participation unavailable</h2>
            {error && <p role="alert">{error}</p>}
            <button type="button" className="bm-primary" onClick={onBrowse}>Explore Tasks</button>
          </section>
        ) : <>
          <div className="tp-heading">
            <div>
              <span className="bm-eyebrow">BLINK TASKS / PARTICIPATION</span>
              <h1>{editing ? (saved ? 'Edit Participation' : 'My Participation') : 'My Participation'}</h1>
              <p>Task: {task.title}</p>
            </div>
            <button type="button" className="bm-outline" onClick={onBack}>← Task Details</button>
          </div>
          {notice && <div className="ct-notice ct-success" role="status">{notice}</div>}
          {error && <div className="ct-notice ct-error" role="alert">{error}</div>}
          {!editing && saved ? (
            <div className="tp-review">
              <div className="tp-success-hero">
                <span aria-hidden="true">✓</span>
                <h2>Participation saved</h2>
                <p>Your evidence and explanation are saved as an editable draft.</p>
              </div>
              <section className="bm-card tp-review-card">
                <div className="tp-review-header">
                  <h2>My Participation</h2>
                  <span className="tp-draft-badge">Saved draft</span>
                </div>
                <p className="tp-small">Last saved {new Date(saved.updatedAt).toLocaleString()}</p>
                <div className="tp-separator"/>
                <h3>Your explanation</h3>
                <p className="tp-explanation">{saved.explanation || 'No explanation added yet.'}</p>
                <div className="tp-separator"/>
                <h3>Supporting images ({saved.images.length})</h3>
                {saved.images.length ? (
                  <div className="tp-photo-grid">
                    {saved.images.map((image, index) => (
                      <div className="tp-photo-tile" key={image.id}>
                        <ParticipationPhoto id={image.id} alt={'Evidence ' + (index + 1)} />
                      </div>
                    ))}
                  </div>
                ) : <p className="tp-small">No evidence images added yet.</p>}
                <div className="tp-separator"/>
                <h3>Task checklist</h3>
                <div className="tp-saved-progress">{saved.checkedItemIds.length} of {steps} steps checked</div>
                <div className="tp-review-buttons">
                  <button type="button" className="bm-primary" onClick={() => { resetFromSaved(); setEditing(true); }}>✎ Edit Participation</button>
                  <button type="button" className="bm-outline" onClick={onBack}>← Back to Task</button>
                </div>
              </section>
            </div>
          ) : (
            <form onSubmit={(event) => void saveParticipation(event)}>
              <div className="tp-layout">
                <aside className="tp-reference">
                  <section className="bm-card tp-card">
                    <h2>Task instructions</h2>
                    <div className="tp-video-wrap">
                      {task.videoUrl
                        ? <video src={TASK_API + task.videoUrl} controls playsInline preload="metadata" />
                        : <span>🎬 Instruction video unavailable</span>}
                    </div>
                    <h3>{task.title}</h3>
                    <p className="tp-description">{task.description}</p>
                    {task.images?.length > 0 && <div className="tp-task-photos">
                      {task.images.map((image) =>
                        <CreatorTaskImage key={image.id} image={image} alt="Task instruction image" />)}
                    </div>}
                    <div className="tp-task-progress">
                      <strong>Task checklist</strong>
                      <span>{complete}/{steps}</span>
                    </div>
                    {task.checklists.map((group) => (
                      <div className="tp-checklist" key={group.id}>
                        <h4>{group.name}</h4>
                        {group.items.map((item) => (
                          <label className="tp-check-row" key={item.id}>
                            <input type="checkbox" checked={checked.includes(item.id)}
                              onChange={(event) => toggleStep(item.id, event.target.checked)} />
                            <span>{item.text}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </section>
                  <section className="bm-card tp-reward">
                    <div><strong>Task BP</strong><span className="ct-reward-pill">🟠 {Number(task.rewardBp ?? 0).toFixed(2)} BP</span></div>
                    <p>Saving this participation does not award BP. Verification and rewards will be added later.</p>
                  </section>
                </aside>
                <div className="tp-form-column">
                  <section className="bm-card tp-card">
                    <div className="tp-section-title"><span>01</span><h2>Your explanation</h2></div>
                    <p>Describe how you completed the task, what you did, and what the evidence shows.</p>
                    <label htmlFor="tp-explanation" className="tp-label">Explanation</label>
                    <textarea id="tp-explanation" rows={9} maxLength={6000}
                      placeholder="I completed this task by…"
                      value={explanation} onChange={(event) => setExplanation(event.target.value)} />
                    <small className="tp-counter">{explanation.length}/6000</small>
                  </section>
                  <section className="bm-card tp-card">
                    <div className="tp-section-title"><span>02</span><h2>Supporting images</h2></div>
                    <p>Add original photos or screenshots that demonstrate your work. You can change them later.</p>
                    <input ref={inputRef} type="file" hidden multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => { selectPhotos(event.target.files); event.target.value = ''; }}/>
                    <div className="tp-dropzone">
                      <span className="tp-cloud">☁</span>
                      <strong>Upload evidence photos</strong>
                      <p>JPG · PNG · WebP · up to 8 images, 10 MB each</p>
                      <button className="bm-outline" type="button" disabled={busy || images.length + newPhotos.length >= 8}
                        onClick={() => inputRef.current?.click()}>＋ Add images</button>
                    </div>
                    {(images.length > 0 || newPhotos.length > 0) && (
                      <div className="tp-photo-grid">
                        {images.map((id) => (
                          <div className="tp-photo-tile" key={id}>
                            <ParticipationPhoto id={id} />
                            <button type="button" aria-label="Remove saved evidence" disabled={busy}
                              onClick={() => setImages((old) => old.filter((x) => x !== id))}>×</button>
                          </div>
                        ))}
                        {newPhotos.map((file, index) => (
                          <div className="tp-photo-tile" key={index}>
                            <CreatorNewImage file={file} />
                            <button type="button" aria-label="Remove selected photo" disabled={busy}
                              onClick={() => setNewPhotos((old) => old.filter((_, i) => i !== index))}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {uploadMessage && <p role="status" className="tp-upload-progress">{uploadMessage}</p>}
                    <span className="tp-count">{images.length + newPhotos.length}/8 images</span>
                  </section>
                </div>
              </div>
              <div className="tp-savebar">
                <div><strong>Save your participation</strong><p>Your explanation, checklist, and images remain editable.</p></div>
                <div className="tp-actions">
                  <button type="button" className="bm-outline" disabled={busy} onClick={() => {
                    if (saved) { resetFromSaved(); setEditing(false); } else onBack();
                  }}>Cancel</button>
                  <button type="submit" className="bm-primary" disabled={busy}>
                    {busy ? 'Saving…' : '▣ Save Participation'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </>}
      </div>
    </main>
  );
}
