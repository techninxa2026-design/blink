
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import './App.css';
import ProfilePage from './ProfilePage';
import FriendsPage from './FriendsPage';
import PublicProfilePage from './PublicProfilePage';
import InboxPage from './InboxPage';
import CheckinsPage from './CheckinsPage';
import { NotesRow, useActiveCheckins } from './CheckinPreview';

const API_URL = 'http://localhost:3000';

type User = {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  avatarKey?: string | null;
  createdAt?: string;
};

type AuthResponse = {
  message?: string | string[];
  accessToken?: string;
  user?: User;
};

type Moment = {
  id: string;
  name: string;
  initials: string;
  time: string;
  caption: string;
  image: string;
  kind: 'photo' | 'video';
  duration?: string;
  apiId?: string;
  isMine?: boolean;
  senderId?: string;
};
type ApiMoment = {
  id: string;
  senderId: string;
  mediaUrl: string;
  mediaType: 'photo' | 'video';
  caption: string | null;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatarKey?: string | null;
  };
};


type MomentViewer = {
  viewerId: string;
  name: string;
  avatarKey?: string | null;
  viewedAt: string;
};





const demoMoments: Moment[] = [
  {
    id: '1',
    name: 'Sarah Wilson',
    initials: 'SW',
    time: '2h ago',
    caption: 'Chasing better sunsets 🧡',
    image:
      'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1100&q=85',
    kind: 'photo',
  },
  {
    id: '2',
    name: 'James Carter',
    initials: 'JC',
    time: '4h ago',
    caption: 'Good friends. Great vibes. 🔥',
    image:
      'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1100&q=85',
    kind: 'video',
    duration: '0:18',
  },
  {
    id: '3',
    name: 'Maya Ahmed',
    initials: 'MA',
    time: '5h ago',
    caption: 'A little escape from the everyday 🌿',
    image:
      'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1100&q=85',
    kind: 'photo',
  },
];

type NavItem = {
  label: string;
  symbol: string;
};

const navItems: NavItem[] = [
  { label: 'Home', symbol: '⌂' },
  { label: 'Connections', symbol: '♧' },
  { label: 'Capture', symbol: '+' },
  { label: 'Checkins', symbol: '⌖' },
  { label: 'IRL', symbol: '▣' },
];

function readStoredUser(): User | null {
  try {
    const value =
      sessionStorage.getItem('blink-user') ||
      localStorage.getItem('blink-user');

    return value ? (JSON.parse(value) as User) : null;
  } catch {
    return null;
  }
}

function readStoredToken(): string | null {
  try {
    return (
      localStorage.getItem('blink-access-token') ||
      sessionStorage.getItem('blink-access-token')
    );
  } catch {
    return null;
  }
}

export default function App() {
  const [route, setRoute] = useState(() => {
    const path = window.location.pathname;
    if (/^\/profile\/user\/[^/]+$/.test(path)) return 'public-profile';
    if (path === '/profile') return 'profile';
    if (path === '/connections') return 'connections';
    if (path === '/checkins') return 'checkins';
    if (path === '/inbox') return 'inbox';
    if (path === '/home') return 'home';
    if (path === '/login') return 'login';
    return 'signup';
  });

  const { items: homeCheckins, loading: homeCheckinsLoading } = useActiveCheckins(route === 'home');

  const [publicProfileId, setPublicProfileId] = useState<string | null>(() => {
  const match = window.location.pathname.match(/^\/profile\/user\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
});


  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('blink-theme') === 'dark'
        ? 'dark'
        : 'light';
    } catch {
      return 'light';
    }
  });

  const [, setUser] = useState<User | null>(readStoredUser);
  
