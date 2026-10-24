/**
 * Blink camera AR lenses: original vector artwork anchored to real MediaPipe
 * face landmarks. Face inference stays on the device; no face images uploaded.
 * Photo capture composites the same artwork into the full-resolution JPEG.
 */
export type FaceFilter =
  'none' | 'heart' | 'cat' | 'dog' | 'crown' | 'glasses' | 'party' | 'butterfly' | 'cyber' | 'blush';
export const FACE_FILTERS: { id: FaceFilter; icon: string; label: string }[] = [
  { id: 'none', icon: '◯', label: 'Natural' },
  { id: 'cat', icon: '🐱', label: 'Kitty AR' },
  { id: 'dog', icon: '🐶', label: 'Puppy AR' },
  { id: 'butterfly', icon: '🦋', label: 'Fairy' },
  { id: 'heart', icon: '💖', label: 'Love Glow' },
  { id: 'crown', icon: '👑', label: 'Royal Gold' },
  { id: 'glasses', icon: '😎', label: 'Neon Shades' },
  { id: 'cyber', icon: '⚡', label: 'Cyber' },
  { id: 'blush', icon: '🌸', label: 'Soft Glam' },
  { id: 'party', icon: '🎉', label: 'Festival' },
];
export type FacePoint = { x: number; y: number };
export type FaceDetectorInstance = {
  detectForVideo(video: HTMLVideoElement, timestamp: number): { faceLandmarks: FacePoint[][] };
  close(): void;
};

let detectorPromise: Promise<FaceDetectorInstance> | null = null;
export function loadFaceLandmarker(): Promise<FaceDetectorInstance> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const vision = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/+esm') as {
        FilesetResolver: { forVisionTasks(path: string): Promise<unknown> };
        FaceLandmarker: { createFromOptions(wasm: unknown, options: unknown): Promise<FaceDetectorInstance> };
      };
      const wasm = await vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm',
      );
      return vision.FaceLandmarker.createFromOptions(wasm, {
        baseOptions: { modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'CPU' },
        runningMode: 'VIDEO', numFaces: 1, minFaceDetectionConfidence: .5,
        minFacePresenceConfidence: .5, minTrackingConfidence: .5,
      });
    })().catch((error: unknown) => { detectorPromise = null; throw error; });
  }
  return detectorPromise;
}

