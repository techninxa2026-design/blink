import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BlinkIcon } from './BlinkIcon';

type Request = { message: string; initial?: string; resolve: (value: string | boolean | null) => void };
const queue: Request[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

export function confirmAction(message: string): Promise<boolean> {
  return new Promise(resolve => {
    queue.push({ message, resolve: value => resolve(value === true) });
    notify();
  });
}

export function promptAction(message: string, initial = ''): Promise<string | null> {
  return new Promise(resolve => {
    queue.push({ message, initial, resolve: value => resolve(typeof value === 'string' ? value : null) });
    notify();
  });
}

/** One native modal for confirmations and rename prompts, across all routes. */
export function BlinkDialogHost() {
  const [request, setRequest] = useState<Request | undefined>(() => queue[0]);
  const [value, setValue] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const update = () => setRequest(queue[0]);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);
  useEffect(() => {
    if (!request) return;
    const previous = document.activeElement;
    setValue(request.initial ?? '');
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [request]);
  function finish(result: string | boolean | null) {
    const current = queue.shift();
    current?.resolve(result);
    notify();
  }
  if (!request) return null;
  const isPrompt = request.initial !== undefined;
  const destructive = /delete|remove|discard|unsend|leave|block/i.test(request.message) && !/unblock/i.test(request.message);
  const action = isPrompt ? 'Save name' : /delete/i.test(request.message) ? 'Delete' :
    /unsend/i.test(request.message) ? 'Unsend' : /discard/i.test(request.message) ? 'Discard edits' :
    /leave/i.test(request.message) ? 'Leave group' : /remove/i.test(request.message) ? 'Remove' :
    /unblock/i.test(request.message) ? 'Unblock' : /block/i.test(request.message) ? 'Block' : 'Confirm';
  return createPortal(<dialog ref={dialog} className="blink-confirm" aria-labelledby="blink-confirm-title"
    aria-describedby="blink-confirm-description" onCancel={event => { event.preventDefault(); finish(null); }}>
    <form onSubmit={event => { event.preventDefault(); finish(isPrompt ? value.trim() : true); }}>
      <div className={`blink-confirm-icon ${destructive ? 'is-danger' : ''}`}><BlinkIcon name={isPrompt ? 'people' : destructive ? 'lock' : 'task'} size={26} /></div>
      <h2 id="blink-confirm-title">{isPrompt ? 'Rename your group' : destructive ? 'Before you continue' : 'Ready to continue?'}</h2>
      <p id="blink-confirm-description">{request.message}</p>
      {isPrompt && <label>Group name<input value={value} maxLength={100} required autoFocus
        onChange={event => setValue(event.target.value)} /></label>}
      <div className="blink-confirm-actions">
        <button type="button" autoFocus={!isPrompt} onClick={() => finish(null)}>Cancel</button>
        <button type="submit" className={destructive ? 'is-danger' : 'is-primary'} disabled={isPrompt && !value.trim()}>{action}</button>
      </div>
    </form>
  </dialog>, document.body);
}

/** Keyboard and scroll behaviour shared by the existing custom dialogs. */
export function BlinkModalAccessibility() {
  useEffect(() => {
    let active: HTMLElement | undefined;
    let previous: HTMLElement | undefined;
    let savedOverflow: string | undefined;
    const focusable = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, video[controls], audio[controls], [tabindex="0"]',
    )).filter(element => element.getClientRects().length > 0 && !element.closest('[inert]'));
    const sync = () => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], dialog[open]'))
        .filter(element => element.getClientRects().length > 0);
      // Native confirmations must sit above an already open custom modal.
      const next = dialogs.find(element => element.tagName === 'DIALOG') ??
        dialogs.find(element => element.classList.contains('blink-call-scrim')) ?? dialogs.at(-1);
      if (next === active) return;
      if (next) {
        if (!active) {
          previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
          savedOverflow = document.body.style.overflow;
          document.body.style.overflow = 'hidden';
        }
        active = next;
        if (!next.contains(document.activeElement)) {
          next.tabIndex = -1;
          (focusable(next)[0] ?? next).focus({ preventScroll: true });
        }
      } else {
        active = undefined;
        if (savedOverflow !== undefined) document.body.style.overflow = savedOverflow;
        savedOverflow = undefined;
        if (previous?.isConnected) previous.focus({ preventScroll: true });
        previous = undefined;
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    const keydown = (event: KeyboardEvent) => {
      if (!active) return;
      if (event.key === 'Tab') {
        const controls = focusable(active);
        const first = controls[0] ?? active;
        const last = controls.at(-1) ?? active;
        if (!active.contains(document.activeElement) ||
            (event.shiftKey && document.activeElement === first) ||
            (!event.shiftKey && document.activeElement === last) || !controls.length) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      } else if (event.key === 'Escape' && active.tagName !== 'DIALOG') {
        const close = active.querySelector<HTMLButtonElement>(
          '[data-dialog-close],button[aria-label^="Close"],.bma-close,.bm-modal-close,.profile-edit-close,.profile-delete-cancel,.blink-note-close,.ci-close',
        );
        if (close && !close.disabled) { event.preventDefault(); event.stopImmediatePropagation(); close.click(); }
      }
    };
    document.addEventListener('keydown', keydown, true);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', keydown, true);
      if (savedOverflow !== undefined) document.body.style.overflow = savedOverflow;
    };
  }, []);
  return null;
}