const [momentViewers, setMomentViewers] = useState<MomentViewer[]>([]);
const [showMomentViewers, setShowMomentViewers] = useState(false);
const [loadingMomentViewers, setLoadingMomentViewers] = useState(false);
const [momentViewersError, setMomentViewersError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [menuOpen, setMenuOpen] = useState(false);
  
  
const [momentIndex, setMomentIndex] = useState(0);
const [selectedNav, setSelectedNav] = useState('Home');
const [fullMoment, setFullMoment] = useState(false);
const [selectedMomentId, setSelectedMomentId] = useState<string | null>(null);
const [visibleMomentCount, setVisibleMomentCount] = useState(35);
const [notice, setNotice] = useState('');
const [apiMoments, setApiMoments] = useState<ApiMoment[]>([]);
const [, setIsLoadingMoments] = useState(false);
const [, setMomentsError] = useState('');

const [captureMode, setCaptureMode] = useState<'photo' | 'video'>('photo');
const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
const [capturedMedia, setCapturedMedia] = useState<string | null>(null);
const [capturedType, setCapturedType] = useState<'photo' | 'video' | null>(null);
const [isRecording, setIsRecording] = useState(false);
const [cameraError, setCameraError] = useState('');
const [isPostingDemo, setIsPostingDemo] = useState(false);

const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
const mediaRecorderRef = useRef<MediaRecorder | null>(null);
const recordedChunksRef = useRef<Blob[]>([]);


  // Demo-only flag until moment upload is connected to the backend.
  const [hasPostedMoment, setHasPostedMoment] = useState(() => {
    try {
      return localStorage.getItem('blink-demo-first-moment') === 'true';
    } catch {
      return false;
    }
  });

  const touchStart = useRef<{ x: number; y: number } | null>(null);
 const allMoments: Moment[] = [
  ...apiMoments.map((moment) => ({
    id: `api-${moment.id}`,
    apiId: moment.id,
    senderId: moment.senderId,
    isMine: moment.senderId === readStoredUser()?.id,
    name: moment.sender?.name ?? 'Blink user',
    initials: (moment.sender?.name ?? 'B')
      .split(' ')
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    time: new Date(moment.createdAt).toLocaleString(),
    caption: moment.caption ?? '',
    image: moment.mediaUrl.startsWith('http')
      ? moment.mediaUrl
      : `${API_URL}${moment.mediaUrl}`,
    kind: moment.mediaType,
  })),
  ...Array.from({ length: 105 }, (_, index) => {
    const original = demoMoments[index % demoMoments.length];

    return {
      ...original,
      id: `demo-${index + 1}`,
      time: index < 3 ? original.time : `${index + 1}h ago`,
    };
  }),
];

const activeMoment =
  allMoments.find((moment) => moment.id === selectedMomentId) ??
  allMoments[momentIndex];

  useEffect(() => {
  document.documentElement.dataset.theme = theme;

  try {
    localStorage.setItem('blink-theme', theme);
  } catch {
    // Theme remains available for this session.
  }
}, [theme]);

useEffect(() => {
  if (selectedNav !== 'Capture' || capturedMedia) {
    return;
  }

  let cancelled = false;
  let activeStream: MediaStream | null = null;

  async function openCamera() {
    setCameraError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Camera access requires localhost or a secure HTTPS connection.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: true,
      });

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      activeStream = stream;
      setCameraStream(stream);
    } catch {
      if (!cancelled) {
        setCameraError(
          'Camera permission was denied or no camera is available.'
        );
      }
    }
  }




  void openCamera();

  return () => {
    cancelled = true;

    activeStream?.getTracks().forEach((track) => track.stop());
  };
}, [selectedNav, capturedMedia]);


useEffect(() => {
  const video = cameraVideoRef.current;

  if (!video || !cameraStream || capturedMedia) {
    return;
  }

  if (video.srcObject !== cameraStream) {
    video.srcObject = cameraStream;
  }

  void video.play().catch(() => {
    // The browser may delay playback until the video is ready.
  });
}, [cameraStream, capturedMedia, selectedNav]);



async function loadApiMoments() {
  const token = readStoredToken();

  if (!token) {
    setApiMoments([]);
    return;
  }

  setIsLoadingMoments(true);
  setMomentsError('');

  try {
    const response = await fetch(`${API_URL}/moments`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Could not load moments (${response.status})`);
    }

    const data: ApiMoment[] = await response.json();
    setApiMoments(data);
  } catch (error) {
    setMomentsError(
      error instanceof Error
        ? error.message
        : 'Could not load moments.',
    );
  } finally {
    setIsLoadingMoments(false);
  }
}



async function recordMomentView(momentId: string) {
  const token = readStoredToken();

  if (!token) return;

  try {
    const response = await fetch(
      `${API_URL}/moments/${encodeURIComponent(momentId)}/view`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      console.error(
        'Could not record moment view:',
        response.status,
      );
    }
  } catch (error) {
    console.error('Could not record moment view:', error);
  }
}


async function openMomentViewers(momentId: string) {
  setShowMomentViewers(true);
  setMomentViewers([]);
  setMomentViewersError('');
  setLoadingMomentViewers(true);

  try {
    const viewers = await loadMomentViews(momentId);
    setMomentViewers(viewers);
  } catch (error) {
    setMomentViewersError(
      error instanceof Error
        ? error.message
        : 'Could not load moment viewers.',
    );
  } finally {
    setLoadingMomentViewers(false);
  }
}





async function loadMomentViews(momentId: string): Promise<MomentViewer[]> {
  const token = readStoredToken();

  if (!token) return [];

  const response = await fetch(
    `${API_URL}/moments/${encodeURIComponent(momentId)}/views`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Could not load viewers (${response.status})`);
  }

  return response.json();
}





