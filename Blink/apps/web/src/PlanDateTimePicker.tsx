import { useState } from 'react';
import './PlanDateTimePicker.css';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

const two = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PlanDateTimePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const firstWeekday = first.getDay();
  const selectedDate = value ? value.substring(0,10) : '';
  const hours24 = value ? Number(value.substring(11,13)) : 18;
  const minutes = value ? Number(value.substring(14,16)) : 0;
  const hour12 = hours24 % 12 || 12;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const dateText = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric', year:'numeric' })
    : 'Choose a date';

  function change(date: string, hour: number, minute: number, ap: string) {
    const h24 = (hour % 12) + (ap === 'PM' ? 12 : 0);
    onChange(date + 'T' + two(h24) + ':' + two(minute));
  }

  function updateTime(hour: number, minute: number, ap: string) {
    const initial = new Date();
    // First time choice also picks a date so the form always gets a complete value.
    if (!selectedDate && initial.getHours() >= 18) initial.setDate(initial.getDate() + 1);
    change(selectedDate || localDate(initial), hour, minute, ap);
  }

  const cells: Array<{ date: string; day: number; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(first.getFullYear(), first.getMonth(), i + 1 - firstWeekday);
    cells.push({ date: localDate(date), day: date.getDate(), inMonth: date.getMonth() === first.getMonth() });
  }
  return (
    <div className="blink-date-time">
      <button type="button" className={'blink-date-trigger' + (open ? ' active' : '')}
        aria-expanded={open} aria-label="Choose meetup date" onClick={() => setOpen(o => !o)}>
        <span aria-hidden="true">📅</span>
        <span><strong>{dateText}</strong><small>{selectedDate ? 'Change date' : 'Pick a day to meet'}</small></span>
        <span aria-hidden="true" className="blink-date-chevron">{open ? '⌃' : '⌄'}</span>
      </button>
      {open && (
        <div className="blink-calendar" role="group" aria-label="Choose a date">
          <div className="blink-calendar-head">
            <strong>{months[first.getMonth()]} {first.getFullYear()}</strong>
            <div>
              <button type="button" aria-label="Previous month" disabled={offset <= 0} onClick={() => setOffset(v => Math.max(0, v - 1))}>‹</button>
              <button type="button" aria-label="Next month" onClick={() => setOffset(v => v + 1)}>›</button>
            </div>
          </div>
          <div className="blink-calendar-grid">
            {weekdays.map(day => <span className="blink-calendar-weekday" key={day}>{day}</span>)}
            {cells.map(cell => {
              const old = cell.date < localDate(today);
              return <button type="button" key={cell.date} disabled={old || !cell.inMonth}
                className={(cell.date === selectedDate ? ' selected' : '') + (cell.date === localDate(today) ? ' today' : '')}
                aria-pressed={cell.date === selectedDate}
                onClick={() => { change(cell.date, hour12, minutes, period); setOpen(false); }}>
                {cell.day}
              </button>;
            })}
          </div>
          <div className="blink-calendar-foot"><span>● Today</span><button type="button" onClick={() => {setOffset(0);change(localDate(today),hour12,minutes,period);setOpen(false);}}>Use today</button></div>
        </div>
      )}
      <div className="blink-time-picker" role="group" aria-label="Choose a meetup time">
        <span aria-hidden="true">🕒</span>
        <label>Hour<select value={String(hour12)} onChange={e => updateTime(Number(e.target.value), minutes, period)} aria-label="Hour">
          {Array.from({length:12},(_,i)=>i+1).map(h => <option key={h} value={String(h)}>{two(h)}</option>)}
        </select></label>
        <span className="blink-time-colon">:</span>
        <label>Minute<select value={String(minutes)} onChange={e => updateTime(hour12, Number(e.target.value), period)} aria-label="Minute">
          {Array.from({length:60},(_,i)=>i).map(m => <option key={m} value={String(m)}>{two(m)}</option>)}
        </select></label>
        <label>Period<select value={period} onChange={e => updateTime(hour12, minutes, e.target.value)} aria-label="AM or PM">
          <option>AM</option><option>PM</option>
        </select></label>
      </div>
      <p className="blink-datetime-tip">Your friends will see the time in their local timezone.</p>
    </div>
  );
}
