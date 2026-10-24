import { useEffect, useRef, useState, type FormEvent } from 'react';
import './BusinessMatchPage.css';
import './CreatorTasks.css';
import {
  TASK_API, taskRequest, taskSteps, taskToken, uploadTaskVideo,
  type CreatorTask, type DraftChecklist,
} from './creatorTaskApi';

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
  return { key: ++nextItemKey, name: 'Task completion checklist', items: [{ key: ++nextItemKey, text: '' }] };
}
export default function CreatorDashboardPage({
  theme, onToggleTheme, onBack, onBrowse, onOpenTask,
}: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<CreatorTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<'dashboard' | 'create'>('dashboard');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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
    setShowPreview(false);
    setTitle('');
    setDescription('');
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
    setShowPreview(false);
    setTitle(task.title);
    setDescription(task.description);
    setGroups(task.checklists.length
      ? task.checklists.map((g) => ({
        key: ++nextItemKey, name: g.name,
        items: g.items.map((i) => ({ key: ++nextItemKey, text: i.text })),
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

  async function saveTask(status: 'DRAFT' | 'PUBLISHED') {
    if (busy) return;
    if (!title.trim() || !description.trim()) { setError('Task title and description are required.'); return; }
    const checklists = groups.filter((g) => g.name.trim() || g.items.some((i) => i.text.trim()))
      .map((g) => ({ name: g.name.trim(), items: g.items.map((i) => i.text.trim()).filter(Boolean) }));
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
      const url = editingId ? '/' + encodeURIComponent(editingId) : '';
      const result = await taskRequest<{ id: string; status: string }>(url, editingId ? 'PUT' : 'POST', {
        title: title.trim(), description: description.trim(), status, checklists,
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
                  <div className="ct-task-icon">🎬</div>
                  <div className="ct-task-main"><h3>{task.title}</h3><p>{task.checklists.length} checklists · {taskSteps(task)} steps · {new Date(task.updatedAt).toLocaleDateString()}</p></div>
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
                  <p className="bm-muted">Checklists live under a task, each containing its own items.</p>
                  {groups.map((group, index) => (
                    <div className="ct-group" key={group.key}>
                      <div className="ct-group-head"><strong>Checklist {index + 1}</strong><button type="button" className="ct-text-danger" onClick={() => setGroups((old) => old.filter((g) => g.key !== group.key))}>Remove</button></div>
                      <label>Checklist name<input maxLength={100} value={group.name} onChange={(e) => updateGroup(group.key, { name: e.target.value })} placeholder="Checklist name" /></label>
                      <strong className="ct-steps-label">Checklist steps</strong>
                      {group.items.map((item) => (
                        <div className="ct-edit-item" key={item.key}>
                          <span>☐</span><input value={item.text} maxLength={240} onChange={(e) => updateItem(group.key, item.key, e.target.value)} placeholder="Write a step"/>
                          <button type="button" title="Remove step" onClick={() => updateGroup(group.key, { items: group.items.filter((i) => i.key !== item.key) })}>×</button>
                        </div>
                      ))}
                      <button type="button" className="bm-outline" disabled={group.items.length >= 30} onClick={() => updateGroup(group.key, { items: [...group.items, { key: ++nextItemKey, text: '' }] })}>＋ Add checklist item</button>
                    </div>
                  ))}
                  <button type="button" className="bm-outline ct-add-checklist" disabled={groups.length >= 12} onClick={() => setGroups((old) => [...old, makeChecklist()])}>＋ Add another checklist</button>
                </section>
              </div>
              {showPreview && <section className="bm-card ct-preview-task">
                <span className="bm-eyebrow">TASK PREVIEW</span>
                <h2>{title.trim() || 'Untitled task'}</h2>
                <p>{description || 'Your description will appear here.'}</p>
                {videoPreview && <video src={videoPreview} controls playsInline />}
                {groups.map((group) => <div key={group.key}>
                  <h3>{group.name || 'Unnamed checklist'}</h3>
                  {group.items.filter((item) => item.text.trim()).map((item) => <p key={item.key}>☐ {item.text}</p>)}
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
