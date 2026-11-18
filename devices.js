// Saling Jaga: 3D concept models of the devices on the product page.
// Every model is built from simple shapes in code (no model files), drawn by one shared WebGL
// renderer and copied into each card's 2D canvas, so a page with seven models uses one GL context.
// Without WebGL or with JavaScript off, the <img> fallback inside each .dev3d stays visible.
import * as THREE from './vendor/three/three.module.min.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { RoundedBoxGeometry } from './vendor/three/RoundedBoxGeometry.js';

const GREEN = 0x1d4f33, LEAF = 0x2f9e5f, SOS = 0xe5352b, WHITE = 0xf4f5f2, DARK = 0x141a17, STEEL = 0xb9c0bc;

const mat = (color, o = {}) => new THREE.MeshPhysicalMaterial({
  color, roughness: o.rough ?? 0.45, metalness: o.metal ?? 0, clearcoat: o.coat ?? 0, clearcoatRoughness: 0.25,
  emissive: o.glow ? color : 0x000000, emissiveIntensity: o.glow ?? 0,
});
const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
const rbox = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 6, r);
const cyl = (r, h, seg = 48) => new THREE.CylinderGeometry(r, r, h, seg);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const face = (w, h, tex, o = {}) => new THREE.Mesh(new THREE.PlaneGeometry(w, h),
  new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, ...o }));
const font = (px, wt = 800) => `${wt} ${px}px "Plus Jakarta Sans", system-ui, sans-serif`;

function word(text, color = '#ffffff', px = 90) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = color; g.font = font(px); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
  });
}
// The red SOS button: a ring, a domed cap and the word on top. Faces +z.
function sosButton(r) {
  const g = new THREE.Group();
  const ring = mesh(cyl(r * 1.16, 0.05), mat(STEEL, { metal: 1, rough: 0.25 })); ring.rotation.x = Math.PI / 2;
  const cap = mesh(cyl(r, 0.12), mat(SOS, { rough: 0.35, coat: 1 }), 0, 0, 0.05); cap.rotation.x = Math.PI / 2;
  const t = face(r * 1.9, r * 0.475, word('SOS', '#ffffff', 104)); t.position.z = 0.115;
  g.add(ring, cap, t); return g;
}
function led(color, r = 0.035) { return mesh(new THREE.SphereGeometry(r, 16, 12), mat(color, { glow: 1.6, rough: 0.3 })); }
function logoPlane(size) {
  const tex = new THREE.TextureLoader().load(new URL('./brand/mark.png', import.meta.url).href, () => { dirty = true; });
  tex.colorSpace = THREE.SRGBColorSpace;
  return face(size, size * 0.97, tex);
}
function antenna(len, r = 0.06) {
  const g = new THREE.Group();
  g.add(mesh(cyl(r * 1.5, 0.22), mat(STEEL, { metal: 1, rough: 0.3 }), 0, 0.11, 0));
  g.add(mesh(cyl(r, len), mat(DARK, { rough: 0.6 }), 0, 0.22 + len / 2, 0));
  g.add(mesh(new THREE.SphereGeometry(r, 16, 12), mat(DARK, { rough: 0.6 }), 0, 0.22 + len, 0));
  return g;
}
function strap(rx, ry, width, thick, color) {
  const m = mesh(new THREE.TorusGeometry(1, thick, 20, 120), mat(color, { rough: 0.75 }));
  m.scale.set(rx, ry, width / (2 * thick)); return m;
}

