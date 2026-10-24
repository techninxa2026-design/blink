import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { uploadReel, videoCoverJpeg, type Reel } from './reelApi';
import './Reels.css';

type Props = {
  onBack: () => void;
  onPublished: (reel: Reel) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

const MAX_REEL_BYTES = 200 * 1024 * 1024;
const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];
function formatClock(seconds: number) {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return String(Math.floor(value / 60)).padStart(2,'0') + ':' + String(value % 60).padStart(2,'0');
}

export default function ReelsUploader({ onBack, onPublished, theme, onToggleTheme }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [duration, setDuration] = useState(0);
  const [coverTime, setCoverTime] = useState(0);
  const [coverPreview, setCoverPreview] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingCoverRef = useRef(0);

  useEffect(() => {
    if (!file) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!cameraOpen || !cameraStream || !cameraRef.current) return;
    cameraRef.current.srcObject = cameraStream;
    void cameraRef.current.play().catch(() => {});
  }, [cameraOpen, cameraStream]);

  useEffect(() => {
    if (!recording) return;
    const tick = window.setInterval(() => setRecordedSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(tick);
  }, [recording]);

  useEffect(() => () => {
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function selectFile(next?: File) {
    if (!next) return;
    if ((!ALLOWED_VIDEO.includes(next.type) && !/\.(mp4|mov|webm)$/i.test(next.name)) ||
        next.size === 0 || next.size > MAX_REEL_BYTES) {
      setError('Choose a nonempty MP4, MOV, or WebM video under 200 MB.');
      return;
    }
    setError('');
    setCoverTime(0); setDuration(0); setCoverPreview('');
    setFile(next);
    closeCamera();
  }

  function onGallery(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
    event.target.value = '';
  }

  async function openCamera() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Camera recording requires HTTPS or localhost and a supported browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, aspectRatio: { ideal: 9 / 16 } },
        audio: true,
      });
      streamRef.current = stream;
      setCameraStream(stream);
      setCameraOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Camera or microphone permission was denied.');
    }
  }

  function closeCamera() {
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null; setCameraStream(null); setCameraOpen(false);
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || !cameraOpen) return;
    const mime = ['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find((v) =>
      MediaRecorder.isTypeSupported(v));
    if (!mime) { setError('This browser cannot record a supported MP4/WebM reel. Use Gallery.'); return; }
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_500_000 });
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      const type = mime.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
      const blob = new Blob(chunks, { type });
      if (blob.size) selectFile(new File([blob], 'blink-reel-' + Date.now() +
        (type === 'video/mp4' ? '.mp4' : '.webm'), { type }));
      setRecording(false);
    };
    setRecordedSeconds(0);
    recorder.start(1000);
    setRecording(true);
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setRecording(false);
  }

  function seekCover(nextTime: number) {
    const target = Math.max(0, Math.min(nextTime, duration));
    setCoverTime(target);
    const video = videoRef.current;
    if (video && duration) video.currentTime = Math.min(target, Math.max(0, duration - 0.05));
  }

  function refreshCover() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 220 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCoverPreview(canvas.toDataURL('image/jpeg', .72));
  }

  async function publish() {
    if (publishing || !file) return;
    if (!duration || duration > 300 || !Number.isFinite(duration)) {
      setError('Reels must be no longer than five minutes.');
      return;
    }
    setError(''); setPublishing(true);
    try {
      const cover = await videoCoverJpeg(file, coverTime);
      const reel = await uploadReel(file, cover, caption, duration, coverTime);
      onPublished(reel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reel publishing failed.');
    } finally { setPublishing(false); }
  }

  return (
    <main className="br-page" data-theme={theme}>
      <header className="br-topbar"><button onClick={onBack} type="button">← Reels</button>
        <strong>blink<span>●</span> Create Reel</strong>
        <button type="button" onClick={onToggleTheme}>{theme === 'light' ? '☾' : '☀'} Theme</button></header>
      <div className="br-container br-upload-page">
        <section className="br-upload-hero">
          <span className="br-eyebrow">BLINK REELS STUDIO</span>
          <h1>Create something worth watching 🎬</h1>
          <p>Record a vertical video or choose a high-quality Reel from Gallery. Pick any video frame as the cover shown in your profile and Inbox shares.</p>
        </section>
        {error && <div className="br-error" role="alert">{error}</div>}
        <input hidden ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" onChange={onGallery} />
        {!file && <div className="br-upload-options">
          <button type="button" className="br-gallery-large" onClick={() => fileRef.current?.click()}>
            <span className="br-upload-illustration">▧ <span>↥</span></span>
            <strong>Choose from Gallery</strong>
            <small>Browse videos · MP4, MOV, WebM · max 200 MB</small>
            <span className="br-upload-cta">Select video →</span>
          </button>
          <button type="button" className="br-camera-large" onClick={() => void openCamera()}>
            <span className="br-upload-illustration">🎥</span>
            <strong>Open Camera</strong>
            <small>Record your own Reel · up to 5 minutes</small>
            <span className="br-upload-cta">Start camera →</span>
          </button>
        </div>}
        {cameraOpen && !file && <section className="br-camera-stage">
          <video ref={cameraRef} playsInline autoPlay muted />
          <div className="br-camera-buttons">
            <button type="button" disabled={publishing} onClick={recording ? stopRecording : startRecording}>
              {recording ? '■ Stop recording' : '● Record Reel'}
            </button>
            <span>{formatClock(recordedSeconds)} / 05:00</span>
            <button type="button" onClick={closeCamera} disabled={recording}>Close</button>
          </div>
          <small>Grant camera and microphone access to record a Reel.</small>
        </section>}
        {file && <div className="br-edit-grid">
          <section className="br-card">
            <div className="br-row-heading"><h2>Video preview</h2>
              <button type="button" className="br-text-button" disabled={publishing} onClick={() => fileRef.current?.click()}>Replace video</button></div>
            <video className="br-upload-preview" src={previewUrl} ref={videoRef} controls playsInline preload="auto"
              onLoadedMetadata={(event) => {
                const value = event.currentTarget.duration;
                if (!Number.isFinite(value) || value <= 0 || value > 300) {
                  setError('Reels must be between 1 second and 5 minutes.');
                  setDuration(0); return;
                }
                setDuration(value);
                event.currentTarget.currentTime = Math.min(0.1, value / 2);
              }}
              onSeeked={() => { pendingCoverRef.current++; refreshCover(); }}/>
            <p className="br-hint">{file.name} · {(file.size/1024/1024).toFixed(1)} MB · {formatClock(duration)}</p>
            <label className="br-label">Caption
              <textarea rows={4} maxLength={1000} value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Tell people what's happening in your Reel…"/>
              <small>{caption.length} / 1000</small>
            </label>
          </section>
          <section className="br-card">
            <h2>🖼 Choose Reel cover</h2>
            <p>Your chosen frame is saved as a real JPEG thumbnail. It appears in your profile, the Reel feed, and Inbox shares.</p>
            <div className="br-cover-preview">
              {coverPreview ? <img src={coverPreview} alt="Reel cover at selected timestamp" /> :
                <span>Scrub the video to generate your cover</span>}
            </div>
            <label className="br-label">Select frame · {formatClock(coverTime)}
              <input type="range" min={0} max={duration || 1} step=".1"
                value={coverTime} disabled={!duration} onChange={(event) => seekCover(Number(event.target.value))}/>
            </label>
            <p className="br-hint">Drag anywhere in the video timeline to choose a custom thumbnail.</p>
            <button type="button" className="br-primary" disabled={!duration || publishing}
              onClick={() => void publish()}>{publishing ? 'Publishing video and cover…' : 'Publish Reel →'}</button>
          </section>
        </div>}
      </div>
    </main>
  );
}
