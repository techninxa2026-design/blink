
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

import './App.css';

import SecretsPage from './SecretsPage';
import HeartPage from './HeartPage';
import ExchangePage from './exchnagePage';
import ExchangePostPage from './ExchangePostPage';
import ProfilePage from './ProfilePage';
import FriendsPage from './FriendsPage';
import PublicProfilePage from './PublicProfilePage';
import InboxPage from './InboxPage';
import CheckinsPage from './CheckinsPage';
import IrlPage from './IrlPage';
import BusinessMatchPage from './BusinessMatchPage';
import MomentActions from './MomentActions';
import {
  NotesRow,
  useActiveCheckins,
} from './CheckinPreview';

const API = (
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

type Theme = 'light' | 'dark';
type MediaKind = 'photo' | 'video';

type User = {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  avatarKey?: string | null;
};

type AuthResponse = {
  accessToken?: string;
  user?: User;
  message?: string | string[];
};

type ApiMoment = {
  id: string;
  senderId: string;
  mediaUrl: string;
  mediaType: MediaKind;
  caption: string | null;
  createdAt: string;
  sender?: {
    id: string;
    name: string;
    avatarKey?: string | null;
  };
};

type MomentViewer = {
  viewerId: string;
  name: string;
  viewedAt: string;
  avatarKey?: string | null;
};

type Route =
  | 'home'
  | 'profile'
  | 'public-profile'
  | 'connections'
  | 'checkins'
  | 'irl'
  | 'secrets'
  | 'hearts'
  | 'business-match'
  | 'settings'
  | 'inbox'
  | 'exchange'
  | 'exchange-post'
  | 'login'
  | 'signup';

const NAV = [
  { label: 'Home', icon: '⌂', path: '/home' },
  { label: 'Connections', icon: '♧', path: '/connections' },
  { label: 'Capture', icon: '+', path: '' },
  { label: 'Checkins', icon: '⌖', path: '/checkins' },
  { label: 'IRL', icon: '▣', path: '/irl' },
] as const;

function token(): string | null {
  return (
    localStorage.getItem('blink-access-token') ||
    sessionStorage.getItem('blink-access-token')
  );
}

function storedUser(): User | null {
  try {
    const raw =
      sessionStorage.getItem('blink-user') ||
      localStorage.getItem('blink-user');

    return raw
      ? (JSON.parse(raw) as User)
      : null;
  } catch {
    return null;
  }
}

function asset(key?: string | null): string {
  if (!key) return '';

  return /^https?:\/\//i.test(key)
    ? key
    : `${API}${
        key.startsWith('/')
          ? key
          : `/uploads/${encodeURIComponent(key)}`
      }`;
}

function messageOf(
  data: { message?: string | string[] } | null,
  fallback: string,
): string {
  if (Array.isArray(data?.message)) {
    return data.message.join(', ');
  }

  return data?.message || fallback;
}

function routeFromPath(path: string): Route {
  if (/^\/profile\/user\/[^/]+$/.test(path)) {
    return 'public-profile';
  }

  if (/^\/exchange\/[^/]+$/.test(path)) {
    return 'exchange-post';
  }

  const map: Record<string, Route> = {
    '/home': 'home',
    '/profile': 'profile',
    '/connections': 'connections',
    '/checkins': 'checkins',
    '/irl': 'irl',
    '/secrets': 'secrets',
    '/hearts': 'hearts',
    '/business-match': 'business-match',
    '/settings': 'settings',
    '/inbox': 'inbox',
    '/exchange': 'exchange',
    '/login': 'login',
    '/': 'signup',
  };

  return map[path] || 'signup';
}

const MOMENT_OVERLAY_CSS = `
/* This file affects ONLY the full-screen moment viewer.
   All Home, Secrets, Hearts, Check-ins and Exchange styling stays unchanged. */
.blink-moment-classic {
  position: fixed;
  inset: 0;
  z-index: 60;
  overflow: hidden;
  background: #090909;
  color: #fff;
  isolation: isolate;
}

.blink-moment-classic > .full-moment-media {
  position: absolute !important;
  inset: 0 !important;
  display: block;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  object-fit: contain !important;
  background: #090909;
  z-index: 0;
}

.blink-moment-classic > .full-moment-shade {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(180deg, #0008, transparent 21%, transparent 65%, #0009);
  pointer-events: none;
}

.blink-moment-classic > .full-moment-header {
  position: absolute;
  z-index: 8;
  top: max(20px, env(safe-area-inset-top));
  left: clamp(15px, 3vw, 54px);
  right: clamp(15px, 3vw, 54px);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.blink-moment-classic .moment-author-profile-button {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  width: auto;
  height: auto;
  margin-left: 0;
  border-radius: 0;
  flex-shrink: 1;
  color: #fff;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.blink-moment-classic .moment-author-profile-button .moment-avatar {
  display: grid;
  place-items: center;
  flex: 0 0 58px;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  border: 3px solid #fff;
  background: #fb6c00;
  color: #fff;
  font-weight: 800;
  font-size: 24px;
}

.blink-moment-classic .moment-author-profile-button .moment-author {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.blink-moment-classic .moment-author-profile-button .moment-author strong {
  color: #fff;
  font-weight: 800;
  font-size: 18px;
}

.blink-moment-classic .moment-author-profile-button .moment-author span {
  color: #e6e6e6;
  font-size: 13px;
}

.blink-moment-classic .moment-close {
  flex: 0 0 56px;
  display: grid;
  place-items: center;
  margin-left: auto;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1px solid #ffffff70;
  background: #06060670;
  color: #fff;
  font-size: 27px;
  cursor: pointer;
}

.blink-moment-classic .full-moment-caption {
  position: absolute;
  z-index: 5;
  left: 50%;
  right: auto;
  bottom: 24%;
  width: min(550px, calc(100% - 190px));
  margin: 0;
  transform: translateX(-50%);
  color: #fff;
  font-size: clamp(15px, 2vw, 20px);
  font-weight: 700;
  text-align: center;
  text-shadow: 0 2px 8px #000b;
  pointer-events: none;
}

.blink-moment-classic .moment-viewers-button {
  position: absolute;
  z-index: 8;
  bottom: 15%;
  left: 50%;
  transform: translateX(-50%);
}

.blink-moment-classic .full-moment-controls {
  position: absolute;
  z-index: 8;
  left: 50%;
  right: auto;
  bottom: max(65px, 8%);
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  gap: 18px;
  white-space: nowrap;
}

.blink-moment-classic .moment-viewers-panel {
  z-index: 30;
}

/* Keep the interaction buttons visible, especially on wide landscape photos. */
.blink-moment-classic .bma-root {
  position: fixed;
  inset: 0;
  z-index: 20;
  pointer-events: none;
}

.blink-moment-classic .bma-rail {
  z-index: 4;
  right: clamp(13px, 2vw, 30px);
  bottom: max(95px, env(safe-area-inset-bottom));
}

/* Right-side drawer must remain above video controls and the viewer. */
.blink-moment-classic .bma-backdrop {
  z-index: 40;
}

.blink-moment-classic .bma-panel {
  z-index: 41;
}

.blink-moment-classic .bma-message {
  z-index: 30;
}

@media (max-width: 700px) {
  .blink-moment-classic .moment-author-profile-button .moment-avatar {
    width: 42px;
    height: 42px;
    flex-basis: 42px;
    font-size: 17px;
  }
  .blink-moment-classic .moment-author-profile-button .moment-author strong {
    font-size: 13px;
  }
  .blink-moment-classic .moment-author-profile-button .moment-author span {
    font-size: 10px;
  }
  .blink-moment-classic .moment-close {
    width: 42px;
    height: 42px;
    flex-basis: 42px;
  }
  .blink-moment-classic .full-moment-caption {
    width: calc(100% - 130px);
    bottom: 30%;
    font-size: 15px;
  }
  .blink-moment-classic .moment-viewers-button {
    bottom: 20%;
  }
  .blink-moment-classic .full-moment-controls {
    bottom: 13%;
    gap: 8px;
  }
  .blink-moment-classic .full-moment-controls button {
    padding: 8px 10px;
    font-size: 11px;
  }
  .blink-moment-classic .bma-rail {
    right: 8px;
    bottom: 15%;
  }
  .blink-moment-classic .bma-panel { z-index: 41; }
}

`;

export default function App() {
  // ROUTING

  const [route, setRoute] = useState<Route>(() =>
    routeFromPath(window.location.pathname),
  );

  const [exchangePostId, setExchangePostId] =
    useState<string | null>(() =>
      window.location.pathname.match(
        /^\/exchange\/([^/]+)$/,
      )?.[1] ?? null,
    );

  const [publicProfileId, setPublicProfileId] =
    useState<string | null>(() =>
      window.location.pathname.match(
        /^\/profile\/user\/([^/]+)$/,
      )?.[1] ?? null,
    );

  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem('blink-theme') === 'dark'
      ? 'dark'
      : 'light',
  );

  const [user, setUser] =
    useState<User | null>(storedUser);

  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedNav, setSelectedNav] =
    useState('Home');

  // MOMENTS

  const [moments, setMoments] =
    useState<ApiMoment[]>([]);

  const [momentsLoading, setMomentsLoading] =
    useState(false);

  const [momentsError, setMomentsError] =
    useState('');

  const [visibleCount, setVisibleCount] =
    useState(35);

  const [selectedMomentId, setSelectedMomentId] =
    useState<string | null>(null);

  // VIEWERS

  const [viewersOpen, setViewersOpen] =
    useState(false);

  const [viewers, setViewers] =
    useState<MomentViewer[]>([]);

  const [viewersLoading, setViewersLoading] =
    useState(false);

  const [viewersError, setViewersError] =
    useState('');

  // BLINK POINTS

  const [bpBalance, setBpBalance] =
    useState<number | null>(null);

  // CHECK-INS

  const {
    items: checkins,
    loading: checkinsLoading,
  } = useActiveCheckins(route === 'home');

  // AUTHENTICATION

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] =
    useState(false);

  const [rememberMe, setRememberMe] =
    useState(true);

  const [authLoading, setAuthLoading] =
    useState(false);

  const [authError, setAuthError] =
    useState('');

  const [authSuccess, setAuthSuccess] =
    useState('');

  // CAMERA / CAPTURE

  const [captureOpen, setCaptureOpen] =
    useState(false);

  const [captureMode, setCaptureMode] =
    useState<MediaKind>('photo');

  const [stream, setStream] =
    useState<MediaStream | null>(null);

  const [capturedUrl, setCapturedUrl] =
    useState<string | null>(null);

  const [capturedKind, setCapturedKind] =
    useState<MediaKind | null>(null);

  const [galleryFile, setGalleryFile] =
    useState<File | null>(null);

  const [caption, setCaption] = useState('');
  const [recording, setRecording] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [uploading, setUploading] = useState(false);

  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);

  const cameraStreamRef =
    useRef<MediaStream | null>(null);

  const cameraRequestRef = useRef(0);

  const recorderRef =
    useRef<MediaRecorder | null>(null);

  const chunksRef = useRef<Blob[]>([]);

  const capturedUrlRef =
    useRef<string | null>(null);

  const cameraOpenRef = useRef(false);

  const touchStart = useRef<{
    x: number;
    y: number;
  } | null>(null);

  // ACTIVE MOMENT

  const selectedIndex = moments.findIndex(
    (moment) => moment.id === selectedMomentId,
  );

  const currentIndex =
    selectedIndex >= 0 ? selectedIndex : 0;

  const activeMoment = selectedMomentId
    ? moments.find(
        (moment) => moment.id === selectedMomentId,
      )
    : null;

  // THEME

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('blink-theme', theme);
  }, [theme]);

  // BROWSER HISTORY

  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname;

      setRoute(routeFromPath(path));

      setExchangePostId(
        path.match(/^\/exchange\/([^/]+)$/)?.[1] ??
          null,
      );

      setPublicProfileId(
        path.match(
          /^\/profile\/user\/([^/]+)$/,
        )?.[1] ?? null,
      );

      setMenuOpen(false);
      setSelectedMomentId(null);
      setCaptureOpen(false);
    };

    window.addEventListener('popstate', onPop);

    return () =>
      window.removeEventListener('popstate', onPop);
  }, []);

  function goTo(path: string) {
    window.history.pushState({}, '', path);

    setRoute(routeFromPath(path));

    setExchangePostId(
      path.match(/^\/exchange\/([^/]+)$/)?.[1] ??
        null,
    );

    setPublicProfileId(
      path.match(
        /^\/profile\/user\/([^/]+)$/,
      )?.[1] ?? null,
    );

    setMenuOpen(false);
    setSelectedMomentId(null);
    setCaptureOpen(false);

    setSelectedNav(
      path === '/home'
        ? 'Home'
        : path === '/connections'
          ? 'Connections'
          : path === '/checkins'
            ? 'Checkins'
            : path === '/irl'
              ? 'IRL'
              : 'Home',
    );

    window.scrollTo(0, 0);
  }

  function openPublicProfile(id: string) {
    goTo(
      `/profile/user/${encodeURIComponent(id)}`,
    );
  }

  function openExchangePost(id: string) {
    goTo(`/exchange/${encodeURIComponent(id)}`);
  }

  function toggleTheme() {
    setTheme((current) =>
      current === 'light' ? 'dark' : 'light',
    );
  }

  function logout() {
    ['blink-access-token', 'blink-user'].forEach(
      (key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      },
    );

    setUser(null);
    setMoments([]);
    setBpBalance(null);

    closeCapture();
    goTo('/login');
  }

  // LOAD MOMENTS

  async function loadMoments() {
    const access = token();

    if (!access) {
      setMoments([]);
      return;
    }

    setMomentsLoading(true);
    setMomentsError('');

    try {
      const res = await fetch(`${API}/moments`, {
        headers: {
          Authorization: `Bearer ${access}`,
        },
        cache: 'no-store',
      });

      const data: unknown = await res.json();

      if (!res.ok || !Array.isArray(data)) {
        throw new Error(
          `Moments couldn't load (${res.status})`,
        );
      }

      const realMoments = data as ApiMoment[];
      setMoments(realMoments);

      const sharedId = new URLSearchParams(window.location.search).get('moment');
      if (sharedId && realMoments.some(item => item.id === sharedId)) {
        setSelectedMomentId(sharedId);
        window.history.replaceState({}, '', '/home');
      }
    } catch (err) {
      setMomentsError(
        err instanceof Error
          ? err.message
          : 'Unable to load moments.',
      );
    } finally {
      setMomentsLoading(false);
    }
  }

  // LOAD REAL BP BALANCE

  async function loadWallet() {
    const access = token();
    if (!access) return;

    try {
      const res = await fetch(
        `${API}/secrets/points`,
        {
          headers: {
            Authorization: `Bearer ${access}`,
          },
          cache: 'no-store',
        },
      );

      if (!res.ok) return;

      const data = (await res.json()) as {
        points: number | string;
      };

      if (Number.isFinite(Number(data.points))) {
        setBpBalance(Number(data.points));
      }
    } catch {
      // Retain last known balance.
    }
  }

  // LOAD PROFILE

  async function loadProfile() {
    const access = token();
    if (!access) return;

    try {
      const res = await fetch(`${API}/profile/me`, {
        headers: {
          Authorization: `Bearer ${access}`,
        },
        cache: 'no-store',
      });

      if (!res.ok) return;

      const data = (await res.json()) as User;

      setUser(data);

      sessionStorage.setItem(
        'blink-user',
        JSON.stringify(data),
      );
    } catch {
      // Retain the stored profile.
    }
  }

  useEffect(() => {
    if (route === 'home' && token()) {
      void loadMoments();
      void loadWallet();
      void loadProfile();
    }
  }, [route]);

  // MOMENT VIEW TRACKING

  async function recordView(id: string) {
    const access = token();
    if (!access) return;

    try {
      await fetch(
        `${API}/moments/${encodeURIComponent(id)}/view`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access}`,
          },
        },
      );
    } catch {
      // Viewing should remain possible even if
      // the view-tracking request fails.
    }
  }

  async function openMoment(id: string) {
    const moment = moments.find(
      (item) => item.id === id,
    );

    if (!moment) return;

    setSelectedMomentId(id);
    setViewersOpen(false);

    if (moment.senderId !== user?.id) {
      await recordView(id);
    }
  }

  function changeMoment(delta: number) {
    if (moments.length === 0) return;

    const next = moments[
      (currentIndex + delta + moments.length) %
        moments.length
    ];

    void openMoment(next.id);
  }

  // MOMENT VIEWERS

  async function loadViewers(id: string) {
    const access = token();
    if (!access) return;

    setViewersOpen(true);
    setViewersLoading(true);
    setViewersError('');
    setViewers([]);

    try {
      const res = await fetch(
        `${API}/moments/${encodeURIComponent(id)}/views`,
        {
          headers: {
            Authorization: `Bearer ${access}`,
          },
        },
      );

      if (!res.ok) {
        throw new Error(
          `Unable to load viewers (${res.status})`,
        );
      }

      setViewers(
        (await res.json()) as MomentViewer[],
      );
    } catch (err) {
      setViewersError(
        err instanceof Error
          ? err.message
          : 'Viewers unavailable.',
      );
    } finally {
      setViewersLoading(false);
    }
  }

  // STOP CAMERA

  function stopCamera() {
    cameraRequestRef.current += 1;

    cameraStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());

    cameraStreamRef.current = null;
    setStream(null);
  }

  // START CAMERA

  async function startCamera() {
    const requestId = ++cameraRequestRef.current;

    setCameraError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Camera access requires HTTPS or localhost.',
      );
      return;
    }

    try {
      const video: MediaTrackConstraints = {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };

      let next: MediaStream;

      try {
        next =
          await navigator.mediaDevices.getUserMedia({
            video,
            audio: true,
          });
      } catch {
        next =
          await navigator.mediaDevices.getUserMedia({
            video,
            audio: false,
          });
      }

      if (
        requestId !== cameraRequestRef.current ||
        !cameraOpenRef.current
      ) {
        next.getTracks().forEach((track) =>
          track.stop(),
        );
        return;
      }

      cameraStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());

      cameraStreamRef.current = next;
      setStream(next);
    } catch {
      if (
        requestId === cameraRequestRef.current
      ) {
        setCameraError(
          'Camera unavailable. Allow permission or choose Gallery.',
        );
      }
    }
  }

  useEffect(() => {
    cameraOpenRef.current = captureOpen;

    if (
      route !== 'home' ||
      !captureOpen ||
      capturedUrl
    ) {
      stopCamera();
      return;
    }

    void startCamera();

    return () => {
      stopCamera();
    };
  }, [route, captureOpen, capturedUrl]);

  useEffect(() => {
    if (
      !videoRef.current ||
      !stream ||
      capturedUrl
    ) {
      return;
    }

    videoRef.current.srcObject = stream;

    void videoRef.current.play().catch(() => {});
  }, [stream, captureOpen, capturedUrl]);

  useEffect(() => {
    return () => {
      cameraStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());

      if (
        capturedUrlRef.current?.startsWith('blob:')
      ) {
        URL.revokeObjectURL(
          capturedUrlRef.current,
        );
      }
    };
  }, []);

  // PREVIEW CAPTURED MEDIA

  function setPreview(url: string | null) {
    if (
      capturedUrlRef.current?.startsWith('blob:')
    ) {
      URL.revokeObjectURL(
        capturedUrlRef.current,
      );
    }

    capturedUrlRef.current = url;
    setCapturedUrl(url);
  }

  function closeCapture() {
    cameraOpenRef.current = false;

    const rec = recorderRef.current;

    if (rec && rec.state !== 'inactive') {
      rec.onstop = null;
      rec.stop();
    }

    recorderRef.current = null;

    stopCamera();
    setPreview(null);
    setCaptureOpen(false);
    setCapturedKind(null);
    setGalleryFile(null);
    setCaption('');
    setCameraError('');
    setRecording(false);
    setCaptureMode('photo');
    setSelectedNav('Home');
  }

  function discardCapture() {
    setPreview(null);
    setGalleryFile(null);
    setCapturedKind(null);
    setCameraError('');
  }

  function openCapture() {
    setMenuOpen(false);
    setSelectedMomentId(null);
    setCaptureMode('photo');
    setGalleryFile(null);
    setCapturedKind(null);
    setPreview(null);
    setCaption('');
    setCameraError('');
    setSelectedNav('Capture');
    setCaptureOpen(true);
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (
      !video ||
      !canvas ||
      video.videoWidth === 0
    ) {
      setCameraError('Camera is not ready.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setCameraError(
        'Unable to capture image.',
      );
      return;
    }

    ctx.drawImage(video, 0, 0);

    setPreview(
      canvas.toDataURL('image/jpeg', 0.9),
    );

    setCapturedKind('photo');
    stopCamera();
  }

  // VIDEO RECORDING

  function startRecording() {
    if (
      !stream ||
      !('MediaRecorder' in window)
    ) {
      setCameraError(
        'Video recording is not supported.',
      );
      return;
    }

    try {
      const mime = [
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );

      const rec = mime
        ? new MediaRecorder(stream, {
            mimeType: mime,
          })
        : new MediaRecorder(stream);

      chunksRef.current = [];

      rec.ondataavailable = (event) => {
        if (event.data.size) {
          chunksRef.current.push(event.data);
        }
      };

      rec.onstop = () => {
        const type =
          rec.mimeType.split(';')[0] ||
          chunksRef.current[0]?.type.split(';')[0] ||
          'video/webm';

        const blob = new Blob(
          chunksRef.current,
          { type },
        );

        if (blob.size) {
          setPreview(
            URL.createObjectURL(blob),
          );

          setCapturedKind('video');
        } else {
          setCameraError(
            'No video recorded. Please try again.',
          );
        }

        setRecording(false);
        stopCamera();
      };

      recorderRef.current = rec;

      rec.start(250);
      setRecording(true);
    } catch {
      setCameraError(
        'Could not start recording.',
      );
    }
  }

  function captureAction() {
    if (captureMode === 'photo') {
      capturePhoto();
    } else if (recording) {
      if (
        recorderRef.current?.state === 'recording'
      ) {
        recorderRef.current.stop();
      }

      setRecording(false);
    } else {
      startRecording();
    }
  }

  // CHOOSE GALLERY FILE

  function selectGallery(
    file: File | undefined,
  ) {
    if (!file) return;

    const kind: MediaKind | null =
      /^image\/(jpeg|png|webp)$/.test(file.type)
        ? 'photo'
        : /^video\/(webm|mp4|quicktime)$/.test(
            file.type,
          )
          ? 'video'
          : null;

    if (!kind) {
      setCameraError(
        'Please choose JPG, PNG, WebP, MP4, WebM or MOV.',
      );
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setCameraError(
        'Maximum upload size is 50 MB.',
      );
      return;
    }

    stopCamera();

    setGalleryFile(file);
    setCapturedKind(kind);
    setPreview(
      URL.createObjectURL(file),
    );
    setCameraError('');
  }

  // REAL MOMENT UPLOAD

  async function publishMoment() {
    if (
      !capturedUrl ||
      !capturedKind ||
      uploading
    ) {
      return;
    }

    const access = token();

    if (!access) {
      setCameraError(
        'Please sign in again.',
      );
      return;
    }

    setUploading(true);
    setCameraError('');

    try {
      let file = galleryFile;

      if (!file) {
        const blob = await (
          await fetch(capturedUrl)
        ).blob();

        if (!blob.size) {
          throw new Error(
            'Captured media is empty.',
          );
        }

        const mime =
          blob.type.split(';')[0] ||
          (capturedKind === 'photo'
            ? 'image/jpeg'
            : 'video/webm');

        const ext =
          mime === 'image/png'
            ? 'png'
            : mime === 'image/webp'
              ? 'webp'
              : mime === 'video/mp4'
                ? 'mp4'
                : mime === 'video/quicktime'
                  ? 'mov'
                  : mime === 'video/webm'
                    ? 'webm'
                    : 'jpg';

        file = new File(
          [blob],
          `moment-${Date.now()}.${ext}`,
          { type: mime },
        );
      }

      if (
        file.size >
        50 * 1024 * 1024
      ) {
        throw new Error(
          'Maximum upload size is 50 MB.',
        );
      }

      const form = new FormData();

      form.append('file', file);
      form.append(
        'caption',
        caption.trim(),
      );

      const res = await fetch(
        `${API}/moments/upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access}`,
          },
          body: form,
        },
      );

      const result = (await res
        .json()
        .catch(() => null)) as {
          earnedBp?: number;
          message?: string | string[];
        } | null;

      if (!res.ok) {
        throw new Error(
          messageOf(
            result,
            `Upload failed (${res.status})`,
          ),
        );
      }

      closeCapture();

      await Promise.all([
        loadMoments(),
        loadWallet(),
      ]);

      setNotice(
        result?.earnedBp === 0.5
          ? 'Moment published! +0.5 BP earned 🧡'
          : 'Your moment was published.',
      );
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? err.message
          : 'Unable to publish moment.',
      );
    } finally {
      setUploading(false);
    }
  }

  // LOGIN / REGISTRATION

  async function submitAuth(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setAuthError('');
    setAuthSuccess('');

    const isLogin = route === 'login';

    if (
      password.length < 8 ||
      password.length > 72
    ) {
      setAuthError(
        'Password must be 8–72 characters.',
      );
      return;
    }

    if (
      !isLogin &&
      (name.trim().length < 2 ||
        name.trim().length > 80)
    ) {
      setAuthError(
        'Name must be 2–80 characters.',
      );
      return;
    }

    if (
      !isLogin &&
      !/^\+?[0-9]{10,15}$/.test(phone.trim())
    ) {
      setAuthError(
        'Enter a valid phone number.',
      );
      return;
    }

    setAuthLoading(true);

    try {
      const res = await fetch(
        `${API}${
          isLogin
            ? '/auth/login'
            : '/auth/register'
        }`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(
            isLogin
              ? {
                  email: email.trim(),
                  password,
                }
              : {
                  name: name.trim(),
                  email: email.trim(),
                  phoneNumber: phone.trim(),
                  password,
                },
          ),
        },
      );

      const data = (await res
        .json()
        .catch(() => null)) as AuthResponse | null;

      if (!res.ok) {
        throw new Error(
          messageOf(
            data,
            'Unable to authenticate.',
          ),
        );
      }

      if (isLogin) {
        if (!data?.accessToken) {
          throw new Error(
            'Login response has no access token.',
          );
        }

        const storage = rememberMe
          ? localStorage
          : sessionStorage;

        const otherStorage = rememberMe
          ? sessionStorage
          : localStorage;

        storage.setItem(
          'blink-access-token',
          data.accessToken,
        );

        otherStorage.removeItem(
          'blink-access-token',
        );

        if (data.user) {
          sessionStorage.setItem(
            'blink-user',
            JSON.stringify(data.user),
          );

          setUser(data.user);
        }

        goTo('/home');
      } else {
        setAuthSuccess(
          'Account created! You can now sign in.',
        );

        setName('');
        setEmail('');
        setPhone('');
        setPassword('');
      }
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Unable to connect to Blink.',
      );
    } finally {
      setAuthLoading(false);
    }
  }

  // PROTECTED ROUTES

  const protectedScreen = (
    content: ReactNode,
    title: string,
  ) =>
    token() ? (
      content
    ) : (
      <main className="blink-guard">
        <h1>Sign in to use {title}</h1>

        <button
          onClick={() => goTo('/login')}
        >
          Sign in →
        </button>
      </main>
    );

  // PUBLIC PROFILE

  if (route === 'public-profile') {
    return protectedScreen(
      publicProfileId ? (
        <PublicProfilePage
          userId={decodeURIComponent(
            publicProfileId,
          )}
          onBack={() =>
            goTo('/connections')
          }
          onMyProfile={() =>
            goTo('/profile')
          }
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      ) : (
        <main className="blink-guard">
          Profile not found.
        </main>
      ),
      'profiles',
    );
  }

  // BLINK SECRETS

  if (route === 'secrets') {
    return protectedScreen(
      <SecretsPage
        theme={theme}
        onToggleTheme={toggleTheme}
        onBack={() => goTo('/home')}
        onHearts={() => goTo('/hearts')}
      />,
      'Blink Secrets',
    );
  }

  // BLINK HEARTS

  if (route === 'hearts') {
    return protectedScreen(
      <HeartPage
        theme={theme}
        onToggleTheme={toggleTheme}
        onBack={() => goTo('/home')}
        onSecrets={() => goTo('/secrets')}
        onOpenProfile={openPublicProfile}
      />,
      'Blink Hearts',
    );
  }

  // INBOX

  if (route === 'inbox') {
    return protectedScreen(
      <InboxPage
        onBack={() => goTo('/home')}
        onOpenProfile={openPublicProfile}
        theme={theme}
        onToggleTheme={toggleTheme}
      />,
      'Inbox',
    );
  }

  // SETTINGS

  if (route === 'settings') {
    return protectedScreen(
      <BusinessMatchPage
        initialView="settings"
        onBack={() => goTo('/home')}
        theme={theme}
        onToggleTheme={toggleTheme}
      />,
      'settings',
    );
  }

  // BUSINESS MATCH

  if (route === 'business-match') {
    return protectedScreen(
      <BusinessMatchPage
        onBack={() => goTo('/home')}
        theme={theme}
        onToggleTheme={toggleTheme}
      />,
      'Business Match',
    );
  }

  // IRL

  if (route === 'irl') {
    return protectedScreen(
      <IrlPage
        onBack={() => goTo('/home')}
        theme={theme}
        onToggleTheme={toggleTheme}
      />,
      'IRL',
    );
  }

  // CHECK-INS

  if (route === 'checkins') {
    return protectedScreen(
      <CheckinsPage
        onBack={() => goTo('/home')}
        onOpenProfile={openPublicProfile}
        theme={theme}
        onToggleTheme={toggleTheme}
      />,
      'Check-Ins',
    );
  }

  // CONNECTIONS

  if (route === 'connections') {
    return protectedScreen(
      <FriendsPage
        onOpenProfile={openPublicProfile}
        onBack={() => goTo('/home')}
        theme={theme}
        onToggleTheme={toggleTheme}
      />,
      'Connections',
    );
  }

  // MY PROFILE

  if (route === 'profile') {
    return protectedScreen(
      <ProfilePage
        onBack={() => goTo('/home')}
        theme={theme}
        onToggleTheme={toggleTheme}
      />,
      'Profile',
    );
  }

  // EXCHANGE POST DETAILS

  if (route === 'exchange-post') {
    return protectedScreen(
      exchangePostId ? (
        <ExchangePostPage
          postId={decodeURIComponent(
            exchangePostId,
          )}
          onBack={() => goTo('/exchange')}
          onOpenProfile={openPublicProfile}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      ) : (
        <main className="blink-guard">
          Exchange post not found.
        </main>
      ),
      'Blink Exchange',
    );
  }

  // BLINK EXCHANGE

  if (route === 'exchange') {
    return protectedScreen(
      <ExchangePage
        onBack={() => goTo('/home')}
        onOpenPost={openExchangePost}
        onOpenProfile={openPublicProfile}
        theme={theme}
        onToggleTheme={toggleTheme}
      />,
      'Blink Exchange',
    );
  }

  // HOMEPAGE

  if (route === 'home') {
    if (!token()) {
      return protectedScreen(
        <></>,
        'Blink',
      );
    }

    return (
      <main className="blink-home">
        {/* HEADER */}

        <header className="home-header">
          <button
            type="button"
            className="icon-button menu-button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() =>
              setMenuOpen((open) => !open)
            }
          >
            <span />
            <span />
            <span />
          </button>

          <a
            className="home-brand"
            href="/home"
            onClick={(event) => {
              event.preventDefault();
              goTo('/home');
            }}
          >
            <img
              src="/blink-logo.png"
              alt="Blink"
            />
          </a>

          <div className="home-header-right">
            {bpBalance !== null && (
              <span className="home-bp-pill">
                🟠 {bpBalance.toFixed(1)} BP
              </span>
            )}

            <button
              type="button"
              className="home-profile-button"
              aria-label="My profile"
              onClick={() =>
                goTo('/profile')
              }
            >
              {user?.avatarKey ? (
                <img
                  src={asset(user.avatarKey)}
                  alt=""
                />
              ) : (
                <span>
                  {(user?.name || 'B')
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* SIDEBAR */}

        {menuOpen && (
          <>
            <button
              type="button"
              className="menu-backdrop"
              aria-label="Close menu"
              onClick={() =>
                setMenuOpen(false)
              }
            />

            <aside
              className="home-drawer"
              aria-label="Blink menu"
            >
              <div className="drawer-heading">
                <img
                  src="/blink-logo.png"
                  alt="Blink"
                />

                <button
                  type="button"
                  className="drawer-close"
                  onClick={() =>
                    setMenuOpen(false)
                  }
                >
                  ×
                </button>
              </div>

              <p className="drawer-label">
                EXPLORE BLINK
              </p>

              <button
                onClick={() =>
                  goTo('/profile')
                }
              >
                👤 <span>My profile</span>
              </button>

              <button
                onClick={() =>
                  goTo('/exchange')
                }
              >
                💱 <span>Blink Exchange</span>
              </button>

              <button
                onClick={() =>
                  goTo('/secrets')
                }
              >
                🤫 <span>Blink Secrets</span>
              </button>

              <button
                onClick={() =>
                  goTo('/hearts')
                }
              >
                💖 <span>Blink Hearts</span>
              </button>

              <button
                onClick={() =>
                  goTo('/business-match')
                }
              >
                🤝 <span>Business Match</span>
              </button>

              <p className="drawer-label drawer-section-label">
                YOUR SPACE
              </p>

              <button
                onClick={() =>
                  goTo('/settings')
                }
              >
                ⚙️ <span>Settings</span>
              </button>

              <button onClick={toggleTheme}>
                🌓
                <span>
                  {theme === 'light'
                    ? 'Dark mode'
                    : 'Light mode'}
                </span>
              </button>

              <div className="drawer-spacer" />

              <button
                className="drawer-logout"
                onClick={logout}
              >
                ↪ <span>Log out</span>
              </button>

              <p className="drawer-footnote">
                Your people. Your moments. Your Blink.
              </p>
            </aside>
          </>
        )}

        {/* COMPACT CHECK-INS */}

        <section
          className="blink-ci-preview blink-ci-slim"
          aria-label="Friends' Check-Ins"
        >
          <div className="blink-ci-preview-head">
            <div className="blink-ci-title">
              <h2>🧡 Check-Ins</h2>
              <p>What's happening now?</p>
            </div>

            <button
              type="button"
              className="blink-ci-write"
              onClick={() =>
                goTo('/checkins')
              }
            >
              + Write note
            </button>

            <button
              type="button"
              className="blink-ci-seeall"
              onClick={() =>
                goTo('/checkins')
              }
            >
              <strong>
                {checkins.length} active
              </strong>
              <span> · See all →</span>
            </button>
          </div>

          {checkinsLoading ? (
            <p className="blink-ci-preview-empty">
              Loading Check-Ins…
            </p>
          ) : checkins.length > 0 ? (
            <div className="blink-ci-notes-preview">
              <NotesRow
                items={checkins.slice(0, 8)}
                ownId={user?.id}
                showEmpty={false}
                onOpenProfile={(id) =>
                  id === user?.id
                    ? goTo('/profile')
                    : openPublicProfile(id)
                }
              />
            </div>
          ) : null}
        </section>

        {/* MOMENTS GALLERY */}

        <section
          className="home-feed"
          aria-label="Moments feed"
        >
          <div className="feed-heading">
            <div>
              <p className="feed-eyebrow">
                YOUR PEOPLE, YOUR MOMENTS
              </p>

              <h1>
                Moments{' '}
                <span className="feed-spark">
                  ✦
                </span>
              </h1>
            </div>

            <div className="feed-heading-actions">
              <span className="feed-count">
                {moments.length} moments
              </span>

              <button
                type="button"
                className="feed-create-button"
                onClick={openCapture}
              >
                + Create
              </button>
            </div>
          </div>

          {momentsLoading &&
          moments.length === 0 ? (
            <div className="blink-moments-state">
              <span>🧡</span>
              <h2>Loading moments…</h2>
            </div>
          ) : momentsError &&
            moments.length === 0 ? (
            <div className="blink-moments-state">
              <span>⚠️</span>
              <h2>Couldn't load moments</h2>
              <p>{momentsError}</p>

              <button
                onClick={() =>
                  void loadMoments()
                }
              >
                Try again
              </button>
            </div>
          ) : moments.length === 0 ? (
            <div className="blink-moments-state">
              <span>📷</span>
              <h2>No moments yet</h2>

              <p>
                Be the first to share a real
                photo or video on Blink.
              </p>

              <button onClick={openCapture}>
                + Share a moment
              </button>

              <small>
                Earn 0.5 BP per published Moment
              </small>
            </div>
          ) : (
            <>
              <div className="moment-grid">
                {moments
                  .slice(0, visibleCount)
                  .map((moment) => (
                    <button
                      key={moment.id}
                      type="button"
                      className="moment-grid-card"
                      onClick={() =>
                        void openMoment(moment.id)
                      }
                      aria-label={`Open ${
                        moment.sender?.name ||
                        'Blink user'
                      }'s moment`}
                    >
                      {moment.mediaType ===
                      'video' ? (
                        <video
                          className="moment-tile-image"
                          src={asset(
                            moment.mediaUrl,
                          )}
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img
                          className="moment-tile-image"
                          src={asset(
                            moment.mediaUrl,
                          )}
                          alt=""
                          loading="lazy"
                        />
                      )}

                      <span className="grid-card-shade" />

                      <span className="grid-card-indicator">
                        {moment.mediaType ===
                        'video'
                          ? '▶'
                          : '▧'}
                      </span>

                      <span className="grid-card-caption">
                        {moment.sender?.name ||
                          'Blink user'}
                      </span>
                    </button>
                  ))}
              </div>

              {visibleCount < moments.length && (
                <button
                  className="load-more-moments"
                  onClick={() =>
                    setVisibleCount(
                      (count) => count + 35,
                    )
                  }
                >
                  Load more moments
                </button>
              )}

              <p className="swipe-hint">
                Select a moment to view it
              </p>
            </>
          )}
        </section>

        {/* BOTTOM NAVIGATION */}

        <nav
          className="home-bottom-nav"
          aria-label="Main navigation"
        >
          {NAV.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`bottom-nav-item ${
                selectedNav === item.label
                  ? 'selected'
                  : ''
              } ${
                item.label === 'Capture'
                  ? 'capture-nav'
                  : ''
              }`}
              aria-label={item.label}
              onClick={() =>
                item.label === 'Capture'
                  ? openCapture()
                  : goTo(item.path)
              }
            >
              <span className="nav-symbol">
                {item.icon}
              </span>

              <span className="nav-label">
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        {/* FLOATING INBOX */}

        {!captureOpen && !activeMoment && (
          <button
            type="button"
            className="home-floating-inbox"
            onClick={() => goTo('/inbox')}
            aria-label="Open Inbox"
            title="Inbox"
          >
            💬
          </button>
        )}

        {/* NOTIFICATIONS */}

        {notice && (
          <div
            className="home-toast"
            role="status"
          >
            {notice}

            <button
              type="button"
              onClick={() => setNotice('')}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* ORIGINAL MOMENT VIEWER + REAL COMMENTS, REACTIONS, BP AND SHARE */}
        {activeMoment && (
          <div
            className="full-moment-view blink-moment-classic"
            role="dialog"
            aria-modal="true"
            aria-label="Blink Moment viewer"
          >
            <style>{MOMENT_OVERLAY_CSS}</style>
            {activeMoment.mediaType === 'video' ? (
              <video
                key={activeMoment.id}
                className="full-moment-media"
                src={asset(activeMoment.mediaUrl)}
                controls
                autoPlay
                playsInline
                loop
              />
            ) : (
              <img
                className="full-moment-media"
                src={asset(activeMoment.mediaUrl)}
                alt={`${activeMoment.sender?.name || 'Blink user'}'s Moment`}
              />
            )}

            <div className="full-moment-shade" aria-hidden="true" />

            <div className="full-moment-header">
              <button
                type="button"
                className="moment-author-profile-button"
                onClick={() => {
                  if (activeMoment.senderId === user?.id) goTo('/profile');
                  else openPublicProfile(activeMoment.senderId);
                }}
                aria-label={`Open ${activeMoment.sender?.name || 'Blink user'}'s profile`}
              >
                <span className="moment-avatar">
                  {(activeMoment.sender?.name || 'B').slice(0, 1).toUpperCase()}
                </span>
                <span className="moment-author">
                  <strong>{activeMoment.sender?.name || 'Blink user'}</strong>
                  <span>{new Date(activeMoment.createdAt).toLocaleString()}</span>
                </span>
              </button>
              <button
                type="button"
                className="moment-close"
                onClick={() => {
                  setSelectedMomentId(null);
                  setViewersOpen(false);
                }}
                aria-label="Close Moment"
              >
                ×
              </button>
            </div>

            {activeMoment.caption && (
              <p className="full-moment-caption">{activeMoment.caption}</p>
            )}

            {activeMoment.senderId === user?.id && (
              <button
                type="button"
                className="moment-viewers-button"
                onClick={() => void loadViewers(activeMoment.id)}
              >
                Viewers
              </button>
            )}

            <div className="full-moment-controls">
              <button type="button" onClick={() => changeMoment(-1)}>
                ← Previous
              </button>
              <button type="button" onClick={() => changeMoment(1)}>
                Next →
              </button>
            </div>

            {viewersOpen && (
              <div className="moment-viewers-panel">
                <div className="moment-viewers-heading">
                  <strong>People who viewed this Moment</strong>
                  <button
                    type="button"
                    onClick={() => setViewersOpen(false)}
                    aria-label="Close viewers"
                  >
                    ×
                  </button>
                </div>
                {viewersLoading ? (
                  <p>Loading viewers…</p>
                ) : viewersError ? (
                  <p role="alert">{viewersError}</p>
                ) : viewers.length === 0 ? (
                  <p>No views yet.</p>
                ) : (
                  viewers.map((viewer) => (
                    <div className="moment-viewer-row" key={viewer.viewerId}>
                      <span className="moment-viewer-avatar">
                        {viewer.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span>{viewer.name}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Mount the EXISTING server-backed interaction component.
                Its CSS (.bma-*) creates the reaction rail and comments drawer. */}
            <MomentActions
              key={activeMoment.id}
              momentId={activeMoment.id}
              caption={activeMoment.caption ?? ''}
              currentUserId={user?.id}
              momentOwnerId={activeMoment.senderId}
              onBpTransferred={() => void loadWallet()}
              onOpenProfile={(id) => {
                if (id === user?.id) goTo('/profile');
                else openPublicProfile(id);
              }}
            />
          </div>
        )}

        {/* CAPTURE MODAL */}

        {captureOpen && (
          <div
            className="capture-screen"
            role="dialog"
            aria-modal="true"
            aria-label="Create a Moment"
          >
            <div className="capture-topbar">
              <button
                type="button"
                className="capture-close"
                onClick={closeCapture}
                aria-label="Close camera"
              >
                ×
              </button>

              <div className="capture-title">
                <h2>
                  {capturedUrl
                    ? 'Preview your Moment'
                    : 'Create a Moment'}
                </h2>

                <p>
                  Share something worth remembering
                </p>
              </div>

              <span className="capture-mode-label">
                {capturedKind?.toUpperCase() ||
                  captureMode.toUpperCase()}
              </span>
            </div>

            <div className="capture-workspace">
              <div
                className="capture-stage"
                onTouchStart={(event) => {
                  touchStart.current = {
                    x:
                      event.touches[0]
                        ?.clientX ?? 0,
                    y:
                      event.touches[0]
                        ?.clientY ?? 0,
                  };
                }}
                onTouchEnd={(event) => {
                  const start =
                    touchStart.current;

                  const end =
                    event.changedTouches[0];

                  if (
                    start &&
                    end &&
                    !capturedUrl &&
                    !recording &&
                    Math.abs(
                      end.clientX -
                        start.x,
                    ) > 55 &&
                    Math.abs(
                      end.clientX -
                        start.x,
                    ) >
                      Math.abs(
                        end.clientY -
                          start.y,
                      )
                  ) {
                    setCaptureMode(
                      end.clientX <
                        start.x
                        ? 'video'
                        : 'photo',
                    );
                  }

                  touchStart.current =
                    null;
                }}
              >
                {capturedUrl ? (
                  capturedKind ===
                  'photo' ? (
                    <img
                      className="capture-preview"
                      src={capturedUrl}
                      alt="Captured photo"
                    />
                  ) : (
                    <video
                      className="capture-preview"
                      key={capturedUrl}
                      src={capturedUrl}
                      controls
                      playsInline
                      autoPlay
                      loop
                    />
                  )
                ) : (
                  <video
                    ref={videoRef}
                    className="capture-live-video"
                    autoPlay
                    muted
                    playsInline
                  />
                )}

                <canvas
                  ref={canvasRef}
                  hidden
                />

                {!capturedUrl &&
                  !stream &&
                  !cameraError && (
                    <p className="capture-status">
                      Starting camera…
                    </p>
                  )}

                {cameraError && (
                  <div
                    className="capture-error"
                    role="alert"
                  >
                    <p>{cameraError}</p>

                    {!capturedUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          void startCamera()
                        }
                      >
                        Retry camera
                      </button>
                    )}
                  </div>
                )}

                {recording && (
                  <span className="recording-indicator">
                    ● Recording
                  </span>
                )}

                <span className="capture-corner tl" />
                <span className="capture-corner tr" />
                <span className="capture-corner bl" />
                <span className="capture-corner br" />
              </div>

              {capturedUrl ? (
                <div className="capture-review">
                  <label htmlFor="moment-caption">
                    Caption (optional)
                  </label>

                  <textarea
                    id="moment-caption"
                    maxLength={500}
                    rows={2}
                    value={caption}
                    placeholder="What's happening in this moment?"
                    onChange={(event) =>
                      setCaption(
                        event.target.value,
                      )
                    }
                  />

                  <div className="capture-review-actions">
                    <button
                      type="button"
                      className="capture-discard"
                      disabled={uploading}
                      onClick={discardCapture}
                    >
                      ↻ Retake
                    </button>

                    <button
                      type="button"
                      className="capture-post"
                      disabled={uploading}
                      onClick={() =>
                        void publishMoment()
                      }
                    >
                      {uploading
                        ? 'Publishing…'
                        : 'Publish Moment →'}
                    </button>
                  </div>

                  <p className="capture-reward-note">
                    ✦ Earn +0.5 BP when a Moment
                    is published successfully
                  </p>
                </div>
              ) : (
                <div className="capture-controls">
                  <div className="capture-mode-switch">
                    <button
                      className={
                        captureMode ===
                        'photo'
                          ? 'active'
                          : ''
                      }
                      disabled={recording}
                      onClick={() =>
                        setCaptureMode(
                          'photo',
                        )
                      }
                    >
                      📷 Photo
                    </button>

                    <button
                      className={
                        captureMode ===
                        'video'
                          ? 'active'
                          : ''
                      }
                      disabled={recording}
                      onClick={() =>
                        setCaptureMode(
                          'video',
                        )
                      }
                    >
                      🎥 Video
                    </button>
                  </div>

                  <div className="capture-action-row">
                    <label className="capture-gallery-button">
                      🖼️ Gallery

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                        disabled={recording}
                        hidden
                        onChange={(event) => {
                          selectGallery(
                            event.target.files?.[0],
                          );

                          event.target.value =
                            '';
                        }}
                      />
                    </label>

                    <button
                      className={`capture-shutter ${
                        captureMode ===
                        'video'
                          ? 'video-mode'
                          : ''
                      } ${
                        recording
                          ? 'recording'
                          : ''
                      }`}
                      type="button"
                      disabled={
                        !stream &&
                        !recording
                      }
                      onClick={
                        captureAction
                      }
                      aria-label={
                        recording
                          ? 'Stop recording'
                          : captureMode ===
                              'photo'
                            ? 'Take photo'
                            : 'Start recording'
                      }
                    >
                      <span />
                    </button>

                    <span className="capture-side-placeholder" />
                  </div>

                  <p className="capture-instruction">
                    {captureMode ===
                    'photo'
                      ? 'Tap to take a photo'
                      : recording
                        ? 'Tap to finish recording'
                        : 'Tap to record a video'}
                  </p>

                  <p className="capture-swipe-hint">
                    Swipe to switch modes
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    );
  }

  // LOGIN AND REGISTRATION PAGE

  const isLogin = route === 'login';

  return (
    <main
      className={`auth-page ${
        isLogin
          ? 'login-page'
          : 'signup-page'
      }`}
    >
      <header className="site-header">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            goTo('/');
          }}
        >
          <img
            className="brand-logo"
            src="/blink-logo.png"
            alt="Blink"
          />
        </a>

        <button
          className="theme-toggle"
          type="button"
          onClick={toggleTheme}
        >
          {theme === 'light'
            ? '☾ Dark mode'
            : '☀ Light mode'}
        </button>
      </header>

      <div className="auth-layout">
        <section className="auth-hero">
          <p className="eyebrow">
            <span className="eyebrow-dot" />
            YOUR MOMENTS. YOUR PEOPLE.
          </p>

          <h1>
            {isLogin ? (
              <>
                Welcome back
                <br />
                to <span>Blink.</span>
              </>
            ) : (
              <>
                Life moves
                <br />
                fast. <span>Blink it.</span>
              </>
            )}
          </h1>

          <p className="hero-description">
            {isLogin
              ? 'Log in to continue sharing moments and reconnecting with your people.'
              : 'A little moment can mean everything. Connect with your people and share the moments worth remembering.'}
          </p>

          <div
            className="hero-art"
            aria-hidden="true"
          >
            <div className="art-orbit" />

            <div className="moment-card moment-card-back">
              <div className="moment-sun" />
              <div className="moment-mountains" />
            </div>

            <div className="moment-card moment-card-front">
              <div className="moment-scene">
                <span className="person person-one" />
                <span className="person person-two" />
                <span className="person person-three" />
                <span className="person person-four" />
              </div>

              <span className="moment-caption">
                Good vibes, together
              </span>
            </div>

            <span className="art-spark spark-one">
              ✦
            </span>

            <span className="art-spark spark-two">
              ✳
            </span>
          </div>

          <p className="hero-footer">
            <span className="eyebrow-dot" />
            Be present. Stay connected.
          </p>
        </section>

        <section className="auth-panel">
          <div className="auth-card">
            <p className="form-eyebrow">
              {isLogin
                ? 'LOG IN TO BLINK'
                : "LET'S GET STARTED"}
            </p>

            <h2>
              {isLogin
                ? 'Welcome back'
                : 'Create your account'}
            </h2>

            <p className="form-description">
              {isLogin
                ? 'Enter your details to sign in.'
                : 'Your next favorite moment starts here.'}
            </p>

            <form
              onSubmit={submitAuth}
              noValidate
            >
              {!isLogin && (
                <div className="form-field">
                  <label htmlFor="name">
                    Full name
                  </label>

                  <input
                    id="name"
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target.value,
                      )
                    }
                    placeholder="What should we call you?"
                    autoComplete="name"
                    maxLength={80}
                    required
                  />
                </div>
              )}

              <div className="form-field">
                <label htmlFor="email">
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value,
                    )
                  }
                  required
                />
              </div>

              {!isLogin && (
                <div className="form-field">
                  <label htmlFor="phone">
                    Phone number
                  </label>

                  <input
                    id="phone"
                    autoComplete="tel"
                    type="tel"
                    placeholder="+8801XXXXXXXXX"
                    value={phone}
                    onChange={(event) =>
                      setPhone(
                        event.target.value,
                      )
                    }
                    required
                  />
                </div>
              )}

              <div className="form-field">
                <label htmlFor="password">
                  Password
                </label>

                <div className="password-wrap">
                  <input
                    id="password"
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    autoComplete={
                      isLogin
                        ? 'current-password'
                        : 'new-password'
                    }
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value,
                      )
                    }
                    minLength={8}
                    maxLength={72}
                    required
                  />

                  <button
                    className="show-password"
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (value) => !value,
                      )
                    }
                  >
                    {showPassword
                      ? 'Hide'
                      : 'Show'}
                  </button>
                </div>
              </div>

              {isLogin && (
                <div className="login-options">
                  <label className="remember-option">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) =>
                        setRememberMe(
                          event.target.checked,
                        )
                      }
                    />
                    Remember me
                  </label>

                  <button
                    className="text-link"
                    type="button"
                    onClick={() =>
                      setAuthError(
                        'Password reset is not available yet.',
                      )
                    }
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {authError && (
                <p
                  className="form-message form-error"
                  role="alert"
                >
                  {authError}
                </p>
              )}

              {authSuccess && (
                <p
                  className="form-message form-success"
                  role="status"
                >
                  {authSuccess}
                </p>
              )}

              <button
                className="submit-button"
                type="submit"
                disabled={authLoading}
              >
                {authLoading
                  ? 'Please wait…'
                  : isLogin
                    ? 'Sign in →'
                    : 'Create account →'}
              </button>

              <div className="form-divider">
                <span />
                <span>OR</span>
                <span />
              </div>

              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  goTo(
                    isLogin
                      ? '/'
                      : '/login',
                  )
                }
              >
                {isLogin
                  ? 'Create a new account'
                  : 'I already have an account'}
              </button>
            </form>

            <p className="legal-copy">
              By continuing, you agree to our
              <br />
              <a href="/terms">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy">
                Privacy Policy
              </a>.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
