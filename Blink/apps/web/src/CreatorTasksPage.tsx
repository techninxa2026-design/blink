import { useEffect, useState, type FormEvent } from 'react';
import './BusinessMatchPage.css';
import './CreatorTasks.css';
import { TASK_API, taskRequest, taskSteps, type CreatorTask } from './creatorTaskApi';

type Props = {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onBack: () => void;
  onBrowse: () => void;
  onOpenTask: (id: string) => void;
  taskId: string | null;
};

export default function CreatorTasksPage({
  theme, onToggleTheme, onBack, onBrowse, onOpenTask, taskId,
}: Props) {
  const [tasks, setTasks] = useState<CreatorTask[]>([]);
  const [task, setTask] = useState<CreatorTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setTask(null);
    setChecked({});
    if (taskId) {
      void taskRequest<CreatorTask>('/' + encodeURIComponent(taskId))
        .then((value) => { if (alive) setTask(value); })
        .catch((err: unknown) => { if (alive) setError(err instanceof Error ? err.message : 'Task unavailable.'); })
        .finally(() => { if (alive) setLoading(false); });
    } else {
      if (page === 1) setTasks([]);
      void taskRequest<CreatorTask[]>('?page=' + page + '&q=' + encodeURIComponent(search))
        .then((items) => {
          if (!alive) return;
          setTasks((old) => page === 1
            ? items
            : [...old, ...items.filter((item) => !old.some((oldTask) => oldTask.id === item.id))]);
          setMore(items.length === 24);
        })
        .catch((err: unknown) => { if (alive) setError(err instanceof Error ? err.message : 'Unable to load tasks.'); })
        .finally(() => { if (alive) setLoading(false); });
    }
    return () => { alive = false; };
  }, [taskId, search, page]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(query.trim());
  }
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <main className="bm-page ct-page" data-bm-theme={theme}>
      <header className="bm-topbar">
        <button className="bm-back" type="button" onClick={onBack}>← Back to Blink</button>
        <img src="/blink-logo.png" className="bm-logo" alt="Blink" />
        <button className="bm-theme" type="button" onClick={onToggleTheme}>
          {theme === 'light' ? '☾ Dark mode' : '☀ Light mode'}
        </button>
      </header>
      <div className="bm-container ct-container">
        {taskId ? <>
          <button className="bm-outline ct-back" type="button" onClick={onBrowse}>← All Tasks</button>
          {loading ? <div className="bm-card bm-empty"><h2>Loading task…</h2></div>
          : error || !task ? <section className="bm-card bm-empty">
              <h2>Task unavailable</h2><p role="alert">{error || 'Task not found.'}</p>
              <button className="bm-primary" type="button" onClick={onBrowse}>All Tasks</button>
            </section>
          : <>
            <div className="ct-video-player">
              {task.videoUrl
                ? <video src={TASK_API + task.videoUrl} controls playsInline preload="metadata" />
                : <div className="ct-video-unavailable">🎬 No video available</div>}
            </div>
            <div className="ct-detail-grid">
              <section>
                <span className="bm-eyebrow">BLINK COMMUNITY TASK</span>
                <h1 className="ct-detail-title">{task.title}</h1>
                <p className="ct-creator">👤 {task.creator.name}</p>
                <p className="ct-task-description">{task.description}</p>
              </section>
              <section className="bm-card ct-checklist-detail">
                <div className="ct-heading"><h2>Task checklists</h2><span className="ct-progress-badge">{done}/{taskSteps(task)}</span></div>
                {task.checklists.map((group) => (
                  <div className="ct-detail-group" key={group.id}>
                    <h3>{group.name}</h3>
                    {group.items.map((item) => (
                      <label className="ct-check-item" key={item.id}>
                        <input
                          type="checkbox"
                          checked={Boolean(checked[item.id])}
                          onChange={(event) => setChecked((prev) => ({ ...prev, [item.id]: event.target.checked }))}
                        />
                        <span>{item.text}</span>
                      </label>
                    ))}
                  </div>
                ))}
                <p className="bm-muted ct-small">These checkmarks are only a local preview; submissions and participant completion history are not implemented yet.</p>
              </section>
            </div>
          </>}
        </> : <>
          <div className="ct-topline">
            <div><span className="bm-eyebrow">BLINK COMMUNITY</span><h1>Explore Tasks</h1><p>Discover tasks published by creators on Blink.</p></div>
          </div>
          <form className="ct-search" onSubmit={submitSearch}>
            <input aria-label="Search creator tasks" type="search" value={query} maxLength={100}
              placeholder="Search tasks, creators or instructions…" onChange={(event) => setQuery(event.target.value)} />
            <button className="bm-primary" type="submit">Search</button>
          </form>
          {error && <p className="ct-notice ct-error" role="alert">{error}</p>}
          <div className="ct-directory">
            {tasks.map((item) => (
              <article className="ct-public-card" key={item.id}>
                <div className="ct-thumbnail">
                  {item.videoUrl ? <video muted preload="metadata" playsInline src={TASK_API + item.videoUrl} />
                  : <span aria-hidden="true">🎬</span>}
                  <span className="ct-play-icon" aria-hidden="true">▶</span>
                </div>
                <div className="ct-public-body">
                  <h2>{item.title}</h2>
                  <p className="ct-creator">by {item.creator.name}</p>
                  <p className="ct-excerpt">{item.description}</p>
                  <p className="ct-meta">☑ {item.checklists.length} checklist(s) · {taskSteps(item)} steps</p>
                  <button className="bm-primary" type="button" onClick={() => onOpenTask(item.id)}>View Task →</button>
                </div>
              </article>
            ))}
          </div>
          {loading && <p className="bm-muted">Loading tasks…</p>}
          {!loading && !error && tasks.length === 0 && (
            <div className="bm-card bm-empty"><h2>No tasks found</h2><p>Try another search or check back for new creator tasks.</p></div>
          )}
          {!loading && more && <button type="button" className="bm-outline ct-load-more" onClick={() => setPage((p) => p + 1)}>Load more tasks</button>}
        </>}
      </div>
    </main>
  );
}
