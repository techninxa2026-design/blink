/**
 * Photo-only face stickers. Face landmarks run locally in the browser using
 * Google's MediaPipe Face Landmarker. First use downloads the WASM/model.
 * We do not upload camera frames for landmark processing.
 */
export type FaceFilter = 'none' | 'heart' | 'cat' | 'dog' | 'crown' | 'glasses' | 'party';

export const FACE_FILTERS: { id: FaceFilter; icon: string; label: string }[] = [
  { id: 'none', icon: '🚫', label: 'Original' },
  { id: 'heart', icon: '💗', label: 'Hearts' },
  { id: 'cat', icon: '🐱', label: 'Kitten' },
  { id: 'dog', icon: '🐶', label: 'Puppy' },
  { id: 'crown', icon: '👑', label: 'Royal' },
  { id: 'glasses', icon: '😎', label: 'Shades' },
  { id: 'party', icon: '🥳', label: 'Party' },
];

export type FacePoint = { x: number; y: number };
export type FaceDetectorInstance = {
  detectForVideo(video: HTMLVideoElement, timestamp: number): { faceLandmarks: FacePoint[][] };
  close(): void;
};

let loading: Promise<FaceDetectorInstance> | null = null;
export function loadFaceLandmarker(): Promise<FaceDetectorInstance> {
  if (!loading) {
    loading = (async () => {
      const url = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/+esm';
      // Runtime-loaded: avoids bundling a heavy native/WASM inference engine in Blink.
      const vision = await import(/* @vite-ignore */ url) as {
        FilesetResolver: { forVisionTasks(path: string): Promise<unknown> };
        FaceLandmarker: { createFromOptions(wasm: unknown, options: unknown): Promise<FaceDetectorInstance> };
      };
      const fileset = await vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm',
      );
      return vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    })().catch((error: unknown) => { loading = null; throw error; });
  }
  return loading;
}

/** Draw landmark-anchored emoji props at original photo resolution. */
export function paintFaceFilter(
  ctx: CanvasRenderingContext2D,
  points: FacePoint[] | null,
  filter: FaceFilter,
  width: number,
  height: number,
  mirrored = false,
): void {
  if (!points?.length || filter === 'none') return;
  const xs = points.map((point) => point.x * width);
  const ys = points.map((point) => point.y * height);
  const size = Math.max(75, (Math.max(...xs) - Math.min(...xs)) * 1.1);
  const anchor = (index: number): [number, number] => {
    const p = points[index] ?? points[1];
    return [(mirrored ? 1 - p.x : p.x) * width, p.y * height];
  };
  const print = (emoji: string, x: number, y: number, scale: number, angle = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = Math.round(size * scale) + 'px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
    ctx.shadowColor = '#0006';
    ctx.shadowBlur = size * 0.035;
    ctx.fillText(emoji, 0, 0);
    ctx.restore();
  };
  const [foreheadX, foreheadY] = anchor(10);
  const [leftEyeX, leftEyeY] = anchor(33);
  const [rightEyeX, rightEyeY] = anchor(263);
  const [noseX, noseY] = anchor(1);
  const [cheekLX, cheekLY] = anchor(234);
  const [cheekRX, cheekRY] = anchor(454);
  switch (filter) {
    case 'heart':
      print('💗', cheekLX, cheekLY, 0.34, -0.2);
      print('💗', cheekRX, cheekRY, 0.34, 0.2);
      print('💕', foreheadX, foreheadY - size * .54, .5);
      break;
    case 'cat':
      print('🐱', foreheadX, foreheadY - size * .48, .58);
      print('💗', noseX, noseY + size * .04, .18);
      break;
    case 'dog':
      print('🐶', foreheadX, foreheadY - size * .50, .63);
      print('🐾', noseX, noseY + size * .35, .28);
      break;
    case 'crown':
      print('👑', foreheadX, foreheadY - size * .50, .82);
      print('✨', cheekLX, cheekLY, .3);
      print('✨', cheekRX, cheekRY, .3);
      break;
    case 'glasses':
      print('🕶️', (leftEyeX + rightEyeX) / 2, (leftEyeY + rightEyeY) / 2, .86);
      break;
    case 'party':
      print('🥳', foreheadX, foreheadY - size * .57, .54);
      print('🎉', cheekLX - size * .18, cheekLY, .35);
      print('🎊', cheekRX + size * .18, cheekRY, .35);
      break;
  }
}
