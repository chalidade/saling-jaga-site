// 3D concept models of the devices on the product page.
// Every model is built from shapes in code (no model files), drawn by one shared WebGL renderer and
// copied into each card's 2D canvas, so a page with many models uses one GL context.
// Without WebGL or with JavaScript off, the <img> fallback inside each .dev3d stays visible.
//
// Brand: nothing here spells the brand out. The name printed on every device, the Wi-Fi name, the
// colours and the product names all come from brand.js, which tools/site/build.py writes from
// tools/site/brand.py. A rebrand is an edit to that one file and a rebuild. The devices carry the
// name as lettering and no logo, so a new logo needs nothing redrawn here.
//
// Design language shared by the family (each shape follows a real product of its kind):
//   · a matte shell, a soft-touch gasket band around the middle, one glossy black window
//   · one SOS key, the size of a real key, sunk inside a guard ring so a pocket cannot press it
import * as THREE from './vendor/three/three.module.min.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { RoundedBoxGeometry } from './vendor/three/RoundedBoxGeometry.js';
import { BRAND } from './brand.js';

const PI = Math.PI;
const hex = (s) => new THREE.Color(s).getHex();
const C = BRAND.colors;
const GREEN = hex(C.green), LEAF = hex(C.leaf), SOS = hex(C.sos), SHELL = hex(C.shell), GRAPHITE = hex(C.graphite);
const STEEL = 0xc6ccc8, GLASS = 0x060908, RUBBER = 0x1a1f1f, WARM = 0xfff1cf;

const mat = (color, o = {}) => new THREE.MeshPhysicalMaterial({
  color, roughness: o.rough ?? 0.5, metalness: o.metal ?? 0, clearcoat: o.coat ?? 0, clearcoatRoughness: o.coatRough ?? 0.25,
  emissive: o.glow ? color : 0x000000, emissiveIntensity: o.glow ?? 0, side: o.side ?? THREE.FrontSide,
});
// Finishes: "kabut" is white, "arang" is black. Every device wears either; the page's colour picker
// (any [data-finish-pick] button) switches all of them at once.
const FINISH = {
  kabut: {
    dark: false, ink: C.green, mute: 'rgba(20,30,24,.52)', soft: 0xdfe3de, hole: 0x0c2416, key: 0x40484b, keyAlt: 0xcdd3cf, fabric: 0xcfcdc2, edge: GREEN, loop: GREEN, red: C.sos, print: 'rgba(20,30,24,.74)',
    shell: () => mat(SHELL, { rough: 0.6, coat: 0.4, coatRough: 0.32 }), band: () => mat(GREEN, { rough: 0.78 }), strap: () => mat(GREEN, { rough: 0.85 }),
    metal: () => mat(0xd2d6d3, { metal: 1, rough: 0.36 }), panel: () => mat(SHELL, { rough: 0.48, coat: 0.55, coatRough: 0.22 }),
  },
  arang: {
    dark: true, ink: '#dfe7e2', mute: 'rgba(235,240,237,.58)', soft: 0x3a4245, hole: 0x050606, key: 0xe3e7e3, keyAlt: 0x40484b, fabric: 0x1e2224, edge: LEAF, loop: new THREE.Color(GREEN).lerp(new THREE.Color(LEAF), 0.28).getHex(), red: '#ff7a70', print: 'rgba(235,240,237,.8)',
    shell: () => mat(GRAPHITE, { rough: 0.62, coat: 0.3, coatRough: 0.4 }), band: () => mat(LEAF, { rough: 0.7 }), strap: () => mat(0x1b2021, { rough: 0.85 }),
    metal: () => mat(0x596064, { metal: 1, rough: 0.4 }), panel: () => mat(0x16191b, { rough: 0.48, coat: 0.55, coatRough: 0.22 }),
  },
};
const steel = () => mat(STEEL, { metal: 1, rough: 0.28 });
const glass = () => mat(GLASS, { rough: 0.06, coat: 1, coatRough: 0.04 });
const rubber = () => mat(RUBBER, { rough: 0.85 });

const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
const rbox = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 6, r);
const cyl = (r, h, seg = 48) => new THREE.CylinderGeometry(r, r, h, seg);

// ---- geometry helpers ----------------------------------------------------------------------------
// A rounded rectangle as points. r is one radius, or four: bottom-right, top-right, top-left, bottom-left.
function rrPoints(w, h, r, n = 14) {
  const rs = (Array.isArray(r) ? r : [r, r, r, r]).map((q) => Math.max(0.001, Math.min(q, w / 2, h / 2))), pts = [];
  [[1, -1, -PI / 2], [1, 1, 0], [-1, 1, PI / 2], [-1, -1, PI]].forEach(([sx, sy, a0], k) => {
    const q = rs[k], cx = sx * (w / 2 - q), cy = sy * (h / 2 - q);
    for (let i = 0; i <= n; i++) {
      const a = a0 + i / n * PI / 2, v = new THREE.Vector2(cx + q * Math.cos(a), cy + q * Math.sin(a)), last = pts[pts.length - 1];
      if (!last || last.distanceTo(v) > 1e-5) pts.push(v);
    }
  });
  if (pts[0].distanceTo(pts[pts.length - 1]) < 1e-5) pts.pop();
  return pts;
}
const rrShape = (w, h, r) => new THREE.Shape(rrPoints(w, h, r));
// A rounded slot or a round eye to cut out of a slab.
const hole = (x, y, w, h, r) => new THREE.Path(rrPoints(w, h, r, 8).map((v) => new THREE.Vector2(v.x + x, v.y + y)));
// Welds the vertices so the light rolls over a bevel instead of showing its facets.
function smooth(g) {
  const p = g.attributes.position, src = g.index ? g.index.array : null, n = src ? src.length : p.count;
  const seen = new Map(), pos = [], idx = [];
  for (let i = 0; i < n; i++) {
    const j = src ? src[i] : i, x = p.getX(j), y = p.getY(j), z = p.getZ(j);
    const k = Math.round(x * 4e3) + ',' + Math.round(y * 4e3) + ',' + Math.round(z * 4e3);
    let v = seen.get(k); if (v === undefined) { v = pos.length / 3; pos.push(x, y, z); seen.set(k, v); }
    idx.push(v);
  }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  o.setIndex(idx); o.computeVertexNormals(); return o;
}
// A plate w × h × d with corner radius r and its front and back edges rolled over by b. Faces +z.
function slab(w, h, d, r, b = 0.05, holes = []) {
  const rs = Array.isArray(r) ? r : [r];
  b = Math.max(0.002, Math.min(b, d / 2 - 0.001, Math.min(...rs) - 0.001));
  const s = rrShape(w - 2 * b, h - 2 * b, Array.isArray(r) ? r.map((q) => q - b) : r - b); holes.forEach((q) => s.holes.push(q));
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 6 });
  g.translate(0, 0, -(d - 2 * b) / 2); return smooth(g);
}
// The same plate lying down: faces +y, h runs front to back.
const deck = (w, h, d, r, b, holes) => slab(w, h, d, r, b, holes).rotateX(-PI / 2);
// A body of revolution around +y from [radius, y] points; zLathe points it at +z instead.
const lathe = (pts, seg = 72) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const zLathe = (pts, seg) => lathe(pts, seg).rotateX(PI / 2);
// A strap: an ellipse rx × ry in the xy plane, width along z. Width and thickness may vary along it.
// u runs along the strap and v around its section by real length, so a woven texture sits evenly.
function band(rx, ry, wf, tf, N = 200, Ms = 22) {
  const pos = [], uv = [], idx = [], R = Ms + 1;
  for (let i = 0; i <= N; i++) {
    const t = (i % N) / N * 2 * PI, ct = Math.cos(t), st = Math.sin(t);
    let nx = ry * ct, ny = rx * st; const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
    const w = typeof wf === 'function' ? wf(t) : wf, th = typeof tf === 'function' ? tf(t) : tf, run = [];
    let len = 0, ln = 0, lz = 0;
    for (let j = 0; j <= Ms; j++) {
      const u = (j % Ms) / Ms * 2 * PI, cu = Math.cos(u), su = Math.sin(u);
      const pn = th / 2 * Math.sign(cu) * Math.abs(cu) ** 0.45, pz = w / 2 * Math.sign(su) * Math.abs(su) ** 0.3;
      if (j) len += Math.hypot(pn - ln, pz - lz); run.push(len); ln = pn; lz = pz;
      pos.push(rx * ct + nx * pn, ry * st + ny * pn, pz);
    }
    run.forEach((d) => uv.push(i / N, d / len));
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < Ms; j++) {
    const a = i * R + j, b = (i + 1) * R + j, c = b + 1, d = a + 1;
    idx.push(a, d, b, b, d, c);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  // the first and last row and column are the same points, so give them the same normal
  const nrm = g.attributes.normal, va = new THREE.Vector3(), vb = new THREE.Vector3();
  const join = (a, b) => { va.fromBufferAttribute(nrm, a).add(vb.fromBufferAttribute(nrm, b)).normalize(); nrm.setXYZ(a, va.x, va.y, va.z); nrm.setXYZ(b, va.x, va.y, va.z); };
  for (let i = 0; i <= N; i++) join(i * R, i * R + Ms);
  for (let j = 0; j <= Ms; j++) join(j, N * R + j);
  return g;
}
// A knitted strap material in one colour.
function woven(color, along = 64, around = 12) {
  const t = canvasTex(64, 64, (c) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, 64, 64); c.strokeStyle = 'rgba(0,0,0,.34)'; c.lineWidth = 6;
    for (let i = -64; i < 128; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 64, 64); c.stroke(); c.beginPath(); c.moveTo(i + 64, 0); c.lineTo(i, 64); c.stroke(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(along, around);
  return new THREE.MeshPhysicalMaterial({ color, map: t, roughness: 0.95 });
}

// ---- printed and lit surfaces --------------------------------------------------------------------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const face = (w, h, tex, o = {}) => new THREE.Mesh(new THREE.PlaneGeometry(w, h),
  new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, ...o }));
const disc = (r, tex) => new THREE.Mesh(new THREE.CircleGeometry(r, 72), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
const font = (px, wt = 800) => `${wt} ${px}px "Plus Jakarta Sans", system-ui, sans-serif`;
const mono = (px, wt = 700) => `${wt} ${px}px "JetBrains Mono", ui-monospace, monospace`;

function word(text, color = '#ffffff', px = 90, wt = 800, w = 512) {
  return canvasTex(w, 128, (g, cw, h) => {
    g.fillStyle = color; g.font = font(px, wt); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, h / 2 + 4);
  });
}
// A name printed small in the shell's ink colour: the brand's unless told otherwise. Width follows its length.
function nameplate(h, ink, text = BRAND.name) {
  const w = Math.max(3, text.length * 0.62) * h;
  return face(w, h, canvasTex(Math.round(128 * w / h), 128, (g, cw) => {
    g.fillStyle = ink; g.font = font(84, 700); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, 68);
  }));
}
// Wraps a printed plate around a round body of radius R, centred on the angle th (0 faces +z).
function bent(plate, R, th) {
  const { width: w, height: h } = plate.geometry.parameters, a = w / R;
  return new THREE.Mesh(new THREE.CylinderGeometry(R, R, h, 24, 1, true, th - a / 2, a), plate.material);
}
// The brand name in spaced capitals, the way it is engraved on a metal product.
function capsPlate(h, ink) {
  const t = BRAND.name.toUpperCase(), w = (t.length * 0.86 + 1) * h;
  return face(w, h, canvasTex(Math.round(160 * w / h), 160, (g, cw) => {
    g.fillStyle = ink; g.font = font(88, 700); if ('letterSpacing' in g) g.letterSpacing = '16px';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, cw / 2 + 8, 84);
  }));
}
// Small print in the monospace face, for legends beside a key.
function legend(text, ink, h = 0.07) {
  const w = (text.length * 0.66 + 0.6) * h;
  return face(w, h, canvasTex(Math.round(128 * w / h), 128, (g, cw) => { g.fillStyle = ink; g.font = mono(92, 700); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, 68); }));
}
// A field of punched holes for a speaker, w × h in model units.
function grille(w, h, pitch = 0.075, round = false, ink = 'rgba(16,26,21,.62)') {
  const k = 256 / pitch * 0.25, cw = Math.round(w * k), ch = Math.round(h * k), cols = Math.round(w / pitch), rows = Math.round(h / pitch);
  return face(w, h, canvasTex(cw, ch, (g) => {
    g.fillStyle = ink;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) / cols, y = (r + 0.5) / rows;
      if (round && Math.hypot(x - 0.5, y - 0.5) > 0.5) continue;
      g.beginPath(); g.arc(x * cw, y * ch, cw / cols * 0.27, 0, 7); g.fill();
    }
  }));
}
// A stand-in QR code: the right look, not a real code.
function qr(g, x, y, s, n = 25, ink = '#111') {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const u = s / n; g.fillStyle = ink;
  const finder = (cx, cy) => { g.fillRect(x + cx * u, y + cy * u, 7 * u, 7 * u); g.clearRect(x + (cx + 1) * u, y + (cy + 1) * u, 5 * u, 5 * u); g.fillRect(x + (cx + 2) * u, y + (cy + 2) * u, 3 * u, 3 * u); };
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if ((r < 8 && c < 8) || (r < 8 && c >= n - 8) || (r >= n - 8 && c < 8)) continue;
    if (rnd() > 0.52) g.fillRect(x + c * u, y + r * u, u + 0.5, u + 0.5);
  }
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
}
function led(color, r = 0.035) { return mesh(new THREE.SphereGeometry(r, 16, 12), mat(color, { glow: 1.7, rough: 0.3 })); }
function lightBar(w, h, color = LEAF) { return mesh(slab(w, h, 0.02, h / 2, 0.006), mat(color, { glow: 1.5, rough: 0.3 })); }

