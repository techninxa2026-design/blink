import { useEffect, useState } from 'react';
import './BusinessMatchPage.css';

type ProfileType = 'PROFESSIONAL' | 'COMPANY';
type SavedProfile = { id: string; type: ProfileType; name: string; active: boolean };
type Props = {
  expectedType: ProfileType;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onBack: () => void;
  onDiscover: () => void;
};
const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export default function BusinessDashboardPage({
  expectedType, theme, onToggleTheme, onBack, onDiscover,
}: Props) {
  const [profile, setProfile] = useState<SavedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const jwt = localStorage.getItem('blink-access-token') ||
      sessionStorage.getItem('blink-access-token');
    setLoading(true);
    setError('');
    setProfile(null);

    async function loadProfile() {
      if (!jwt) throw new Error('Please sign in again.');
      const response = await fetch(API + '/business-match/me', {
        headers: { Authorization: 'Bearer ' + jwt },
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Could not load Business Profile (' + response.status + ').');
      }
      const data = (await response.json()) as SavedProfile | null;
      if (!controller.signal.aborted) setProfile(data);
    }

    void loadProfile().catch((err: unknown) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Unable to load your profile.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [expectedType]);

  const creator = expectedType === 'PROFESSIONAL';
  const title = creator ? 'Creator Dashboard' : 'Business Dashboard';

  return (
    <main className="bm-page" data-bm-theme={theme}>
      <header className="bm-topbar">
        <button className="bm-back" type="button" onClick={onBack}>
          ← Business Profile Settings
        </button>
        <img src="/blink-logo.png" className="bm-logo" alt="Blink" />
        <button className="bm-theme" type="button" onClick={onToggleTheme}>
          {theme === 'light' ? '☾ Dark mode' : '☀ Light mode'}
        </button>
      </header>
      <div className="bm-container">
        {loading ? (
          <section className="bm-card bm-empty"><h2>Loading your profile…</h2></section>
        ) : error ? (
          <section className="bm-card bm-empty">
            <h2>Dashboard unavailable</h2>
            <p role="alert">{error}</p>
            <button type="button" className="bm-primary" onClick={onBack}>Back to settings</button>
          </section>
        ) : profile?.type !== expectedType ? (
          <section className="bm-card bm-empty">
            <h2>{profile ? 'Different profile type' : 'Create a Business Profile first'}</h2>
            <p>Save the matching profile type under Business Profile Settings to access this dashboard.</p>
            <button type="button" className="bm-primary" onClick={onBack}>Go to Business Profile Settings</button>
          </section>
        ) : (
          <>
            <section className="bm-heading">
              <span className="bm-eyebrow">BLINK / {title.toUpperCase()}</span>
              <h1>{title}</h1>
              <p>Welcome, {profile.name}.</p>
            </section>
            <section className="bm-card bm-dashboard-summary">
              <span className="bm-eyebrow">YOUR BUSINESS IDENTITY</span>
              <h2>{profile.name}</h2>
              <span className={`bm-activation ${profile.active ? 'on' : ''}`}>
                {profile.active ? '● Active in business discovery' : '○ Business discovery is paused'}
              </span>
              <p>{profile.active ? 'Your profile is available for new business connections. Explore the directory to manage requests, conversations and meetings.' : 'Update your business profile settings when you are ready to appear in discovery.'}</p>
              <div className="bm-utility-links">
                <button type="button" className="bm-primary" onClick={onDiscover}>Open Business Match →</button>
                <button type="button" className="bm-link" onClick={onBack}>Edit business profile</button>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