const PI = Math.PI;
type Painter = CanvasRenderingContext2D;
function ellipse(c: Painter, x: number, y: number, rx: number, ry: number, color: string, opacity = 1) {
  c.save(); c.globalAlpha *= opacity; c.fillStyle = color;
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, PI * 2); c.fill(); c.restore();
}
function path(c: Painter, points: number[][], color: string, stroke?: string, width = .012) {
  c.beginPath(); c.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
  c.closePath(); c.fillStyle = color; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
function stroke(c: Painter, points: number[][], color: string, width: number) {
  c.beginPath(); c.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}
function glow(c: Painter, x: number, y: number, radius: number, color: string) {
  const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color); gradient.addColorStop(1, 'transparent');
  c.fillStyle = gradient; c.beginPath(); c.arc(x, y, radius, 0, PI * 2); c.fill();
}
function star(c: Painter, x: number, y: number, radius: number, color: string, sides = 4) {
  const pts: number[][] = [];
  for (let n = 0; n < sides * 2; n++) {
    const angle = (n * PI / sides) - PI / 2;
    const r = n % 2 === 0 ? radius : radius * .27;
    pts.push([x + Math.cos(angle) * r, y + Math.sin(angle) * r]);
  }
  path(c, pts, color);
}
function ear(c: Painter, side: number, outer: string, inner: string, shape: 'cat' | 'dog') {
  c.save(); c.translate(side * .36, -.59); c.rotate(side * .17);
  if (shape === 'cat') {
    path(c, [[-.17,.11],[-.14,-.28],[.06,-.18],[.23,.12]], outer, '#fff6', .013);
    path(c, [[-.095,.04],[-.077,-.18],[.04,-.12],[.14,.05]], inner);
    star(c, side * .10, -.16, .035, '#fff7cb');
  } else {
    ellipse(c, side * .08, -.03, .20, .29, outer);
    ellipse(c, side * .08, -.02, .12, .20, inner, .75);
    c.translate(side * .05,.04);
  }
  c.restore();
}
function heart(c: Painter, x: number, y: number, r: number, color: string) {
  c.save(); c.translate(x, y); c.scale(r,r);
  c.beginPath(); c.moveTo(0,.35);
  c.bezierCurveTo(-.6,-.04,-.62,-.4,-.28,-.43);
  c.bezierCurveTo(-.1,-.45,0,-.28,0,-.20);
  c.bezierCurveTo(0,-.28,.1,-.45,.28,-.43);
  c.bezierCurveTo(.62,-.4,.6,-.04,0,.35);
  c.fillStyle=color; c.shadowColor=color; c.shadowBlur=.09; c.fill(); c.restore();
}
function blush(c: Painter) {
  glow(c, -.32,.23,.26,'rgba(255,100,147,.27)');
  glow(c, .32,.23,.26,'rgba(255,100,147,.27)');
  ellipse(c,-.33,.22,.13,.053,'#ff85a2',.34);
  ellipse(c,.33,.22,.13,.053,'#ff85a2',.34);
}
function drawLens(c: Painter, filter: FaceFilter) {
  switch (filter) {
    case 'cat':
      ear(c,-1,'#29222e','#ef97c0','cat'); ear(c,1,'#29222e','#ef97c0','cat');
      blush(c);
      path(c,[[-.10,.21],[.10,.21],[0,.31]],'#e46a96','#ffd5e2',.012);
      stroke(c,[[-.025,.31],[-.025,.37],[-.13,.40]],'#47303a',.019);
      stroke(c,[[.025,.31],[.025,.37],[.13,.40]],'#47303a',.019);
      for (let side of [-1,1]) for(let i=0;i<3;i++)
        stroke(c,[[side*.18,.32+i*.045],[side*.53,.25+i*.045]],'#f1e5e6',.014);
      break;
    case 'dog':
      ear(c,-1,'#a97050','#d7a08d','dog'); ear(c,1,'#a97050','#d7a08d','dog');
      glow(c,0,.29,.19,'rgba(255,238,207,.38)');
      ellipse(c,0,.28,.13,.10,'#352b30');
      ellipse(c,-.035,.245,.036,.018,'#ffffff',.68);
      stroke(c,[[0,.35],[0,.45],[-.08,.48]],'#633d42',.014);
      stroke(c,[[0,.45],[.08,.48]],'#633d42',.014);
      path(c,[[-.08,.49],[.08,.49],[.06,.68],[0,.75],[-.06,.68]],'#f48ca5');
      stroke(c,[[0,.52],[0,.70]],'#b4546c',.013);
      break;
    case 'heart':
      blush(c);
      glow(c,0,-.53,.40,'rgba(255,115,180,.26)');
      heart(c,-.33,-.54,.23,'#ff629d');
      heart(c,.30,-.71,.16,'#fa72ce');
      heart(c,.01,-.80,.18,'#ffb1cb');
      star(c,-.49,.03,.06,'#fff6c6');
      star(c,.47,-.10,.07,'#fff2cd');
      break;
    case 'crown':
      glow(c,0,-.61,.66,'rgba(255,215,95,.25)');
      path(c,[[-.49,-.54],[-.48,-.92],[-.23,-.73],[0,-1.08],[.23,-.73],[.48,-.92],[.49,-.54]],'#ebbb4d','#ffeeb6',.02);
      path(c,[[-.49,-.55],[.49,-.55],[.49,-.46],[-.49,-.46]],'#ffd979','#fff4b8',.012);
      for(const x of [-.31,0,.31]) ellipse(c,x,-.60,.045,.052,'#c53d6c');
      star(c,-.60,-.40,.08,'#ffe2a1'); star(c,.58,-.37,.08,'#ffe2a1');
      break;
    case 'glasses':
      glow(c,0,-.03,.45,'rgba(244,63,187,.24)');
      c.save();c.shadowColor='#ff72d5';c.shadowBlur=.09;
      for(const side of [-1,1]) {
        c.beginPath();c.moveTo(side*.03,-.09);c.lineTo(side*.49,-.09);
        c.lineTo(side*.44,.10);c.lineTo(side*.14,.12);c.closePath();
        c.fillStyle='rgba(23,10,54,.78)';c.fill();
        c.strokeStyle='#ff65c7';c.lineWidth=.036;c.stroke();
      }
      stroke(c,[[-.06,-.03],[.06,-.03]],'#fba5e1',.027);
      stroke(c,[[-.52,-.07],[-.60,-.10]],'#ff65c7',.032);
      stroke(c,[[.52,-.07],[.60,-.10]],'#ff65c7',.032);
      c.restore();
      star(c,-.53,-.35,.065,'#7cf6ff');
      break;
    case 'butterfly':
      blush(c);
      glow(c,0,-.58,.52,'rgba(181,131,255,.25)');
      for(const side of [-1,1]){
        c.save();c.scale(side,1);
        c.beginPath();c.moveTo(.05,-.61);
        c.bezierCurveTo(.1,-1.05,.55,-1.08,.55,-.72);
        c.bezierCurveTo(.60,-.42,.21,-.35,.05,-.61);
        c.closePath();c.fillStyle='rgba(157,126,255,.85)';c.fill();
        c.beginPath();c.moveTo(.09,-.55);
        c.bezierCurveTo(.42,-.69,.52,-.26,.22,-.17);
        c.bezierCurveTo(.05,-.17,.04,-.41,.09,-.55);c.closePath();
        c.fillStyle='rgba(255,166,222,.79)';c.fill();
        ellipse(c,.30,-.73,.05,.05,'#fff7e7');
        star(c,.46,-.42,.055,'#fff8d6');
        c.restore();
      }
      stroke(c,[[0,-.80],[0,-.29]],'#7c528d',.033);
      ellipse(c,0,-.79,.06,.065,'#fff9e3');
      break;
    case 'cyber':
      c.save();c.shadowColor='#1afff2';c.shadowBlur=.10;
      for(const side of [-1,1]) {
        stroke(c,[[side*.53,-.18],[side*.58,-.02],[side*.45,.14],[side*.12,.15]],'#40faff',.028);
        stroke(c,[[side*.17,-.14],[side*.46,-.14]],'#d57bff',.026);
        stroke(c,[[side*.59,.19],[side*.47,.30]],'#40faff',.016);
      }
      stroke(c,[[-.11,.07],[.11,.07]],'#42f6ff',.015);
      star(c,0,-.66,.16,'#d087ff',6);
      c.restore();
      break;
    case 'blush':
      blush(c);
      for(const side of [-1,1]){
        stroke(c,[[side*.17,-.09],[side*.41,-.12]],'#65404c',.028);
        glow(c,side*.39,-.19,.11,'rgba(255,183,225,.38)');
        star(c,side*.42,-.22,.05,'#fff3d2');
      }
      heart(c,.45,-.49,.11,'#ff93bb');
      break;
    case 'party':
      glow(c,0,-.65,.56,'rgba(248,206,84,.22)');
      path(c,[[-.19,-.52],[.12,-1.09],[.33,-.52]],'#8d65e3','#e8d1ff',.017);
      for(let i=0;i<5;i++){
        star(c,-.3+i*.14,-.77+Math.sin(i*3)*.12,.05,
          ['#ff7086','#67e3ff','#ffd868','#f2a0ff','#a8ef80'][i]);
      }
      ellipse(c,.12,-1.10,.08,.08,'#ffcd63');
      blush(c);
      star(c,-.58,-.38,.09,'#ff7da9');
      star(c,.59,-.23,.08,'#7aeaf1');
      break;
    default: break;
  }
}