// ---- shared parts --------------------------------------------------------------------------------
// The SOS key. A real key, not a mushroom: about a fingertip wide, sunk inside a satin guard ring.
// Faces +z. `halo` adds the status light ring that makes it findable in the dark.
function sosKey(r = 0.19, o = {}) {
  const g = new THREE.Group();
  g.add(mesh(zLathe([[r * 1.04, 0], [r * 1.36, 0], [r * 1.36, 0.03], [r * 1.3, 0.052], [r * 1.14, 0.052], [r * 1.05, 0.024], [r * 1.04, 0]]), mat(o.ring ?? STEEL, { metal: o.ring ? 0 : 1, rough: 0.34 })));
  g.add(mesh(zLathe([[r, 0], [r, 0.012], [r * 0.93, 0.028], [r * 0.7, 0.036], [0, 0.038]]), mat(SOS, { rough: 0.48, coat: 0.3, coatRough: 0.4 })));
  if (o.text !== false) { const t = face(r * 1.36, r * 0.34, word('SOS', '#ffffff', 108)); t.position.z = 0.04; g.add(t); }
  if (o.halo) { const h = mesh(new THREE.TorusGeometry(r * 1.62, 0.013, 10, 72), mat(LEAF, { glow: 1.6, rough: 0.3 })); h.scale.z = 0.5; g.add(h); }
  return g;
}
// The same key as a side key, for edges. Faces +x, runs along y, between two guard ribs.
function sosSide(len = 0.36, wid = 0.13) {
  const g = new THREE.Group();
  g.add(mesh(slab(wid, len, 0.07, wid / 2, 0.02), mat(SOS, { rough: 0.5, coat: 0.3 }), 0, 0, 0.018));
  [-1, 1].forEach((s) => g.add(mesh(slab(wid + 0.02, 0.045, 0.1, 0.02, 0.012), mat(0x3a4144, { rough: 0.6 }), 0, s * (len / 2 + 0.05), 0.015)));
  g.rotation.y = PI / 2; return g;
}
// A plain side key in the shell's own colour. Faces +x.
function sideKey(len, wid, m, dir = 1) { const k = mesh(slab(wid, len, 0.05, wid / 2, 0.016), m, 0, 0, 0.012); const g = new THREE.Group(); g.add(k); g.rotation.y = dir * PI / 2; return g; }
// The SOS key of the design B family: a slim red key let into the metal frame. Faces +x (dir 1) or -x.
function actionKey(len, wid = 0.1, dir = 1) {
  const g = new THREE.Group();
  g.add(mesh(slab(wid + 0.04, len + 0.06, 0.03, (wid + 0.04) / 2, 0.008), mat(0x101314, { rough: 0.7 }), 0, 0, -0.006));
  g.add(mesh(slab(wid, len, 0.06, wid / 2, 0.02), mat(SOS, { rough: 0.45, coat: 0.4, coatRough: 0.3 }), 0, 0, 0.012));
  g.rotation.y = dir * PI / 2; return g;
}
// USB-C socket. Faces +z; turn it to sit on an edge.
function usbC(w = 0.26) {
  const g = new THREE.Group();
  g.add(mesh(slab(w, w * 0.37, 0.02, w * 0.18, 0.004), steel()));
  g.add(mesh(slab(w * 0.86, w * 0.25, 0.022, w * 0.12, 0.004), mat(0x050606, { rough: 0.9 }), 0, 0, 0.002));
  return g;
}
// A short rubber antenna like the ones on satellite messengers. Rises along +y.
function stubby(len = 0.6, r = 0.085, accent = LEAF) {
  const g = new THREE.Group();
  g.add(mesh(cyl(r * 1.22, 0.07), steel(), 0, 0.035, 0));
  g.add(mesh(new THREE.CapsuleGeometry(r, len - r, 8, 28), rubber(), 0, 0.07 + (len - r) / 2, 0));
  g.add(mesh(cyl(r * 1.015, 0.035), mat(accent, { rough: 0.6 }), 0, 0.16, 0));
  return g;
}
// A white fibreglass outdoor antenna on a metal base. Rises along +y.
function whip(len, r = 0.045) {
  const g = new THREE.Group();
  g.add(mesh(cyl(r * 1.7, 0.2), steel(), 0, 0.1, 0));
  g.add(mesh(cyl(r, len), mat(0xeef0ec, { rough: 0.4, coat: 0.5 }), 0, 0.2 + len / 2, 0));
  g.add(mesh(new THREE.SphereGeometry(r * 1.05, 16, 12), mat(0x23292a, { rough: 0.6 }), 0, 0.2 + len, 0));
  return g;
}
function solarPanel(w, h, cols, rows) {
  const tex = canvasTex(512, Math.round(512 * h / w), (c, cw, ch) => {
    c.fillStyle = '#0b1016'; c.fillRect(0, 0, cw, ch);
    const gx = cw / cols, gy = ch / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const gr = c.createLinearGradient(i * gx, j * gy, (i + 1) * gx, (j + 1) * gy); gr.addColorStop(0, '#16263d'); gr.addColorStop(1, '#0d1726');
      c.fillStyle = gr; c.beginPath(); c.roundRect(i * gx + 3, j * gy + 3, gx - 6, gy - 6, 9); c.fill();
      c.strokeStyle = 'rgba(190,205,225,.3)'; c.lineWidth = 1.5;
      for (let k = 1; k < 5; k++) { c.beginPath(); c.moveTo(i * gx + 3, j * gy + k * gy / 5); c.lineTo((i + 1) * gx - 3, j * gy + k * gy / 5); c.stroke(); }
    }
  });
  const g = new THREE.Group();
  g.add(mesh(slab(w + 0.06, h + 0.06, 0.035, 0.05, 0.01), mat(0x14181a, { rough: 0.35, metal: 0.6 })));
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 }));
  p.position.z = 0.019; g.add(p); return g;
}

// The sRide unit on its cradle, nose toward -x and the dial at the back. Used on the helmet and on its own.
function rideUnit(f) {
  const u = new THREE.Group(), W = 2.0, H = 0.96, D = 0.44, z = D / 2, zf = z + 0.009;
  // the cradle stuck to the shell, and the clamp that hooks under the helmet's edge
  const rr = [0.18, 0.38, 0.46, 0.46];
  u.add(mesh(slab(W + 0.08, H + 0.08, 0.22, rr.map((q) => q + 0.04), 0.03), mat(0x15191a, { rough: 0.8 }), 0, 0, -z - 0.105));
  u.add(mesh(slab(0.86, 0.56, 0.05, 0.08, 0.012), steel(), 0.08, -H / 2 - 0.12, -z - 0.05));
  [-0.2, 0.36].forEach((x) => { const s = mesh(cyl(0.045, 0.02, 20), mat(0x23292a, { metal: 0.6, rough: 0.4 }), x, -H / 2 - 0.26, -z - 0.02); s.rotation.x = PI / 2; u.add(s); });
  // the unit: nose forward, dial at the back
  u.add(mesh(slab(W, H, D, rr, 0.06), f.metal()));
  u.add(mesh(slab(W - 0.1, H - 0.1, 0.03, rr.map((q) => q - 0.05), 0.01), f.panel(), 0, 0, z - 0.008));
  const dx = 0.54, lx = -0.42;
  u.add(mesh(zLathe([[0.31, 0], [0.32, 0.012], [0.31, 0.024], [0, 0.024]], 72), mat(0x101314, { rough: 0.6 }), dx, 0, z));
  u.add(mesh(new THREE.CylinderGeometry(0.28, 0.295, 0.14, 44).rotateX(PI / 2), new THREE.MeshPhysicalMaterial({ color: f.dark ? 0x70787c : 0xd2d6d3, metalness: 1, roughness: 0.34, flatShading: true }), dx, 0, z + 0.09));
  u.add(mesh(zLathe([[0, 0], [0.235, 0], [0.235, 0.012], [0.21, 0.02], [0, 0.02]], 72), glass(), dx, 0, z + 0.16));
  const dr = mesh(new THREE.TorusGeometry(0.155, 0.014, 8, 60), mat(LEAF, { glow: 1.5, rough: 0.3 }), dx, 0, z + 0.181); dr.scale.z = 0.4; u.add(dr);
  u.add(mesh(slab(0.7, 0.1, 0.02, 0.05, 0.006), glass(), lx, 0.05, z + 0.003));
  const bar = lightBar(0.4, 0.03); bar.position.set(lx, 0.05, z + 0.006); u.add(bar);
  const nm = capsPlate(0.07, f.print); nm.position.set(lx, -0.23, zf); u.add(nm);
  const k = actionKey(0.46, 0.13, 1); k.rotation.set(-PI / 2, 0, PI / 2); k.position.set(lx + 0.04, H / 2 - 0.004, 0); u.add(k);
  const lg = legend('SOS', f.red, 0.08); lg.position.set(lx + 0.04, 0.3, zf); u.add(lg);
  const p = usbC(0.2); p.rotation.x = PI / 2; p.position.set(0.44, -H / 2 + 0.004, 0); u.add(p);
  return u;
}

