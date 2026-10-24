import { useEffect, useRef, useState, type FormEvent } from 'react';
import './BusinessMatchPage.css';
import './CreatorTasks.css';
import {
  TASK_API, taskRequest, taskSteps, taskToken, uploadTaskVideo, uploadTaskImage,
  type CreatorTask, type DraftChecklist,
} from './creatorTaskApi';
import { CreatorTaskImage, CreatorNewImage } from './CreatorTaskImages';

type Profile = { id: string; name: string; type: 'PROFESSIONAL' | 'COMPANY'; active: boolean };
type Props = {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onBack: () => void;
  onBrowse: () => void;
  onOpenTask: (id: string) => void;
};
let nextItemKey = 0;
function makeChecklist(): DraftChecklist {
  return { key: ++nextItemKey, name: 'Task completion checklist', items: [{ key: ++nextItemKey, text: '', rewardBp: '0' }] };
}
export default function CreatorDashboardPage({
  theme, onToggleTheme, onBack, onBrowse, onOpenTask,
}: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<CreatorTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<'dashboard' | 'create'>('dashboard');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [oldUnallocatedBp, setOldUnallocatedBp] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [existingImages, setExistingImages] = useState<CreatorTask['images']>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [uploadedImages, setUploadedImages] = useState<{ file: File; id: string }[]>([]);
  const [imageProgress, setImageProgress] = useState('');
  const [groups, setGroups] = useState<DraftChecklist[]>([makeChecklist()]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoUploadId, setVideoUploadId] = useState<string | null>(null);
  const [videoAttached, setVideoAttached] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const jwt = taskToken();
      if (!jwt) throw new Error('Please sign in again.');
      const response = await fetch(TASK_API + '/business-match/me', {
        headers: { Authorization: 'Bearer ' + jwt }, cache: 'no-store',
      });
      if (!response.ok) throw new Error('Could not load your Business Profile.');
      const profile = await response.json() as Profile | null;
      if (!alive) return;
      setProfile(profile);
      if (profile?.type === 'PROFESSIONAL') {
        const mine = await taskRequest<CreatorTask[]>('/mine');
        if (alive) setTasks(mine);
      }
    }
    void load().catch((err: unknown) => {
      if (alive) setError(err instanceof Error ? err.message : 'Unable to load Creator Dashboard.');
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!selectedFile) { setVideoPreview(null); return; }
    const url = URL.createObjectURL(selectedFile);
    setVideoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  function clearEditor() {
    setEditingId(null);
    setOldUnallocatedBp(0);
    setShowPreview(false);
    setTitle('');
    setDescription('');
    setExistingImages([]);
    setNewImages([]);
    setUploadedImages([]);
    setImageProgress('');
    setGroups([makeChecklist()]);
    setSelectedFile(null);
    setVideoUploadId(null);
    setVideoAttached(false);
    setUploadPercent(null);
    setError('');
  }
  function createTask() { clearEditor(); setNotice(''); setScreen('create'); }
  function editTask(task: CreatorTask) {
    setEditingId(task.id);
    setOldUnallocatedBp(task.legacyUnallocatedBp ?? 0);
    setShowPreview(false);
    setTitle(task.title);
    setDescription(task.description);
    setExistingImages(task.images ?? []);
    setNewImages([]);
    setUploadedImages([]);
    setImageProgress('');
    setGroups(task.checklists.length
      ? task.checklists.map((g) => ({
        key: ++nextItemKey, id: g.id, name: g.name,
        items: g.items.map((i) => ({ key: ++nextItemKey, id: i.id, text: i.text,
          rewardBp: String(i.rewardBp ?? 0) })),
      }))
      : [makeChecklist()]);
    setVideoAttached(task.hasVideo);
    setSelectedFile(null);
    setVideoUploadId(null);
    setUploadPercent(null);
    setError('');
    setNotice('');
    setScreen('create');
  }
  function updateGroup(key: number, change: Partial<DraftChecklist>) {
    setGroups((old) => old.map((g) => g.key === key ? { ...g, ...change } : g));
  }
  function updateItem(groupKey: number, itemKey: number, text: string) {
    setGroups((old) => old.map((g) => g.key === groupKey ? {
      ...g, items: g.items.map((i) => i.key === itemKey ? { ...i, text } : i),
    } : g));
  }

  function selectImages(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files);
    if (existingImages.length + newImages.length + incoming.length > 8) {
      setError('A task supports up to eight images. Remove an image before adding more.');
      return;
    }
    if (incoming.some((file) => !['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)
      || !file.size || file.size > 10 * 1024 * 1024)) {
      setError('Use JPEG, PNG, WebP or GIF images under 10 MB each.');
      return;
    }
    setNewImages((old) => [...old, ...incoming]);
    setError('');
  }

  async function saveTask(status: 'DRAFT' | 'PUBLISHED') {
    if (busy) return;
    if (!title.trim() || !description.trim()) { setError('Task title and description are required.'); return; }
    const checklists = groups.filter((g) => g.name.trim() || g.items.some((i) => i.text.trim()))
      .map((g) => ({
        ...(g.id ? { id: g.id } : {}),
        name: g.name.trim(),
        items: g.items.filter((i) => i.text.trim()).map((i) => ({
          ...(i.id ? { id: i.id } : {}),
          text: i.text.trim(), rewardBp: Number(i.rewardBp),
        })),
      }));
    if (groups.some((g) => g.items.some((i) => i.text.trim() &&
        (!i.rewardBp.trim() || !Number.isFinite(Number(i.rewardBp)) ||
         Number(i.rewardBp) < 0 || Number(i.rewardBp) > 5 ||
         Math.abs(Number(i.rewardBp) * 100 - Math.round(Number(i.rewardBp) * 100)) > 0.000001)))) {
      setError('Each checklist item needs its own BP value from 0 to 5 (max two decimals).');
      return;
    }
    if (checklists.some((g) => !g.name)) { setError('Enter a name for every checklist.'); return; }
    if (status === 'PUBLISHED' && !checklists.some((g) => g.items.length)) {
      setError('Add at least one checklist step before publishing.'); return;
    }
    if (status === 'PUBLISHED' && !profile?.active) {
      setError('Activate your Individual Professional profile first to publish.'); return;
    }
    if (status === 'PUBLISHED' && !selectedFile && !videoUploadId && !videoAttached) {
      setError('Upload a video briefing before publishing.'); return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      let currentVideo = videoUploadId;
      if (selectedFile && !currentVideo) {
        setUploadPercent(0);
        currentVideo = await uploadTaskVideo(selectedFile, setUploadPercent);
        setVideoUploadId(currentVideo);
      }
      const imageIds = existingImages.map((image) => image.id);
      for (let i = 0; i < newImages.length; i++) {
        const file = newImages[i];
        let imageId = uploadedImages.find((entry) => entry.file === file)?.id;
        if (!imageId) {
          setImageProgress('Uploading image ' + (i + 1) + ' of ' + newImages.length + '…');
          imageId = await uploadTaskImage(file);
          setUploadedImages((current) => [...current, { file, id: imageId as string }]);
        }
        imageIds.push(imageId);
      }
      setImageProgress('');
      const url = editingId ? '/' + encodeURIComponent(editingId) : '';
      const result = await taskRequest<{ id: string; status: string }>(url, editingId ? 'PUT' : 'POST', {
        title: title.trim(), description: description.trim(), status, checklists,
        imageIds,
        ...(currentVideo ? { videoUploadId: currentVideo } : {}),
      });
      setTasks(await taskRequest<CreatorTask[]>('/mine'));
      clearEditor();
      setScreen('dashboard');
      setNotice(result.status === 'PUBLISHED' ? 'Task published. It is now in All Tasks.' : 'Task saved as a private draft.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your task.');
    } finally { setBusy(false); }
  }
  async function deleteTask(task: CreatorTask) {
    if (busy || !window.confirm('Delete "' + task.title + '" permanently?')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await taskRequest('/' + encodeURIComponent(task.id), 'DELETE');
      setTasks((old) => old.filter((item) => item.id !== task.id));
      setNotice('Task deleted.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete task.'); }
    finally { setBusy(false); }
  }
  const published = tasks.filter((task) => task.status === 'PUBLISHED').length;
  const totalBp = groups.reduce((sum, group) =>
    sum + group.items.filter((item) => item.text.trim()).reduce((part, item) => {
      const amount = Number(item.rewardBp);
      return part + (Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0);
    }, 0), 0) / 100;

  return (
    <main className="bm-page ct-page" data-bm-theme={theme}>
      <header className="bm-topbar">
        <button className="bm-back" type="button" onClick={onBack}>← Business Profile Settings</button>
        <img src="/blink-logo.png" alt="Blink" className="bm-logo" />
        <button className="bm-theme" type="button" onClick={onToggleTheme}>
          {theme === 'light' ? '☾ Dark mode' : '☀ Light mode'}
        </button>
      </header>
      <div className="bm-container ct-container">
        {loading ? <section className="bm-card bm-empty"><h2>Loading Creator Dashboard…</h2></section>
        : profile?.type !== 'PROFESSIONAL' ? (
          <section className="bm-card bm-empty">
            <h2>Individual Professional profile required</h2>
            <p>Save an Individual Professional profile in Business Profile Settings to create tasks.</p>
            <button className="bm-primary" type="button" onClick={onBack}>Business Profile Settings</button>
          </section>
        ) : <>
          <div className="ct-topline">
            <div><span className="bm-eyebrow">BLINK / CREATOR STUDIO</span><h1>Creator Dashboard</h1><p>Welcome, {profile.name}. Your ideas. Your tasks.</p></div>
            <div className="ct-top-actions">
              <button type="button" className="bm-outline" onClick={onBrowse}>Explore all tasks ↗</button>
              <button type="button" className="bm-primary" onClick={createTask}>＋ Create new task</button>
            </div>
          </div>
          {notice && <p className="ct-notice ct-success" role="status">{notice}</p>}
          {error && <p className="ct-notice ct-error" role="alert">{error}</p>}
          {screen === 'dashboard' ? <>
            <div className="ct-stats">
              <div className="ct-stat"><span>My tasks</span><strong>{tasks.length}</strong><small>All your tasks</small></div>
              <div className="ct-stat"><span>Published</span><strong>{published}</strong><small>Visible to everyone</small></div>
              <div className="ct-stat"><span>Drafts</span><strong>{tasks.length - published}</strong><small>Only you can see</small></div>
            </div>
            <section className="bm-card ct-list">
              <div className="ct-heading"><div><h2>My Tasks</h2><p className="bm-muted">Manage your own published tasks and drafts.</p></div><button className="bm-outline" type="button" onClick={onBrowse}>All Tasks →</button></div>
              {tasks.length === 0 ? (
                <div className="ct-empty"><span>🎬</span><h3>No tasks yet</h3><p>Create your first task with a video and named checklist.</p><button className="bm-primary" type="button" onClick={createTask}>Create Task</button></div>
              ) : tasks.map((task) => (
                <article className="ct-task-row" key={task.id}>
                  <div className="ct-task-icon">{task.images?.[0]
                    ? <CreatorTaskImage image={task.images[0]} alt="" className="ct-dashboard-thumb" />
                    : '🎬'}</div>
                  <div className="ct-task-main"><h3>{task.title}</h3><p>{task.rewardBp ?? 0} BP · {task.images?.length ?? 0} images · {task.checklists.length} checklists · {taskSteps(task)} steps · {new Date(task.updatedAt).toLocaleDateString()}</p></div>
                  <span className={'ct-status ' + (task.status === 'PUBLISHED' ? 'published' : 'draft')}>{task.status === 'PUBLISHED' ? 'Published' : 'Draft'}</span>
                  <div className="ct-row-actions">
                    {task.status === 'PUBLISHED' && <button className="bm-outline" type="button" onClick={() => onOpenTask(task.id)}>View</button>}
                    <button className="bm-outline" type="button" onClick={() => editTask(task)}>Edit</button>
                    <button className="ct-danger" type="button" disabled={busy} onClick={() => void deleteTask(task)}>Delete</button>
                  </div>
                </article>
              ))}
            </section>
          </> : <section className="ct-editor">
            <div className="ct-heading">
              <div><span className="bm-eyebrow">{editingId ? 'EDIT TASK' : 'CREATE TASK'}</span><h2>{editingId ? 'Edit Task' : 'Create Task'}</h2></div>
              <button type="button" className="bm-outline" onClick={() => { clearEditor(); setScreen('dashboard'); }}>← My Tasks</button>
            </div>
            <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); void saveTask('PUBLISHED'); }}>
              <div className="ct-editor-grid">
                <div className="ct-editor-left">
                  <section className="bm-card ct-editor-card">
                    <h3>01 · Task information</h3>
                    <label>Task title<input value={title} maxLength={140} required onChange={(e) => setTitle(e.target.value)} placeholder="Enter a task title" /></label>
                    <label>Task description<textarea value={description} maxLength={4000} required rows={7} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what participants should do" /></label>

                    <div className="ct-image-uploader">
                      <div className="ct-image-heading">
                        <strong>Task images</strong><span>{existingImages.length + newImages.length}/8 images</span>
                      </div>
                      <p className="bm-muted">Add pictures beside the title and description.</p>
                      <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                        multiple hidden onChange={(event) => { selectImages(event.target.files); event.target.value = ''; }} />
                      <button className="bm-outline ct-add-image" type="button"
                        disabled={busy || existingImages.length + newImages.length >= 8}
                        onClick={() => imageInput.current?.click()}>＋ Add images</button>
                      {(existingImages.length > 0 || newImages.length > 0) && (
                        <div className="ct-image-grid">
                          {existingImages.map((image) => (
                            <div className="ct-image-cell" key={image.id}>
                              <CreatorTaskImage image={image} alt="Task image" />
                              <button type="button" aria-label="Remove image"
                                onClick={() => setExistingImages((items) => items.filter((item) => item.id !== image.id))}>×</button>
                            </div>
                          ))}
                          {newImages.map((file, index) => (
                            <div className="ct-image-cell" key={index}>
                              <CreatorNewImage file={file} />
                              <button type="button" aria-label="Remove image"
                                onClick={() => setNewImages((items) => items.filter((_, i) => i !== index))}>×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {imageProgress && <p className="ct-image-upload-status" role="status">{imageProgress}</p>}
                    </div>
                  </section>
                  <section className="bm-card ct-editor-card">
                    <h3>02 · Task video</h3>
                    <div className="ct-upload" role="button" tabIndex={0} onClick={() => fileInput.current?.click()} onKeyDown={(e) => { if (e.key === 'Enter') fileInput.current?.click(); }}>
                      <span>☁</span>
                      <strong>{selectedFile?.name || (videoAttached ? 'Video uploaded' : 'Upload a high-quality video')}</strong>
                      <small>MP4, WebM, MOV · original quality · uploaded in 8 MB chunks</small>
                      <input ref={fileInput} type="file" hidden accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
                        onChange={(e) => { setSelectedFile(e.target.files?.[0] ?? null); setVideoUploadId(null); setUploadPercent(null); }}/>
                    </div>
                    {videoPreview && <video className="ct-video-preview" src={videoPreview} controls playsInline preload="metadata" />}
                    {uploadPercent !== null && <div className="ct-progress"><span>Video upload: {uploadPercent}%</span><progress max={100} value={uploadPercent}/></div>}
                    <small className="bm-muted">Large-file uploads depend on your server storage and configured TASK_MAX_VIDEO_BYTES limit.</small>
                  </section>
                </div>
                <section className="bm-card ct-editor-card">
                  <h3>03 · Named checklists</h3>
                  <p className="bm-muted">Every checklist item is an individual task with its own BP value (0–5). The total is calculated automatically.</p>
                  <div className="ct-bp-summary"><span>Combined task BP</span><strong>{totalBp.toFixed(2)} BP</strong></div>
                  {oldUnallocatedBp > 0 && <p className="ct-legacy-bp-alert">
                    Your older task had {oldUnallocatedBp.toFixed(2)} BP set at the parent level.
                    Assign that amount across individual checklist items before saving.
                    The old amount is not automatically assigned to a particular item.
                  </p>}
                  {groups.map((group, index) => (
                    <div className="ct-group" key={group.key}>
                      <div className="ct-group-head"><strong>Checklist {index + 1}</strong><button type="button" className="ct-text-danger" onClick={() => setGroups((old) => old.filter((g) => g.key !== group.key))}>Remove</button></div>
                      <label>Checklist name<input maxLength={100} value={group.name} onChange={(e) => updateGroup(group.key, { name: e.target.value })} placeholder="Checklist name" /></label>
                      <strong className="ct-steps-label">Checklist steps</strong>
                      {group.items.map((item) => (
                        <div className="ct-edit-item ct-reward-item" key={item.key}>
                          <span>☐</span>
                          <input aria-label="Checklist item title" value={item.text} maxLength={240}
                            onChange={(e) => updateItem(group.key, item.key, e.target.value)} placeholder="Individual task title"/>
                          <label className="ct-item-bp">
                            <span>BP / item</span>
                            <input type="number" min="0" max="5" step="0.01" inputMode="decimal"
                              aria-label={'BP for ' + (item.text || 'checklist item')}
                              value={item.rewardBp}
                              onChange={(e) => updateGroup(group.key, {
                                items: group.items.map((x) => x.key === item.key
                                  ? { ...x, rewardBp: e.target.value } : x),
                              })} />
                          </label>
                          <button type="button" title="Remove item" onClick={() => updateGroup(group.key, {
                            items: group.items.filter((i) => i.key !== item.key),
                          })}>×</button>
                        </div>
                      ))}
                      <button type="button" className="bm-outline" disabled={group.items.length >= 30} onClick={() => updateGroup(group.key, { items: [...group.items, { key: ++nextItemKey, text: '', rewardBp: '0' }] })}>＋ Add checklist item</button>
                    </div>
                  ))}
                  <button type="button" className="bm-outline ct-add-checklist" disabled={groups.length >= 12} onClick={() => setGroups((old) => [...old, makeChecklist()])}>＋ Add another checklist</button>
                </section>
              </div>
              {showPreview && <section className="bm-card ct-preview-task">
                <span className="bm-eyebrow">TASK PREVIEW</span>
                <h2>{title.trim() || 'Untitled task'}</h2>
                <span className="ct-reward-pill">🟠 {totalBp.toFixed(2)} BP total (sum of items)</span>
                <div className="ct-image-grid ct-preview-images">
                  {existingImages.map((image) => <CreatorTaskImage key={image.id} image={image} alt="Task picture" />)}
                  {newImages.map((file, index) => <CreatorNewImage key={index} file={file} />)}
                </div>
                <p>{description || 'Your description will appear here.'}</p>
                {videoPreview && <video src={videoPreview} controls playsInline />}
                {groups.map((group) => <div key={group.key}>
                  <h3>{group.name || 'Unnamed checklist'}</h3>
                  {group.items.filter((item) => item.text.trim()).map((item) => <p key={item.key}>☐ {item.text} — {Number(item.rewardBp || 0).toFixed(2)} BP</p>)}
                </div>)}
              </section>}
              <div className="ct-form-footer">
                <p>Save a private draft or publish your task to the community directory.</p>
                <div className="ct-top-actions">
                  <button type="button" className="bm-outline" onClick={() => setShowPreview((value) => !value)}>{showPreview ? 'Hide Preview' : 'Preview Task'}</button>
                  <button type="button" className="bm-outline" disabled={busy} onClick={() => void saveTask('DRAFT')}>Save Draft</button>
                  <button type="submit" className="bm-primary" disabled={busy}>{busy ? 'Saving / uploading…' : 'Publish Task →'}</button>
                </div>
              </div>
            </form>
          </section>}
        </>}
      </div>
    </main>
  );
}