const BUILD = {
  // sTag: Bluetooth key fob with an SOS button and a coin cell.
  stag() {
    const g = new THREE.Group();
    g.add(mesh(rbox(1.5, 1.9, 0.42, 0.21), mat(WHITE, { rough: 0.35, coat: 0.6 })));
    g.add(mesh(rbox(1.52, 0.5, 0.44, 0.2), mat(GREEN, { rough: 0.5 }), 0, -0.71, 0));
    const b = sosButton(0.42); b.position.set(0, 0.12, 0.2); g.add(b);
    const l = led(LEAF); l.position.set(0, 0.74, 0.21); g.add(l);
    const lg = logoPlane(0.34); lg.position.set(0, -0.7, 0.225); g.add(lg);
    const loop = mesh(new THREE.TorusGeometry(0.2, 0.05, 16, 48), mat(WHITE, { rough: 0.35 }), 0, 1.05, 0); g.add(loop);
    const ring = mesh(new THREE.TorusGeometry(0.42, 0.03, 16, 64), mat(STEEL, { metal: 1, rough: 0.2 }), 0, 1.52, 0);
    ring.rotation.y = Math.PI / 2.4; g.add(ring);
    g.scale.setScalar(1.05); g.position.y = -0.42; return g;
  },
  // sBand: the same beacon as a wristband for children, elders and pilgrims.
  sband() {
    const g = new THREE.Group();
    g.add(strap(1.25, 1.0, 0.62, 0.075, GREEN));
    g.add(mesh(rbox(1.05, 0.3, 0.74, 0.14), mat(WHITE, { rough: 0.35, coat: 0.6 }), 0, 1.06, 0));
    const b = sosButton(0.26); b.rotation.x = -Math.PI / 2; b.position.set(0, 1.21, 0); g.add(b);
    const l = led(LEAF, 0.03); l.position.set(0.4, 1.21, 0); g.add(l);
    for (let i = 0; i < 5; i++) { // strap holes
      const a = -Math.PI / 2 + (i - 2) * 0.16;
      const h = mesh(cyl(0.035, 0.05, 16), mat(0x0f2a1b, { rough: 0.9 }), Math.cos(a) * 1.33, Math.sin(a) * 1.07, 0);
      h.rotation.z = a - Math.PI / 2; g.add(h);
    }
    g.rotation.x = 0.5; g.scale.setScalar(1.0); g.position.y = -0.55; return g;
  },
  // sWatch: a watch with SOS and a compass to the group's meeting point.
  swatch() {
    const g = new THREE.Group();
    g.add(strap(1.2, 1.02, 0.78, 0.085, DARK));
    g.add(mesh(rbox(1.2, 0.36, 1.2, 0.17), mat(0x2a322e, { metal: 0.9, rough: 0.3 }), 0, 1.1, 0));
    const scr = canvasTex(512, 512, (c, w) => {
      c.fillStyle = '#07110c'; c.fillRect(0, 0, w, w);
      c.strokeStyle = 'rgba(127,224,164,.25)'; c.lineWidth = 3;
      [90, 150, 210].forEach(r => { c.beginPath(); c.arc(256, 280, r, 0, 7); c.stroke(); });
      c.save(); c.translate(256, 280); c.rotate(-0.6); c.fillStyle = '#e5352b';
      c.beginPath(); c.moveTo(0, -150); c.lineTo(46, -40); c.lineTo(0, -64); c.lineTo(-46, -40); c.closePath(); c.fill(); c.restore();
      c.fillStyle = '#7fe0a4'; c.beginPath(); c.arc(256, 280, 14, 0, 7); c.fill();
      c.fillStyle = '#ff8a83'; c.font = font(34); c.textAlign = 'center'; c.fillText('SOS · SARI', 256, 70);
      c.fillStyle = '#fff'; c.font = font(84); c.fillText('259 m', 256, 462);
    });
    const glass = mesh(rbox(1.0, 0.03, 1.0, 0.012), mat(0x050807, { rough: 0.05, coat: 1 }), 0, 1.285, 0); g.add(glass);
    const f = face(0.9, 0.9, scr); f.rotation.x = -Math.PI / 2; f.position.set(0, 1.305, 0); g.add(f);
    const crown = mesh(cyl(0.09, 0.12, 24), mat(SOS, { rough: 0.35, coat: 1 }), 0.66, 1.1, -0.2); crown.rotation.z = Math.PI / 2; g.add(crown);
    const btn = mesh(rbox(0.1, 0.12, 0.3, 0.04), mat(STEEL, { metal: 1, rough: 0.3 }), 0.63, 1.1, 0.25); g.add(btn);
    g.rotation.x = 0.62; g.scale.setScalar(1.0); g.position.y = -0.6; return g;
  },
  // sPower: a power bank with LoRa, Bluetooth and Wi-Fi, a torch, a siren and a big SOS button.
  spower() {
    const g = new THREE.Group();
    g.add(mesh(rbox(1.5, 2.9, 0.56, 0.2), mat(WHITE, { rough: 0.4, coat: 0.5 })));
    g.add(mesh(rbox(1.52, 0.7, 0.58, 0.2), mat(GREEN, { rough: 0.5 }), 0, -1.1, 0));
    const b = sosButton(0.44); b.position.set(0, 0.55, 0.27); g.add(b);
    for (let i = 0; i < 4; i++) { const l = led(i < 3 ? LEAF : 0x9aa59f, 0.045); l.position.set(-0.27 + i * 0.18, -0.25, 0.285); g.add(l); }
    const lg = logoPlane(0.42); lg.position.set(-0.36, -1.1, 0.295); g.add(lg);
    const nm = face(0.72, 0.18, word('Saling Jaga', '#ffffff', 70)); nm.position.set(0.22, -1.1, 0.295); g.add(nm);
    // top: torch lens, antenna
    const lens = mesh(cyl(0.2, 0.06), mat(0xfff6d8, { glow: 1.2, rough: 0.1 }), -0.35, 1.46, 0); g.add(lens);
    g.add(mesh(new THREE.TorusGeometry(0.21, 0.03, 12, 40), mat(STEEL, { metal: 1, rough: 0.25 }), -0.35, 1.47, 0).rotateX(Math.PI / 2));
    const a = antenna(0.95, 0.055); a.position.set(0.45, 1.4, 0); g.add(a);
    // bottom ports
    [-0.3, 0.3].forEach(x => g.add(mesh(rbox(0.3, 0.04, 0.12, 0.018), mat(0x0b0f0d, { rough: 0.8 }), x, -1.455, 0)));
    // siren grille
    for (let i = 0; i < 5; i++) g.add(mesh(rbox(0.5, 0.035, 0.02, 0.008), mat(0xc9cfcb, { rough: 0.6 }), 0, 1.2 - i * 0.07, 0.285));
    g.scale.setScalar(0.74); g.position.y = -0.42; return g;
  },
  // sNode: a solar LoRa repeater for hills, towers and mosque minarets.
  snode() {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.07, 3.2, 24), mat(STEEL, { metal: 1, rough: 0.35 }), 0, -0.4, -0.25));
    g.add(mesh(rbox(1.1, 1.3, 0.55, 0.1), mat(WHITE, { rough: 0.45, coat: 0.3 }), 0, -0.1, 0.1));
    g.add(mesh(rbox(1.12, 0.2, 0.57, 0.08), mat(GREEN, { rough: 0.5 }), 0, -0.66, 0.1));
    const lg = logoPlane(0.4); lg.position.set(0, 0.05, 0.38); g.add(lg);
    const l = led(LEAF, 0.04); l.position.set(0.4, 0.42, 0.38); g.add(l);
    const cells = canvasTex(512, 512, (c, w) => {
      c.fillStyle = '#0c1f3a'; c.fillRect(0, 0, w, w); c.strokeStyle = '#3a5d92'; c.lineWidth = 4;
      for (let i = 0; i <= 6; i++) { c.beginPath(); c.moveTo(i * w / 6, 0); c.lineTo(i * w / 6, w); c.moveTo(0, i * w / 6); c.lineTo(w, i * w / 6); c.stroke(); }
    });
    const panel = new THREE.Group();
    panel.add(mesh(rbox(1.9, 0.06, 1.35, 0.025), mat(0xdfe4e1, { metal: 0.8, rough: 0.35 })));
    const pf = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.25), new THREE.MeshPhysicalMaterial({ map: cells, roughness: 0.15, clearcoat: 1 }));
    pf.rotation.x = -Math.PI / 2; pf.position.y = 0.032; panel.add(pf);
    panel.position.set(0, 0.95, 0.25); panel.rotation.x = 0.6; g.add(panel);
    const a = antenna(1.25, 0.05); a.position.set(-0.36, 0.5, -0.05); g.add(a);
    g.scale.setScalar(0.8); g.position.y = -0.1; return g;
  },
  // sHub: a post box that broadcasts a "SALING JAGA" Wi-Fi network any phone can open.
  shub() {
    const g = new THREE.Group();
    g.add(mesh(rbox(2.5, 0.7, 1.6, 0.16), mat(WHITE, { rough: 0.4, coat: 0.4 })));
    g.add(mesh(rbox(2.52, 0.18, 1.62, 0.08), mat(GREEN, { rough: 0.5 }), 0, -0.27, 0));
    [-0.95, 0.95].forEach(x => { const a = antenna(1.1, 0.055); a.position.set(x, 0.3, -0.55); a.rotation.z = -x * 0.12; g.add(a); });
    const lg = logoPlane(0.38); lg.position.set(-0.85, 0.06, 0.81); g.add(lg);
    const nm = face(1.0, 0.25, word('POSKO', '#1d4f33', 84)); nm.position.set(-0.15, 0.06, 0.81); g.add(nm);
    [LEAF, LEAF, 0xf2b84b].forEach((c, i) => { const l = led(c, 0.04); l.position.set(0.6 + i * 0.2, 0.06, 0.81); g.add(l); });
    const b = sosButton(0.3); b.rotation.x = -Math.PI / 2; b.position.set(0.8, 0.36, 0.25); g.add(b);
    const handle = mesh(new THREE.TorusGeometry(0.42, 0.045, 12, 40, Math.PI), mat(DARK, { rough: 0.6 }), -0.35, 0.34, 0.1); g.add(handle);
    g.scale.setScalar(0.86); g.position.y = -0.75; g.rotation.x = 0.18; return g;
  },
  // sKom: a pocket LoRa communicator with a screen and keyboard, no SIM.
  skom() {
    const g = new THREE.Group();
    g.add(mesh(rbox(1.7, 2.9, 0.42, 0.18), mat(GREEN, { rough: 0.55 })));
    const scr = canvasTex(512, 384, (c, w, h) => {
      c.fillStyle = '#f6f8f7'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#e5352b'; c.beginPath(); c.roundRect(20, 18, w - 40, 78, 18); c.fill();
      c.fillStyle = '#fff'; c.font = font(30); c.fillText('SOS · Sari · 2,4 km', 40, 68);
      c.fillStyle = '#fff'; c.strokeStyle = '#dfe6e1'; c.lineWidth = 3; c.beginPath(); c.roundRect(20, 116, 330, 84, 18); c.fill(); c.stroke();
      c.fillStyle = '#0c1610'; c.font = font(26, 600); c.fillText('Pos 2 aman, 14 orang', 40, 168);
      c.fillStyle = '#1d4f33'; c.beginPath(); c.roundRect(170, 222, 322, 84, 18); c.fill();
      c.fillStyle = '#fff'; c.fillText('Tim menuju lokasi', 192, 274);
      c.fillStyle = '#7b867f'; c.font = font(20, 600); c.fillText('LoRa · 3 lompatan', 20, 356);
    });
    g.add(mesh(rbox(1.46, 1.14, 0.03, 0.012), mat(0x050807, { rough: 0.05, coat: 1 }), 0, 0.72, 0.21));
    const f = face(1.36, 1.02, scr); f.position.set(0, 0.72, 0.232); g.add(f);
    const key = rbox(0.115, 0.115, 0.05, 0.02), km = mat(0xe9ede9, { rough: 0.5 });
    for (let r = 0; r < 4; r++) for (let k = 0; k < 10; k++) g.add(mesh(key, km, -0.63 + k * 0.14, -0.3 - r * 0.2, 0.215));
    g.add(mesh(rbox(0.6, 0.115, 0.05, 0.02), km, 0, -1.1, 0.215));
    const b = sosButton(0.13); b.position.set(0.58, -1.1, 0.215); g.add(b);
    const a = antenna(0.9, 0.055); a.position.set(0.55, 1.4, 0); g.add(a);
    g.scale.setScalar(0.74); g.position.y = -0.45; return g;
  },
};

