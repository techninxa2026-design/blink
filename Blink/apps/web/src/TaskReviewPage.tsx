import { useEffect, useMemo, useState } from 'react';
import './BusinessMatchPage.css';
import './CreatorTasks.css';
import './TaskReviewPage.css';
import { taskRequest } from './creatorTaskApi';
import ParticipationPhoto from './ParticipationPhoto';
import { videoPlaybackUrl } from './taskParticipationApi';

type ReviewStep = {
  id: string; checklistItemId: string; title: string; group: string;
  explanation: string; imageIds: string[]; videoUploadId: string | null;
  rewardBp: number; status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note: string | null; reviewedAt: string | null;
};
type ReviewSubmission = {
  id: string; status: 'SUBMITTED' | 'REVIEWED'; submittedAt: string | null;
  reviewedAt: string | null; earnedBp: number;
  participant: { id: string; name: string; avatarKey?: string | null };
  steps: ReviewStep[];
};
type ReviewData = { task: { id: string; title: string }; submissions: ReviewSubmission[] };
type Props = {
  taskId: string; theme: 'light' | 'dark';
  onToggleTheme: () => void; onBack: () => void;
};

function ReviewVideo({ id }: { id: string }) {
  const [url, setUrl] = useState('');
  const [failure, setFailure] = useState(false);
  useEffect(() => {
    let active = true;
    setUrl(''); setFailure(false);
    void videoPlaybackUrl(id).then((next) => { if (active) setUrl(next); })
      .catch(() => { if (active) setFailure(true); });
    return () => { active = false; };
  }, [id]);
  if (failure) return <p className="tr-muted">Video playback is unavailable.</p>;
  return url ? <video className="tr-video" controls playsInline preload="metadata" src={url} /> :
    <p className="tr-muted">Loading private video…</p>;
}