/**
 * Draw in facial-local coordinates: eyes define origin and roll,
 * cheeks define scale. Mirrored capture and live preview match exactly.
 */
export function paintFaceFilter(
  ctx: Painter, points: FacePoint[] | null, filter: FaceFilter,
  width: number, height: number, mirrored = false,
): void {
  if (!points || points.length < 455 || filter === 'none') return;
  const anchor = (id: number) => {
    const p = points[id];
    return { x: (mirrored ? 1 - p.x : p.x) * width, y: p.y * height };
  };
  const left = anchor(33), right = anchor(263);
  const a = anchor(234), b = anchor(454);
  const center = { x: (left.x+right.x)*.5, y: (left.y+right.y)*.5 };
  const faceWidth = Math.hypot(b.x-a.x,b.y-a.y);
  if (!Number.isFinite(faceWidth) || faceWidth < 35) return;
  const roll = Math.atan2(right.y-left.y,right.x-left.x);
  ctx.save();
  ctx.translate(center.x,center.y);
  // Mirrored landmarks already passed in mirrored order: orientation is
  // corrected with the sign of left-to-right direction.
  ctx.rotate(roll + (right.x < left.x ? PI : 0));
  ctx.scale(faceWidth,faceWidth);
  drawLens(ctx,filter);
  ctx.restore();
}
