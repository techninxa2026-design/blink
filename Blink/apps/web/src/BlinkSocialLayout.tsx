
import type { ReactNode } from 'react';
import './BlinkSocial.css';

type Props = {
  active: 'secrets' | 'hearts';
  title: string;
  subtitle: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onBack: () => void;
  onSecrets: () => void;
  onHearts: () => void;
  children: ReactNode;
};

export default function BlinkSocialLayout({
  active,
  title,
  subtitle,
  theme,
  onToggleTheme,
  onBack,
  onSecrets,
  onHearts,
  children,
}: Props) {
  return (
    <main className="blink-social">
      <div className="bs-main">

        {/* Header — no sidebar */}
        <header className="bs-topbar">
          <button
            type="button"
            className="bs-home-link"
            onClick={onBack}
            aria-label="Back to Blink Home"
          >
            <span aria-hidden="true">←</span>
            Back
          </button>

          <span className="bs-top-pill">
            ✦ YOUR CIRCLE
          </span>

          <button
            type="button"
            className="bs-home-link bs-theme-toggle"
            onClick={onToggleTheme}
            aria-label={
              theme === 'dark'
                ? 'Switch to light mode'
                : 'Switch to dark mode'
            }
          >
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
        </header>

        {/* Original introduction */}
        <section className="bs-intro">
          <span className="bs-kicker">
            BLINK ORIGINALS <span>✦</span>
          </span>

          <h1>{title}</h1>
          <p>{subtitle}</p>
        </section>

        {/* Small navigation switch, not a sidebar */}
        <nav
          className="bs-mobile-tabs"
          aria-label="Blink features"
        >
          <button
            type="button"
            className={active === 'secrets' ? 'active' : ''}
            onClick={onSecrets}
            aria-current={
              active === 'secrets' ? 'page' : undefined
            }
          >
            🔐 Secrets
          </button>

          <button
            type="button"
            className={active === 'hearts' ? 'active' : ''}
            onClick={onHearts}
            aria-current={
              active === 'hearts' ? 'page' : undefined
            }
          >
            🖤 Heart
          </button>
        </nav>

        {/* Original page UI and behavior */}
        {children}

      </div>
    </main>
  );
}