export default function TaskReviewPage({ taskId, theme, onToggleTheme, onBack }: Props) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('pending');
  const [busyId, setBusyId] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const latest = await taskRequest<ReviewData>('/' + encodeURIComponent(taskId) + '/submissions');
    setData(latest);
    setSelectedId((previous) =>
      latest.submissions.some((entry) => entry.id === previous)
        ? previous : latest.submissions[0]?.id ?? '');
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void taskRequest<ReviewData>('/' + encodeURIComponent(taskId) + '/submissions')
      .then((result) => {
        if (!active) return;
        setData(result);
        setSelectedId(result.submissions[0]?.id ?? '');
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Review queue unavailable.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [taskId]);

  const all = data?.submissions ?? [];
  const waiting = all.filter((entry) => entry.status === 'SUBMITTED');
  const reviewed = all.filter((entry) => entry.status === 'REVIEWED');
  const list = all.filter((entry) => filter === 'all' ||
    (filter === 'pending' ? entry.status === 'SUBMITTED' : entry.status === 'REVIEWED'));
  const selection = list.find((entry) => entry.id === selectedId) ?? list[0] ?? null;
  const pendingCount = useMemo(() => all.reduce((sum, entry) =>
    sum + entry.steps.filter((step) => step.status === 'PENDING').length, 0), [all]);

  async function decide(entry: ReviewSubmission, step: ReviewStep, decision: 'APPROVED' | 'REJECTED') {
    if (busyId || step.status !== 'PENDING') return;
    if (decision === 'APPROVED' && !window.confirm(
      'Approve "' + step.title + '" for ' + entry.participant.name +
      '? ' + step.rewardBp.toFixed(2) + ' BP will be credited immediately and cannot be awarded twice.'
    )) return;
    setBusyId(step.id); setError(''); setMessage('');
    try {
      const outcome = await taskRequest<{ awardedBp: number }>(
        '/' + encodeURIComponent(taskId) + '/submissions/' +
        encodeURIComponent(entry.id) + '/steps/' + encodeURIComponent(step.id) + '/review',
        'POST', { decision, note: notes[step.id]?.trim() || undefined },
      );
      setMessage(outcome.status === 'REVIEWED'
        ? 'Verification finished. ' + outcome.awardedBp.toFixed(2) +
          ' BP has been credited to ' + entry.participant.name + '.'
        : decision === 'APPROVED'
          ? 'Answer approved. BP will be credited once all submitted items have been reviewed.'
          : 'Answer rejected. Continue reviewing the remaining items.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not review the answer.');
    } finally { setBusyId(''); }
  }

  return (
    <main className="bm-page ct-page tr-page" data-bm-theme={theme}>
      <header className="bm-topbar">
        <button className="bm-back" type="button" onClick={onBack}>← Creator Dashboard</button>
        <img src="/blink-logo.png" className="bm-logo" alt="Blink"/>
        <button className="bm-theme" type="button" onClick={onToggleTheme}>
          {theme === 'light' ? '☾ Dark mode' : '☀ Light mode'}
        </button>
      </header>
      <div className="bm-container ct-container">
        <div className="tr-title">
          <span className="bm-eyebrow">BLINK / CREATOR REVIEWS</span>
          <h1>Task Verification</h1>
          <p>{data?.task.title ?? 'Review participant answers'}</p>
          <button className="bm-outline" type="button" disabled={Boolean(busyId)}
            onClick={() => void load().catch((err: unknown) =>
              setError(err instanceof Error ? err.message : 'Unable to refresh submissions.'))}>
            ↻ Refresh participant queue
          </button>
        </div>
        {error && <p className="ct-notice ct-error" role="alert">{error}</p>}
        {message && <p className="ct-notice ct-success" role="status">{message}</p>}
        {loading ? <section className="bm-card tr-empty">Loading submitted answers…</section>
          : !data ? <section className="bm-card tr-empty">Could not load the review queue.</section>
          : <>
            <div className="tr-stats">
              <div><strong>{waiting.length}</strong><span>Participants awaiting review</span></div>
              <div><strong>{pendingCount}</strong><span>Checklist answers pending</span></div>
              <div><strong>{reviewed.length}</strong><span>Fully reviewed participants</span></div>
            </div>
            <div className="tr-layout">
              <aside className="bm-card tr-sidebar">
                <h2>Participant queue</h2>
                <div className="tr-filters">
                  {(['pending','all','reviewed'] as const).map((option) =>
                    <button key={option} type="button" className={filter === option ? 'active' : ''}
                      onClick={() => setFilter(option)}>{option === 'pending' ? 'Pending' :
                        option === 'all' ? 'All' : 'Reviewed'}</button>)}
                </div>
                {list.length === 0 && <p className="tr-muted">No participants in this view.</p>}
                {list.map((entry) => (
                  <button type="button" key={entry.id}
                    className={'tr-person' + (selection?.id === entry.id ? ' active' : '')}
                    onClick={() => { setSelectedId(entry.id); setError(''); setMessage(''); }}>
                    <span className="tr-avatar">{entry.participant.name.slice(0,1).toUpperCase()}</span>
                    <span className="tr-person-text">
                      <strong>{entry.participant.name}</strong>
                      <small>{entry.steps.filter((step) => step.status === 'PENDING').length} pending · {entry.steps.length} answers</small>
                    </span>
                    <span className={'tr-status ' + (entry.status === 'REVIEWED' ? 'done' : 'pending')}>
                      {entry.status === 'REVIEWED' ? 'Reviewed' : 'New'}
                    </span>
                  </button>
                ))}
              </aside>
              <section className="tr-answer-list">
                {!selection ? <div className="bm-card tr-empty">Select a participant to review individual checklist answers.</div>
                  : <>
                    <div className="bm-card tr-participant-summary">
                      <div>
                        <span className="bm-eyebrow">PARTICIPANT</span>
                        <h2>{selection.participant.name}</h2>
                        <p className="tr-muted">Submitted {selection.submittedAt ?
                          new Date(selection.submittedAt).toLocaleString() : 'recently'}</p>
                      </div>
                      <div className="tr-earned"><strong>{selection.earnedBp.toFixed(2)} BP</strong><small>Credited after full review</small></div>
                    </div>
                    {selection.steps.map((step, index) => (
                      <article className="bm-card tr-answer" key={step.id}>
                        <div className="tr-answer-heading">
                          <div><span className="bm-eyebrow">ANSWER {index + 1} · {step.group}</span><h3>{step.title}</h3></div>
                          <span className="ct-reward-pill">{step.rewardBp.toFixed(2)} BP</span>
                        </div>
                        <div className="tr-review-status">
                          <span className={'tr-status ' + (step.status === 'APPROVED' ? 'done' : step.status === 'REJECTED' ? 'rejected' : 'pending')}>
                            {step.status === 'APPROVED' ? '✓ Approved' : step.status === 'REJECTED' ? '✕ Rejected' : '⏳ Needs review'}
                          </span>
                          {step.note && <p className="tr-muted">Review note: {step.note}</p>}
                        </div>
                        <h4>Participant explanation</h4>
                        <p className="tr-explanation">{step.explanation || 'No written explanation.'}</p>
                        {step.imageIds.length > 0 && <>
                          <h4>Evidence images ({step.imageIds.length})</h4>
                          <div className="tr-photos">
                            {step.imageIds.map((id) => <div className="tr-photo" key={id}><ParticipationPhoto id={id} /></div>)}
                          </div>
                        </>}
                        {step.videoUploadId && <>
                          <h4>Video evidence</h4><ReviewVideo id={step.videoUploadId}/>
                        </>}
                        {step.status === 'PENDING' && <>
                          <label className="tr-note">Verification note (optional)
                            <textarea maxLength={500} rows={2} value={notes[step.id] || ''}
                              placeholder="Explain your decision, especially if rejecting."
                              onChange={(event) => setNotes((old) => ({ ...old, [step.id]: event.target.value }))} />
                          </label>
                          <div className="tr-decisions">
                            <button type="button" className="tr-approve" disabled={Boolean(busyId)}
                              onClick={() => void decide(selection, step, 'APPROVED')}>
                              {busyId === step.id ? 'Reviewing…' : '✓ Approve · ' + step.rewardBp.toFixed(2) + ' BP'}
                            </button>
                            <button type="button" className="tr-reject" disabled={Boolean(busyId)}
                              onClick={() => void decide(selection, step, 'REJECTED')}>✕ Reject Answer</button>
                          </div>
                        </>}
                      </article>
                    ))}
                  </>}
              </section>
            </div>
          </>}
      </div>
    </main>
  );
}
