import type { CSSProperties } from 'react';

export type BlinkIconName = 'home' | 'people' | 'capture' | 'reels' | 'explore' |
  'message' | 'heart' | 'lock' | 'exchange' | 'task' | 'business' | 'pin' |
  'phone' | 'video' | 'calendar' | 'profile' | 'settings' | 'arrow' | 'close' | 'sun' | 'moon';

const paths: Record<BlinkIconName, string> = {
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3 5.2 2 2 0 0 1 5 3h3a1 1 0 0 1 1 .9l.6 3a1 1 0 0 1-.3 1l-1.6 1.6a16 16 0 0 0 6 6l1.6-1.6a1 1 0 0 1 1-.3l3 .6a1 1 0 0 1 .9 1Z',
  video: 'M3 5h12v14H3ZM15 10l6-4v12l-6-4Z',
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  capture: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  reels: 'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM3 8h18M8 3l4 5m3-5 4 5m-9 4 6 3-6 3Z',
  explore: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM16 8l-3 5-5 3 3-5Z',
  message: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2a8.5 8.5 0 0 1 8.5 8.5ZM7 9h10M7 13h6',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  lock: 'M6 10V7a6 6 0 0 1 12 0v3M5 10h14a1 1 0 0 1 1 1v10H4V11a1 1 0 0 1 1-1ZM12 14v3',
  exchange: 'M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4',
  task: 'M9 4h6v4H9ZM9 6H5v15h14V6h-4M8 13l2 2 6-5M8 18h8',
  business: 'M8 7V3h8v4M3 7h18v14H3ZM3 12a24 24 0 0 0 18 0M10 12v3h4v-3',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  calendar: 'M4 5h16v16H4ZM8 3v4m8-4v4M4 10h16m-12 4h2m4 0h2m-8 4h2',
  profile: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  settings: 'm9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  close: 'm6 6 12 12M6 18 18 6',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  moon: 'M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10Z',
};

export function BlinkIcon({ name, size = 22, style }: {
  name: BlinkIconName; size?: number; style?: CSSProperties;
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true" focusable="false" style={style}>
    <path d={paths[name]} />
  </svg>;
}