let renderer, pmrem, env, dirty = true;
const views = [];

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  pmrem = new THREE.PMREMGenerator(renderer);
  env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
}
function makeView(el) {
  const build = BUILD[el.dataset.model]; if (!build) return;
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
  const scene = new THREE.Scene(); scene.environment = env;
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 5, 4); scene.add(key);
  const pivot = new THREE.Group(); pivot.add(build()); scene.add(pivot);
  const shadow = face(3.0, 3.0, canvasTex(256, 256, (c) => {
    const gr = c.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, 'rgba(12,22,16,.2)'); gr.addColorStop(1, 'rgba(12,22,16,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
  }), { depthWrite: false });
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.62; shadow.scale.y = 0.55; scene.add(shadow);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50); camera.position.set(0, 1.25, 7.4); camera.lookAt(0, -0.12, 0);
  const v = { el, canvas, ctx: canvas.getContext('2d'), scene, camera, pivot, rotY: Number(el.dataset.angle || -0.55), rotX: 0, spin: !el.hasAttribute('data-still'), seen: false, drag: null };
  el.appendChild(canvas);
  canvas.addEventListener('pointerdown', (e) => { v.drag = { x: e.clientX, y: e.clientY }; v.spin = false; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!v.drag) return;
    v.rotY += (e.clientX - v.drag.x) * 0.01; v.rotX = Math.max(-0.7, Math.min(0.7, v.rotX + (e.clientY - v.drag.y) * 0.006));
    v.drag = { x: e.clientX, y: e.clientY }; dirty = true;
  });
  const end = () => { v.drag = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  views.push(v); return v;
}
function draw(v) {
  const r = v.el.getBoundingClientRect(); if (!r.width) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (v.canvas.width !== w || v.canvas.height !== h) { v.canvas.width = w; v.canvas.height = h; }
  renderer.setSize(w, h, false); v.camera.aspect = w / h;
  v.camera.position.z = w / h < 0.9 ? 7.4 / (w / h) * 0.9 : 7.4; v.camera.updateProjectionMatrix();
  v.pivot.rotation.set(v.rotX, v.rotY, 0);
  renderer.render(v.scene, v.camera);
  v.ctx.clearRect(0, 0, w, h); v.ctx.drawImage(renderer.domElement, 0, 0);
  if (!v.live) { v.live = true; v.el.classList.add('live'); } // only now hide the fallback image
}
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function frame() {
  const still = reduced.matches;
  views.forEach((v) => {
    if (!v.seen) return;
    if (v.spin && !still) { v.rotY += 0.004; draw(v); } else if (dirty || v.drag) draw(v);
  });
  dirty = false; requestAnimationFrame(frame);
}

const els = [].slice.call(document.querySelectorAll('.dev3d[data-model]'));
if (els.length) {
  try {
    init();
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      let v = views.find((x) => x.el === e.target);
      if (e.isIntersecting && !v) { v = makeView(e.target); if (v) draw(v); }
      if (v) { v.seen = e.isIntersecting; dirty = true; }
    }), { rootMargin: '200px' });
    els.forEach((el) => io.observe(el));
    addEventListener('resize', () => { dirty = true; });
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { dirty = true; });
    requestAnimationFrame(frame);
    window.sjDevices = { views, draw };
  } catch (e) { /* no WebGL: the fallback images stay */ }
}
