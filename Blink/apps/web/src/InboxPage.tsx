
import { useCallback, useEffect, useRef, useState } from 'react';
import './InboxPage.css';
import { SOCIAL_API_URL } from './blinkSocialApi';

const API_URL = SOCIAL_API_URL;

type PublicUser = {
  id: string;
  name: string;
  avatarKey: string | null;
  bio: string | null;
};

type Message = {
  id: string;
  senderId: string;
  body: string | null;
  mediaKey: string | null;
  mediaType?: string | null;
  isPrivate?: boolean;
  privateOpenedAt?: string | null;
  createdAt: string;
  editedAt?: string | null;
  unsentAt?: string | null;
  replyToId?: string | null;
  forwarded?: boolean;
  reactions?: { userId: string; emoji: string }[];
  privateViews?: { userId: string }[];
};

type ConversationSummary = {
  id: string;
  otherUser: PublicUser | null;
  isGroup?: boolean;
  groupName?: string | null;
  members?: { user: PublicUser; role: string }[];
  lastMessage: Message | null;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  muted?: boolean;
  blockedByMe?: boolean;
  blockedByOther?: boolean;
};

type ConversationDetail = {
  id: string;
  otherUser: PublicUser | null;
  isGroup?: boolean;
  groupName?: string | null;
  groupOwnerId?: string | null;
  members?: { user: PublicUser; role: string }[];
  messages: Message[];
  otherLastReadAt: string | null;
  pinnedMessage?: { id: string; body: string | null; mediaType: string | null; isPrivate: boolean } | null;
  muted?: boolean;
  blockedByMe?: boolean;
  blockedByOther?: boolean;
  createdAt: string;
};