// ---- the devices ---------------------------------------------------------------------------------
const BUILD = {
  // sPower: a slim 10,000 mAh power bank (the shape of an Anker Nano or a Xiaomi 10000) with the radio
  // of a Heltec MeshPocket inside: LoRa, Bluetooth and Wi-Fi, a torch, a siren and one SOS key.
  spower(f) {
    const g = new THREE.Group(), W = 1.74, H = 2.96, D = 0.5, z = D / 2;
    g.add(mesh(slab(W, H, D, 0.36, 0.12), f.shell()));
    g.add(mesh(slab(W + 0.016, H + 0.016, 0.1, 0.368, 0.02), f.band()));
    // status window: battery in big digits, mesh links beside it
    g.add(mesh(slab(1.18, 0.36, 0.03, 0.18, 0.012), glass(), 0, 1.02, z));
    const st = face(1.08, 0.27, canvasTex(640, 160, (c) => {
      c.fillStyle = '#f2f6f3'; c.font = mono(112, 700); c.textBaseline = 'middle'; c.fillText('82', 14, 86);
      c.font = mono(56, 700); c.fillStyle = '#9fb0a7'; c.fillText('%', 158, 96);
      c.fillStyle = C.leaf; [0, 1, 2, 3].forEach((i) => { c.globalAlpha = i < 3 ? 1 : 0.28; c.beginPath(); c.roundRect(360 + i * 40, 104 - i * 20, 24, 24 + i * 20, 6); c.fill(); });
      c.globalAlpha = 1; c.fillStyle = '#f2f6f3'; c.font = mono(64, 700); c.fillText('12', 536, 90);
    })); st.position.set(0, 1.02, z + 0.017); g.add(st);
    const k = sosKey(0.175, { halo: true }); k.position.set(0, 0.34, z - 0.004); g.add(k);
    const gr = grille(0.98, 0.56, 0.07, false, f.dark ? 'rgba(0,0,0,.6)' : undefined); gr.position.set(0, -0.56, z + 0.002); g.add(gr);
    const nm = nameplate(0.15, f.ink); nm.position.set(0, -1.16, z + 0.003); g.add(nm);
    // top edge: torch and a short antenna
    g.add(mesh(lathe([[0.0, 0], [0.135, 0], [0.15, 0.012], [0.15, 0.034], [0.118, 0.04], [0.112, 0.022], [0, 0.022]]), steel(), -0.42, H / 2 - 0.004, 0));
    g.add(mesh(cyl(0.108, 0.01), mat(WARM, { glow: 1.5, rough: 0.2 }), -0.42, H / 2 + 0.024, 0));
    const a = stubby(0.62, 0.082); a.position.set(0.46, H / 2 - 0.01, 0); g.add(a);
    // right edge: power key. bottom edge: two USB-C and a lanyard bar
    const pk = sideKey(0.3, 0.1, mat(f.soft, { rough: 0.5 })); pk.position.set(W / 2 - 0.004, 0.62, 0); g.add(pk);
    [-0.3, 0.3].forEach((x) => { const p = usbC(0.27); p.rotation.x = PI / 2; p.position.set(x, -H / 2 + 0.004, 0); g.add(p); });
    // left edge: the built-in USB-C cable, which is also the carry loop (as on an Anker Nano)
    const loop = new THREE.CatmullRomCurve3([[0.03, 1.02], [-0.14, 1.0], [-0.27, 0.84], [-0.3, 0.6], [-0.27, 0.36], [-0.14, 0.2], [0.03, 0.18]].map(([x, y]) => new THREE.Vector3(-W / 2 + x, y, 0)));
    g.add(mesh(new THREE.TubeGeometry(loop, 60, 0.04, 14), mat(GREEN, { rough: 0.9 })));
    [1.02, 0.18].forEach((y) => { const c = mesh(cyl(0.062, 0.14, 24), mat(f.soft, { rough: 0.55 }), -W / 2 - 0.03, y, 0); c.rotation.z = PI / 2; g.add(c); });
    // back: the wireless-charging ring and the rating plate
    const ring = mesh(new THREE.TorusGeometry(0.52, 0.014, 8, 80), mat(f.soft, { rough: 0.6 }), 0, 0.42, -z); ring.scale.z = 0.4; g.add(ring);
    const plate = face(1.1, 0.5, canvasTex(660, 300, (c) => {
      c.fillStyle = f.mute; c.textAlign = 'center';
      c.font = font(40, 700); c.fillText(BRAND.name + ' ' + BRAND.devices.spower, 330, 60);
      c.font = mono(26, 500); ['10.000 mAh · 37 Wh · USB-C 20 W', 'LoRa 920–923 MHz · Bluetooth LE · Wi-Fi', 'Model konsep · bukan untuk dijual'].forEach((t, i) => c.fillText(t, 330, 126 + i * 46));
    })); plate.rotation.y = PI; plate.position.set(0, -0.86, -z - 0.003); g.add(plate);
    g.scale.setScalar(0.86); g.position.set(0.07, -0.34, 0); return g;
  },

  // sTag: a key fob the shape of a Galaxy SmartTag2 or a Tile, with the ring hole moulded into the body.
  stag(f) {
    const g = new THREE.Group(), W = 1.46, H = 2.0, D = 0.4, z = D / 2, hy = 0.62;
    const eye = () => hole(0, hy, 0.38, 0.38, 0.19);
    g.add(mesh(slab(W, H, D, 0.5, 0.11, [eye()]), f.shell()));
    g.add(mesh(slab(W + 0.016, H + 0.016, 0.08, 0.508, 0.02, [eye()]), f.band()));
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, D - 0.16, 48, 1, true).rotateX(PI / 2), mat(STEEL, { metal: 1, rough: 0.3, side: THREE.DoubleSide }), 0, hy, 0));
    [-1, 1].forEach((s) => g.add(mesh(new THREE.TorusGeometry(0.2, 0.022, 10, 48), steel(), 0, hy, s * (z - 0.085))));
    const k = sosKey(0.21); k.position.set(0, -0.16, z - 0.004); g.add(k);
    const l = led(LEAF, 0.022); l.position.set(0, 0.25, z - 0.004); g.add(l);
    const nm = nameplate(0.11, f.ink); nm.position.set(0, -0.7, z + 0.003); g.add(nm);
    const ring = mesh(new THREE.TorusGeometry(0.4, 0.024, 14, 80), steel(), 0, hy + 0.36, 0); ring.rotation.y = PI / 2.25; g.add(ring);
    const ring2 = mesh(new THREE.TorusGeometry(0.4, 0.024, 14, 80), steel(), 0.03, hy + 0.36, 0.012); ring2.rotation.y = PI / 2.25; g.add(ring2);
    const back = face(0.9, 0.34, canvasTex(540, 200, (c) => {
      c.fillStyle = f.mute; c.textAlign = 'center'; c.font = font(40, 700); c.fillText(BRAND.name + ' ' + BRAND.devices.stag, 270, 56);
      c.font = mono(26, 500); c.fillText('Bluetooth LE · CR2032', 270, 108); c.fillText('ID 3F2A', 270, 152);
    })); back.rotation.y = PI; back.position.set(0, -0.3, -z - 0.003); g.add(back);
    g.scale.setScalar(1.16); g.position.y = -0.56; return g;
  },

  // sBand: the same beacon as a wristband, the shape of a Xiaomi Smart Band without the screen.
  sband(f) {
    const g = new THREE.Group(), ry = 1.0, top = ry + 0.02;
    const taper = (t) => 0.5 + 0.12 * Math.max(0, Math.sin(t)) ** 2;
    g.add(mesh(band(1.26, ry, taper, 0.085), f.strap()));
    g.add(mesh(deck(1.32, 0.68, 0.27, 0.34, 0.1), f.shell(), 0, top + 0.1, 0));
    g.add(mesh(deck(1.336, 0.696, 0.06, 0.348, 0.014), mat(f.soft, { rough: 0.6 }), 0, top + 0.06, 0));
    const k = sosKey(0.13, { text: false }); k.rotation.x = -PI / 2; k.position.set(0.3, top + 0.232, 0); g.add(k);
    const bar = lightBar(0.34, 0.05); bar.rotation.x = -PI / 2; bar.position.set(-0.28, top + 0.236, 0); g.add(bar);
    for (let i = 0; i < 6; i++) { // strap holes and the pin
      const a = -PI / 2 + 0.22 + i * 0.13;
      const h = mesh(cyl(0.032, 0.03, 16), mat(f.hole, { rough: 0.9 }), Math.cos(a) * 1.305, Math.sin(a) * 1.04, 0); h.rotation.z = a - PI / 2; g.add(h);
    }
    const pa = -PI / 2 + 0.06; const pin = mesh(lathe([[0.062, 0], [0.062, 0.014], [0.05, 0.028], [0, 0.03]], 32), steel(), Math.cos(pa) * 1.3, Math.sin(pa) * 1.04, 0); pin.rotation.z = pa - PI / 2; g.add(pin);
    g.rotation.x = 0.52; g.scale.setScalar(1.1); g.position.y = -0.7; return g;
  },

  // sWatch: a round outdoor watch the shape of a Garmin Instinct, with the SOS key where the Apple
  // Watch Ultra keeps its action button. The screen is the app's compass to the person in trouble.
  swatch(f) {
    const g = new THREE.Group(), ry = 1.0, y0 = ry + 0.06, body = mat(f.dark ? 0x23282a : 0xe4e6e1, { rough: 0.62 }), tick = f.dark ? '223,230,226' : '38,46,42';
    g.add(mesh(band(1.2, ry, (t) => 0.6 + 0.1 * Math.max(0, Math.sin(t)) ** 3, 0.095), f.strap()));
    g.add(mesh(lathe([[0, -0.15], [0.6, -0.15], [0.7, -0.11], [0.76, -0.02], [0.76, 0.09], [0.73, 0.14], [0.56, 0.14], [0.56, 0.12], [0, 0.12]], 96), body, 0, y0, 0));
    g.add(mesh(lathe([[0.57, 0.12], [0.74, 0.12], [0.74, 0.17], [0.71, 0.2], [0.6, 0.2], [0.575, 0.165], [0.57, 0.12]], 96), mat(f.dark ? 0x4a5356 : 0xc4c9c6, { metal: 0.85, rough: 0.42 }), 0, y0, 0)); // bezel
    [-1, 1].forEach((s) => g.add(mesh(deck(0.6, 0.34, 0.2, 0.08, 0.05), body, 0, y0 - 0.05, s * 0.76))); // lugs
    const ticks = canvasTex(1024, 1024, (c) => {
      c.translate(512, 512); c.fillStyle = `rgb(${tick})`; c.font = font(62, 800); c.textAlign = 'center'; c.textBaseline = 'middle';
      for (let i = 0; i < 60; i++) { c.save(); c.rotate(i * PI / 30); c.fillStyle = i % 5 ? `rgba(${tick},.55)` : `rgb(${tick})`; c.fillRect(-3.5, -492, 7, i % 5 ? 26 : 50); c.restore(); }
      ['U', 'T', 'S', 'B'].forEach((t, i) => { c.save(); c.rotate(i * PI / 2); c.fillStyle = i ? `rgb(${tick})` : (f.dark ? '#ff8a83' : C.sos); c.clearRect(-40, -500, 80, 78); c.fillText(t, 0, -462); c.restore(); });
    });
    const bz = new THREE.Mesh(new THREE.RingGeometry(0.585, 0.725, 96), new THREE.MeshBasicMaterial({ map: ticks, transparent: true, toneMapped: false }));
    { const uv = bz.geometry.attributes.uv, p = bz.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + p.getX(i) / 1.45, 0.5 + p.getY(i) / 1.45); }
    bz.rotation.x = -PI / 2; bz.position.y = y0 + 0.202; g.add(bz);
    const scr = canvasTex(640, 640, (c) => {
      c.beginPath(); c.arc(320, 320, 320, 0, 7); c.clip(); c.fillStyle = '#050b08'; c.fillRect(0, 0, 640, 640);
      c.strokeStyle = 'rgba(127,224,164,.2)'; c.lineWidth = 3; [120, 190, 260].forEach((r) => { c.beginPath(); c.arc(320, 330, r, 0, 7); c.stroke(); });
      c.save(); c.translate(320, 330); c.rotate(-0.62); c.fillStyle = C.sos;
      c.beginPath(); c.moveTo(0, -196); c.lineTo(56, -50); c.lineTo(0, -82); c.lineTo(-56, -50); c.closePath(); c.fill(); c.restore();
      c.fillStyle = '#7fe0a4'; c.beginPath(); c.arc(320, 330, 15, 0, 7); c.fill();
      c.textAlign = 'center'; c.fillStyle = '#ff8a83'; c.font = font(36); c.fillText('SOS · SARI', 320, 108);
      c.fillStyle = '#fff'; c.font = font(104); c.fillText('259 m', 320, 520); c.fillStyle = '#9fb0a7'; c.font = font(32, 600); c.fillText('barat laut', 320, 566);
    });
    const d = disc(0.565, scr); d.rotation.x = -PI / 2; d.position.y = y0 + 0.168; g.add(d);
    const gl = mesh(new THREE.CircleGeometry(0.572, 72), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0.02, clearcoat: 1 }), 0, y0 + 0.172, 0); gl.rotation.x = -PI / 2; g.add(gl);
    const pusher = (ang, m, len = 0.2, wid = 0.1) => { const p = mesh(rbox(0.09, wid, len, 0.035), m, Math.cos(ang) * 0.785, y0 + 0.03, -Math.sin(ang) * 0.785); p.rotation.y = ang; return p; };
    g.add(pusher(0.5, steel()), pusher(-0.5, steel()), pusher(PI - 0.5, steel()));
    g.add(pusher(PI + 0.5, mat(SOS, { rough: 0.45, coat: 0.4 }), 0.3, 0.12));
    [0.5 - 0.27, 0.5 + 0.27].forEach((o) => g.add(pusher(PI + o, body, 0.05, 0.16)));
    g.rotation.x = 0.66; g.scale.setScalar(1.1); g.position.y = -0.74; return g;
  },

  // sNode: a solar repeater the shape of a RAK WisMesh Repeater Mini: the lid is the solar panel.
  snode(f) {
    const g = new THREE.Group(), box = new THREE.Group(), W = 1.5, H = 2.05, D = 0.5, z = D / 2;
    g.add(mesh(cyl(0.075, 3.4, 32), steel(), 0, -0.55, -0.62));
    box.add(mesh(slab(W, H, D, 0.2, 0.07), f.shell()));
    box.add(mesh(slab(W + 0.016, H + 0.016, 0.09, 0.208, 0.02), f.band()));
    const sp = solarPanel(1.26, 1.36, 3, 4); sp.position.set(0, 0.24, z + 0.005); box.add(sp);
    const nm = nameplate(0.12, f.ink); nm.position.set(-0.22, -0.74, z + 0.003); box.add(nm);
    const l = led(LEAF, 0.03); l.position.set(0.54, -0.74, z); box.add(l);
    const a = whip(1.0); a.position.set(0.5, H / 2 - 0.02, -0.05); box.add(a);
    const gland = mesh(cyl(0.07, 0.1, 24), mat(0x2b3133, { rough: 0.6 }), -0.4, -H / 2 - 0.03, 0); box.add(gland);
    box.rotation.x = -0.3; box.position.set(0, 0.1, 0); g.add(box);
    // bracket: a clamp on the pole and an arm to the back of the box
    g.add(mesh(rbox(0.3, 0.24, 0.5, 0.05), mat(0x8f9793, { metal: 0.9, rough: 0.4 }), 0, 0.05, -0.42));
    g.add(mesh(cyl(0.12, 0.24, 32), mat(0x8f9793, { metal: 0.9, rough: 0.4 }), 0, 0.05, -0.62));
    g.scale.setScalar(0.88); g.position.y = -0.04; return g;
  },

  // sHub: a post station you carry by its handle, the size of a lantern. The e-paper screen shows the
  // Wi-Fi code, the grille is the announcement speaker, and any phone joins from its browser.
  shub(f) {
    const g = new THREE.Group(), W = 1.9, H = 2.1, D = 1.0, z = D / 2;
    g.add(mesh(slab(W, H, D, 0.34, 0.12), f.shell()));
    g.add(mesh(slab(W + 0.016, H + 0.016, 0.12, 0.348, 0.02), f.band()));
    g.add(mesh(slab(1.56, 0.96, 0.03, 0.12, 0.012), glass(), 0, 0.4, z));
    const ep = face(1.44, 0.84, canvasTex(864, 504, (c) => {
      c.fillStyle = '#e7e5dc'; c.beginPath(); c.roundRect(0, 0, 864, 504, 26); c.fill();
      qr(c, 36, 60, 384, 25, '#15181a');
      c.fillStyle = '#15181a'; c.font = mono(30, 700); c.fillText('WI-FI POSKO', 462, 104);
      c.font = font(BRAND.wifi.length > 12 ? 50 : 60, 800); c.fillText(BRAND.wifi, 460, 178);
      c.font = font(32, 600); c.fillStyle = '#4c5350'; c.fillText('Tanpa kata sandi.', 462, 236); c.fillText('Tanpa aplikasi.', 462, 280);
      c.fillStyle = '#15181a'; c.fillRect(462, 318, 360, 3);
      c.font = font(64, 800); c.fillText('37', 462, 400); c.font = font(30, 600); c.fillStyle = '#4c5350'; c.fillText('HP tersambung', 556, 398);
      c.font = mono(24, 700); c.fillText('Baterai 76% · LoRa aktif', 462, 448);
    })); ep.position.set(0, 0.4, z + 0.017); g.add(ep);
    const gr = grille(1.5, 0.42, 0.07, false, f.dark ? 'rgba(0,0,0,.6)' : undefined); gr.position.set(0, -0.42, z + 0.002); g.add(gr);
    const nm = nameplate(0.115, f.ink); nm.position.set(-0.36, -0.84, z + 0.003); g.add(nm);
    const k = sosKey(0.12, { text: false }); k.position.set(0.62, -0.84, z - 0.004); g.add(k);
    const bar = lightBar(0.3, 0.045); bar.position.set(0.22, -0.84, z - 0.004); g.add(bar);
    // carry handle and two short antennas
    const hd = mesh(new THREE.TorusGeometry(0.56, 0.05, 14, 60, PI), f.band(), 0, H / 2 - 0.02, 0); hd.scale.set(1, 0.72, 2.4); g.add(hd);
    [-0.56, 0.56].forEach((x) => g.add(mesh(cyl(0.085, 0.06, 24), steel(), x, H / 2 + 0.01, 0)));
    [-0.72, 0.72].forEach((x) => { const a = stubby(0.7, 0.07); a.position.set(x, H / 2 - 0.02, -0.3); a.rotation.z = -x * 0.16; g.add(a); });
    [-0.3, 0.3].forEach((x) => { const p = usbC(0.24); p.rotation.y = PI; p.position.set(x, -0.7, -z - 0.002); g.add(p); });
    g.scale.setScalar(0.9); g.position.y = -0.4; g.rotation.x = 0.06; return g;
  },

  // sKom: a pocket messenger the shape of a LilyGo T-Deck or a BlackBerry: screen, keys, no SIM.
  skom(f) {
    const g = new THREE.Group(), W = 1.76, H = 3.0, D = 0.44, z = D / 2;
    g.add(mesh(slab(W, H, D, 0.32, 0.1), f.shell()));
    g.add(mesh(slab(W + 0.016, H + 0.016, 0.09, 0.328, 0.02), f.band()));
    g.add(mesh(slab(1.52, 1.24, 0.03, 0.12, 0.012), glass(), 0, 0.7, z));
    const scr = face(1.42, 1.14, canvasTex(710, 570, (c, w, h) => {
      c.fillStyle = '#f4f7f5'; c.beginPath(); c.roundRect(0, 0, w, h, 22); c.fill();
      c.fillStyle = '#7b867f'; c.font = mono(22, 700); c.fillText('LoRa · 3 lompatan', 28, 44); c.textAlign = 'right'; c.fillText('82%', w - 28, 44); c.textAlign = 'left';
      c.fillStyle = C.sos; c.beginPath(); c.roundRect(24, 66, w - 48, 104, 22); c.fill();
      c.fillStyle = '#fff'; c.font = font(38); c.fillText('SOS · Sari', 48, 114); c.font = font(26, 600); c.fillStyle = '#ffd9d6'; c.fillText('2,4 km ke barat laut · baterai 21%', 48, 150);
      c.fillStyle = '#fff'; c.strokeStyle = '#dfe6e1'; c.lineWidth = 3; c.beginPath(); c.roundRect(24, 196, 430, 92, 22); c.fill(); c.stroke();
      c.fillStyle = '#0c1610'; c.font = font(30, 600); c.fillText('Pos 2 aman, 14 orang', 46, 254);
      c.fillStyle = C.green; c.beginPath(); c.roundRect(w - 24 - 400, 312, 400, 92, 22); c.fill();
      c.fillStyle = '#fff'; c.fillText('Tim menuju lokasi', w - 24 - 376, 370);
      c.strokeStyle = '#cfd8d2'; c.beginPath(); c.roundRect(24, 462, w - 48, 78, 39); c.stroke(); c.fillStyle = '#9aa69f'; c.font = font(28, 500); c.fillText('Tulis pesan…', 56, 512);
    })); scr.position.set(0, 0.7, z + 0.017); g.add(scr);
    // navigation row and keyboard
    const keyM = mat(f.key, { rough: 0.5 }), dark = mat(f.keyAlt, { rough: 0.55 });
    g.add(mesh(slab(0.26, 0.2, 0.05, 0.06, 0.016), glass(), 0, -0.14, z + 0.006));
    [-1, 1].forEach((s) => { g.add(mesh(slab(0.3, 0.16, 0.05, 0.07, 0.016), dark, s * 0.36, -0.14, z + 0.006), mesh(slab(0.24, 0.16, 0.05, 0.07, 0.016), s < 0 ? mat(LEAF, { rough: 0.55 }) : dark, s * 0.66, -0.14, z + 0.006)); });
    const kg = slab(0.118, 0.13, 0.055, 0.04, 0.02);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 10; k++) g.add(mesh(kg, keyM, -0.648 + k * 0.144, -0.42 - r * 0.2, z + 0.004));
    [-0.576, -0.432, 0.432, 0.576].forEach((x) => g.add(mesh(kg, dark, x, -1.02, z + 0.004)));
    g.add(mesh(slab(0.69, 0.13, 0.055, 0.045, 0.02), keyM, 0, -1.02, z + 0.004));
    const nm = nameplate(0.105, f.ink); nm.position.set(0, -1.27, z + 0.003); g.add(nm);
    const sk = sosSide(0.34, 0.13); sk.position.set(W / 2 - 0.006, 0.86, 0); g.add(sk);
    const pk = sideKey(0.26, 0.1, dark); pk.position.set(W / 2 - 0.004, 0.2, 0); g.add(pk);
    const a = stubby(0.72, 0.085); a.position.set(0.5, H / 2 - 0.01, 0); g.add(a);
    const p = usbC(0.27); p.rotation.x = PI / 2; p.position.set(0, -H / 2 + 0.004, 0); g.add(p);
    g.scale.setScalar(0.84); g.position.y = -0.42; return g;
  },

  // sCard: a group ID card the shape of a SenseCAP T1000 card tracker, worn on a lanyard.
  scard(f) {
    const g = new THREE.Group(), W = 1.72, H = 2.66, D = 0.16, z = D / 2;
    const slot = () => hole(0, H / 2 - 0.2, 0.5, 0.1, 0.05);
    g.add(mesh(slab(W, H, D, 0.2, 0.05, [slot()]), f.shell()));
    g.add(mesh(slab(W + 0.014, H + 0.014, 0.045, 0.207, 0.012, [slot()]), f.band()));
    const id = face(1.5, 1.62, canvasTex(750, 810, (c, w, h) => {
      c.fillStyle = '#fff'; c.beginPath(); c.roundRect(0, 0, w, h, 34); c.fill();
      c.save(); c.beginPath(); c.roundRect(0, 0, w, h, 34); c.clip(); c.fillStyle = C.green; c.fillRect(0, 0, w, 190); c.restore();
      c.fillStyle = '#fff'; c.font = font(46, 800); c.fillText(BRAND.name, 44, 86); c.font = mono(26, 700); c.fillStyle = '#b9e5cb'; c.fillText('KARTU ROMBONGAN', 44, 138);
      c.fillStyle = '#e6ece8'; c.beginPath(); c.arc(132, 330, 88, 0, 7); c.fill();
      c.save(); c.beginPath(); c.arc(132, 330, 88, 0, 7); c.clip(); c.fillStyle = '#b6c2bb'; c.beginPath(); c.arc(132, 304, 36, 0, 7); c.fill(); c.beginPath(); c.arc(132, 420, 74, 0, 7); c.fill(); c.restore();
      c.fillStyle = '#0c1610'; c.font = font(52, 800); c.fillText('Siti Aminah', 250, 316); c.font = font(32, 600); c.fillStyle = '#5c6862'; c.fillText('Rombongan 12 · Bus B', 250, 366);
      c.fillStyle = '#eef3f0'; c.beginPath(); c.roundRect(44, 470, w - 88, 296, 26); c.fill();
      qr(c, 70, 496, 244, 21, '#0c1610');
      c.fillStyle = '#5c6862'; c.font = mono(24, 700); c.fillText('KETUA REGU', 350, 536); c.fillStyle = '#0c1610'; c.font = font(36, 700); c.fillText('Pak Hasan', 350, 584);
      c.fillStyle = '#5c6862'; c.font = mono(24, 700); c.fillText('HOTEL', 350, 652); c.fillStyle = '#0c1610'; c.font = font(36, 700); c.fillText('Al Safwah 1204', 350, 700);
    })); id.position.set(0, 0.2, z + 0.003); g.add(id);
    const k = sosKey(0.15, { text: false }); k.position.set(0.52, -0.96, z - 0.004); g.add(k);
    const bar = lightBar(0.26, 0.04); bar.position.set(0.1, -0.96, z - 0.004); g.add(bar);
    const nm = nameplate(0.12, f.ink, BRAND.devices.scard); nm.position.set(-0.52, -0.96, z + 0.003); g.add(nm);
    // lanyard: two straps that leave the frame, and the clip
    const strapM = f.strap();
    [-1, 1].forEach((s) => { const st = mesh(rbox(0.2, 1.6, 0.02, 0.008), strapM, s * 0.2, H / 2 + 0.74, s * 0.012); st.rotation.z = -s * 0.2; g.add(st); });
    g.add(mesh(rbox(0.26, 0.2, 0.05, 0.02), steel(), 0, H / 2 - 0.02, 0), mesh(rbox(0.34, 0.08, 0.06, 0.02), steel(), 0, H / 2 - 0.16, 0));
    const back = face(1.2, 0.4, canvasTex(720, 240, (c) => {
      c.fillStyle = f.mute; c.textAlign = 'center'; c.font = font(44, 700); c.fillText(BRAND.name + ' ' + BRAND.devices.scard, 360, 70);
      c.font = mono(28, 500); c.fillText('Bluetooth LE · LoRa · GPS', 360, 130); c.fillText('Isi ulang USB-C · IP65', 360, 178);
    })); back.rotation.y = PI; back.position.set(0, -0.4, -z - 0.003); g.add(back);
    g.scale.setScalar(0.86); g.position.y = -0.7; return g;
  },

  // sHome: a bedside lamp the size of a smart speaker. It lights itself when the power fails and
  // sounds when a family member presses SOS on a tag or a band.
  shome(f) {
    const g = new THREE.Group(), R = 0.86;
    g.add(mesh(lathe([[0, -0.8], [R - 0.12, -0.8], [R - 0.03, -0.77], [R, -0.69], [R, -0.02], [R - 0.02, 0], [0, 0]], 120), f.shell()));
    g.add(mesh(lathe([[R - 0.03, -0.035], [R + 0.008, -0.035], [R + 0.008, 0.035], [R - 0.03, 0.035]], 120), f.band()));
    const dome = [[R - 0.012, 0.02], [R - 0.012, 0.42]]; for (let i = 1; i <= 18; i++) { const a = i / 18 * PI / 2; dome.push([R - 0.372 + 0.36 * Math.cos(a), 0.42 + 0.36 * Math.sin(a)]); } dome.push([0, 0.78]);
    g.add(mesh(lathe(dome, 120), new THREE.MeshPhysicalMaterial({ color: 0xfff4dc, emissive: 0xffd9a0, emissiveIntensity: 0.42, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4 })));
    g.add(mesh(lathe([[0.2, 0.781], [0.2, 0.789], [0, 0.789]], 48), mat(f.soft, { rough: 0.5 })));
    const dots = grille(1.5, 0.22, 0.062, false, f.dark ? 'rgba(0,0,0,.6)' : undefined).material.map;
    g.add(mesh(new THREE.CylinderGeometry(R + 0.002, R + 0.002, 0.22, 64, 1, true, -0.85, 1.7), new THREE.MeshBasicMaterial({ map: dots, transparent: true, toneMapped: false }), 0, -0.2, 0));
    const k = sosKey(0.13, { text: false }); k.position.set(0, -0.52, R - 0.014); g.add(k);
    const at = (o, th, y) => { o.position.set(Math.sin(th) * (R + 0.003), y, Math.cos(th) * (R + 0.003)); o.rotation.y = th; g.add(o); };
    const nm = bent(nameplate(0.09, f.ink), R + 0.003, -0.58); nm.position.y = -0.52; g.add(nm);
    at(lightBar(0.2, 0.04), 0.42, -0.52);
    const p = usbC(0.24); at(p, PI, -0.5);
    g.scale.setScalar(1.14); g.position.y = -0.5; return g;
  },

  // sSirine: a village siren on a pole. A horn, a strobe, its own solar panel, and the same radio.
  ssiren(f) {
    const g = new THREE.Group(), W = 1.2, H = 1.36, D = 0.56, z = D / 2;
    g.add(mesh(cyl(0.075, 3.6, 32), steel(), 0, -0.7, -0.5));
    g.add(mesh(slab(W, H, D, 0.2, 0.08), f.shell(), 0, -0.2, 0));
    g.add(mesh(slab(W + 0.016, H + 0.016, 0.09, 0.208, 0.02), f.band(), 0, -0.2, 0));
    // horn
    const horn = new THREE.Group();
    const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([0.09 + 0.5 * t ** 2.3, t * 0.62]); }
    horn.add(mesh(lathe([...pts, [0.62, 0.64], [0.64, 0.62], [0.63, 0.58]], 96), mat(f.dark ? GRAPHITE : SHELL, { rough: 0.45, coat: 0.3, side: THREE.DoubleSide })));
    horn.add(mesh(lathe(pts.map(([r, y]) => [r * 0.97, y + 0.004]), 96), mat(0x23292a, { rough: 0.7, side: THREE.BackSide })));
    horn.add(mesh(cyl(0.12, 0.3, 32), mat(GREEN, { rough: 0.7 }), 0, -0.1, 0));
    horn.add(mesh(new THREE.SphereGeometry(0.1, 24, 16), mat(0x3a4144, { rough: 0.5 }), 0, 0.2, 0));
    horn.rotation.x = PI / 2 - 0.12; horn.position.set(0, -0.26, z + 0.16); g.add(horn);
    // strobe
    g.add(mesh(cyl(0.2, 0.1, 40), mat(0x2b3133, { rough: 0.5 }), 0, 0.53, 0));
    g.add(mesh(lathe([[0.17, 0], [0.17, 0.16], [0.15, 0.24], [0.1, 0.3], [0, 0.32]], 48), new THREE.MeshPhysicalMaterial({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 0.9, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.92 }), 0, 0.58, 0));
    // solar panel on an arm, antenna
    const sp = solarPanel(1.3, 0.8, 4, 2); sp.rotation.x = -PI / 2 + 0.5; sp.position.set(0, 1.42, -0.4); g.add(sp);
    g.add(mesh(rbox(0.2, 0.16, 0.5, 0.04), mat(0x8f9793, { metal: 0.9, rough: 0.4 }), 0, -0.2, -0.36));
    const a = whip(0.7, 0.04); a.position.set(-0.44, 0.46, -0.1); g.add(a);
    const nm = nameplate(0.085, f.ink); nm.position.set(0.02, 0.37, z + 0.003); g.add(nm);
    const l = led(LEAF, 0.028); l.position.set(0.42, 0.3, z); g.add(l);
    g.scale.setScalar(0.86); g.position.y = 0.04; return g;
  },
  // ---- design B: the same radios in a quieter, more current shell --------------------------------
  // Kept beside design A, not instead of it: a card shows it when its data-model names it, and a
  // [data-design-pick] button swaps every card that carries data-alt.
  // Shared language: a machined metal frame, flat satin panels, one black glass window, a line of
  // light, and SOS as a slim red key let into the frame, where a watch keeps its action button.

  // sPower B: a slim magnetic power bank the shape of an Anker MagGo Slim. The antenna runs inside
  // the frame as in a phone, the screen sits behind a glass visor and the torch is a strip of light.
  'spower-b'(f) {
    const g = new THREE.Group(), W = 1.7, H = 2.92, D = 0.4, z = D / 2, R = 0.32, pw = W - 0.1, ph = H - 0.1, pr = R - 0.05, zf = z + 0.009;
    g.add(mesh(slab(W, H, D, R, 0.05), f.metal()));
    [1, -1].forEach((s) => g.add(mesh(slab(pw, ph, 0.03, pr, 0.01), f.panel(), 0, 0, s * (z - 0.008))));
    // the visor: battery in big digits, the phones on the mesh beside it, a line that drains
    const vw = pw - 0.1, vh = 0.86, vy = ph / 2 - 0.05 - vh / 2;
    g.add(mesh(slab(vw, vh, 0.02, [0.08, pr - 0.05, pr - 0.05, 0.08], 0.006), glass(), 0, vy, z + 0.003));
    const st = face(vw - 0.16, vh - 0.16, canvasTex(952, 490, (c, w) => {
      c.textBaseline = 'alphabetic'; c.fillStyle = '#f4f7f5'; c.font = font(210, 700); c.fillText('82', -6, 236);
      const tw = c.measureText('82').width; c.font = font(84, 600); c.fillStyle = '#8fa097'; c.fillText('%', tw + 8, 236);
      c.font = mono(40, 700); c.fillText('BATERAI', 2, 318);
      c.textAlign = 'right'; c.fillText('HP DI MESH', w - 2, 318);
      c.fillStyle = '#f4f7f5'; c.font = font(120, 700); c.fillText('12', w, 236);
      const bx = w - c.measureText('12').width - 40; c.fillStyle = C.leaf;
      [0, 1, 2, 3].forEach((i) => { c.globalAlpha = i < 3 ? 1 : 0.3; c.beginPath(); c.roundRect(bx - (4 - i) * 38, 236 - 30 - i * 24, 26, 30 + i * 24, 7); c.fill(); });
      c.globalAlpha = 1; c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.roundRect(0, 416, w, 14, 7); c.fill();
      c.fillStyle = C.leaf; c.beginPath(); c.roundRect(0, 416, w * 0.82, 14, 7); c.fill();
    })); st.position.set(0, vy, z + 0.0145); g.add(st);
    const nm = capsPlate(0.085, f.print); nm.position.set(0, -1.13, zf); g.add(nm);
    // right edge: the SOS key, with its name beside it on the face. left edge: power
    const k = actionKey(0.46, 0.1, 1); k.position.set(W / 2 - 0.004, 0.2, 0); g.add(k);
    const lg = legend('SOS', f.red, 0.078); lg.position.set(pw / 2 - 0.16, 0.2, zf); g.add(lg);
    const pk = sideKey(0.26, 0.09, f.metal(), -1); pk.position.set(-W / 2 + 0.004, 0.5, 0); g.add(pk);
    // top edge: the torch, and a capped socket for an outside antenna when the unit serves a post.
    // Day to day the LoRa antenna is inside: the thin lines are the breaks that let the frame radiate.
    g.add(mesh(deck(0.62, 0.14, 0.02, 0.07, 0.005), mat(0x101314, { rough: 0.6 }), -0.08, H / 2 - 0.006, 0));
    g.add(mesh(deck(0.54, 0.075, 0.02, 0.037, 0.005), mat(WARM, { glow: 1.5, rough: 0.2 }), -0.08, H / 2 - 0.001, 0));
    g.add(mesh(cyl(0.078, 0.014, 28), steel(), 0.42, H / 2 + 0.002, 0), mesh(cyl(0.064, 0.036, 28), rubber(), 0.42, H / 2 + 0.018, 0));
    const line = mat(f.dark ? 0x2a2f31 : 0x9aa19d, { rough: 0.7 });
    [-1, 1].forEach((sx) => [-1, 1].forEach((sy) => g.add(mesh(new THREE.BoxGeometry(0.012, 0.018, D - 0.02), line, sx * (W / 2 - 0.0045), sy * (H / 2 - 0.42), 0))));
    // bottom edge: USB-C between two rows of speaker holes
    const p = usbC(0.25); p.rotation.x = PI / 2; p.position.set(0, -H / 2 + 0.004, 0); g.add(p);
    const dot = cyl(0.017, 0.01, 14), dm = mat(0x08090a, { rough: 0.9 });
    [-1, 1].forEach((s) => { for (let i = 0; i < 5; i++) g.add(mesh(dot, dm, s * (0.27 + i * 0.058), -H / 2 + 0.003, 0)); });
    // a pull tab with an eyelet on the left edge, for a carabiner or a cord
    g.add(mesh(slab(0.38, 0.2, 0.04, 0.1, 0.012, [hole(-0.08, 0, 0.09, 0.09, 0.045)]), mat(f.loop, { rough: 0.92 }), -W / 2 - 0.12, 1.0, 0));
    const eye = mesh(new THREE.TorusGeometry(0.054, 0.013, 10, 36), steel(), -W / 2 - 0.2, 1.0, 0); eye.scale.z = 1.7; g.add(eye);
    // back: the magnetic charging ring and the rating plate
    const ring = mesh(new THREE.TorusGeometry(0.56, 0.012, 8, 96), mat(f.soft, { rough: 0.55 }), 0, 0.46, -zf + 0.002); ring.scale.z = 0.4; g.add(ring);
    const plate = face(1.1, 0.5, canvasTex(660, 300, (c) => {
      c.fillStyle = f.mute; c.textAlign = 'center';
      c.font = font(40, 700); c.fillText(BRAND.name + ' ' + BRAND.devices.spower, 330, 60);
      c.font = mono(26, 500); ['10.000 mAh · 37 Wh · USB-C 20 W', 'LoRa 920–923 MHz · Bluetooth LE · Wi-Fi', 'Model konsep · bukan untuk dijual'].forEach((t, i) => c.fillText(t, 330, 126 + i * 46));
    })); plate.rotation.y = PI; plate.position.set(0, -0.86, -zf); g.add(plate);
    g.scale.setScalar(0.9); g.position.set(0.04, -0.1, 0); return g;
  },

  // sTag B: a slim metal tag the shape of a Tile Pro or a Pebblebee Clip, on a woven loop. SOS is a
  // squeeze of the two red keys at once, which a pocket or a bag cannot do by accident.
  'stag-b'(f) {
    const g = new THREE.Group(), W = 1.24, H = 2.2, D = 0.3, z = D / 2, R = 0.4, sy = H / 2 - 0.3, zf = z + 0.009;
    const slot = (grow = 0) => hole(0, sy, 0.5 + grow, 0.15 + grow, (0.15 + grow) / 2);
    g.add(mesh(slab(W, H, D, R, 0.05, [slot()]), f.metal()));
    [1, -1].forEach((s) => g.add(mesh(slab(W - 0.1, H - 0.1, 0.03, R - 0.05, 0.01, [slot(0.07)]), f.panel(), 0, 0, s * (z - 0.008))));
    g.add(mesh(slab(0.4, 0.1, 0.02, 0.05, 0.006), glass(), 0, 0.5, z + 0.003));
    const bar = lightBar(0.2, 0.028); bar.position.set(0, 0.5, z + 0.006); g.add(bar);
    const lg = face(1.0, 0.12, canvasTex(920, 110, (c) => {
      c.fillStyle = c.strokeStyle = f.red; c.font = mono(74, 700); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SOS', 460, 60);
      c.lineWidth = 6; c.lineCap = 'round'; [[30, 340], [580, 890]].forEach(([a, b]) => { c.beginPath(); c.moveTo(a, 55); c.lineTo(b, 55); c.stroke(); });
    })); lg.position.set(0, -0.36, zf); g.add(lg);
    [1, -1].forEach((s) => { const k = actionKey(0.42, 0.1, s); k.position.set(s * (W / 2 - 0.004), -0.36, 0); g.add(k); });
    const nm = capsPlate(0.062, f.print); nm.position.set(0, -0.8, zf); g.add(nm);
    // the loop through the slot and the split ring through the loop
    g.add(mesh(band(0.27, 0.34, 0.4, 0.028, 120, 14).rotateY(PI / 2), woven(f.loop, 20, 6), 0, sy + 0.34, 0));
    [0, 1].forEach((i) => { const r = mesh(new THREE.TorusGeometry(0.26, 0.02, 12, 72), steel(), i * 0.02, sy + 0.89, i * 0.014); r.rotation.y = 0.5; g.add(r); });
    const back = face(0.9, 0.34, canvasTex(540, 200, (c) => {
      c.fillStyle = f.mute; c.textAlign = 'center'; c.font = font(40, 700); c.fillText(BRAND.name + ' ' + (BRAND.devices.stagslim || BRAND.devices.stag), 270, 56);
      c.font = mono(26, 500); c.fillText('Bluetooth LE · CR2032', 270, 108); c.fillText('ID 3F2A', 270, 152);
    })); back.rotation.y = PI; back.position.set(0, -0.2, -zf); g.add(back);
    g.scale.setScalar(0.98); g.position.y = -0.52; return g;
  },

  // sTag C: a pebble with its own loop, the shape of a Chipolo Loop or a Pebblebee Clip, so it hangs
  // on a bag, a belt loop or a bunch of keys with no extra ring. The whole face is the SOS key: it
  // sits level with the panel inside a thin red ring, easy to find by touch and quiet to look at.
  'stag-c'(f) {
    const g = new THREE.Group(), W = 1.5, H = 1.6, D = 0.36, z = D / 2, R = 0.46, zf = z + 0.009, ky = 0.06, kr = 0.4;
    g.add(mesh(slab(W, H, D, R, 0.06), f.metal()));
    g.add(mesh(slab(W - 0.12, H - 0.12, 0.03, R - 0.06, 0.01, [hole(0, ky, kr * 2, kr * 2, kr)]), f.panel(), 0, 0, z - 0.008));
    g.add(mesh(slab(W - 0.12, H - 0.12, 0.03, R - 0.06, 0.01), f.panel(), 0, 0, -z + 0.008));
    // the key in its well: a red ring that lights, and a cap dished for the thumb
    g.add(mesh(new THREE.RingGeometry(kr - 0.06, kr + 0.004, 72), mat(SOS, { glow: 0.85, rough: 0.4 }), 0, ky, z + 0.0012));
    const kc = kr - 0.034;
    g.add(mesh(zLathe([[kc, 0], [kc, 0.005], [kc * 0.965, 0.0095], [kc * 0.6, 0.005], [0, 0.0035]], 72), f.panel(), 0, ky, z));
    const lg = legend('SOS', f.red, 0.11); lg.position.set(0, ky, z + 0.012); g.add(lg);
    g.add(mesh(slab(0.3, 0.085, 0.02, 0.042, 0.006), glass(), 0, 0.6, z + 0.003));
    const bar = lightBar(0.15, 0.024); bar.position.set(0, 0.6, z + 0.006); g.add(bar);
    const nm = capsPlate(0.06, f.print); nm.position.set(0, -0.565, zf); g.add(nm);
    // the loop: a soft cord moulded into the body on the left, closed by a metal stud on the right
    const sx = 0.45, y0 = H / 2 - 0.1, y1 = H / 2 + 0.07, ry = 0.36, pts = [];
    for (let i = 0; i <= 4; i++) pts.push(new THREE.Vector3(-sx, y0 + (y1 - y0) * i / 4, 0));
    for (let i = 1; i < 28; i++) { const a = PI - i / 28 * PI; pts.push(new THREE.Vector3(Math.cos(a) * sx, y1 + Math.sin(a) * ry, 0)); }
    for (let i = 4; i >= 0; i--) pts.push(new THREE.Vector3(sx, y0 + (y1 - y0) * i / 4, 0));
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.056, 20), mat(f.loop, { rough: 0.88 })));
    g.add(mesh(cyl(0.082, 0.07, 28), f.metal(), -sx, H / 2 + 0.03, 0), mesh(cyl(0.082, 0.13, 28), steel(), sx, H / 2 + 0.06, 0));
    const back = face(0.9, 0.34, canvasTex(540, 200, (c) => {
      c.fillStyle = f.mute; c.textAlign = 'center'; c.font = font(40, 700); c.fillText(BRAND.name + ' ' + BRAND.devices.stag, 270, 56);
      c.font = mono(26, 500); c.fillText('Bluetooth LE · CR2032', 270, 108); c.fillText('ID 3F2A', 270, 152);
    })); back.rotation.y = PI; back.position.set(0, -0.1, -zf); g.add(back);
    g.scale.setScalar(1.2); g.position.y = -0.64; return g;
  },

  // sBand B: a knitted strap and a slim metal pod, the shape of a WHOOP or an Amazfit Helio Strap.
  // No screen to scratch or charge every night: a line of light, and the SOS key on the pod's side.
  'sband-b'(f) {
    const g = new THREE.Group(), rx = 1.25, ry = 1.0, py = ry + 0.075;
    g.add(mesh(band(rx, ry, 0.6, 0.07), woven(f.fabric)));
    [-1, 1].forEach((s) => g.add(mesh(band(rx + 0.002, ry + 0.002, 0.026, 0.07, 200, 10), mat(f.loop, { rough: 0.9 }), 0, 0, s * 0.225)));
    g.add(mesh(deck(1.0, 0.68, 0.2, 0.2, 0.05), f.metal(), 0, py, 0));
    g.add(mesh(deck(0.9, 0.58, 0.03, 0.15, 0.01), glass(), 0, py + 0.092, 0));
    const bar = lightBar(0.3, 0.03); bar.rotation.x = -PI / 2; bar.position.set(0, py + 0.1, -0.1); g.add(bar);
    const nm = capsPlate(0.056, 'rgba(235,240,237,.82)'); nm.rotation.x = -PI / 2; nm.position.set(0, py + 0.109, 0.11); g.add(nm);
    const k = actionKey(0.34, 0.08, 1); k.rotation.set(0, 0, PI / 2); k.position.set(0.16, py, 0.336); g.add(k);
    g.add(mesh(deck(0.36, 0.7, 0.14, 0.05, 0.022), f.metal(), 0, -ry, 0)); // clasp
    g.add(mesh(new THREE.BoxGeometry(0.014, 0.146, 0.5), mat(0x101314, { rough: 0.7 }), 0, -ry, 0));
    g.rotation.x = 0.52; g.scale.setScalar(1.1); g.position.y = -0.7; return g;
  },

  // ---- everyday devices --------------------------------------------------------------------------
  // Things people buy for another reason and use every day. Each one is also a hop on the mesh, so
  // the network grows while nobody is thinking about emergencies. They wear the design B language.

  // sGate: the reader at a school gate, the size of a door-entry panel. It hears a child's sCard as
  // the child walks through (Bluetooth, the way a campus gateway hears a badge), so nobody taps or
  // queues. The ring turns green, the screen counts who is in, and the parents' phones get the word.
  sgate(f) {
    const g = new THREE.Group(), W = 1.36, H = 2.56, D = 0.36, z = D / 2, R = 0.44, pw = W - 0.1, ph = H - 0.1, pr = R - 0.05, zf = z + 0.009;
    // the gate post it is screwed to, and its mounting plate
    g.add(mesh(rbox(0.56, 4.4, 0.56, 0.06), mat(f.dark ? 0xb4bab6 : 0x4b5356, { metal: 0.7, rough: 0.5 }), 0, -0.8, -z - 0.4));
    g.add(mesh(slab(W - 0.36, H - 0.6, 0.14, 0.18, 0.03), mat(0x1c2122, { rough: 0.75 }), 0, 0, -z - 0.06));
    g.add(mesh(slab(W, H, D, R, 0.05), f.metal()));
    [1, -1].forEach((s) => g.add(mesh(slab(pw, ph, 0.03, pr, 0.01), f.panel(), 0, 0, s * (z - 0.008))));
    // the visor: how many are in, and the child who just came through
    const vw = pw - 0.1, vh = 0.9, vy = ph / 2 - 0.05 - vh / 2;
    g.add(mesh(slab(vw, vh, 0.02, [0.08, pr - 0.05, pr - 0.05, 0.08], 0.006), glass(), 0, vy, z + 0.003));
    const st = face(vw - 0.14, vh - 0.14, canvasTex(760, 566, (c, w) => {
      c.textBaseline = 'alphabetic'; c.fillStyle = '#8fa097'; c.font = mono(40, 700); c.fillText('GERBANG 1', 0, 44);
      c.textAlign = 'right'; c.fillStyle = '#f4f7f5'; c.fillText('06.52', w, 44); c.textAlign = 'left';
      c.font = font(196, 700); c.fillText('312', -6, 280);
      const tw = c.measureText('312').width; c.font = font(76, 600); c.fillStyle = '#8fa097'; c.fillText('/340', tw + 8, 280);
      c.font = mono(40, 700); c.fillText('SUDAH MASUK', 2, 350);
      c.fillStyle = 'rgba(127,224,164,.16)'; c.beginPath(); c.roundRect(0, 416, w, 136, 44); c.fill();
      c.fillStyle = C.leaf; c.beginPath(); c.arc(70, 484, 40, 0, 7); c.fill();
      c.strokeStyle = '#06110b'; c.lineWidth = 11; c.lineCap = c.lineJoin = 'round'; c.beginPath(); c.moveTo(51, 486); c.lineTo(65, 500); c.lineTo(91, 468); c.stroke();
      c.fillStyle = '#f4f7f5'; c.font = font(62, 700); c.fillText('Rania · 4B', 136, 506);
    })); st.position.set(0, vy, z + 0.0145); g.add(st);
    // the reading ring: green as a card passes
    const ry = -0.22, rr = 0.33;
    g.add(mesh(zLathe([[0, 0], [rr, 0], [rr, 0.008], [0, 0.008]], 72), glass(), 0, ry, z + 0.002));
    const halo = mesh(new THREE.TorusGeometry(rr + 0.04, 0.017, 10, 80), mat(LEAF, { glow: 1.6, rough: 0.3 }), 0, ry, z + 0.006); halo.scale.z = 0.5; g.add(halo);
    const ic = face(0.44, 0.44, canvasTex(256, 256, (c) => {
      c.strokeStyle = '#e4ebe7'; c.lineWidth = 11; c.lineCap = 'round';
      c.beginPath(); c.roundRect(36, 86, 104, 84, 14); c.stroke(); c.beginPath(); c.moveTo(58, 146); c.lineTo(96, 146); c.stroke();
      [34, 60, 86].forEach((r) => { c.beginPath(); c.arc(138, 128, r, -0.62, 0.62); c.stroke(); });
    })); ic.position.set(0.02, ry, z + 0.012); g.add(ic);
    // speaker, the guard's SOS key beside it, the name
    const gr = grille(0.62, 0.2, 0.062, false, f.dark ? 'rgba(0,0,0,.62)' : undefined); gr.position.set(-0.1, -0.84, zf); g.add(gr);
    const k = actionKey(0.4, 0.1, 1); k.position.set(W / 2 - 0.004, -0.84, 0); g.add(k);
    const lg = legend('SOS', f.red, 0.07); lg.position.set(pw / 2 - 0.15, -0.84, zf); g.add(lg);
    const nm = capsPlate(0.066, f.print); nm.position.set(0, -1.08, zf); g.add(nm);
    // top: the antenna that reaches the next hop. bottom: the cable gland
    const a = stubby(0.52, 0.07); a.position.set(0.36, H / 2 - 0.01, 0); g.add(a);
    g.add(mesh(cyl(0.07, 0.12, 24), mat(0x23292a, { rough: 0.6 }), 0, -H / 2 - 0.04, -0.04));
    const back = face(1.0, 0.42, canvasTex(600, 252, (c) => {
      c.fillStyle = f.mute; c.textAlign = 'center'; c.font = font(40, 700); c.fillText(BRAND.name + ' ' + BRAND.devices.sgate, 300, 60);
      c.font = mono(26, 500); ['Bluetooth LE · LoRa · Wi-Fi', 'Listrik 5 V atau PoE · IP65'].forEach((t, i) => c.fillText(t, 300, 122 + i * 46));
    })); back.rotation.y = PI; back.position.set(0, 0.94, -zf); g.add(back);
    g.scale.setScalar(0.88); g.position.set(0, -0.2, 0); return g;
  },

  // sTalk: a talk key on a clip, the size of a hockey puck. Like a Milo communicator or the shoulder
  // microphone of a guard's radio: press and talk to the group while the phone stays in the pocket.
  stalk(f) {
    const g = new THREE.Group(), W = 1.44, H = 2.36, D = 0.46, z = D / 2, R = 0.56, zf = z + 0.009, ky = -0.42, kr = 0.47;
    g.add(mesh(slab(W, H, D, R, 0.07), f.metal()));
    g.add(mesh(slab(W - 0.12, H - 0.12, 0.03, R - 0.06, 0.01, [hole(0, ky, kr * 2, kr * 2, kr)]), f.panel(), 0, 0, z - 0.008));
    g.add(mesh(slab(W - 0.12, H - 0.12, 0.03, R - 0.06, 0.01), f.panel(), 0, 0, -z + 0.008));
    // speaker, and the line that lights while the group is talking
    const gr = grille(0.7, 0.5, 0.07, false, f.dark ? 'rgba(0,0,0,.62)' : undefined); gr.position.set(0, 0.66, zf); g.add(gr);
    g.add(mesh(slab(0.34, 0.085, 0.02, 0.042, 0.006), glass(), 0, 0.22, z + 0.003));
    const bar = lightBar(0.18, 0.024); bar.position.set(0, 0.22, z + 0.006); g.add(bar);
    // the talk key: half the face, dished for the thumb, inside a ring that lights green
    g.add(mesh(new THREE.RingGeometry(kr - 0.058, kr + 0.004, 72), mat(LEAF, { glow: 0.95, rough: 0.4 }), 0, ky, z + 0.0012));
    const kc = kr - 0.034;
    g.add(mesh(zLathe([[kc, 0], [kc, 0.016], [kc * 0.955, 0.034], [kc * 0.6, 0.018], [0, 0.012]], 72), mat(f.dark ? 0x30373a : 0x22282a, { rough: 0.82 }), 0, ky, z - 0.004));
    const mic = face(0.42, 0.42, canvasTex(256, 256, (c) => {
      c.fillStyle = c.strokeStyle = '#e9efeb'; c.lineWidth = 13; c.lineCap = 'round';
      c.beginPath(); c.roundRect(101, 40, 54, 104, 27); c.fill();
      c.beginPath(); c.arc(128, 112, 56, 0.08 * PI, 0.92 * PI); c.stroke();
      c.beginPath(); c.moveTo(128, 170); c.lineTo(128, 208); c.moveTo(96, 210); c.lineTo(160, 210); c.stroke();
    })); mic.position.set(0, ky, z + 0.024); g.add(mic);
    const nm = capsPlate(0.056, f.print); nm.position.set(0, -1.02, zf); g.add(nm);
    // right edge: SOS. left edge: volume up and down. bottom: USB-C
    const k = actionKey(0.4, 0.1, 1); k.position.set(W / 2 - 0.004, 0.22, 0); g.add(k);
    const lg = legend('SOS', f.red, 0.068); lg.position.set(W / 2 - 0.21, 0.22, zf); g.add(lg);
    [0.36, 0.06].forEach((y) => { const v = sideKey(0.22, 0.09, f.metal(), -1); v.position.set(-W / 2 + 0.004, y, 0); g.add(v); });
    const p = usbC(0.22); p.rotation.x = PI / 2; p.position.set(0, -H / 2 + 0.004, 0); g.add(p);
    // back: the spring clip for a collar, a strap or a handlebar
    g.add(mesh(slab(0.84, 0.36, 0.1, 0.12, 0.025), mat(0x1c2122, { rough: 0.75 }), 0, 0.7, -z - 0.04));
    const hinge = mesh(cyl(0.07, 0.9, 24), steel(), 0, 0.7, -z - 0.1); hinge.rotation.z = PI / 2; g.add(hinge);
    g.add(mesh(slab(0.7, 1.46, 0.05, 0.22, 0.014), f.metal(), 0, 0.0, -z - 0.13));
    const lip = mesh(slab(0.7, 0.24, 0.05, 0.1, 0.014), f.metal(), 0, -0.8, -z - 0.175); lip.rotation.x = 0.42; g.add(lip);
    g.scale.setScalar(1.0); g.position.y = -0.42; return g;
  },

  // sRide: a helmet intercom of the slim, antenna-less kind (Cardo Packtalk Edge, Sena 50S), drawn at
  // their size: about 86 x 42 x 20 mm on a helmet 35 cm long. It snaps onto a cradle clamped to the
  // helmet's edge and its dial is worked with a gloved hand; the microphone and the speakers sit
  // inside the helmet. Shown on a full-face helmet.
  sride(f) {
    const g = new THREE.Group(), hel = new THREE.Group(), u = rideUnit(f), HR = 1.24, CUT = 0.8 * PI;
    // The shell, front toward -x. P(ph, th) is a point on it: ph turns from the front toward the
    // rider's left, th runs from the crown down. Above the brow line it is a dome; below, a skirt
    // that keeps curving in at the sides, tucks in further at the nape, and at the front drops
    // nearly straight into a chin bar that ends lower than the back.
    const P = (ph, th, lift = 0) => {
      const cf = Math.cos(ph), sf = Math.sin(ph), t = (th - PI / 2) / (CUT - PI / 2);
      const rad = th <= PI / 2 ? Math.sin(th) : Math.sqrt(1 - ((0.52 - 0.2 * cf) * t) ** 2) * (1 + 0.05 * Math.max(cf, 0) ** 2 * t * t), y = th <= PI / 2 ? 0.98 * Math.cos(th) : -(0.86 + 0.07 * cf) * t;
      const q = new THREE.Vector3(-HR * (1.3 + 0.03 * cf) * rad * cf, HR * y, HR * 0.97 * rad * sf);
      return lift ? q.addScaledVector(N(ph, th), lift) : q;
    };
    const N = (ph, th) => (th < 0.03 ? new THREE.Vector3(0, 1, 0) : P(ph, th + 0.004).sub(P(ph, th - 0.004)).cross(P(ph + 0.004, th).sub(P(ph - 0.004, th))).normalize());
    // lays a shape modelled on a unit sphere onto the shell
    const wrap = (geo) => {
      const p = geo.attributes.position, n = geo.attributes.normal, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i); const r = v.length(), th = Math.acos(Math.max(-1, Math.min(1, v.y / r))), ph = Math.atan2(v.z, -v.x);
        const q = P(ph, th, (r - 1) * HR), m = N(ph, th); p.setXYZ(i, q.x, q.y, q.z); n.setXYZ(i, m.x, m.y, m.z);
      }
      return geo;
    };
    const on = (o, ph, th, lift = 0) => { const q = P(ph, th, lift); o.position.copy(q); o.lookAt(q.clone().add(N(ph, th))); hel.add(o); return o; };
    const grid = (nu, nv, at) => {
      const pos = [], idx = [];
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const q = at(i / nu, j / nv); pos.push(q.x, q.y, q.z); }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.slice(), 3)); geo.setIndex(idx); return geo;
    };
    const lac = mat(f.dark ? 0xe6e8e3 : 0x2c3336, { rough: 0.34, coat: 1, coatRough: 0.1 }), dark = () => mat(0x0c0e0f, { rough: 0.8 });
    hel.add(mesh(wrap(new THREE.SphereGeometry(1, 128, 80, 0, 2 * PI, 0, CUT)), lac));
    // the rubber edge and the dark of the opening
    const rim = []; for (let i = 0; i < 96; i++) rim.push(P(i / 96 * 2 * PI, CUT, -0.02));
    hel.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 240, 0.06, 12, true), rubber()));
    const fan = [0, -HR * 0.8, 0], fi = []; rim.forEach((q, i) => { fan.push(q.x * 0.97, q.y + 0.02, q.z * 0.97); fi.push(0, i + 1, (i + 1) % 96 + 1); });
    const hole = new THREE.BufferGeometry(); hole.setAttribute('position', new THREE.Float32BufferAttribute(fan, 3)); hole.setIndex(fi);
    hel.add(new THREE.Mesh(hole, new THREE.MeshBasicMaterial({ color: 0x070808, side: THREE.DoubleSide })));
    // The visor: a band that wraps from pivot to pivot and narrows toward them. q runs across it
    // (-1 to 1), t from its top edge (-1) to its bottom edge (1).
    const va = 1.36, vis = (q, t, lift) => P(q * va, (0.452 + 0.012 * q * q + (0.118 - 0.034 * q * q) * Math.pow(1 - Math.pow(Math.abs(q), 5), 0.2) * t) * PI, lift);
    const vg = grid(96, 24, (a, b) => { const q = vis(a * 2 - 1, b * 2 - 1, 0.016); return q; }); vg.computeVertexNormals();
    hel.add(mesh(vg, mat(GLASS, { rough: 0.04, coat: 1, coatRough: 0.03, side: THREE.DoubleSide })));
    const edge = [], NE = 60;
    for (let i = 0; i <= NE; i++) edge.push(vis(-Math.cos(PI * i / NE), -1, 0.014));
    for (let i = 1; i < NE; i++) edge.push(vis(Math.cos(PI * i / NE), 1, 0.014));
    hel.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, true, 'catmullrom', 0.1), 420, 0.024, 10, true), rubber()));
    [1, -1].forEach((s) => {
      const ph = s * 0.93 * va, th = (0.452 + 0.012 * 0.865) * PI;
      on(mesh(zLathe([[0, 0], [0.16, 0], [0.16, 0.018], [0.14, 0.04], [0, 0.04]], 48), mat(0x15191a, { rough: 0.6 })), ph, th, 0.012);
      on(mesh(zLathe([[0, 0], [0.055, 0], [0.055, 0.008], [0, 0.012]], 32), steel()), ph, th, 0.052);
    });
    // vents: the chin, the brow, the exhaust at the back
    on(mesh(slab(0.4, 0.085, 0.04, 0.042, 0.01), dark()), 0, 0.69 * PI, -0.004);
    [-0.5, 0.5].forEach((ph) => on(mesh(slab(0.26, 0.065, 0.04, 0.032, 0.008), dark()), ph, 0.665 * PI, -0.004));
    [-0.3, 0.3].forEach((ph) => on(mesh(slab(0.3, 0.075, 0.04, 0.037, 0.01), dark()), ph, 0.2 * PI, -0.004));
    on(mesh(slab(0.5, 0.07, 0.04, 0.035, 0.01), dark()), PI, 0.34 * PI, -0.004);
    // a stripe over the crown, from above the visor to the nape
    const b0 = 0.185 * PI, b1 = 1.275 * PI;
    hel.add(mesh(wrap(grid(160, 2, (a, b) => { const be = b0 + (b1 - b0) * a; return new THREE.Vector3(-Math.cos(be), Math.sin(be), (b - 0.5) * 0.1).normalize().multiplyScalar(1.004); })), mat(LEAF, { rough: 0.4, coat: 0.8, coatRough: 0.15, side: THREE.DoubleSide })));
    g.add(hel);
    // on the helmet's left side, low, just behind the chin bar
    const up = PI / 2 - 0.1, ut = 0.716 * PI, q0 = P(up, ut, 0.158);
    u.scale.setScalar(0.395); u.position.copy(q0); u.lookAt(q0.clone().add(N(up, ut))); g.add(u);
    g.scale.setScalar(0.9); g.position.set(0.02, -0.16, 0); return g;
  },

  // sRide off the helmet: the unit on its cradle, and under it what goes inside the helmet. Two flat
  // 40 mm speakers for the ear pockets and the microphone on its boom, each on a thin lead.
  'sride-u'(f) {
    const g = new THREE.Group(), u = rideUnit(f), pad = () => mat(0x15191a, { rough: 0.8 });
    const lead = (pts, r = 0.02) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(q[0], q[1], q[2] ?? -0.1))), 64, r, 8), rubber());
    u.scale.setScalar(1.2); u.position.set(0, 0.7, 0); g.add(u);
    [-1.0, -0.2].forEach((x, i) => {
      g.add(mesh(zLathe([[0, 0], [0.33, 0], [0.34, 0.03], [0.31, 0.075], [0, 0.075]], 64), pad(), x, -0.8, -0.1));
      const gr = grille(0.5, 0.5, 0.05, true, 'rgba(255,255,255,.17)'); gr.position.set(x, -0.8, -0.022); g.add(gr);
      g.add(lead([[-0.12 + i * 0.16, -0.28], [x * 0.55 - 0.06, -0.36], [x, -0.46]]));
    });
    g.add(lead([[0.42, -0.28, -0.06], [0.66, -0.4, -0.02], [0.92, -0.62, 0], [1.02, -0.84, 0]], 0.032));
    const foam = mesh(new THREE.SphereGeometry(0.13, 28, 18), mat(0x0f1213, { rough: 1 }), 1.03, -0.9, 0); foam.scale.set(0.9, 1.25, 0.9); g.add(foam);
    g.position.set(0, -0.36, 0); return g;
  },

  // sLamp: an all-in-one solar street light, the kind a village already buys (Philips SunStay,
  // SmartBright): the lid is the panel, the battery is inside, the lamp is underneath. The repeater
  // rides in the head, so every lamp post is a hop, at the best height there is.
  slamp(f) {
    const g = new THREE.Group(), head = new THREE.Group(), W = 2.2, L = 1.0, T = 0.2, px = -1.16, grey = () => mat(0x8f9793, { metal: 0.9, rough: 0.4 });
    g.add(mesh(cyl(0.09, 4.2, 32), steel(), px, -0.95, 0));
    g.add(mesh(cyl(0.13, 0.34, 32), grey(), px, 0.98, 0));
    const arm = mesh(cyl(0.065, 0.56, 24), grey(), px + 0.26, 0.98, 0); arm.rotation.z = PI / 2; g.add(arm);
    const a = whip(0.5, 0.036); a.position.set(px, 1.1, 0); g.add(a);
    head.add(mesh(deck(W, L, T, 0.2, 0.05), f.shell()));
    head.add(mesh(deck(W + 0.016, L + 0.016, 0.055, 0.208, 0.016), f.band()));
    const sp = solarPanel(W - 0.3, L - 0.44, 6, 2); sp.rotation.x = -PI / 2; sp.position.set(0, T / 2 - 0.012, -0.075); head.add(sp);
    const nm = capsPlate(0.06, f.print); nm.rotation.x = -PI / 2; nm.position.set(-0.36, T / 2 + 0.003, L / 2 - 0.16); head.add(nm);
    const bar = lightBar(0.3, 0.032); bar.rotation.x = -PI / 2; bar.position.set(0.72, T / 2 - 0.004, L / 2 - 0.16); head.add(bar);
    // underneath: the lamp and the motion sensor
    head.add(mesh(deck(1.5, 0.7, 0.04, 0.2, 0.012), mat(0x0b0d0e, { rough: 0.3, coat: 1 }), 0.24, -T / 2 - 0.004, 0));
    head.add(mesh(deck(1.34, 0.54, 0.09, 0.2, 0.03), mat(WARM, { glow: 1.7, rough: 0.2 }), 0.24, -T / 2 - 0.03, 0));
    head.add(mesh(new THREE.SphereGeometry(0.075, 24, 16), mat(0x15191a, { rough: 0.25, coat: 1 }), -0.74, -T / 2 - 0.01, 0));
    head.rotation.x = 0.4; head.position.set(px + 0.5 + W / 2, 0.98, 0.06); g.add(head);
    // the light it throws
    const lx = head.position.x + 0.24, top = 0.84, floor = -1.56;
    const beam = canvasTex(8, 256, (c) => { const gr = c.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,226,170,.24)'); gr.addColorStop(1, 'rgba(255,226,170,0)'); c.fillStyle = gr; c.fillRect(0, 0, 8, 256); });
    g.add(mesh(new THREE.CylinderGeometry(0.36, 1.2, top - floor, 64, 1, true), new THREE.MeshBasicMaterial({ map: beam, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }), lx, (top + floor) / 2, 0));
    const pool = face(2.5, 2.5, canvasTex(256, 256, (c) => { const gr = c.createRadialGradient(128, 128, 6, 128, 128, 128); gr.addColorStop(0, 'rgba(255,226,170,.5)'); gr.addColorStop(1, 'rgba(255,226,170,0)'); c.fillStyle = gr; c.fillRect(0, 0, 256, 256); }), { depthWrite: false, blending: THREE.AdditiveBlending });
    pool.rotation.x = -PI / 2; pool.position.set(lx, floor, 0); g.add(pool);
    g.scale.setScalar(0.92); g.position.set(-0.08, -0.16, 0); return g;
  },

  // sSense: the home sensors. A gas detector the size of an Aqara, and a door sensor in two parts.
  // They sound in the house and on the phones of the family and the nearest neighbours, with no
  // internet. LPG is heavier than air, so this one goes low on the kitchen wall; the smoke detector
  // is the same shell on the ceiling.
  ssense(f) {
    const g = new THREE.Group(), R = 0.86, D = 0.36, z = D / 2, zf = z + 0.009, px = -0.5;
    const prof = [[0, -z]]; for (let i = 0; i <= 8; i++) { const t = i / 8 * PI / 2; prof.push([R - 0.07 + 0.07 * Math.sin(t), -z + 0.07 - 0.07 * Math.cos(t)]); }
    for (let i = 0; i <= 8; i++) { const t = i / 8 * PI / 2; prof.push([R - 0.07 + 0.07 * Math.cos(t), z - 0.07 + 0.07 * Math.sin(t)]); } prof.push([0, z]);
    g.add(mesh(zLathe(prof, 120), f.metal(), px, 0, 0));
    g.add(mesh(zLathe([[0, 0], [R - 0.07, 0], [R - 0.07, 0.012], [R - 0.08, 0.02], [0, 0.02]], 120), f.panel(), px, 0, z - 0.012));
    // the vents the air comes in through
    const vents = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 96), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, map: canvasTex(1024, 1024, (c) => {
      c.translate(512, 512); c.fillStyle = f.dark ? 'rgba(0,0,0,.66)' : 'rgba(16,26,21,.6)';
      for (let i = 0; i < 40; i++) { c.save(); c.rotate(i * PI / 20); c.beginPath(); c.roundRect(-9, -496, 18, 150, 9); c.fill(); c.restore(); }
    }) }));
    { const uv = vents.geometry.attributes.uv, p = vents.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + p.getX(i) / 1.5, 0.5 + p.getY(i) / 1.5); }
    vents.position.set(px, 0, zf); g.add(vents);
    // the test key in the middle, inside the ring that is green when the air is clean
    const kr = 0.24;
    g.add(mesh(zLathe([[0, 0], [kr + 0.05, 0], [kr + 0.05, 0.008], [0, 0.008]], 72), glass(), px, 0, zf - 0.004));
    const halo = mesh(new THREE.TorusGeometry(kr, 0.016, 10, 72), mat(LEAF, { glow: 1.6, rough: 0.3 }), px, 0, zf + 0.004); halo.scale.z = 0.5; g.add(halo);
    const lg = legend('UJI', '#e4ebe7', 0.085); lg.position.set(px, 0, zf + 0.008); g.add(lg);
    const tp = legend('GAS LPG', f.print, 0.058); tp.position.set(px, 0.39, zf); g.add(tp);
    const nm = capsPlate(0.05, f.print); nm.position.set(px, -0.39, zf); g.add(nm);
    // the door sensor: the bar goes on the frame, the magnet on the door, the marks line up
    const bx = 0.86, bw = 0.4, bh = 1.44, mx = bx + bw / 2 + 0.06 + 0.13, mw = 0.26, mh = 0.74, my = -0.1;
    g.add(mesh(slab(bw, bh, 0.32, 0.17, 0.05), f.metal(), bx, 0, 0));
    g.add(mesh(slab(bw - 0.1, bh - 0.1, 0.03, 0.12, 0.01), f.panel(), bx, 0, 0.16 - 0.008));
    g.add(mesh(slab(0.085, 0.3, 0.02, 0.042, 0.006), glass(), bx, 0.42, 0.163));
    const db = lightBar(0.024, 0.16); db.position.set(bx, 0.42, 0.166); g.add(db);
    const dl = legend('PINTU', f.print, 0.05); dl.rotation.z = PI / 2; dl.position.set(bx, -0.3, 0.169); g.add(dl);
    g.add(mesh(slab(mw, mh, 0.26, 0.12, 0.04), f.metal(), mx, my, -0.03));
    g.add(mesh(slab(mw - 0.09, mh - 0.09, 0.03, 0.08, 0.01), f.panel(), mx, my, 0.1 - 0.008));
    const tick = mat(LEAF, { glow: 1.2, rough: 0.4 });
    g.add(mesh(new THREE.BoxGeometry(0.07, 0.016, 0.01), tick, bx + bw / 2 - 0.085, my, 0.168), mesh(new THREE.BoxGeometry(0.07, 0.016, 0.01), tick, mx - mw / 2 + 0.08, my, 0.108));
    // the backs: the plate that stays on the wall and says where each one goes, and the sticky pads
    const plate = mesh(zLathe([[0, 0], [0.6, 0], [0.6, 0.016], [0, 0.016]], 72), mat(0x15191a, { rough: 0.8 }), px, 0, -z); plate.rotation.y = PI; g.add(plate);
    [0.4, -0.4].forEach((x) => g.add(mesh(slab(0.07, 0.2, 0.01, 0.035, 0.003), mat(0x050606, { rough: 1 }), px + x, 0.02, -z - 0.014)));
    const back = face(0.9, 0.5, canvasTex(540, 300, (c) => {
      c.fillStyle = 'rgba(235,240,237,.62)'; c.textAlign = 'center'; c.font = font(38, 700); c.fillText(BRAND.name + ' ' + BRAND.devices.ssense, 270, 60);
      c.font = mono(23, 500); ['Gas LPG: pasang rendah,', 'dekat kompor', 'Asap: pasang di plafon'].forEach((t, i) => c.fillText(t, 270, 126 + i * 42));
    })); back.rotation.y = PI; back.position.set(px, -0.02, -z - 0.019); g.add(back);
    const tape = () => mat(0xb4bab5, { rough: 0.95 });
    g.add(mesh(slab(bw - 0.12, bh - 0.2, 0.012, 0.1, 0.004), tape(), bx, 0, -0.163), mesh(slab(mw - 0.1, mh - 0.14, 0.012, 0.07, 0.004), tape(), mx, my, -0.163));
    g.rotation.x = 0.04; g.scale.setScalar(1.04); g.position.set(-0.02, -0.34, 0); return g;
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
// Builds, or rebuilds, the model a view shows: data-model picks the device and data-finish its colour.
function dress(v) {
  const build = BUILD[v.el.dataset.model]; if (!build) return;
  if (v.model) {
    v.pivot.remove(v.model);
    v.model.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); if (m.material.map) m.material.map.dispose(); m.material.dispose(); } });
  }
  v.model = build(FINISH[v.el.dataset.finish] || FINISH.kabut); v.pivot.add(v.model); dirty = true;
}
function makeView(el) {
  const build = BUILD[el.dataset.model]; if (!build) return;
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
  const scene = new THREE.Scene(); scene.environment = env;
  const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xd6ecff, 1.3); rim.position.set(-4, 2.5, -3.5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xfff2de, 0.3); fill.position.set(-3.5, 0.5, 4); scene.add(fill);
  const pivot = new THREE.Group(); scene.add(pivot);
  const shadow = face(3.0, 3.0, canvasTex(256, 256, (c) => {
    const gr = c.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, 'rgba(8,16,12,.3)'); gr.addColorStop(1, 'rgba(8,16,12,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
  }), { depthWrite: false });
  shadow.rotation.x = -PI / 2; shadow.position.y = -1.62; shadow.scale.y = 0.55; scene.add(shadow);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50); camera.position.set(0, 1.25, 7.4); camera.lookAt(0, -0.12, 0);
  const v = { el, canvas, ctx: canvas.getContext('2d'), scene, camera, pivot, rotY: Number(el.dataset.angle || -0.55), rotX: 0, spin: !el.hasAttribute('data-still'), seen: false, drag: null };
  dress(v); el.appendChild(canvas);
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
    // the screens and labels are drawn once, so the fonts have to be there first
    const fonts = document.fonts ? Promise.all([font(40), font(40, 600), mono(40)].map((f) => document.fonts.load(f))) : Promise.resolve();
    Promise.race([fonts, new Promise((r) => setTimeout(r, 1500))]).catch(() => {}).then(() => els.forEach((el) => io.observe(el)));
    addEventListener('resize', () => { dirty = true; });
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { dirty = true; });
    requestAnimationFrame(frame);
    // Pickers. [data-finish-pick="kabut|arang"] recolours every model; [data-design-pick="a|b"] swaps
    // the models that name a second design in data-alt. A model with data-lock keeps what it has.
    const redress = (el) => { const v = views.find((x) => x.el === el); if (v) dress(v); };
    const press = (attr, value) => document.querySelectorAll(`[${attr}]`).forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value)));
    const setFinish = (name) => {
      if (!FINISH[name]) return;
      els.forEach((el) => { if (!el.hasAttribute('data-lock')) { el.dataset.finish = name; redress(el); } });
      press('data-finish-pick', name);
      try { localStorage.setItem('sj-finish', name); } catch (e) { /* storage is off: the choice lasts for this visit */ }
    };
    const setDesign = (d) => {
      els.forEach((el) => {
        if (!el.dataset.alt || el.hasAttribute('data-lock')) return;
        el.dataset.base = el.dataset.base || el.dataset.model; el.dataset.model = d === 'b' ? el.dataset.alt : el.dataset.base; redress(el);
      });
      press('data-design-pick', d);
    };
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('[data-finish-pick], [data-design-pick]'); if (!b) return;
      if (b.dataset.finishPick) setFinish(b.dataset.finishPick); else setDesign(b.dataset.designPick);
    });
    try { const saved = localStorage.getItem('sj-finish'); if (saved && saved !== 'kabut') setFinish(saved); } catch (e) { /* storage is off */ }
    document.documentElement.classList.add('has-3d'); // shows the colour picker
    window.sjDevices = { views, draw, setFinish, setDesign };
  } catch (e) { console.error(e); /* no WebGL: the fallback images stay */ }
}
