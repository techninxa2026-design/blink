import { BlinkIcon, type BlinkIconName } from './BlinkIcon';

const groups: { title: string; description: string; items: {
  title: string; description: string; path: string; icon: BlinkIconName; mood: string;
}[] }[] = [
  { title: 'Your people, closer', description: 'Little updates. Good conversations. Real connections.', items: [
    { title: 'Inbox', description: 'Messages, group chats and calls with your friends.', path: '/inbox', icon: 'message', mood: 'orange' },
    { title: 'Check-Ins', description: 'Share a quick note and see what your circle is up to.', path: '/checkins', icon: 'pin', mood: 'rose' },
    { title: 'IRL Plans', description: 'Turn “we should meet” into something real.', path: '/irl', icon: 'calendar', mood: 'teal' },
    { title: 'Hearts', description: 'A little courage can start a new connection.', path: '/hearts', icon: 'heart', mood: 'rose' },
    { title: 'Secrets', description: 'Share a mystery. Let your friends take a guess.', path: '/secrets', icon: 'lock', mood: 'violet' },
  ] },
  { title: 'Make room for possibility', description: 'Share what you do, find opportunities and create together.', items: [
    { title: 'Services', description: 'Discover services and connect with people who can help.', path: '/Exchange', icon: 'exchange', mood: 'violet' },
    { title: 'Tasks', description: 'Explore creator tasks and put your skills to work.', path: '/tasks', icon: 'task', mood: 'gold' },
    { title: 'Business Match', description: 'Find professionals and businesses worth knowing.', path: '/business-match', icon: 'business', mood: 'teal' },
    { title: 'Creator Studio', description: 'Manage your tasks, submissions and reviews.', path: '/creator-dashboard', icon: 'capture', mood: 'orange' },
  ] },
];

export default function ExplorePage({ onNavigate, theme, onToggleTheme }: {
  onNavigate: (path: string) => void; theme: 'light' | 'dark'; onToggleTheme: () => void;
}) {
  return <main className="blink-explore">
    <header className="explore-topbar">
      <button type="button" className="explore-brand" onClick={() => onNavigate('/home')} aria-label="Blink Home">
        <img src="/blink-logo.png" alt="Blink" />
      </button>
      <div className="explore-utilities">
        <button type="button" onClick={() => onNavigate('/profile')}><BlinkIcon name="profile" size={19} /><span>My profile</span></button>
        <button type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}><BlinkIcon name={theme === 'light' ? 'moon' : 'sun'} size={19} /></button>
      </div>
    </header>
    <div className="explore-container">
      <section className="explore-intro">
        <div><span className="polish-eyebrow">A LITTLE MORE BLINK</span>
          <h1>Find your next<br /><span>little connection.</span></h1>
          <p>Your favourite spaces, together in one place. Follow your curiosity.</p>
        </div>
        <div className="explore-orbit" aria-hidden="true"><BlinkIcon name="explore" size={92} /><span>YOUR WORLD, OPEN</span></div>
      </section>
      {groups.map(group => <section className="explore-group" key={group.title}>
        <div className="explore-group-heading"><h2>{group.title}</h2><p>{group.description}</p></div>
        <div className="explore-grid">{group.items.map(item => <button key={item.path} type="button"
          className={`explore-card mood-${item.mood}`} onClick={() => onNavigate(item.path)}>
          <span className="explore-card-icon"><BlinkIcon name={item.icon} size={25} /></span>
          <span className="explore-card-copy"><strong>{item.title}</strong><span>{item.description}</span></span>
          <span className="explore-card-arrow"><BlinkIcon name="arrow" size={19} /></span>
        </button>)}</div>
      </section>)}
      <button className="explore-account" type="button" onClick={() => onNavigate('/settings')}>
        <BlinkIcon name="settings" /><span>Business profile settings</span><BlinkIcon name="arrow" size={18} />
      </button>
    </div>
  </main>;
}