useEffect(() => {
  if (route === 'home' && readStoredToken()) {
    void loadApiMoments();
  }
}, [route]);





  useEffect(() => {
    function handlePopState() {
      const path = window.location.pathname;
      const match = path.match(/^\/profile\/user\/([^/]+)$/);
      setPublicProfileId(match ? decodeURIComponent(match[1]) : null);

      if (match) {
        setRoute('public-profile');
      } else if (path === '/profile') {
        setRoute('profile');
      } else if (path === '/connections') {
        setRoute('connections');
      } else if (path === '/checkins') {
        setRoute('checkins');
        setSelectedNav('Checkins');
      } else if (path === '/inbox') {
        setRoute('inbox');
      } else if (path === '/home') {
        setRoute('home');
        setSelectedNav('Home');
      } else if (path === '/login') {
        setRoute('login');
      } else {
        setRoute('signup');
      }

      setMenuOpen(false);
      setFullMoment(false);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function goTo(
    path: '/home' | '/profile' | '/connections' | '/checkins' | '/inbox' | '/login' | '/',
  ) {
    window.history.pushState({}, '', path);

    if (path === '/home') {
      setRoute('home');
      setSelectedNav('Home');
    } else if (path === '/inbox') {
      setRoute('inbox');
    } else if (path === '/profile') {
      setRoute('profile');
    } else if (path === '/connections') {
      setRoute('connections');
      setSelectedNav('Connections');
    } else if (path === '/checkins') {
      setRoute('checkins');
      setSelectedNav('Checkins');
    } else if (path === '/login') {
      setRoute('login');
    } else {
      setRoute('signup');
    }

    setPublicProfileId(null);
    setMenuOpen(false);
    setFullMoment(false);
    window.scrollTo(0, 0);
  }

  function openPublicProfile(userId: string) {
  setPublicProfileId(userId);
  window.history.pushState(
    {},
    '',
    `/profile/user/${encodeURIComponent(userId)}`,
  );
  setRoute('public-profile');
  setMenuOpen(false);
  setFullMoment(false);
  window.scrollTo(0, 0);
}

  function logout() {
    try {
      localStorage.removeItem('blink-access-token');
      sessionStorage.removeItem('blink-access-token');
      localStorage.removeItem('blink-user');
      sessionStorage.removeItem('blink-user');
    } catch {
      // Continue to the login screen even if storage is unavailable.
    }

    setUser(null);
    goTo('/login');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 8 || password.length > 72) {
      setError('Password must be between 8 and 72 characters.');
      return;
    }

    if (route !== 'login') {
      if (name.trim().length < 2 || name.trim().length > 80) {
        setError('Your name must be between 2 and 80 characters.');
        return;
      }

      if (!/^\+?[0-9]{10,15}$/.test(phoneNumber.trim())) {
        setError('Enter a valid phone number with country code if needed.');
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = route === 'login' ? '/auth/login' : '/auth/register';
      const payload =
        route === 'login'
          ? { email: email.trim(), password }
          : {
              name: name.trim(),
              email: email.trim(),
              phoneNumber: phoneNumber.trim(),
              password,
            };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as AuthResponse;

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(' ')
          : data.message;

        throw new Error(
          message ||
            (response.status === 401
              ? 'Incorrect email or password.'
              : 'Something went wrong. Please try again.'),
        );
      }

      if (route === 'login') {
        if (!data.accessToken) {
          throw new Error(
            'Login succeeded, but the server did not return an access token.',
          );
        }

        try {
          if (rememberMe) {
            localStorage.setItem('blink-access-token', data.accessToken);
            sessionStorage.removeItem('blink-access-token');
          } else {
            sessionStorage.setItem('blink-access-token', data.accessToken);
            localStorage.removeItem('blink-access-token');
          }

          if (data.user) {
            sessionStorage.setItem('blink-user', JSON.stringify(data.user));
          }
        } catch {
          throw new Error(
            'Your browser could not save the login session. Please enable site storage and try again.',
          );
        }

        setUser(data.user ?? null);
        goTo('/home');
      } else {
        setSuccess('Account created successfully! You can now sign in.');
        setName('');
        setEmail('');
        setPhoneNumber('');
        setPassword('');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to connect to Blink. Check that the API is running.',
      );
    } finally {
      setLoading(false);
    }
  }

  function changeMoment(direction: number) {
  const currentIndex = allMoments.findIndex(
    (moment) => moment.id === selectedMomentId,
  );

  const baseIndex = currentIndex >= 0 ? currentIndex : momentIndex;

  const nextIndex =
    (baseIndex + direction + allMoments.length) % allMoments.length;

  setMomentIndex(nextIndex);
  setSelectedMomentId(allMoments[nextIndex].id);
}

  // function handleTouchStart(event: TouchEvent<HTMLElement>) {
  //   const touch = event.touches[0];
  //   touchStart.current = { x: touch.clientX, y: touch.clientY };
  // }

  // function handleTouchEnd(event: TouchEvent<HTMLElement>) {
  //   if (!touchStart.current) return;

  //   const touch = event.changedTouches[0];
  //   const deltaX = touch.clientX - touchStart.current.x;
  //   const deltaY = touch.clientY - touchStart.current.y;
  //   touchStart.current = null;

  //   if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY)) {
  //     changeMoment(deltaX < 0 ? 1 : -1);
  //   }
  // }

  // function handleFeedKeyDown(event: KeyboardEvent<HTMLElement>) {
  //   if (event.key === 'ArrowRight') changeMoment(1);
  //   if (event.key === 'ArrowLeft') changeMoment(-1);
  //   if (event.key === 'Escape') setFullMoment(false);
  // }

  function demoPostMoment() {
    try {
      localStorage.setItem('blink-demo-first-moment', 'true');
    } catch {
      // The demo gate still updates in memory.
    }

    setHasPostedMoment(true);
    setNotice('Your demo moment is posted! Friends’ moments are now visible.');
  }

function handleNav(label: string) {
  setSelectedNav(label);
  if (label === 'Checkins') {
    goTo('/checkins');
    return;
  }
  if (label === 'Connections') {
  goTo('/connections');
  return;
}

  if (label === 'Home') {
    setCameraError('');
    setCapturedMedia(null);
    setCapturedType(null);
    setIsRecording(false);
    return;
  }

  if (label === 'Capture') {
    setCameraError('');
    setCapturedMedia(null);
    setCapturedType(null);
    setCaptureMode('photo');
    return;
  }

  setNotice(`${label} will be available when that page is built.`);
}

  async function startCamera() {
    setCameraError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Camera access is unavailable. Use localhost or a secure HTTPS connection.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: true,
      });

      setCameraStream(stream);

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError(
        'Camera permission was denied or no camera is available. Check your browser permissions and try again.'
      );
    }
  }

  function stopCamera() {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
  }

  function capturePhoto() {
    const video = cameraVideoRef.current;
    const canvas = cameraCanvasRef.current;

    if (!video || !canvas || video.videoWidth === 0) {
      setCameraError('The camera is not ready yet. Please try again.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');

    if (!context) {
      setCameraError('Could not capture the photo. Please try again.');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedMedia(canvas.toDataURL('image/jpeg', 0.92));
    setCapturedType('photo');
    setCameraError('');
    stopCamera();
  }

  function startVideoRecording() {
    if (!cameraStream) {
      setCameraError('Please wait for the camera to start.');
      return;
    }

    if (!window.MediaRecorder) {
      setCameraError('Video recording is not supported by this browser.');
      return;
    }

    try {
      const mimeType = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ].find((type) => MediaRecorder.isTypeSupported(type));

      const recorder = mimeType
        ? new MediaRecorder(cameraStream, { mimeType })
        : new MediaRecorder(cameraStream);

      recordedChunksRef.current = [];

     recorder.ondataavailable = (event) => {
  if (event.data.size > 0) {
    console.log('Recorded video MIME type:', event.data.type);
    recordedChunksRef.current.push(event.data);
  }
};

      recorder.onstop = () => {
        const rawMimeType = recorder.mimeType.toLowerCase();
const normalizedMimeType = rawMimeType.split(';')[0].trim();

const blob = new Blob(recordedChunksRef.current, {
  type: normalizedMimeType,
});

        console.log('Final video MIME type:', blob.type);
console.log('Final video size:', blob.size);

        if (blob.size > 0) {
          setCapturedMedia(URL.createObjectURL(blob));
          setCapturedType('video');
          setCameraError('');
        } else {
          setCameraError('No video was recorded. Please try again.');
        }

        stopCamera();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setCameraError('');
    } catch {
      setCameraError('Could not start recording. Please try again.');
    }
  }

  function stopVideoRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
  }

  function handleCaptureAction() {
    if (captureMode === 'photo') {
      capturePhoto();
      return;
    }

    if (isRecording) {
      stopVideoRecording();
    } else {
      startVideoRecording();
    }
  }

  function discardCapturedMedia() {
    if (capturedMedia?.startsWith('blob:')) {
      URL.revokeObjectURL(capturedMedia);
    }

    setCapturedMedia(null);
    setCapturedType(null);
    setCameraError('');
    setIsRecording(false);
    setSelectedNav('Home');
  }

  
async function postCapturedMediaDemo() {
  if (!capturedMedia || !capturedType) return;

  const token = readStoredToken();

  if (!token) {
    setNotice('Please sign in again before posting.');
    return;
  }

  setIsPostingDemo(true);
  setCameraError('');

  try {
    const mediaResponse = await fetch(capturedMedia);
    const mediaBlob = await mediaResponse.blob();

    const baseMimeType = mediaBlob.type
  .toLowerCase()
  .split(';')[0]
  .trim();

const uploadBlob = mediaBlob.slice(
  0,
  mediaBlob.size,
  baseMimeType,
);

    const extension =
      capturedType === 'video'
        ? mediaBlob.type.includes('webm')
          ? 'webm'
          : mediaBlob.type.includes('quicktime')
            ? 'mov'
            : 'mp4'
        : mediaBlob.type.includes('png')
          ? 'png'
          : mediaBlob.type.includes('webp')
            ? 'webp'
            : 'jpg';

    const formData = new FormData();
    formData.append('file', uploadBlob, `moment.${extension}`);

    const response = await fetch(`${API_URL}/moments/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        errorText || `Upload failed (${response.status})`,
      );
    }

    if (capturedMedia.startsWith('blob:')) {
      URL.revokeObjectURL(capturedMedia);
    }

    setCapturedMedia(null);
    setCapturedType(null);
    await loadApiMoments();
    setHasPostedMoment(true);

    try {
      localStorage.setItem('blink-demo-first-moment', 'true');
    } catch {
      // Posting still succeeds if browser storage is unavailable.
    }

    setSelectedNav('Home');
    setNotice('Your moment was uploaded successfully!');
  } catch (error) {
    setCameraError(
      error instanceof Error
        ? error.message
        : 'Could not upload your moment. Please try again.',
    );
  } finally {
    setIsPostingDemo(false);
  }
}
if (route === 'public-profile') {
  if (!readStoredToken()) {
    return (
      <main className="blink-public-profile">
        <div className="public-profile-container">
          <h1>Sign in to view profiles</h1>
          <button type="button" onClick={() => goTo('/login')}>
            Sign in
          </button>
        </div>
      </main>
    );
  }

  if (!publicProfileId) {
    return null;
  }

  return (
    <PublicProfilePage
      userId={publicProfileId}
      onBack={() => goTo('/connections')}
      onMyProfile={() => goTo('/profile')}
      theme={theme}
      onToggleTheme={() =>
        setTheme((current) =>
          current === 'light' ? 'dark' : 'light',
        )
      }
    />
  );
}

// NEW: Inbox page
if (route === 'inbox') {
  if (!readStoredToken()) {
    return (
      <main className="blink-inbox">
        <div className="inbox-empty">
          <h1>Sign in to view Inbox</h1>
          <button type="button" onClick={() => goTo('/login')}>Sign in</button>
        </div>
      </main>
    );
  }

  return (
    <InboxPage
      onBack={() => goTo('/home')}
      onOpenProfile={openPublicProfile}
      theme={theme}
      onToggleTheme={() =>
        setTheme((current) =>
          current === 'light' ? 'dark' : 'light',
        )
      }
    />
  );
}

if (route === 'checkins') {
  if (!readStoredToken()) { goTo('/login'); return null; }
  return <CheckinsPage onBack={() => goTo('/home')} onOpenProfile={openPublicProfile} theme={theme} onToggleTheme={() => setTheme(current => current === 'light' ? 'dark' : 'light')} />;
}

if (route === 'connections') {
  if (!readStoredToken()) {
    return (
      <main className="blink-friends">
        <div className="friends-container">
          <h1>Sign in to view Connections</h1>
          <button type="button" onClick={() => goTo('/login')}>
            Sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <FriendsPage
    onOpenProfile={openPublicProfile}
      onBack={() => goTo('/home')}
      theme={theme}
      onToggleTheme={() =>
        setTheme((current) =>
          current === 'light' ? 'dark' : 'light',
        )
      }
    />
  );
}
if (route === 'profile') {
  return (
    <ProfilePage
      onBack={() => goTo('/home')}
      theme={theme}
      onToggleTheme={() =>
        setTheme((current) => 
          current === 'light' ? 'dark' : 'light',)
      }
    />
  );
}



  if (route === 'home') {
    const hasToken = Boolean(readStoredToken());

    if (!hasToken) {
      return (
        <main className="auth-page">
          <header className="site-header">
            <a className="brand" href="/" onClick={(e) => { e.preventDefault(); goTo('/'); }}>
              <img className="brand-logo" src="/blink-logo.png" alt="Blink" />
            </a>
            <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
              {theme === 'light' ? '☾ Dark mode' : '☀ Light mode'}
            </button>
          </header>
          <section className="home-signin-required">
            <span className="home-lock">⌑</span>
            <h1>Welcome to Blink</h1>
            <p>Sign in to see your friends’ moments and stay connected.</p>
            <button className="submit-button" onClick={() => goTo('/login')}>Sign in to continue →</button>
          </section>
        </main>
      );
    }

    return (
      <main className={`blink-home ${fullMoment ? 'moment-expanded' : ''}`}>
        <header className="home-header">
          <button
            className="icon-button menu-button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>

          <a className="home-brand" href="/home" onClick={(e) => e.preventDefault()}>
            <img src="/blink-logo.png" alt="Blink" />
          </a>

          <button
            type="button"
            className="icon-button inbox-button"
            onClick={() => goTo('/inbox')}
            aria-label="Open Inbox"
            title="Inbox"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3.5-.8L4 20l1.8-4.6A7.5 7.5 0 1 1 20 11.5Z" />
              <path d="M8.5 11.5h7" />
            </svg>
          </button>
        </header>

        {menuOpen && (
          <>
            <button className="menu-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
            <aside className="home-drawer">
              <div className="drawer-heading">
                <img src="/blink-logo.png" alt="Blink" />
                <button className="drawer-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">×</button>
              </div>
              <p className="drawer-label">YOUR SPACE</p>
             <button onClick={() => goTo('/profile')}>
  ◉ <span>My profile</span>
</button>
              <button onClick={() => { setMenuOpen(false); setNotice('Settings will be available soon.'); }}>⚙ <span>Settings</span></button>
              <button onClick={() => { setMenuOpen(false); setTheme(theme === 'light' ? 'dark' : 'light'); }}>◐ <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span></button>
              <div className="drawer-spacer" />
              <button className="drawer-logout" onClick={logout}>↪ <span>Log out</span></button>
              <p className="drawer-footnote">More Blink features are coming soon.</p>
            </aside>
          </>
        )}

        
<section className="blink-ci-preview" aria-label="Friends' Check-Ins">
  <div className="blink-ci-preview-head"><h2>🧡 Check-Ins</h2><button type="button" onClick={() => goTo('/checkins')}>See all →</button></div>
  {homeCheckinsLoading ? <p className="blink-ci-preview-empty">Loading Check-Ins…</p> :
    <NotesRow items={homeCheckins} ownId={readStoredUser()?.id} onCreate={() => goTo('/checkins')} onOpenProfile={id => id === readStoredUser()?.id ? goTo('/profile') : openPublicProfile(id)} />}
</section>

<section className="home-feed" aria-label="Friends' moments feed">
  <div className="feed-heading">
    <div>
      <p className="feed-eyebrow">YOUR PEOPLE, YOUR MOMENTS</p>
      <h1>
        Moments <span className="feed-spark">✦</span>
      </h1>
    </div>
    <span className="feed-count">
      {Math.min(visibleMomentCount, allMoments.length)} moments
    </span>
  </div>

  {!hasPostedMoment && (
    <div className="grid-gate">
      <span className="gate-icon">✦</span>
      <h2>Moments are better when shared.</h2>
      <p>Post your first moment to unlock your friends' photos and videos.</p>
      <button className="gate-button" onClick={demoPostMoment}>
        <span>＋</span> Post your first moment
      </button>
      <small>Demo preview · Upload will be connected later</small>
    </div>
  )}

  <div
    className={`moment-grid ${!hasPostedMoment ? 'moment-grid-locked' : ''}`}
    aria-label="Moments gallery"
  >
    {allMoments.slice(0, visibleMomentCount).map((moment, index) => (
      
<button
  key={moment.id}
  type="button"
  className="moment-grid-card"
  aria-label={`Open ${moment.name}'s ${moment.kind} moment`}
 onClick={() => {
  if (!hasPostedMoment && !moment.apiId) {
    demoPostMoment();
    return;
  }

  setSelectedMomentId(moment.id);
  if (moment.apiId && !moment.isMine) {
  void recordMomentView(moment.apiId);
}
  setMomentIndex(index);
  setFullMoment(true);
}}
>
  
{moment.kind === 'video' ? (
  <video
    className="moment-tile-image"
    src={moment.image}
    muted
    playsInline
    preload="metadata"
  />
) : (
  <img
    className="moment-tile-image"
    src={moment.image}
    alt={`${moment.name}'s moment`}
    loading="lazy"
  />
)}


  <span className="grid-card-shade" />

  <span className="grid-card-indicator">
    {moment.kind === 'video' ? '▶' : '▧'}
  </span>

  <span className="grid-card-caption">
    {moment.name}
  </span>

  {!hasPostedMoment && (
    <span className="grid-card-lock">✦</span>
  )}
</button>

    ))}
  </div>

  {visibleMomentCount < allMoments.length && (
    <button
      className="load-more-moments"
      onClick={() =>
        setVisibleMomentCount((count) =>
          Math.min(count + 35, allMoments.length)
        )
      }
    >
      Load more moments
    </button>
  )}

  <p className="swipe-hint">
    Tap any moment to open it
  </p>
</section>


        <nav className="home-bottom-nav" aria-label="Main navigation">
       
        {selectedNav === 'Capture' && (
          <section className="capture-screen" aria-label="Create a moment">
            <div className="capture-topbar">
              <button
                className="capture-close"
                onClick={() => handleNav('Home')}
                aria-label="Close camera"
              >
                ×
              </button>

              <h2>{capturedMedia ? 'Preview your moment' : 'Create a moment'}</h2>

              <span className="capture-mode-label">
                {capturedType === 'video' ? 'VIDEO' : captureMode.toUpperCase()}
              </span>
            </div>

            <div
              className="capture-stage"
              
onTouchStart={(event) => {
  touchStart.current = {
    x: event.touches[0]?.clientX ?? 0,
    y: event.touches[0]?.clientY ?? 0,
  };
}}
onTouchEnd={(event) => {
  const start = touchStart.current;
  const end = event.changedTouches[0];

  if (
    start &&
    end &&
    Math.abs(end.clientX - start.x) > 55 &&
    Math.abs(end.clientX - start.x) >
      Math.abs(end.clientY - start.y) &&
    !capturedMedia &&
    !isRecording
  ) {
    setCaptureMode(end.clientX < start.x ? 'video' : 'photo');
  }

  touchStart.current = null;
}}
            >
              {capturedMedia ? (
  capturedType === 'photo' ? (
    <img
      className="capture-preview"
      src={capturedMedia}
      alt="Captured moment preview"
    />
  ) : (
    
<video
  key={capturedMedia}
  className="capture-preview"
  src={capturedMedia}
  controls
  muted
  autoPlay
  playsInline
  loop
  preload="auto"
  onLoadedMetadata={(event) => {
    const video = event.currentTarget;
    console.log('Preview video metadata:', {
      width: video.videoWidth,
      height: video.videoHeight,
      duration: video.duration,
      source: video.currentSrc,
    });

    if (video.duration > 0.2) {
      video.currentTime = 0.1;
    }
  }}
  onLoadedData={() => {
    console.log('Preview video frame loaded');
  }}
  onError={(event) => {
    console.error(
      'Preview video error:',
      event.currentTarget.error,
    );
  }}
/>

  )
) : (
  <video
    ref={cameraVideoRef}
    className="capture-live-video"
    autoPlay
    muted
    playsInline
  />
)}

              <canvas ref={cameraCanvasRef} hidden />

              {!capturedMedia && !cameraError && !cameraStream && (
                <p className="capture-status">Starting camera…</p>
              )}

              {cameraError && (
                <div className="capture-error" role="alert">
                  <p>{cameraError}</p>
                  {!capturedMedia && (
                    <button onClick={() => void startCamera()}>
                      Try camera again
                    </button>
                  )}
                </div>
              )}

              {isRecording && (
                <div className="recording-indicator">
                  <span />
                  Recording
                </div>
              )}
            </div>

            {capturedMedia ? (
              <div className="capture-review">
                <p>Would you like to post this moment?</p>
                <div className="capture-review-actions">
                  <button
                    className="capture-discard"
                    onClick={discardCapturedMedia}
                    disabled={isPostingDemo}
                  >
                    Discard
                  </button>
                  <button
                    className="capture-post"
                    onClick={postCapturedMediaDemo}
                    disabled={isPostingDemo}
                  >
                    {isPostingDemo ? 'Please wait…' : 'Post moment'}
                  </button>
                </div>
                <p className="capture-demo-note">
                   Your moment will be uploaded and shared with Blink.
                </p>
              </div>
            ) : (
              <div className="capture-controls">
                <div className="capture-mode-switch" aria-label="Capture mode">
                  <button
                    className={captureMode === 'photo' ? 'active' : ''}
                    onClick={() => setCaptureMode('photo')}
                    disabled={isRecording}
                  >
                    Photo
                  </button>
                  <button
                    className={captureMode === 'video' ? 'active' : ''}
                    onClick={() => setCaptureMode('video')}
                    disabled={isRecording}
                  >
                    Video
                  </button>
                </div>

                <button
                  className={`capture-shutter ${captureMode === 'video' ? 'video-mode' : ''} ${isRecording ? 'recording' : ''}`}
                  onClick={handleCaptureAction}
                  aria-label={
                    captureMode === 'photo'
                      ? 'Take photo'
                      : isRecording
                        ? 'Stop recording'
                        : 'Start recording'
                  }
                  disabled={!cameraStream && !isRecording}
                >
                  <span />
                </button>

                <p className="capture-instruction">
                  {captureMode === 'photo'
                    ? 'Tap to take a photo'
                    : isRecording
                      ? 'Tap again to stop recording'
                      : 'Tap to start recording'}
                </p>
                <p className="capture-swipe-hint">
                  Swipe left for video · Swipe right for photo
                </p>
              </div>
            )}
          </section>
        )}

          {navItems.map((item) => (
            <button
              key={item.label}
              className={`bottom-nav-item ${selectedNav === item.label ? 'selected' : ''} ${item.label === 'Capture' ? 'capture-nav' : ''}`}
              aria-label={item.label}
              aria-current={selectedNav === item.label ? 'page' : undefined}
              onClick={() => handleNav(item.label)}
            >
              <span className="nav-symbol" aria-hidden="true">{item.symbol}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {notice && (
          <div className="home-toast" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice('')} aria-label="Dismiss">×</button>
          </div>
        )}

        {fullMoment &&
  (hasPostedMoment ||
    apiMoments.some((moment) => `api-${moment.id}` === selectedMomentId)) && (
          <div className="full-moment-view">
            {activeMoment.kind === 'video' ? (
  <video
    className="full-moment-media"
    src={activeMoment.image}
    controls
    autoPlay
    playsInline
    loop
  />
) : (
  <img
    className="full-moment-media"
    src={activeMoment.image}
    alt={`${activeMoment.name}'s full-screen moment`}
  />
)}
            <div className="full-moment-shade" />
            
<div className="full-moment-header">
  {activeMoment.senderId ? (
    <button
      type="button"
      className="moment-author-profile-button"
      onClick={() => {
        const currentUserId = readStoredUser()?.id;

        if (activeMoment.senderId === currentUserId) {
          goTo('/profile');
        } else {
          openPublicProfile(activeMoment.senderId!);
        }
      }}
      aria-label={`View ${activeMoment.name}'s profile`}
    >
      <span className="moment-avatar">
        {activeMoment.initials}
      </span>

      <span className="moment-author">
        <strong>{activeMoment.name}</strong>
        <span>{activeMoment.time}</span>
      </span>
    </button>
  ) : (
    <div className="moment-author-profile-static">
      <span className="moment-avatar">
        {activeMoment.initials}
      </span>

      <span className="moment-author">
        <strong>{activeMoment.name}</strong>
        <span>{activeMoment.time}</span>
      </span>
    </div>
  )}

  <button
    type="button"
    onClick={() => setFullMoment(false)}
    aria-label="Close full-screen moment"
  >
    ×
  </button>
</div>

            <p className="full-moment-caption">{activeMoment.caption}</p>
            
{activeMoment.apiId && activeMoment.isMine && (
  <button
    type="button"
    className="moment-viewers-button"
    onClick={() => void openMomentViewers(activeMoment.apiId!)}
  >
    Viewers
  </button>
)}

            <div className="full-moment-controls">
              <button onClick={() => changeMoment(-1)}>← Previous</button>
              <button onClick={() => changeMoment(1)}>Next →</button>
            </div>
            
{showMomentViewers && (
  <div className="moment-viewers-panel">
    <div className="moment-viewers-heading">
      <strong>People who viewed this moment</strong>
      <button
        type="button"
        onClick={() => setShowMomentViewers(false)}
        aria-label="Close viewers"
      >
        ×
      </button>
    </div>

    {loadingMomentViewers ? (
      <p>Loading viewers…</p>
    ) : momentViewersError ? (
      <p role="alert">{momentViewersError}</p>
    ) : momentViewers.length === 0 ? (
      <p>No views yet.</p>
    ) : (
      <>
        <p>{momentViewers.length} viewer(s)</p>
        {momentViewers.map((viewer) => (
          <div className="moment-viewer-row" key={viewer.viewerId}>
            <span className="moment-viewer-avatar">
              {viewer.name.slice(0, 1).toUpperCase()}
            </span>
            <span>{viewer.name}</span>
          </div>
        ))}
      </>
    )}
  </div>
)}

          </div>
        )}
      </main>
    );
  }

  const isLogin = route === 'login';

  return (
    <main className={`auth-page ${isLogin ? 'login-page' : 'signup-page'}`}>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Blink home" onClick={(event) => { event.preventDefault(); goTo('/'); }}>
          <img className="brand-logo" src="/blink-logo.png" alt="Blink" />
        </a>
        <button className="theme-toggle" type="button" onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}>
          {theme === 'light' ? '☾  Dark mode' : '☀  Light mode'}
        </button>
      </header>

      <div className="auth-layout">
        <section className="auth-hero">
          <p className="eyebrow"><span className="eyebrow-dot" /> YOUR MOMENTS. YOUR PEOPLE.</p>
          <h1>{isLogin ? <>Welcome back<br />to <span>Blink.</span></> : <>Life moves<br />fast. <span>Blink it.</span></>}</h1>
          <p className="hero-description">
            {isLogin
              ? 'Log in to continue sharing moments, reconnecting with your people, and being part of something special.'
              : 'A little moment can mean everything. Connect with your people and share the moments worth remembering.'}
          </p>
          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit" />
            <div className="moment-card moment-card-back"><div className="moment-sun" /><div className="moment-mountains" /></div>
            <div className="moment-card moment-card-front">
              <div className="moment-scene"><span className="person person-one" /><span className="person person-two" /><span className="person person-three" /><span className="person person-four" /></div>
              <span className="moment-caption">Good vibes, together</span>
            </div>
            <span className="art-spark spark-one">✦</span><span className="art-spark spark-two">✳</span>
          </div>
          <p className="hero-footer"><span className="eyebrow-dot" /> Be present. Stay connected.</p>
        </section>

        <section className="auth-panel">
          <div className="auth-card">
            <p className="form-eyebrow">{isLogin ? 'LOG IN TO BLINK' : "LET'S GET STARTED"}</p>
            <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
            <p className="form-description">{isLogin ? 'Enter your details to sign in to your account.' : 'Your next favorite moment starts here.'}</p>

            <form onSubmit={handleSubmit} noValidate>
              {!isLogin && <div className="form-field"><label htmlFor="name">Full name</label><input id="name" autoComplete="name" placeholder="What should we call you?" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required /></div>}
              <div className="form-field"><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              {!isLogin && <div className="form-field"><label htmlFor="phoneNumber">Phone number</label><input id="phoneNumber" type="tel" autoComplete="tel" placeholder="+8801XXXXXXXXX" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} maxLength={16} required /><small>Include your country code, if needed.</small></div>}
              <div className="form-field">
                <label htmlFor="password">Password</label>
                <div className="password-wrap">
                  <input id="password" type={showPassword ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={72} required />
                  <button className="show-password" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button>
                </div>
              </div>

              {isLogin && <div className="login-options"><label className="remember-option"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} /><span>Remember me</span></label><button className="text-link" type="button" onClick={() => setError('Password reset is not available yet.')}>Forgot password?</button></div>}
              {error && <p className="form-message form-error" role="alert">{error}</p>}
              {success && <p className="form-message form-success" role="status">{success}</p>}
              <button className="submit-button" type="submit" disabled={loading}>{loading ? 'Please wait…' : isLogin ? 'Sign in  →' : 'Create account  →'}</button>
              <div className="form-divider"><span /><span>OR</span><span /></div>
              <button className="secondary-button" type="button" onClick={() => goTo(isLogin ? '/' : '/login')}>{isLogin ? 'Create a new account' : 'I already have an account'}</button>
            </form>

            <p className="legal-copy">By continuing, you agree to our<br /><a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