type Props = {
  onBack: () => void;
  onOpenProfile: (userId: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

function getToken() {
  return (
    localStorage.getItem('blink-access-token') ||
    sessionStorage.getItem('blink-access-token')
  );
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  if (!token) throw new Error('Please sign in again.');

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(options.method === 'POST' ? 'Could not send message. Please try again.' : 'Could not load Inbox. Please try again.');
  }

  return (await response.json()) as T;
}

function avatarUrl(key: string) {
  if (/^https?:\/\//i.test(key)) return key;
  return `${API_URL}${key.startsWith('/') ? key : `/uploads/${key}`}`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function renderMessageText(body: string | null) {
  if (!body) return null;
  return body.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
    /^https?:\/\//.test(part)
      ? <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      : <span key={index}>{part}</span>,
  );
}

function UserAvatar({ user }: { user: PublicUser }) {
  return (
    <div className="inbox-avatar">
      {user.avatarKey ? (
        <img src={avatarUrl(user.avatarKey)} alt="" />
      ) : (
        <span>{user.name.slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
}


function SendIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>; }
function PaperclipIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>; }
function MicIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8"/></svg>; }
function VoicePlayer({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const format = (n: number) => `${Math.floor(n / 60)}:${Math.floor(n % 60).toString().padStart(2, '0')}`;
  return <div className="inbox-voice-player"><audio ref={ref} src={src} preload="metadata" onLoadedMetadata={e => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)} onTimeUpdate={e => setPosition(e.currentTarget.currentTime)} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
    <button type="button" aria-label={playing ? 'Pause voice message' : 'Play voice message'} onClick={() => { const audio = ref.current; if (!audio) return; if (audio.paused) void audio.play(); else audio.pause(); }}>{playing ? '❚❚' : '▶'}</button>
    <input type="range" aria-label="Voice playback position" min={0} max={duration || 1} step="0.1" value={Math.min(position, duration || 1)} onChange={e => { if (ref.current) ref.current.currentTime = Number(e.target.value); setPosition(Number(e.target.value)); }} />
    <small>{format(position)} / {format(duration)}</small><button type="button" aria-label="Playback speed" onClick={() => { const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1; setSpeed(next); if (ref.current) ref.current.playbackRate = next; }}>{speed}×</button>
  </div>;
}

export default function InboxPage({
  onBack,
  onOpenProfile,
  theme,
  onToggleTheme,
}: Props) {
  const [conversations, setConversations] = useState<
    ConversationSummary[]
  >([]);
  const [active, setActive] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<{id:string;body:string|null;createdAt:string;senderId:string}[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [highlightId, setHighlightId] = useState<string|null>(null);
  const aroundRef = useRef<string|null>(null);
  const [actionMessageId, setActionMessageId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const longPressRef = useRef<number | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [forwarding, setForwarding] = useState<Message | null>(null);
  const [forwardFriends, setForwardFriends] = useState<PublicUser[]>([]);
  const [forwardSelected, setForwardSelected] = useState<string[]>([]);
  const [forwardBusy, setForwardBusy] = useState(false);
  const [groupPicker, setGroupPicker] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSelected, setGroupSelected] = useState<string[]>([]);
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupMembersOpen, setGroupMembersOpen] = useState(false);
  const [groupAddOpen, setGroupAddOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voicePreview, setVoicePreview] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const recordingStartRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string,string>>({});
  const regularMediaPendingRef = useRef<Set<string>>(new Set());
  const regularMediaUrlsRef = useRef<Record<string,string>>({});
  const [privateViewer, setPrivateViewer] = useState<{id:string;url:string;type:string;remaining:number}|null>(null);
  const [openingPrivate, setOpeningPrivate] = useState<string|null>(null);
  const openedPrivateRef = useRef<Set<string>>(new Set());
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const pollBusyRef = useRef(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => { activeIdRef.current = active?.id ?? null; }, [active?.id]);

  const loadInbox = useCallback(async () => {
    const result = await apiRequest<ConversationSummary[]>('/inbox');
    setConversations(result);
  }, []);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');

    void apiRequest<ConversationSummary[]>('/inbox')
      .then((data) => {
        if (!cancelled) setConversations(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Inbox error.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function showNewMessage() {
    setNewMessageOpen(true);
    setFriendSearch('');
    setLoadingFriends(true);
    setError('');
    try {
      setFriends(await apiRequest<PublicUser[]>('/inbox/friends'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load friends.');
    } finally {
      setLoadingFriends(false);
    }
  }

  async function createGroup() {
    if (groupBusy || !groupName.trim() || !groupSelected.length) return;
    setGroupBusy(true); setError('');
    try {
      const created = await apiRequest<{ conversationId: string }>('/inbox/groups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName.trim(), friendIds: groupSelected }),
      });
      await loadInbox(); await openConversation(created.conversationId);
      setGroupPicker(false); setNewMessageOpen(false); setGroupSelected([]); setGroupName('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create group.'); }
    finally { setGroupBusy(false); }
  }

  async function groupAction(action: 'rename' | 'add' | 'remove' | 'leave', targetId?: string) {
    if (!active?.isGroup || groupBusy) return;
    const id = active.id;
    if (action === 'leave' && !window.confirm('Leave this group?')) return;
    if (action === 'remove' && !window.confirm('Remove this member?')) return;
    const name = action === 'rename' ? window.prompt('New group name', active.groupName ?? '') : null;
    if (action === 'rename' && name === null) return;
    setGroupBusy(true); setError('');
    try {
      const path = `/inbox/groups/${encodeURIComponent(id)}`;
      await apiRequest(action === 'rename' ? `${path}/name` : action === 'add' ? `${path}/members` : action === 'remove' ? `${path}/members/${encodeURIComponent(targetId ?? '')}` : `${path}/leave`, {
        method: action === 'rename' ? 'PATCH' : action === 'remove' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'rename' ? { name } : action === 'add' ? { friendIds: groupSelected } : {}),
      });
      if (action === 'leave') { setActive(null); setGroupMembersOpen(false); }
      else { setActive(await apiRequest<ConversationDetail>(`/inbox/conversations/${encodeURIComponent(id)}`)); }
      if (action === 'add') { setGroupAddOpen(false); setGroupSelected([]); }
      await loadInbox();
    } catch (err) { setError(err instanceof Error ? err.message : 'Group action failed.'); }
    finally { setGroupBusy(false); }
  }

  async function startConversation(friendId: string) {
    if (startingChat) return;
    setStartingChat(true);
    setError('');
    try {
      const result = await apiRequest<{ conversationId: string }>('/inbox/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId }),
      });
      await openConversation(result.conversationId);
      await loadInbox();
      setNewMessageOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start conversation.');
    } finally {
      setStartingChat(false);
    }
  }

  async function openConversation(id: string) {
    setOpening(true);
    setError('');

    try {
      const result = await apiRequest<ConversationDetail>(
        `/inbox/conversations/${encodeURIComponent(id)}`,
      );
      aroundRef.current = null;
      setChatMenuOpen(false); setSearchOpen(false); setSearchResults([]); setSearchText(''); setHighlightId(null);
      setActive(result);
      setReplyTo(null); setForwarding(null); setGroupMembersOpen(false); setGroupAddOpen(false);
      setDraft(drafts[id] ?? '');
      void markConversationRead(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open chat.');
    } finally {
      setOpening(false);
    }
  }

  async function markConversationRead(id: string) {
    try {
      await apiRequest(`/inbox/conversations/${encodeURIComponent(id)}/read`, { method: 'POST' });
      setConversations((items) => items.map((item) => item.id === id ? { ...item, unreadCount: 0 } : item));
    } catch { /* The next poll retries; don't interrupt messaging. */ }
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (pollBusyRef.current || document.hidden) return;
      pollBusyRef.current = true;
      void (async () => {
        try {
          const items = await apiRequest<ConversationSummary[]>('/inbox');
          setConversations(items);
          const id = activeIdRef.current;
          if (id) {
            const detail = await apiRequest<ConversationDetail>(`/inbox/conversations/${encodeURIComponent(id)}${aroundRef.current ? `?around=${encodeURIComponent(aroundRef.current)}` : ""}`);
            if (activeIdRef.current === id) {
              setActive((previous) => previous?.id === id ? detail : previous);
              const unread = items.find((item) => item.id === id)?.unreadCount ?? 0;
              if (unread > 0) await markConversationRead(id);
            }
          }
        } catch { /* Temporary network errors are retried on the next poll. */ }
        finally { pollBusyRef.current = false; }
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [active?.id, active?.messages.length]);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!active || !text || sending) return;
    const conversationId = active.id;
    setSending(true);
    setError('');
    try {
      const message = await apiRequest<Message>(
        `/inbox/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: text, replyToId: replyTo?.id ?? null }),
        },
      );
      setActive((current) => current?.id === conversationId
        ? { ...current, messages: [...current.messages, message] }
        : current);
      setDraft(''); setReplyTo(null);
      setDrafts((previous) => ({ ...previous, [conversationId]: '' }));
      await loadInbox();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  }

  async function uploadMedia(file: File, isPrivate = false) {
    if (!active || sending) return;
    if (!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime)|audio\/(webm|ogg|mp4|mpeg|wav))$/.test(file.type)) {
      setError('Please choose a supported photo or video.'); return;
    }
    if (file.size > 30 * 1024 * 1024) { setError('Maximum media size is 30 MB.'); return; }
    setSending(true); setError('');
    const form = new FormData();
    form.append('isPrivate',String(isPrivate));
    form.append('file',file);
    try {
      const message = await apiRequest<Message>(`/inbox/conversations/${encodeURIComponent(active.id)}/media`, {method:'POST',body:form});
      setActive(current => current?.id === active.id ? {...current,messages:[...current.messages,message]} : current);
      await loadInbox();
      if (file === selectedMedia) clearSelectedMedia();
      if (file === voiceFile) discardVoice();
    } catch(err) { setError(err instanceof Error ? err.message : 'Upload failed.'); }
    finally { setSending(false); if(fileInputRef.current) fileInputRef.current.value=''; }
  }

  function chooseMedia(file: File) {
    if (!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))$/.test(file.type)) { setError('Choose a supported photo or video.'); return; }
    if (file.size > 30 * 1024 * 1024) { setError('Maximum media size is 30 MB.'); return; }
    if (selectedPreview) URL.revokeObjectURL(selectedPreview);
    setSelectedMedia(file);
    setSelectedPreview(URL.createObjectURL(file));
    setError('');
  }

  function clearSelectedMedia() {
    if (selectedPreview) URL.revokeObjectURL(selectedPreview);
    setSelectedPreview(null); setSelectedMedia(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function sendSelectedMedia(isPrivate: boolean) {
    if (!selectedMedia) return;
    await uploadMedia(selectedMedia, isPrivate);
    // Only clear on success; uploadMedia reports failures through the error state.
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Voice recording requires a supported browser and HTTPS or localhost.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneRef.current = stream;
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop()); microphoneRef.current = null;
        if (!chunks.length) return;
        const contentType = recorder.mimeType.split(';')[0] || 'audio/webm';
        const extension = contentType.includes('mp4') ? 'm4a' : contentType.includes('ogg') ? 'ogg' : 'webm';
        const file = new File(chunks, `voice-${Date.now()}.${extension}`, { type: contentType });
        setVoiceFile(file);
        setVoicePreview(URL.createObjectURL(file));
      };
      recordingStartRef.current = Date.now(); setRecordSeconds(0); setRecording(true);
      recorder.start(250);
    } catch { setError('Microphone access was denied or is unavailable.'); }
  }

  function finishRecording(discard = false) {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      if (discard) { recorder.ondataavailable = null; recorder.onstop = null; }
      recorder.stop();
    }
    microphoneRef.current?.getTracks().forEach(track => track.stop());
    microphoneRef.current = null; recorderRef.current = null; setRecording(false);
    if (discard) discardVoice();
  }

  function discardVoice() {
    if (voicePreview) URL.revokeObjectURL(voicePreview);
    setVoicePreview(null); setVoiceFile(null); setRecordSeconds(0);
  }

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordSeconds(Math.floor((Date.now() - recordingStartRef.current) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [recording]);

  async function sendVoice() {
    if (!voiceFile) return;
    const file = voiceFile;
    await uploadMedia(file);
  }

  const durationLabel = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  // Regular attachments are fetched automatically, without requiring a click.
  // The authenticated media endpoint remains protected by the existing API guard.
  const regularMediaIds = active?.messages
    .filter(message => message.mediaKey && !message.isPrivate && !message.unsentAt)
    .map(message => message.id).join('|') ?? '';

  useEffect(() => {
    const ids = regularMediaIds ? regularMediaIds.split('|') : [];
    for (const id of ids) {
      if (regularMediaUrlsRef.current[id] || regularMediaPendingRef.current.has(id)) continue;
      regularMediaPendingRef.current.add(id);
      void (async () => {
        try {
          const response = await fetch(`${API_URL}/inbox/media/${encodeURIComponent(id)}`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          });
          if (!response.ok) throw new Error('Media unavailable');
          const url = URL.createObjectURL(await response.blob());
          regularMediaUrlsRef.current[id] = url;
          setMediaUrls(previous => ({ ...previous, [id]: url }));
        } catch {
          // Retry when the conversation is reopened; never block other messages.
        } finally {
          regularMediaPendingRef.current.delete(id);
        }
      })();
    }
  }, [regularMediaIds]);

  useEffect(() => () => {
    Object.values(regularMediaUrlsRef.current).forEach(url => URL.revokeObjectURL(url));
  }, []);

  async function openPrivateMoment(message: Message) {
    if(openingPrivate || openedPrivateRef.current.has(message.id) || message.privateOpenedAt) return;
    // Mark locally immediately so repeated clicks cannot send a second request.
    openedPrivateRef.current.add(message.id);
    setOpeningPrivate(message.id);
    try {
      const response=await fetch(`${API_URL}/inbox/media/${encodeURIComponent(message.id)}/open`,{
        method:'POST',headers:{Authorization:`Bearer ${getToken()}`},cache:'no-store'
      });
      if(!response.ok) throw new Error('This Private Moment is unavailable or already opened.');
      const url=URL.createObjectURL(await response.blob());
      setPrivateViewer({id:message.id,url,type:message.mediaType ?? 'image',remaining:5});
      setActive(current=>current?{...current,messages:current.messages.map(m=>m.id===message.id?{...m,privateOpenedAt:new Date().toISOString()}:m)}:current);
    } catch(err) { setError(err instanceof Error ? err.message : 'Could not open Private Moment.'); }
    finally { setOpeningPrivate(null); }
  }

  function closePrivateViewer() {
    setPrivateViewer(current=>{if(current) URL.revokeObjectURL(current.url);return null;});
  }

  useEffect(()=>{
    if(!privateViewer || privateViewer.type!=='image') return;
    const timer=window.setTimeout(()=>closePrivateViewer(),5000);
    return ()=>window.clearTimeout(timer);
  },[privateViewer?.id,privateViewer?.type]);

  useEffect(()=>{
    if(!privateViewer) return;
    const onVisibility=()=>{if(document.hidden) closePrivateViewer();};
    const onBlur=()=>closePrivateViewer();
    document.addEventListener('visibilitychange',onVisibility);
    window.addEventListener('blur',onBlur);
    return ()=>{document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('blur',onBlur);};
  },[privateViewer?.id]);

  function jumpToMessage(messageId: string) {
    const present = active?.messages.some(message => message.id === messageId);
    if (present) {
      setHighlightId(messageId);
      document.getElementById(`inbox-message-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else void jumpToResult(messageId);
  }

  async function pinMessage(messageId: string | null) {
    if (!active || actionBusy) return;
    setActionBusy(true); setError('');
    try {
      await apiRequest(`/inbox/conversations/${encodeURIComponent(active.id)}/pin`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId }),
      });
      const detail = await apiRequest<ConversationDetail>(`/inbox/conversations/${encodeURIComponent(active.id)}`);
      setActive(detail); setActionMessageId(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not pin message.'); }
    finally { setActionBusy(false); }
  }

  async function startForward(message: Message) {
    setActionMessageId(null); setForwarding(message); setForwardSelected([]); setError('');
    try { setForwardFriends(await apiRequest<PublicUser[]>('/inbox/friends')); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load friends.'); }
  }

  async function submitForward() {
    if (!forwarding || forwardSelected.length === 0 || forwardBusy) return;
    setForwardBusy(true); setError('');
    try {
      await apiRequest(`/inbox/messages/${encodeURIComponent(forwarding.id)}/forward`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendIds: forwardSelected }),
      });
      setForwarding(null); setForwardSelected([]); await loadInbox();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not forward message.'); }
    finally { setForwardBusy(false); }
  }

  function previewMessage(message: Message) {
    if (message.unsentAt) return 'Message unsent';
    if (message.isPrivate) return '🔒 Private Moment';
    if (message.mediaType === 'audio') return '🎤 Voice message';
    if (message.mediaType === 'video') return '🎬 Video';
    if (message.mediaKey) return '📷 Photo';
    return message.body ?? 'Message';
  }

  async function messageAction(message: Message, action: 'edit'|'hide'|'unsend'|'reaction', emoji?: string | null) {
    if (actionBusy) return;
    if (action === 'edit') {
      setEditingId(message.id); setEditDraft(message.body ?? ''); setActionMessageId(null); return;
    }
    if (action === 'unsend' && !window.confirm('Unsend this message for everyone?')) return;
    if (action === 'hide' && !window.confirm('Delete this message from your Inbox only?')) return;
    setActionBusy(true); setError('');
    try {
      const path = `/inbox/messages/${encodeURIComponent(message.id)}`;
      await apiRequest(action === 'reaction' ? `${path}/reaction` : action === 'unsend' ? `${path}/unsend` : path, {
        method: action === 'hide' ? 'DELETE' : 'POST',
        ...(action === 'reaction' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }) } : {}),
      });
      if (activeIdRef.current) {
        const detail = await apiRequest<ConversationDetail>(`/inbox/conversations/${encodeURIComponent(activeIdRef.current)}`);
        setActive(previous => previous?.id === detail.id ? detail : previous);
      }
      await loadInbox(); setActionMessageId(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update message.'); }
    finally { setActionBusy(false); }
  }

  async function saveEdit(message: Message) {
    if (!editDraft.trim() || actionBusy) return;
    setActionBusy(true); setError('');
    try {
      await apiRequest(`/inbox/messages/${encodeURIComponent(message.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: editDraft.trim() }),
      });
      setActive(previous => previous ? { ...previous, messages: previous.messages.map(m => m.id === message.id ? { ...m, body: editDraft.trim(), editedAt: new Date().toISOString() } : m) } : previous);
      setEditingId(null); await loadInbox();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not edit message.'); }
    finally { setActionBusy(false); }
  }

  async function searchConversation() {
    if (!active || !searchText.trim() || searchBusy) return;
    setSearchBusy(true); setError('');
    try {
      const results = await apiRequest<{id:string;body:string|null;createdAt:string;senderId:string}[]>(`/inbox/conversations/${encodeURIComponent(active.id)}/search?q=${encodeURIComponent(searchText.trim())}`);
      setSearchResults(results);
    } catch (err) { setError(err instanceof Error ? err.message : 'Search failed.'); }
    finally { setSearchBusy(false); }
  }

  async function jumpToResult(messageId: string) {
    if (!active) return;
    setError('');
    try {
      const detail = await apiRequest<ConversationDetail>(`/inbox/conversations/${encodeURIComponent(active.id)}?around=${encodeURIComponent(messageId)}`);
      aroundRef.current = messageId;
      setActive(detail); setHighlightId(messageId);
      window.setTimeout(() => document.getElementById(`inbox-message-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not find message.'); }
  }

  async function manageConversation(action: 'mute'|'delete'|'block') {
    if (!active || chatBusy) return;
    const id = active.id; const other = active.otherUser?.id;
    if (action === 'delete' && !window.confirm('Delete this conversation for you? Your friend will keep their messages. New messages will make the chat reappear.')) return;
    if (action === 'block' && !window.confirm(active.blockedByMe ? 'Unblock this user?' : 'Block this user? Neither of you will be able to send new messages.')) return;
    setChatBusy(true); setError('');
    try {
      if (action === 'mute') await apiRequest(`/inbox/conversations/${encodeURIComponent(id)}/mute`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ muted: !active.muted }) });
      else if (action === 'delete') await apiRequest(`/inbox/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });
      else {
        if (!other) throw new Error('User unavailable.');
        await apiRequest(`/inbox/blocks/${encodeURIComponent(other)}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ blocked: !active.blockedByMe }) });
      }
      if (action === 'delete') { setActive(null); aroundRef.current = null; setSearchOpen(false); }
      else { const detail = await apiRequest<ConversationDetail>(`/inbox/conversations/${encodeURIComponent(id)}`); setActive(detail); }
      await loadInbox(); setChatMenuOpen(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update conversation.'); }
    finally { setChatBusy(false); }
  }

  async function refresh() {
    setError('');
    try {
      await loadInbox();

      if (active) {
        const result = await apiRequest<ConversationDetail>(
          `/inbox/conversations/${encodeURIComponent(active.id)}`,
        );
        setActive(result);
        await markConversationRead(result.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh.');
    }
  }

  const currentUserId = (() => {
    try {
      const raw = sessionStorage.getItem('blink-user') || localStorage.getItem('blink-user');
      return raw ? (JSON.parse(raw) as { id?: string }).id : undefined;
    } catch { return undefined; }
  })();

  return (
    <main className="blink-inbox">
      <header className="inbox-topbar">
        <button type="button" onClick={onBack}>
          ← Back
        </button>
        <h1>Inbox</h1>
        <button type="button" onClick={onToggleTheme}>
          {theme === 'light' ? '☾' : '☀'}
        </button>
      </header>

      <div className="inbox-layout">
        <aside className="inbox-sidebar">
          <div className="inbox-section-heading">
            <h2>Messages</h2>
            <div className="inbox-heading-actions">
              <button type="button" className="inbox-new-message" onClick={() => { setGroupPicker(false); void showNewMessage(); }}>
                + New
              </button>
              <button type="button" onClick={() => { setGroupPicker(true); setGroupSelected([]); setGroupName(''); void showNewMessage(); }} title="Create group">+ Group</button>
              <button type="button" onClick={() => void refresh()}>Refresh</button>
            </div>
          </div>

          {newMessageOpen && (
            <div className="inbox-friend-picker">
              <div className="inbox-picker-heading">
                <strong>{groupPicker ? "New Group" : "New message"}</strong>
                <button type="button" onClick={() => { setNewMessageOpen(false); setGroupPicker(false); }} aria-label="Close friend search">×</button>
              </div>
              {groupPicker && <div className="inbox-group-name"><label htmlFor="inbox-group-name">Group name</label><input id="inbox-group-name" value={groupName} maxLength={80} onChange={event => setGroupName(event.target.value)} placeholder="Enter group name…" /></div>}
              <input
                type="search"
                placeholder="Search friends…"
                aria-label="Search friends"
                value={friendSearch}
                onChange={(event) => setFriendSearch(event.target.value)}
                autoFocus
              />
              {loadingFriends ? <p>Loading friends…</p> : friends.length === 0 ? (
                <p>No friends yet. Connect with someone first.</p>
              ) : (
                <div className="inbox-friend-results">
                  {friends.filter((friend) => friend.name.toLowerCase().includes(friendSearch.trim().toLowerCase())).map((friend) => (
                    <button type="button" key={friend.id} disabled={startingChat} onClick={() => groupPicker ? setGroupSelected(previous => previous.includes(friend.id) ? previous.filter(id => id !== friend.id) : [...previous, friend.id]) : void startConversation(friend.id)}>
                      <UserAvatar user={friend} />
                      <span>{friend.name}</span>
                      {groupPicker && <span className={`inbox-selection-mark ${groupSelected.includes(friend.id) ? "selected" : ""}`}>{groupSelected.includes(friend.id) ? "✓" : ""}</span>}
                    </button>
                  ))}
                  {!friends.some((friend) => friend.name.toLowerCase().includes(friendSearch.trim().toLowerCase())) && <p>No matching friends.</p>}
                </div>
              )}
              {groupPicker && <button type="button" className="inbox-group-create" disabled={groupBusy || !groupName.trim() || groupSelected.length < 2} onClick={() => void createGroup()}>{groupBusy ? "Creating…" : `Create group (${groupSelected.length} friends)`}</button>}
            </div>
          )}

          {loading && <p className="inbox-empty">Loading conversations...</p>}

          {!loading && conversations.length === 0 && (
            <div className="inbox-empty">
              <p>No conversations yet.</p>
              <p>
                Tap + New to find a friend and start chatting.
              </p>
            </div>
          )}

          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={`inbox-conversation ${
                active?.id === conversation.id ? 'is-active' : ''
              }`}
              onClick={() => void openConversation(conversation.id)}
              disabled={opening}
            >
              {conversation.isGroup ? <div className="inbox-avatar" aria-hidden="true">👥</div> : conversation.otherUser ? <UserAvatar user={conversation.otherUser} /> : <div className="inbox-avatar" aria-hidden="true">?</div>}

              <span className="inbox-conversation-content">
                <strong>{conversation.isGroup ? conversation.groupName || "Group" : conversation.otherUser?.name || "Unknown user"}</strong>
                <span className="inbox-preview">
                  {conversation.lastMessage?.unsentAt ? 'Message unsent' : conversation.lastMessage?.body ||
                    (conversation.lastMessage?.mediaKey
                      ? '📷 Moment'
                      : 'Start your conversation')}
                </span>
              </span>

              {(conversation.unreadCount ?? 0) > 0 && <span className="inbox-unread-badge" aria-label={`${conversation.unreadCount} unread messages`}>{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span>}
              <time>
                {formatTime(
                  conversation.lastMessage?.createdAt ||
                    conversation.createdAt,
                )}
              </time>
            </button>
          ))}
        </aside>

        <section className="inbox-chat">
          {error && (
            <p className="inbox-error" role="alert">
              {error}
            </p>
          )}

          {!active ? (
            <div className="inbox-placeholder">
              <span className="inbox-placeholder-icon">💬</span>
              <h2>Your Blink Inbox</h2>
              <p>Select a conversation to get started.</p>
            </div>
          ) : (
            <>
              <div className="inbox-chat-header">
                {active.otherUser && (
                  <>
                    <UserAvatar user={active.otherUser} />
                    <button
                      type="button"
                      className="inbox-name-button"
                      onClick={() =>
                        active.otherUser &&
                        onOpenProfile(active.otherUser.id)
                      }
                    >
                      {active.otherUser.name}
                    </button>
                  </>
                )}
                {active.isGroup && <><div className="inbox-avatar" aria-hidden="true">👥</div><button type="button" className="inbox-name-button" onClick={() => setGroupMembersOpen(v => !v)}>{active.groupName || "Group"} · {active.members?.length ?? 0} members</button></>}
                <div className="inbox-chat-controls">
                  <button type="button" aria-label="Search messages" title="Search messages" onClick={() => { setSearchOpen(v => !v); setChatMenuOpen(false); }}>⌕</button>
                  <button type="button" aria-label="Conversation options" aria-expanded={chatMenuOpen} onClick={() => setChatMenuOpen(v => !v)}>⋮</button>
                  {chatMenuOpen && <div className="inbox-chat-options">
                    <button type="button" onClick={() => { setSearchOpen(true); setChatMenuOpen(false); }}>⌕ Search messages</button>
                    <button type="button" disabled={chatBusy} onClick={() => void manageConversation('mute')}>{active.muted ? '🔔 Unmute conversation' : '🔕 Mute conversation'}</button>
                    {active.isGroup ? <button type="button" onClick={() => { setGroupMembersOpen(true); setChatMenuOpen(false); }}>👥 Group details</button> : <button type="button" disabled={chatBusy} onClick={() => void manageConversation('delete')}>🗑 Delete conversation for me</button>}
                    {!active.isGroup && <button type="button" disabled={chatBusy} onClick={() => void manageConversation('block')}>{active.blockedByMe ? 'Unblock user' : '⛔ Block user'}</button>}
                  </div>}
                </div>
                <button
                  type="button"
                  className="inbox-close-chat"
                  onClick={() => { setActive(null); aroundRef.current = null; setSearchOpen(false); setChatMenuOpen(false); }}
                >
                  Close
                </button>
              </div>

              {active.isGroup && groupMembersOpen && <div className="inbox-group-details"><div className="inbox-picker-heading"><strong>Group members</strong><button type="button" aria-label="Close group details" onClick={() => setGroupMembersOpen(false)}>×</button></div>{active.members?.map(member => <div className="inbox-group-member" key={member.user.id}><UserAvatar user={member.user}/><span>{member.user.name} · {member.role}</span>{member.user.id !== currentUserId && active.members?.some(m => m.user.id === currentUserId && m.role === "ADMIN") && <button type="button" disabled={groupBusy} onClick={() => void groupAction("remove", member.user.id)}>Remove</button>}</div>)}{active.members?.some(m => m.user.id === currentUserId && m.role === "ADMIN") && <><button type="button" disabled={groupBusy} onClick={() => void groupAction("rename")}>Rename group</button><button type="button" onClick={() => { setGroupAddOpen(v => !v); setGroupSelected([]); void apiRequest<PublicUser[]>("/inbox/friends").then(setFriends).catch(() => setError("Could not load friends.")); }}>Add members</button></>}{groupAddOpen && <div className="inbox-group-add">{friends.filter(friend => !active.members?.some(m => m.user.id === friend.id)).map(friend => <label key={friend.id} className="inbox-select-friend"><UserAvatar user={friend}/><span>{friend.name}</span><input type="checkbox" checked={groupSelected.includes(friend.id)} onChange={e => setGroupSelected(prev => e.target.checked ? [...prev, friend.id] : prev.filter(id => id !== friend.id))}/><span className={`inbox-selection-mark ${groupSelected.includes(friend.id) ? "selected" : ""}`}>{groupSelected.includes(friend.id) ? "✓" : ""}</span></label>)}<button type="button" disabled={groupBusy || !groupSelected.length} onClick={() => void groupAction("add")}>Add selected members</button></div>}<button type="button" disabled={groupBusy} onClick={() => void groupAction("leave")}>Leave group</button></div>}
              {searchOpen && <div className="inbox-search-panel">
                <div className="inbox-search-head"><strong>Search in conversation</strong><button type="button" onClick={() => { setSearchOpen(false); setSearchResults([]); aroundRef.current = null; }}>✕</button></div>
                <form onSubmit={event => { event.preventDefault(); void searchConversation(); }}>
                  <input aria-label="Search messages" placeholder="Search messages…" maxLength={100} value={searchText} onChange={event => setSearchText(event.target.value)} />
                  <button type="submit" disabled={searchBusy || !searchText.trim()}>{searchBusy ? 'Searching…' : 'Search'}</button>
                </form>
                <div className="inbox-search-results">{searchResults.map(result => <button type="button" key={result.id} onClick={() => void jumpToResult(result.id)}><span>{result.body}</span><small>{formatTime(result.createdAt)}</small></button>)}
                  {!searchBusy && searchText.trim() && searchResults.length === 0 && <small>Search to see matching messages (up to 50 results).</small>}
                </div>
              </div>}
              {(active.blockedByMe || active.blockedByOther) && <div className="inbox-block-banner">Messaging is unavailable because {active.blockedByMe ? 'you blocked this user' : 'this user blocked you'}. {active.blockedByMe && <button type="button" onClick={() => void manageConversation('block')}>Unblock</button>}</div>}
              {active.pinnedMessage && <button type="button" className="inbox-pinned-bar" onClick={() => jumpToMessage(active.pinnedMessage!.id)} title="Jump to pinned message">📌 <span><strong>Pinned message</strong><small>{active.pinnedMessage.body || (active.pinnedMessage.mediaType === 'audio' ? 'Voice message' : 'Photo or video')}</small></span> ›</button>}
              <div className="inbox-messages">
                {active.messages.length === 0 ? (
                  <div className="inbox-placeholder">
                    <h3>Say hello!</h3>
                    <p>No messages in this conversation yet.</p>
                  </div>
                ) : (
                  active.messages.map((message) => (
                    <div
                      className={`inbox-message ${message.senderId === currentUserId ? 'is-mine' : 'is-theirs'}`}
                      key={message.id}
                      id={`inbox-message-${message.id}`}
                      data-highlighted={highlightId === message.id ? 'true' : undefined}
                      onTouchStart={() => { longPressRef.current = window.setTimeout(() => setActionMessageId(message.id), 500); }}
                      onTouchEnd={() => { if (longPressRef.current !== null) window.clearTimeout(longPressRef.current); }}
                      onTouchMove={() => { if (longPressRef.current !== null) window.clearTimeout(longPressRef.current); }}
                    >
                      {message.forwarded && !message.unsentAt && <small className="inbox-forwarded">↪ Forwarded</small>}
                      {message.replyToId && !message.unsentAt && <button type="button" className="inbox-reply-quote" onClick={() => jumpToMessage(message.replyToId!)}><strong>↩ Reply</strong><span>{(() => { const source = active.messages.find(m => m.id === message.replyToId); return source ? previewMessage(source) : 'Original message'; })()}</span></button>}
                      {message.unsentAt ? <p className="inbox-unsent">Message unsent</p> : message.mediaKey ? (message.isPrivate ? (
                        <div className="inbox-private-message">
                          <span>🔒 Private Moment · View once</span>
                          {message.senderId === currentUserId ? <span>Sent privately</span> : message.privateOpenedAt || openedPrivateRef.current.has(message.id) ? <span>Opened · Unavailable</span> : (
                            <button type="button" disabled={openingPrivate !== null} onClick={() => void openPrivateMoment(message)}>
                              {openingPrivate === message.id ? 'Opening…' : 'View Private Moment'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="inbox-media-message">
                          {mediaUrls[message.id] ? (message.mediaType === 'audio' ?
                             <VoicePlayer src={mediaUrls[message.id]} /> : message.mediaType === 'video' ?
                            <video src={mediaUrls[message.id]} controls playsInline /> :
                            <img src={mediaUrls[message.id]} alt="Shared photo" />
                          ) : <span className="inbox-media-loading" role="status">Loading {message.mediaType === 'video' ? 'video' : 'photo'}…</span>}
                        </div>
                      )) : editingId === message.id ? (
                        <div className="inbox-edit-box">
                          <input aria-label="Edit message" value={editDraft} maxLength={5000} onChange={event => setEditDraft(event.target.value)} />
                          <button type="button" disabled={actionBusy || !editDraft.trim()} onClick={() => void saveEdit(message)}>Save</button>
                          <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      ) : <p>{renderMessageText(message.body)}{message.editedAt ? <small className="inbox-edited"> (edited)</small> : null}</p>}
                      {!message.unsentAt && <div className="inbox-action-area">
                        <button type="button" className="inbox-action-toggle" aria-label="Message actions" aria-expanded={actionMessageId === message.id} onClick={() => setActionMessageId(previous => previous === message.id ? null : message.id)}>···</button>
                        {actionMessageId === message.id && <div className="inbox-action-menu">
                          <div className="inbox-reaction-options">{['❤️','😂','👍','😮','😢'].map(emoji => <button type="button" key={emoji} disabled={actionBusy} onClick={() => void messageAction(message,'reaction',message.reactions?.some(r => r.userId === currentUserId && r.emoji === emoji) ? null : emoji)}>{emoji}</button>)}</div>
                          <button type="button" onClick={() => { setReplyTo(message); setActionMessageId(null); }}>↩ Reply</button>
                          {!message.isPrivate && <button type="button" onClick={() => void startForward(message)}>↪ Forward</button>}
                          {!message.isPrivate && <button type="button" disabled={actionBusy} onClick={() => void pinMessage(active.pinnedMessage?.id === message.id ? null : message.id)}>{active.pinnedMessage?.id === message.id ? 'Unpin message' : '📌 Pin message'}</button>}
                          {message.body && <button type="button" onClick={() => { void navigator.clipboard.writeText(message.body ?? '').catch(() => setError('Copy failed.')); setActionMessageId(null); }}>Copy text</button>}
                          {message.senderId === currentUserId && !message.mediaKey && <button type="button" onClick={() => void messageAction(message,'edit')}>Edit message</button>}
                          <button type="button" disabled={actionBusy} onClick={() => void messageAction(message,'hide')}>Delete for me</button>
                          {message.senderId === currentUserId && <button type="button" disabled={actionBusy} onClick={() => void messageAction(message,'unsend')}>Unsend for everyone</button>}
                        </div>}
                      </div>}
                      {Boolean(message.reactions?.length) && !message.unsentAt && <div className="inbox-reaction-display">{message.reactions?.map(r => <span key={r.userId} title="Reaction">{r.emoji}</span>)}</div>}
                      <time>{formatTime(message.createdAt)}</time>
                      {message.senderId === currentUserId && <span className="inbox-read-status">{active.otherLastReadAt && new Date(active.otherLastReadAt).getTime() >= new Date(message.createdAt).getTime() ? 'Seen' : 'Sent'}</span>}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" hidden aria-label="Choose photo or video" onChange={event => { const file = event.target.files?.[0]; if (file) chooseMedia(file); }} />
              {selectedMedia && <div className="inbox-attachment-preview">
                <div className="inbox-attachment-heading"><strong>{selectedMedia.name}</strong><button type="button" className="inbox-icon-button" aria-label="Remove attachment" title="Remove attachment" onClick={clearSelectedMedia}>✕</button></div>
                {selectedPreview && (selectedMedia.type.startsWith('video/') ? <video src={selectedPreview} controls playsInline /> : <img src={selectedPreview} alt="Selected attachment preview" />)}
                <div className="inbox-attachment-actions">
                  <button type="button" className="inbox-icon-button inbox-private-send" title="Send as Private Moment" aria-label="Send as Private Moment" disabled={sending || Boolean(active.blockedByMe || active.blockedByOther)} onClick={() => void sendSelectedMedia(true)}>🔒<SendIcon /></button>
                  <button type="button" className="inbox-icon-button inbox-primary-send" title="Send normally" aria-label="Send normally" disabled={sending || Boolean(active.blockedByMe || active.blockedByOther)} onClick={() => void sendSelectedMedia(false)}><SendIcon /></button>
                </div>
                <div className="inbox-attachment-labels"><span>Private Moment</span><span>Send normally</span></div>
              </div>}
              {(recording || voiceFile) && <div className="inbox-voice-recorder">
                {recording ? <><strong>🔴 Recording… {durationLabel(recordSeconds)}</strong><button type="button" onClick={() => finishRecording(true)}>Discard</button><button type="button" onClick={() => finishRecording()}>■ Finish</button></> : <><strong>Voice preview</strong>{voicePreview && <audio src={voicePreview} controls />}<button type="button" onClick={discardVoice}>Discard</button><button type="button" disabled={sending} onClick={() => void sendVoice()}>Send voice <SendIcon /></button></>}
              </div>}
              {replyTo && <div className="inbox-reply-composer"><span><strong>↩ Replying to message</strong><small>{previewMessage(replyTo)}</small></span><button type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)}>✕</button></div>}
              <form className="inbox-composer" onSubmit={(event) => void sendMessage(event)}>
                <button type="button" className="inbox-icon-button" aria-label="Attach photo or video" title="Attach photo or video" disabled={sending || recording || Boolean(active.blockedByMe || active.blockedByOther)} onClick={() => fileInputRef.current?.click()}><PaperclipIcon /></button>
                <input type="text" aria-label="Write a message" placeholder="Write a message…" value={draft} onChange={(event) => { setDraft(event.target.value); if (active) setDrafts((previous) => ({ ...previous, [active.id]: event.target.value })); }} maxLength={5000} disabled={sending || Boolean(active.blockedByMe || active.blockedByOther)} />
                <button type="button" className="inbox-icon-button" aria-label={recording ? 'Finish recording' : 'Record voice message'} title={recording ? 'Finish recording' : 'Record voice message'} disabled={sending || Boolean(active.blockedByMe || active.blockedByOther) || Boolean(voiceFile)} onClick={() => recording ? finishRecording() : void startRecording()}><MicIcon /></button>
                <button type="submit" className="inbox-icon-button inbox-primary-send" aria-label="Send message" title="Send message" disabled={!draft.trim() || sending || Boolean(active.blockedByMe || active.blockedByOther)}><SendIcon /></button>
              </form>
            </>
          )}
        </section>
      </div>
      {forwarding && <div className="inbox-forward-overlay" role="dialog" aria-modal="true" aria-label="Forward message"><div className="inbox-forward-dialog"><div className="inbox-forward-heading"><strong>↪ Forward message</strong><button type="button" onClick={() => setForwarding(null)} aria-label="Close forwarding">✕</button></div><p className="inbox-forward-preview">{previewMessage(forwarding)}</p><strong>Send to</strong><div className="inbox-forward-friends">{forwardFriends.map(friend => <label key={friend.id} className="inbox-select-friend"><UserAvatar user={friend}/><span>{friend.name}</span><input type="checkbox" aria-label={`Select ${friend.name}`} checked={forwardSelected.includes(friend.id)} onChange={event => setForwardSelected(previous => event.target.checked ? [...previous, friend.id] : previous.filter(id => id !== friend.id))} /><span className={`inbox-selection-mark ${forwardSelected.includes(friend.id) ? 'selected' : ''}`}>{forwardSelected.includes(friend.id) ? '✓' : ''}</span></label>)}{forwardFriends.length === 0 && <p>No friends available.</p>}</div><button type="button" className="inbox-forward-submit" disabled={forwardBusy || !forwardSelected.length} onClick={() => void submitForward()}>{forwardBusy ? 'Forwarding…' : `↪ Forward to ${forwardSelected.length}`}</button></div></div>}
      {privateViewer && <div className="inbox-private-overlay" role="dialog" aria-modal="true" aria-label="Private Moment" onContextMenu={event => event.preventDefault()}>
        <div className="inbox-private-overlay-heading">🔒 Private Moment · View once</div>
        {privateViewer.type === 'video' ? <video src={privateViewer.url} autoPlay playsInline controls={false} disablePictureInPicture onEnded={closePrivateViewer} onPause={event => { if (!event.currentTarget.ended) void event.currentTarget.play().catch(() => closePrivateViewer()); }} onError={closePrivateViewer} /> : <img src={privateViewer.url} alt="Private Moment" draggable={false} />}
        <p>{privateViewer.type === 'image' ? 'Closes automatically after 5 seconds' : 'Plays once without pause controls'}</p>
        <button type="button" onClick={closePrivateViewer}>Close now</button>
      </div>}
    </main>
  );
}
