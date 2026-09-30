/* ============================================================
   《黄沙边镇》 Yellow Sand Gulch — 核心层
   体素规格：1 voxel = 0.2 米（VOXM）。所有坐标以米书写，内部换算为体素。
   本层不依赖 DOM / WebGL / three.js，可在 Node 中直接运行。
   ============================================================ */
'use strict';

const VOXM = 0.2;                 // 每体素边长（米）
const VPM  = 5;                   // 每米体素数
function vx(m){ return Math.round(m * VPM); }      // 米 -> 体素
function vmx(v){ return v * VOXM; }                // 体素 -> 米

const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp  = (a, b, t) => a + (b - a) * t;
function smoothstep(a, b, x){ const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function smoothstep2(e0, e1, x){ return smoothstep(e0, e1, x); }

/* ---------------- 哈希 / 值噪声 ---------------- */
function hash2i(x, y){
  let n = (x | 0) * 374761393 + (y | 0) * 668265263;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function noise2(x, y){
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2i(ix, iy), b = hash2i(ix + 1, iy), c = hash2i(ix, iy + 1), d = hash2i(ix + 1, iy + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, oct){
  oct = oct || 4;
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++){ s += amp * noise2(x * f, y * f); f *= 2.03; amp *= 0.5; }
  return s;
}

/* ---------------- 调色板 ---------------- */
const PAL_LIST = [];
const PAL = {};
function defMat(name, hex, emis){
  PAL[name] = PAL_LIST.length;
  PAL_LIST.push({ name, hex, emis: emis || 0 });
  return PAL[name];
}

defMat('sand',        0xD9B77C);
defMat('sandLight',   0xE7CE99);
defMat('sandDark',    0xC0A168);
defMat('gravel',      0xB79A6E);
defMat('sandstone',   0xC98F5C);
defMat('rockRed',     0xB25A3C);
defMat('rockRedDark', 0x8E4230);
defMat('rockOrange',  0xC8724C);
defMat('rockPurple',  0x7C4A42);
defMat('rockTop',     0xC79262);
defMat('clay',        0xA9694A);
defMat('dirt',        0x8E6B47);
defMat('woodPlank',   0x9C6B41);
defMat('woodDark',    0x6E4526);
defMat('woodLight',   0xBB8B5B);
defMat('woodGray',    0x8A7A66);
defMat('woodRed',     0x8E4B33);
defMat('whitePlaster',0xE8DCC2);
defMat('cream',       0xD9C9A6);
defMat('roofShingle', 0x6B4A33);
defMat('roofRed',     0x8A4030);
defMat('roofGreen',   0x4E6152);
defMat('metal',       0x8B9196);
defMat('metalDark',   0x555B60);
defMat('iron',        0x3E4246);
defMat('black',       0x242428);
defMat('glass',       0x6E8494);
defMat('windowGlass', 0xFFD9A0, 1);
defMat('lampGlass',   0xFFC26A, 1);
defMat('fire',        0xFF7B2E, 1);
defMat('fireYellow',  0xFFD26A, 1);
defMat('smoke',       0xBFB6AA);
defMat('canvas',      0xDCCFA8);
defMat('canvasRed',   0xA6503C);
defMat('cactus',      0x5C7B4A);
defMat('cactusDark',  0x44603A);
defMat('scrub',       0x9C8F5E);
defMat('grassDry',    0xB3A262);
defMat('water',       0x4A7A96);
defMat('waterDark',   0x2E5470);
defMat('gold',        0xC79A3E);
defMat('clockFace',   0xF2E7CE, 1);
defMat('red',         0xA5382B);
defMat('blue',        0x3D5F86);
defMat('green',       0x3F6B4E);
defMat('purple',      0x6B4A72);
defMat('bone',        0xE0D8C0);

function srgbToLinear(c){ return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const PAL_RGB = new Float32Array(PAL_LIST.length * 3);
for (let i = 0; i < PAL_LIST.length; i++){
  const hex = PAL_LIST[i].hex;
  PAL_RGB[i * 3 + 0] = srgbToLinear(((hex >> 16) & 255) / 255);
  PAL_RGB[i * 3 + 1] = srgbToLinear(((hex >> 8) & 255) / 255);
  PAL_RGB[i * 3 + 2] = srgbToLinear((hex & 255) / 255);
}
function matRGB(i){ return [PAL_RGB[i * 3], PAL_RGB[i * 3 + 1], PAL_RGB[i * 3 + 2]]; }
function matEmis(i){ return PAL_LIST[i] ? PAL_LIST[i].emis : 0; }

/* ---------------- 体素字模（3x5）---------------- */
const GLYPHS = {
  'A': ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'],
  'B': ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'],
  'C': ['.XX', 'X..', 'X..', 'X..', '.XX'],
  'D': ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
  'E': ['XXX', 'X..', 'XX.', 'X..', 'XXX'],
  'F': ['XXX', 'X..', 'XX.', 'X..', 'X..'],
  'G': ['.XX', 'X..', 'X.X', 'X.X', '.XX'],
  'H': ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'],
  'I': ['XXX', '.X.', '.X.', '.X.', 'XXX'],
  'J': ['..X', '..X', '..X', 'X.X', '.X.'],
  'K': ['X.X', 'XX.', 'X..', 'XX.', 'X.X'],
  'L': ['X..', 'X..', 'X..', 'X..', 'XXX'],
  'M': ['X.X', 'XXX', 'XXX', 'X.X', 'X.X'],
  'N': ['X.X', 'XX.', 'X.X', '.XX', 'X.X'],
  'O': ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
  'P': ['XX.', 'X.X', 'XX.', 'X..', 'X..'],
  'Q': ['XXX', 'X.X', 'X.X', 'XXX', '..X'],
  'R': ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'],
  'S': ['.XX', 'X..', '.X.', '..X', 'XX.'],
  'T': ['XXX', '.X.', '.X.', '.X.', '.X.'],
  'U': ['X.X', 'X.X', 'X.X', 'X.X', 'XXX'],
  'V': ['X.X', 'X.X', 'X.X', 'X.X', '.X.'],
  'W': ['X.X', 'X.X', 'XXX', 'XXX', 'X.X'],
  'X': ['X.X', 'X.X', '.X.', 'X.X', 'X.X'],
  'Y': ['X.X', 'X.X', '.X.', '.X.', '.X.'],
  'Z': ['XXX', '..X', '.X.', 'X..', 'XXX'],
  '0': ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
  '1': ['.X.', 'XX.', '.X.', '.X.', 'XXX'],
  '2': ['XX.', '..X', '.X.', 'X..', 'XXX'],
  '3': ['XX.', '..X', '.X.', '..X', 'XX.'],
  '4': ['X.X', 'X.X', 'XXX', '..X', '..X'],
  '5': ['XXX', 'X..', 'XX.', '..X', 'XX.'],
  '6': ['.XX', 'X..', 'XXX', 'X.X', 'XXX'],
  '7': ['XXX', '..X', '.X.', '.X.', '.X.'],
  '8': ['XXX', 'X.X', 'XXX', 'X.X', 'XXX'],
  '9': ['XXX', 'X.X', 'XXX', '..X', 'XX.'],
  '&': ['.X.', 'X.X', '.X.', 'X.X', '.X.'],
  '-': ['...', '...', 'XXX', '...', '...'],
  '.': ['...', '...', '...', '...', '.X.'],
  '!': ['.X.', '.X.', '.X.', '...', '.X.'],
  ':': ['...', '.X.', '...', '.X.', '...'],
  "'": ['.X.', '.X.', '...', '...', '...'],
  ' ': ['...', '...', '...', '...', '...']
};
function glyphWidth(str){ return str.length * 4 - 1; }   // 3 宽 + 1 间隔

/* ============================================================
   02_voxel.js — Solid 体素模型生成器
   以“盒体堆叠”描述模型，栅格化后做面剔除 + 逐顶点环境光遮蔽(AO)，
   并按（材质 + AO 签名）做贪心面合并，输出 { pos, nrm, col, idx }
   纯数组网格（可合并、可在 Node 中测试）。
   ============================================================ */
'use strict';

const FACE_DIRS = [
  { n: [ 1, 0, 0], na: 0, ua: 1, va: 2 },
  { n: [-1, 0, 0], na: 0, ua: 1, va: 2 },
  { n: [0,  1, 0], na: 1, ua: 0, va: 2 },
  { n: [0, -1, 0], na: 1, ua: 0, va: 2 },
  { n: [0, 0,  1], na: 2, ua: 0, va: 1 },
  { n: [0, 0, -1], na: 2, ua: 0, va: 1 }
];
const AO_BRIGHT = [0.44, 0.63, 0.82, 1.0];

function emptyMesh(){
  return { pos: [], nrm: [], col: [], idx: [], verts: 0, tris: 0 };
}

class Solid {
  constructor(name){
    this.name = name || 'solid';
    this.b = [];        // [x0,y0,z0,x1,y1,z1,mat] 体素坐标，半开区间
    this.glow = [];     // 灯火光斑 {x,y,z,size,r,g,b}
    this.tag = null;
  }
  /* 坐标一律用“米”，自动换算为 0.2m 体素 */
  box(x0, y0, z0, x1, y1, z1, mat){
    let ax0 = vx(x0), ay0 = vx(y0), az0 = vx(z0), ax1 = vx(x1), ay1 = vx(y1), az1 = vx(z1);
    if (ax1 < ax0){ const t = ax0; ax0 = ax1; ax1 = t; }
    if (ay1 < ay0){ const t = ay0; ay0 = ay1; ay1 = t; }
    if (az1 < az0){ const t = az0; az0 = az1; az1 = t; }
    if (ax1 <= ax0) ax1 = ax0 + 1;
    if (ay1 <= ay0) ay1 = ay0 + 1;
    if (az1 <= az0) az1 = az0 + 1;
    this.b.push([ax0, ay0, az0, ax1, ay1, az1, mat]);
    return this;
  }
  vox(x, y, z, mat){ return this.box(x, y, z, x + VOXM, y + VOXM, z + VOXM, mat); }
  /* 挖空（用于门窗洞口、室内掏空）；按添加顺序，后写的覆盖先写的 */
  clear(x0, y0, z0, x1, y1, z1){ return this.box(x0, y0, z0, x1, y1, z1, -2); }
  addGlow(x, y, z, size, r, g, b){ this.glow.push({ x, y, z, size, r, g, b }); return this; }

  /* 栅格化 + 面剔除 + AO + 贪心合并，返回 {opaque, emissive} 两套网格 */
  toMesh(){
    const items = this.b;
    const out = { opaque: emptyMesh(), emissive: emptyMesh() };
    if (!items.length) return out;

    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < items.length; i++){
      const it = items[i];
      if (it[0] < minX) minX = it[0];
      if (it[1] < minY) minY = it[1];
      if (it[2] < minZ) minZ = it[2];
      if (it[3] > maxX) maxX = it[3];
      if (it[4] > maxY) maxY = it[4];
      if (it[5] > maxZ) maxZ = it[5];
    }
    const nx = maxX - minX, ny = maxY - minY, nz = maxZ - minZ;
    if (nx <= 0 || ny <= 0 || nz <= 0) return out;

    /* 带 1 格空填充的栅格：越界查询天然为空 */
    const px = nx + 2, py = ny + 2, pz = nz + 2;
    const sx = 1, sy = px, sz = px * py;
    const g = new Int16Array(px * py * pz).fill(-1);
    for (let i = 0; i < items.length; i++){
      const it = items[i], m = it[6];
      const fill = (m === -2) ? -1 : m;
      for (let z = it[2] - minZ + 1; z < it[5] - minZ + 1; z++){
        for (let y = it[1] - minY + 1; y < it[4] - minY + 1; y++){
          let o = (it[0] - minX + 1) * sx + y * sy + z * sz;
          for (let x = it[0] - minX + 1; x < it[3] - minX + 1; x++, o += sx) g[o] = fill;
        }
      }
    }

    const sizes = [px, py, pz];
    const strides = [sx, sy, sz];

    for (let dir = 0; dir < 6; dir++){
      const D = FACE_DIRS[dir];
      const nU = sizes[D.ua], nV = sizes[D.va], nL = sizes[D.na];
      const sU = strides[D.ua], sV = strides[D.va], sL = strides[D.na];
      const nOff = D.n[D.na] * strides[D.na];
      const CO = [];
      for (let k = 0; k < 4; k++){
        const a = (k === 1 || k === 2) ? 1 : -1;
        const b = (k === 2 || k === 3) ? 1 : -1;
        const su = a * sU, sv = b * sV;
        CO.push([nOff + su, nOff + sv, nOff + su + sv]);
      }
      const keys = new Int32Array(nU * nV);
      const used = new Uint8Array(nU * nV);

      for (let l = 0; l < nL; l++){
        const baseL = l * sL;
        for (let j = 0; j < nV; j++){
          const row = j * nU;
          const baseV = baseL + j * sV;
          for (let i = 0; i < nU; i++){
            const o = baseV + i * sU;
            const m = g[o];
            if (m < 0 || g[o + nOff] >= 0){ keys[row + i] = -1; continue; }
            let key = m << 8;
            for (let k = 0; k < 4; k++){
              const c = CO[k];
              const s1 = g[o + c[0]] >= 0 ? 1 : 0;
              const s2 = g[o + c[1]] >= 0 ? 1 : 0;
              const cn = g[o + c[2]] >= 0 ? 1 : 0;
              const ao = (s1 && s2) ? 0 : 3 - (s1 + s2 + cn);
              key |= ao << (k * 2);
            }
            keys[row + i] = key;
          }
        }
        used.fill(0);
        for (let j = 0; j < nV; j++){
          const row = j * nU;
          for (let i = 0; i < nU; i++){
            const k0 = keys[row + i];
            if (k0 < 0 || used[row + i]) continue;
            let w = 1;
            while (i + w < nU && !used[row + i + w] && keys[row + i + w] === k0) w++;
            let h = 1;
            outer: while (j + h < nV){
              const r2 = (j + h) * nU + i;
              for (let b = 0; b < w; b++){
                if (used[r2 + b] || keys[r2 + b] !== k0) break outer;
              }
              h++;
            }
            for (let a = 0; a < h; a++) for (let b = 0; b < w; b++) used[(j + a) * nU + i + b] = 1;
            emitFace(out, D, k0, i, j, w, h, l, minX - 1, minY - 1, minZ - 1);
          }
        }
      }
    }

    out.opaque.verts = out.opaque.pos.length / 3;
    out.opaque.tris = out.opaque.idx.length / 3;
    out.emissive.verts = out.emissive.pos.length / 3;
    out.emissive.tris = out.emissive.idx.length / 3;
    return out;
  }
}

function emitFace(out, D, key, i, j, w, h, l, minX, minY, minZ){
  const mat = key >>> 8;
  const emis = matEmis(mat);
  const dst = emis > 0 ? out.emissive : out.opaque;
  const ao = [(key >>> 0) & 3, (key >>> 2) & 3, (key >>> 4) & 3, (key >>> 6) & 3];
  const rgb = matRGB(mat);
  const lF = l + (D.n[D.na] > 0 ? 1 : 0);
  const base = dst.pos.length / 3;
  for (let k = 0; k < 4; k++){
    const a = (k === 1 || k === 2) ? 1 : 0;
    const b = (k === 2 || k === 3) ? 1 : 0;
    const p = [0, 0, 0];
    p[D.ua] = i + a * w; p[D.va] = j + b * h; p[D.na] = lF;
    dst.pos.push((p[0] + minX) * VOXM, (p[1] + minY) * VOXM, (p[2] + minZ) * VOXM);
    dst.nrm.push(D.n[0], D.n[1], D.n[2]);
    const br = emis > 0 ? 1 : AO_BRIGHT[ao[k]];
    dst.col.push(rgb[0] * br, rgb[1] * br, rgb[2] * br);
  }
  if (ao[0] + ao[2] > ao[1] + ao[3]){
    dst.idx.push(base, base + 1, base + 3, base + 1, base + 2, base + 3);
  } else {
    dst.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

/* ---------------- 网格合并 ---------------- */
function mergeMeshParts(parts){
  let vCount = 0, iCount = 0;
  for (const p of parts){ vCount += p.pos.length / 3; iCount += p.idx.length; }
  const pos = new Float32Array(vCount * 3);
  const nrm = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for (const p of parts){
    const n = p.pos.length / 3;
    pos.set(p.pos, vo * 3);
    nrm.set(p.nrm, vo * 3);
    col.set(p.col, vo * 3);
    for (let i = 0; i < p.idx.length; i++) idx[io + i] = p.idx[i] + vo;
    vo += n; io += p.idx.length;
  }
  return { pos, nrm, col, idx, verts: vCount, tris: iCount / 3 };
}

/* 把若干 Solid 合并为一套网格（含发光体） */
function solidsToMesh(solids){
  const op = [], em = [];
  const glows = [];
  for (const s of solids){
    const m = s.toMesh();
    if (m.opaque.idx.length) op.push(m.opaque);
    if (m.emissive.idx.length) em.push(m.emissive);
    for (const g of s.glow) glows.push(g);
  }
  return { opaque: mergeMeshParts(op), emissive: mergeMeshParts(em), glows };
}

/* ---------------- 文字招牌 ----------------
   在竖直面上排出 3x5 字模。faceZ=+1 表示文字朝 +Z（观察者在 +Z 侧），-1 反之。
   (x0,y0) 为文字左上角（米），size 为单格尺寸（米）。 */
function placeText(solid, str, x0, y0, z0, z1, faceZ, size, mat){
  str = (str || '').toUpperCase();
  let col = 0;
  for (const ch of str){
    const gl = GLYPHS[ch] || GLYPHS[' '];
    for (let r = 0; r < 5; r++){
      const line = gl[r];
      for (let c = 0; c < 3; c++){
        if (line[c] !== 'X') continue;
        const gx = faceZ > 0 ? x0 + (col + c) * size : x0 - (col + c + 1) * size;
        const gy = y0 - r * size;
        solid.box(gx, gy, z0, gx + size, gy + size, z1, mat);
      }
    }
    col += 4;
  }
  return col * size;
}

/* ============================================================
   03_terrain.js — 红岩峡谷高度场与地形网格
   世界范围 x,z ∈ [-120, 120] 米，高度单位=体素(0.2m)。
   ============================================================ */
'use strict';

const TW = 1200, TH = 1200;          // 地形格数（0.2m/格 → 240m x 240m）
const HALF = TW / 2;
const TER = { H: new Int16Array(TW * TH), C: new Uint8Array(TW * TH) };

function cellX(ix){ return (ix - HALF + 0.5) * VOXM; }
function cellZ(iz){ return (iz - HALF + 0.5) * VOXM; }
function ixOf(x){ return clamp(Math.floor(x / VOXM + HALF), 0, TW - 1); }
function izOf(z){ return clamp(Math.floor(z / VOXM + HALF), 0, TH - 1); }
function heightAt(x, z){ return TER.H[izOf(z) * TW + ixOf(x)] * VOXM; }

/* 局部整平（用于建筑地基、山道平台） */
function flattenCircle(x, z, r, hMeters){
  const hv = Math.round(hMeters * VPM);
  const r2 = r * r;
  const i0 = ixOf(x - r), i1 = ixOf(x + r), j0 = izOf(z - r), j1 = izOf(z + r);
  for (let j = j0; j <= j1; j++){
    for (let i = i0; i <= i1; i++){
      const dx = cellX(i) - x, dz = cellZ(j) - z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      const w = 1 - Math.sqrt(d2) / r;
      const k = j * TW + i;
      TER.H[k] = Math.round(lerp(TER.H[k], hv, smoothstep(0, 0.55, w)));
    }
  }
}

/* ---------------- 地形高度（米）---------------- */
function terrainHeight(x, z){
  // 荒漠沙丘（长波缓坡，便于网格合并）
  let h = (fbm(x * 0.0072 + 3.1, z * 0.0072 + 7.7, 3) - 0.5) * 6.6
        + (fbm(x * 0.024 + 1.2, z * 0.024 + 5.5, 2) - 0.5) * 0.85;

  // 北侧红岩峡谷巨构
  const ridge = fbm(x * 0.0052 + 21.0, z * 0.0052 + 13.0, 2);
  const northMask = smoothstep(-30, -58, z);
  const gap = smoothstep(32, 12, Math.abs(x + 30));          // 峡谷豁口（干河谷穿行）
  const canyonH = 15 + ridge * 27 + smoothstep(-56, -112, z) * 24;
  h += northMask * canyonH * (1 - gap * 0.85);

  // 东北瞭望山（山顶设瞭望台）
  const md = Math.hypot(x - 62, z + 58);
  const mMask = Math.max(0, 1 - md / 54);
  h += Math.pow(mMask, 1.55) * 62 * (0.92 + 0.14 * fbm(x * 0.012, z * 0.012, 2));

  // 南侧高地
  const south = smoothstep(64, 104, z);
  h += south * (9 + ridge * 12);

  // 东西岩壁边缘（世界尽头）
  const rim = smoothstep(84, 120, Math.abs(x));
  h += rim * (15 + ridge * 17);

  // 干涸河床
  const washZ = 22 + Math.sin(x * 0.021) * 9;
  h -= smoothstep(12, 2, Math.abs(z - washZ)) * 2.6;

  // 小镇整平（主街走廊）
  const townMask = smoothstep(98, 80, Math.abs(x)) * smoothstep(48, 36, Math.abs(z - 2));
  h = lerp(h, 0.12, townMask * 0.96);

  // 铁路走廊整平
  const railMask = smoothstep(70, 58, Math.abs(z - 52)) * smoothstep(116, 96, Math.abs(x));
  h = lerp(h, 0.32, railMask * 0.94);

  // 红岩高地台地化：3.4m 一级，形成 mesa 悬崖与层理
  if (h > 5.2) h = Math.round(h / 3.4) * 3.4;

  return h;
}

function terrainColor(x, z, h){
  const n  = fbm(x * 0.028 + 40.0, z * 0.028 + 17.0, 3);
  const n2 = noise2(x * 0.10 + 2.0, z * 0.10 + 6.0);
  const scrub = fbm(x * 0.06 + 61.0, z * 0.06 + 23.0, 2);
  if (h > 22) return n2 > 0.58 ? PAL.rockTop : PAL.rockOrange;
  if (h > 6.5){
    if (n2 > 0.76) return PAL.rockPurple;
    return n > 0.5 ? PAL.rockRed : PAL.rockRedDark;
  }
  if (h < -1.0) return n2 > 0.5 ? PAL.gravel : PAL.sandDark;
  if (scrub > 0.635) return PAL.scrub;
  if (n > 0.63) return PAL.sandLight;
  if (n < 0.35) return PAL.sandDark;
  return PAL.sand;
}

function buildTerrain(){
  for (let j = 0; j < TH; j++){
    const z = cellZ(j);
    for (let i = 0; i < TW; i++){
      const x = cellX(i);
      const h = terrainHeight(x, z);
      const k = j * TW + i;
      TER.H[k] = Math.round(h * VPM);
      TER.C[k] = terrainColor(x, z, h);
    }
  }
  // 山道平台（通往瞭望台）
  const trail = trailPoints();
  for (const p of trail) flattenCircle(p[0], p[1], 3.2, p[2]);
}

/* 山道：从山脚折返而上至瞭望台 */
function trailPoints(){
  const pts = [];
  const top = { x: 62, z: -58 };
  const base = { x: 26, z: -26 };
  // 三段折返
  const nodes = [
    [base.x, base.z], [40, -30], [52, -38], [42, -44],
    [50, -52], [58, -50], [62, -56], [top.x, top.z]
  ];
  for (let s = 0; s < nodes.length - 1; s++){
    const a = nodes[s], b = nodes[s + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(2, Math.round(len / 3));
    for (let t = 0; t < steps; t++){
      const u = t / steps;
      const x = lerp(a[0], b[0], u), z = lerp(a[1], b[1], u);
      pts.push([x, z, Math.round(terrainHeight(x, z) * VPM) / VPM]);
    }
  }
  pts.push([top.x, top.z, Math.round(terrainHeight(top.x, top.z) * VPM) / VPM]);
  return pts;
}

/* ---------------- 地形网格 ---------------- */
function buildTerrainMesh(){
  const pos = [], nrm = [], col = [], idx = [];
  const H = TER.H, C = TER.C;
  const used = new Uint8Array(TW * TH);

  const pushQuad = (p0, p1, p2, p3, n, mat, shade, cornerMats) => {
    const base = pos.length / 3;
    const pts = [p0, p1, p2, p3];
    for (let k = 0; k < 4; k++){
      pos.push(pts[k][0], pts[k][1], pts[k][2]);
      nrm.push(n[0], n[1], n[2]);
      const rgb = cornerMats ? matRGB(cornerMats[k]) : matRGB(mat);
      col.push(rgb[0] * shade, rgb[1] * shade, rgb[2] * shade);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  const xOf = (i) => (i - HALF) * VOXM;
  const zOf = (j) => (j - HALF) * VOXM;

  /* 顶面：贪心合并等高矩形，四角按格点插值配色 */
  for (let j = 0; j < TH; j++){
    for (let i = 0; i < TW; i++){
      const k = j * TW + i;
      if (used[k]) continue;
      const h = H[k];
      let w = 1;
      while (i + w < TW){
        const k2 = k + w;
        if (used[k2] || H[k2] !== h) break;
        w++;
      }
      let d = 1;
      outer: while (j + d < TH){
        for (let b = 0; b < w; b++){
          const k2 = (j + d) * TW + i + b;
          if (used[k2] || H[k2] !== h) break outer;
        }
        d++;
      }
      for (let a = 0; a < d; a++) for (let b = 0; b < w; b++) used[(j + a) * TW + i + b] = 1;
      const y = h * VOXM;
      const cm = [
        C[j * TW + i],
        C[j * TW + i + w - 1],
        C[(j + d - 1) * TW + i + w - 1],
        C[(j + d - 1) * TW + i]
      ];
      pushQuad(
        [xOf(i), y, zOf(j)], [xOf(i + w), y, zOf(j)], [xOf(i + w), y, zOf(j + d)], [xOf(i), y, zOf(j + d)],
        [0, 1, 0], cm[0], 1.0, cm
      );
    }
  }

  /* 侧壁：沿等高等色游程合并 */
  const strataMat = (yVox, n) => {
    const band = Math.floor(yVox / 8 + n * 2.4);
    const kk = ((band % 4) + 4) % 4;
    return [PAL.rockRedDark, PAL.rockRed, PAL.rockOrange, PAL.rockRed][kk];
  };
  const wallColor = (top, bot, c) => {
    const drop = top - bot;
    return drop > 3 ? strataMat((top + bot) / 2, noise2(top * 0.13, bot * 0.11)) : c;
  };

  for (let j = 0; j < TH; j++){
    let i = 0;
    while (i < TW - 1){
      const a = j * TW + i, b = a + 1;
      if (H[a] > H[b]){
        const top = H[a], bot = H[b], c = C[a];
        let w = 1;
        while (i + w < TW - 1){
          const a2 = j * TW + i + w, b2 = a2 + 1;
          if (!(H[a2] > H[b2]) || H[a2] !== top || H[b2] !== bot || C[a2] !== c) break;
          w++;
        }
        const xw = xOf(i + 1), yTop = top * VOXM, yBot = bot * VOXM;
        const m = wallColor(top, bot, c);
        pushQuad([xw, yBot, zOf(j)], [xw, yTop, zOf(j)], [xw, yTop, zOf(j + w)], [xw, yBot, zOf(j + w)],
          [1, 0, 0], m, 0.74);
        i += w;
      } else i++;
    }
  }
  for (let i = 0; i < TW; i++){
    let j = 0;
    while (j < TH - 1){
      const a = j * TW + i, b = a + TW;
      if (H[a] > H[b]){
        const top = H[a], bot = H[b], c = C[a];
        let w = 1;
        while (j + w < TH - 1){
          const a2 = (j + w) * TW + i, b2 = a2 + TW;
          if (!(H[a2] > H[b2]) || H[a2] !== top || H[b2] !== bot || C[a2] !== c) break;
          w++;
        }
        const zw = zOf(j + 1), yTop = top * VOXM, yBot = bot * VOXM;
        const m = wallColor(top, bot, c);
        pushQuad([xOf(i), yBot, zw], [xOf(i), yTop, zw], [xOf(i + w), yTop, zw], [xOf(i + w), yBot, zw],
          [0, 0, 1], m, 0.74);
        j += w;
      } else j++;
    }
  }

  /* 世界边缘裙摆（远处荒漠，靠雾隐藏接缝） */
  const SKIRT = 420;
  for (let j = 0; j < TH; j += 2){
    const z0 = zOf(j), z1 = zOf(Math.min(j + 2, TH));
    const y0 = H[j * TW] * VOXM;
    pushQuad([xOf(0) - SKIRT, y0, z0], [xOf(0), y0, z0], [xOf(0), y0, z1], [xOf(0) - SKIRT, y0, z1], [0, 1, 0], C[j * TW], 0.9);
    const y1 = H[j * TW + TW - 1] * VOXM;
    pushQuad([xOf(TW), y1, z0], [xOf(TW) + SKIRT, y1, z0], [xOf(TW) + SKIRT, y1, z1], [xOf(TW), y1, z1], [0, 1, 0], C[j * TW + TW - 1], 0.9);
  }
  for (let i = 0; i < TW; i += 2){
    const x0 = xOf(i), x1 = xOf(Math.min(i + 2, TW));
    const y0 = H[i] * VOXM;
    pushQuad([x0, y0, zOf(0) - SKIRT], [x1, y0, zOf(0) - SKIRT], [x1, y0, zOf(0)], [x0, y0, zOf(0)], [0, 1, 0], C[i], 0.9);
    const y1 = H[(TH - 1) * TW + i] * VOXM;
    pushQuad([x0, y1, zOf(TH)], [x1, y1, zOf(TH)], [x1, y1, zOf(TH) + SKIRT], [x0, y1, zOf(TH) + SKIRT], [0, 1, 0], C[(TH - 1) * TW + i], 0.9);
  }

  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), col: new Float32Array(col), idx: new Uint32Array(idx), verts: pos.length / 3, tris: idx.length / 3 };
}

/* ============================================================
   04_buildings.js — 黄沙边镇建筑群
   主街两侧：沙龙、旅馆、杂货铺、警长办公室、监狱、银行、理发店、
   教堂、马厩、铁匠铺、学校、邮局；地标：峡谷水塔、钟楼、风车、
   火车站、山顶瞭望台。
   ============================================================ */
'use strict';

function pick(v, d){ return v === undefined ? d : v; }

/* ---------------- 通用部件 ---------------- */
function windowBox(S, x, y, z, w, h, face, trim, glass){
  glass = pick(glass, PAL.windowGlass);
  trim = pick(trim, PAL.whitePlaster);
  const F = face;
  S.box(x - w / 2, y, z - 0.12 * F, x + w / 2, y + h, z + 0.12 * F, glass);
  S.box(x - w / 2 - 0.22, y - 0.22, z - 0.12 * F, x + w / 2 + 0.22, y, z + 0.34 * F, trim);
  S.box(x - w / 2 - 0.22, y + h, z - 0.12 * F, x + w / 2 + 0.22, y + h + 0.22, z + 0.34 * F, trim);
  S.box(x - w / 2 - 0.22, y, z - 0.12 * F, x - w / 2, y + h, z + 0.34 * F, trim);
  S.box(x + w / 2, y, z - 0.12 * F, x + w / 2 + 0.22, y + h, z + 0.34 * F, trim);
  S.box(x - 0.09, y, z + 0.10 * F, x + 0.09, y + h, z + 0.30 * F, trim);
  S.box(x - w / 2, y + h / 2 - 0.07, z + 0.10 * F, x + w / 2, y + h / 2 + 0.07, z + 0.30 * F, trim);
  S.addGlow(x, y + h / 2, z + 0.7 * F, Math.max(w, h) * 1.25, 1.0, 0.70, 0.34);
}

function doorOpening(S, x, y, z, w, h, face, trim){
  const F = face;
  S.clear(x - w / 2, y, z - 0.42 * F, x + w / 2, y + h, z + 0.42 * F);
  S.box(x - w / 2 - 0.3, y, z - 0.2 * F, x - w / 2, y + h + 0.3, z + 0.3 * F, trim);
  S.box(x + w / 2, y, z - 0.2 * F, x + w / 2 + 0.3, y + h + 0.3, z + 0.3 * F, trim);
  S.box(x - w / 2 - 0.3, y + h, z - 0.2 * F, x + w / 2 + 0.3, y + h + 0.34, z + 0.3 * F, trim);
  // 敞开的门板
  S.box(x - w / 2 - 1.15, y, z - 0.06 * F, x - w / 2 - 0.3, y + h - 0.1, z + 0.16 * F, PAL.woodDark);
}

function gableRoof(S, x0, x1, z0, z1, yBase, rise, mat, over, ridgeAlongX){
  if (ridgeAlongX === undefined) ridgeAlongX = true;
  over = pick(over, 0.7);
  const a0 = ridgeAlongX ? z0 : x0, a1 = ridgeAlongX ? z1 : x1;
  const b0 = ridgeAlongX ? x0 : z0, b1 = ridgeAlongX ? x1 : z1;
  const uA = a0 - over, uB = a1 + over;
  const half = (uB - uA) / 2;
  const steps = Math.max(2, Math.round(half / 1.0));
  const sw = half / steps, sh = rise / steps;
  const band = (ua, ub, y0, y1) => {
    if (ridgeAlongX) S.box(b0 - over, y0, ua, b1 + over, y1, ub, mat);
    else S.box(ua, y0, b0 - over, ub, y1, b1 + over, mat);
  };
  for (let i = 0; i < steps; i++){
    band(uA + i * sw, uA + (i + 1) * sw + 0.04, yBase + i * sh, yBase + (i + 1) * sh);
    band(uB - (i + 1) * sw - 0.04, uB - i * sw, yBase + i * sh, yBase + (i + 1) * sh);
  }
  band(uA + steps * sw - 0.1, uB - steps * sw + 0.1, yBase + rise, yBase + rise + 0.55);
}

function falseFront(S, x0, x1, z, yTop, yFF, face, wall, trim){
  const F = face;
  S.box(x0, yTop, z - 0.45 * F, x1, yFF, z + 0.30 * F, wall);
  S.box(x0 - 0.32, yFF - 0.55, z - 0.55 * F, x1 + 0.32, yFF - 0.15, z + 0.42 * F, trim);
  S.box(x0 - 0.16, yFF - 0.15, z - 0.5 * F, x1 + 0.16, yFF + 0.42, z + 0.38 * F, trim);
  S.box(x0 + 0.25, yFF + 0.42, z - 0.42 * F, x1 - 0.25, yFF + 0.72, z + 0.32 * F, trim);
}

function signBoard(S, text, cx, y, z, face, boardMat, textMat, scale){
  scale = pick(scale, 0.24);
  const F = face;
  const w = glyphWidth(text) * scale;
  S.box(cx - w / 2 - 0.4, y - 0.55, z + 0.02 * F, cx + w / 2 + 0.4, y + 5 * scale + 0.55, z + 0.32 * F, pick(boardMat, PAL.woodDark));
  placeText(S, text, cx - w / 2, y + 5 * scale, z + 0.32 * F, z + 0.56 * F, F, scale, pick(textMat, PAL.whitePlaster));
}

function porch(S, x0, x1, z, face, y, wall, trim, depth){
  const F = face;
  depth = pick(depth, 2.8);
  const zIn = z, zOut = z + depth * F;
  const lo = Math.min(zIn, zOut), hi = Math.max(zIn, zOut);
  S.box(x0 + 0.25, y - 0.35, lo, x1 - 0.25, y, hi, PAL.woodPlank);
  const posts = [x0 + 0.65, x1 - 0.65, (x0 + x1) / 2 - 1.2, (x0 + x1) / 2 + 1.2];
  for (const px of posts){
    S.box(px - 0.16, y, lo + 0.15, px + 0.16, y + 3.1, lo + 0.47, PAL.woodDark);
  }
  S.box(x0 - 0.1, y + 3.1, lo, x1 + 0.1, y + 3.55, hi, PAL.woodDark);
  S.box(x0 + 0.1, y + 3.55, lo + 0.1, x1 - 0.1, y + 3.8, hi - 0.1, PAL.roofShingle);
  // 栏杆
  if (depth > 2.2){
    S.box(x0 + 0.3, y + 0.95, hi - 0.35 * F - 0.15, x1 - 0.3, y + 1.15, hi - 0.35 * F + 0.15, PAL.woodDark);
  }
}

/* ---------------- 西部木板房通用生成器 ---------------- */
function westernBuilding(S, o){
  const w = o.w, d = o.d, h = o.h, x = o.x, z = o.z;
  const face = pick(o.face, 1);
  const F = face;
  const wall = pick(o.wall, PAL.woodPlank);
  const trim = pick(o.trim, PAL.whitePlaster);
  const roofM = pick(o.roof, PAL.roofShingle);
  const floors = pick(o.floors, 1);
  const yF = 0.55;
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const zf = F > 0 ? z1 : z0;
  const zb = F > 0 ? z0 : z1;

  // 基座与地板
  S.box(x0 - 0.25, -0.8, z0 - 0.25, x1 + 0.25, yF - 0.25, z1 + 0.25, PAL.dirt);
  S.box(x0, yF - 0.3, z0, x1, yF, z1, PAL.woodDark);
  // 墙体（先实心再掏空）
  S.box(x0, yF, z0, x1, h, z1, wall);
  S.clear(x0 + 0.42, yF, z0 + 0.42, x1 - 0.42, h, z1 - 0.42);
  // 二层楼板 + 内隔墙
  if (floors >= 2){
    const mid = yF + (h - yF) * 0.52;
    S.box(x0 + 0.42, mid - 0.24, z0 + 0.42, x1 - 0.42, mid, z1 - 0.42, PAL.woodDark);
    S.box(x - 0.2, mid, z0 + 0.42, x + 0.2, h - 0.2, z1 - 0.42, PAL.woodGray);
  }
  // 前门
  const dx = x + pick(o.doorX, 0);
  doorOpening(S, dx, yF, zf, 1.7, 3.0, F, trim);
  // 后门
  S.clear(x - 0.85, yF, zb - 0.42 * -F, x + 0.85, yF + 2.8, zb + 0.42 * -F);
  // 前窗
  const winY = yF + 1.15;
  const offs = w >= 13 ? [-w * 0.31, w * 0.31] : [-w * 0.28, w * 0.28];
  for (const ox of offs){
    if (Math.abs(ox - pick(o.doorX, 0)) < 1.9) continue;
    windowBox(S, x + ox, winY, zf, 1.45, 1.85, F, trim);
  }
  if (floors >= 2){
    const winY2 = yF + (h - yF) * 0.52 + 1.15;
    for (const ox of [-w * 0.30, 0, w * 0.30]){
      windowBox(S, x + ox, winY2, zf, 1.4, 1.7, F, trim);
    }
  }
  // 侧窗
  for (const zz of [-d * 0.24, d * 0.24]){
    windowBox(S, x0, winY, z + zz, 1.3, 1.7, -1, trim);
    windowBox(S, x1, winY, z + zz, 1.3, 1.7, 1, trim);
  }
  // 假立面 + 招牌
  const ffH = pick(o.ff, 0);
  if (ffH > h){
    falseFront(S, x0, x1, zf, h, ffH, F, wall, trim);
    if (o.sign){
      signBoard(S, o.sign, x, ffH - 2.55, zf, F, PAL.woodDark, PAL.whitePlaster, pick(o.signScale, 0.24));
    }
    // 立面装饰窗
    windowBox(S, x - w * 0.28, ffH - 3.5, zf, 1.35, 1.7, F, trim);
    windowBox(S, x + w * 0.28, ffH - 3.5, zf, 1.35, 1.7, F, trim);
  } else if (o.sign){
    signBoard(S, o.sign, x, h - 2.4, zf, F, PAL.woodDark, PAL.whitePlaster, pick(o.signScale, 0.24));
  }
  // 屋顶
  gableRoof(S, x0, x1, z0, z1, h, pick(o.rise, 2.4), roofM, 0.75, true);
  // 门廊
  if (pick(o.porch, true)) porch(S, x0, x1, zf, F, yF, wall, trim, pick(o.porchDepth, 2.8));
  return { x0, x1, z0, z1, zf, zb, yF, F };
}

/* ---------------- 教堂 ---------------- */
function buildChurch(S, x, z, face){
  const F = pick(face, -1);
  const w = 14, d = 22, h = 7.2;
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const zf = F > 0 ? z1 : z0;
  const yF = 0.55;
  S.box(x0 - 0.3, -0.9, z0 - 0.3, x1 + 0.3, yF - 0.25, z1 + 0.3, PAL.sandstone);
  S.box(x0, yF - 0.3, z0, x1, yF, z1, PAL.woodDark);
  S.box(x0, yF, z0, x1, h, z1, PAL.whitePlaster);
  S.clear(x0 + 0.55, yF, z0 + 0.55, x1 - 0.55, h, z1 - 0.55);
  // 地毯与长椅
  S.box(x - 2.2, yF, z0 + 1.2, x + 2.2, yF + 0.12, z1 - 2.0, PAL.red);
  for (let i = 0; i < 7; i++){
    const pz = z0 + 3.2 + i * 2.35;
    S.box(x - 5.2, yF, pz, x - 1.0, yF + 0.85, pz + 0.7, PAL.woodDark);
    S.box(x + 1.0, yF, pz, x + 5.2, yF + 0.85, pz + 0.7, PAL.woodDark);
    S.box(x - 5.2, yF + 0.85, pz - 0.25, x - 1.0, yF + 1.75, pz + 0.1, PAL.woodPlank);
    S.box(x + 1.0, yF + 0.85, pz - 0.25, x + 5.2, yF + 1.75, pz + 0.1, PAL.woodPlank);
  }
  // 祭坛
  S.box(x - 2.6, yF, z0 + 0.9, x + 2.6, yF + 1.1, z0 + 2.2, PAL.woodDark);
  S.box(x - 0.25, yF + 1.1, z0 + 1.2, x + 0.25, yF + 3.2, z0 + 1.6, PAL.gold);
  S.box(x - 1.1, yF + 2.2, z0 + 1.35, x + 1.1, yF + 2.65, z0 + 1.75, PAL.gold);
  // 正门与玫瑰窗
  doorOpening(S, x, yF, zf, 2.4, 4.0, F, PAL.whitePlaster);
  windowBox(S, x, h - 2.4, zf, 2.6, 2.6, F, PAL.whitePlaster);
  for (const sx of [-1, 1]){
    for (let i = 0; i < 4; i++){
      windowBox(S, x + sx * (w / 2), yF + 1.5, z0 + 3.4 + i * 4.4, 2.2, 3.0, sx, PAL.whitePlaster);
    }
  }
  gableRoof(S, x0, x1, z0, z1, h, 3.6, PAL.roofRed, 0.85, false);
  // 尖塔 + 钟
  const sx = x, sz = zf + 2.2 * F;
  S.box(sx - 2.6, h - 0.4, sz - 2.6, sx + 2.6, h + 9.0, sz + 2.6, PAL.whitePlaster);
  S.clear(sx - 2.1, h + 4.6, sz - 2.1, sx + 2.1, h + 8.2, sz + 2.1);
  for (const a of [-1, 1]){
    S.box(sx + a * 2.25 - 0.22, h + 4.4, sz - 2.25, sx + a * 2.25 + 0.22, h + 8.4, sz + 2.25, PAL.whitePlaster);
    S.box(sx - 2.25, h + 4.4, sz + a * 2.25 - 0.22, sx + 2.25, h + 8.4, sz + a * 2.25 + 0.22, PAL.whitePlaster);
  }
  S.box(sx - 1.15, h + 5.2, sz - 1.15, sx + 1.15, h + 7.4, sz + 1.15, PAL.gold);      // 钟
  S.box(sx - 2.9, h + 8.2, sz - 2.9, sx + 2.9, h + 8.8, sz + 2.9, PAL.whitePlaster);
  // 塔尖（阶梯锥）
  for (let i = 0; i < 9; i++){
    const r = 2.75 * (1 - i / 9);
    S.box(sx - r, h + 8.8 + i * 0.85, sz - r, sx + r, h + 9.65 + i * 0.85, sz + r, PAL.roofRed);
  }
  S.box(sx - 0.16, h + 16.2, sz - 0.16, sx + 0.16, h + 18.4, sz + 0.16, PAL.gold);
  S.box(sx - 0.75, h + 17.1, sz - 0.16, sx + 0.75, h + 17.45, sz + 0.16, PAL.gold);
  S.addGlow(x, h - 1.0, zf + 1.0 * F, 3.2, 1.0, 0.78, 0.45);
}

/* ---------------- 峡谷水塔（地标） ---------------- */
function buildWaterTower(S, x, z, opt){
  opt = opt || {};
  const gy = pick(opt.baseY, heightAt(x, z));
  const legH = pick(opt.legH, 11.5);
  const tankR = pick(opt.tankR, 3.6);
  const tankH = pick(opt.tankH, 5.6);
  const top = gy + legH;
  // 四腿
  for (const sx of [-1, 1]){
    for (const sz of [-1, 1]){
      const lx = x + sx * tankR * 0.82, lz = z + sz * tankR * 0.82;
      S.box(lx - 0.32, gy - 1.2, lz - 0.32, lx + 0.32, top, lz + 0.32, PAL.woodDark);
      // 斜撑
      S.box(lx - 0.22, gy + legH * 0.22, lz - 0.22, lx + 0.22, gy + legH * 0.72, lz + 0.22, PAL.woodGray);
    }
  }
  for (const sy of [0.34, 0.62]){
    const yy = gy + legH * sy;
    S.box(x - tankR * 0.95, yy, z - tankR * 0.95, x + tankR * 0.95, yy + 0.34, z - tankR * 0.62, PAL.woodDark);
    S.box(x - tankR * 0.95, yy, z + tankR * 0.62, x + tankR * 0.95, yy + 0.34, z + tankR * 0.95, PAL.woodDark);
    S.box(x - tankR * 0.95, yy, z - tankR * 0.95, x - tankR * 0.62, yy + 0.34, z + tankR * 0.95, PAL.woodDark);
    S.box(x + tankR * 0.62, yy, z - tankR * 0.95, x + tankR * 0.95, yy + 0.34, z + tankR * 0.95, PAL.woodDark);
  }
  // 水柜（八角近似）
  const seg = 8;
  for (let i = 0; i < seg; i++){
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const cx0 = x + Math.cos((a0 + a1) / 2) * tankR * 0.94;
    const cz0 = z + Math.sin((a0 + a1) / 2) * tankR * 0.94;
    const wseg = 2 * tankR * Math.sin(Math.PI / seg) * 1.06;
    S.box(cx0 - wseg / 2, top, cz0 - wseg / 2, cx0 + wseg / 2, top + tankH, cz0 + wseg / 2, PAL.woodPlank);
  }
  S.box(x - tankR * 0.86, top, z - tankR * 0.86, x + tankR * 0.86, top + tankH, z + tankR * 0.86, PAL.water);
  S.clear(x - tankR * 0.7, top, z - tankR * 0.7, x + tankR * 0.7, top + tankH * 0.92, z + tankR * 0.7);
  S.box(x - tankR * 0.86, top, z - tankR * 0.86, x + tankR * 0.86, top + 0.5, z + tankR * 0.86, PAL.waterDark);
  // 铁箍
  for (const yy of [top + tankH * 0.28, top + tankH * 0.72]){
    S.box(x - tankR * 1.02, yy, z - tankR * 1.02, x + tankR * 1.02, yy + 0.3, z + tankR * 1.02, PAL.iron);
    S.clear(x - tankR * 0.95, yy - 0.1, z - tankR * 0.95, x + tankR * 0.95, yy + 0.4, z + tankR * 0.95);
  }
  // 顶盖
  for (let i = 0; i < 7; i++){
    const r = tankR * 1.16 * (1 - i / 7);
    S.box(x - r, top + tankH + i * 0.55, z - r, x + r, top + tankH + 0.55 + i * 0.55, z + r, PAL.roofShingle);
  }
  // 走道 + 栏杆
  S.box(x - tankR * 1.35, top - 0.35, z - tankR * 1.35, x + tankR * 1.35, top, z + tankR * 1.35, PAL.woodDark);
  for (let i = -3; i <= 3; i++){
    S.box(x + i * tankR * 0.42, top, z - tankR * 1.32, x + i * tankR * 0.42 + 0.16, top + 1.15, z - tankR * 1.18, PAL.woodDark);
    S.box(x + i * tankR * 0.42, top, z + tankR * 1.18, x + i * tankR * 0.42 + 0.16, top + 1.15, z + tankR * 1.32, PAL.woodDark);
  }
  S.box(x - tankR * 1.35, top + 1.0, z - tankR * 1.35, x + tankR * 1.35, top + 1.18, z - tankR * 1.18, PAL.woodDark);
  S.box(x - tankR * 1.35, top + 1.0, z + tankR * 1.18, x + tankR * 1.35, top + 1.18, z + tankR * 1.35, PAL.woodDark);
  // 梯子
  for (let i = 0; i < Math.floor(legH / 0.55); i++){
    S.box(x - 0.62, gy + i * 0.55, z - tankR * 1.3, x + 0.62, gy + i * 0.55 + 0.16, z - tankR * 1.16, PAL.woodGray);
  }
  S.box(x - 0.72, gy, z - tankR * 1.36, x - 0.56, top + 1.0, z - tankR * 1.2, PAL.woodDark);
  S.box(x + 0.56, gy, z - tankR * 1.36, x + 0.72, top + 1.0, z - tankR * 1.2, PAL.woodDark);
  // 出水鹤臂
  S.box(x + tankR * 1.1, top + 1.2, z - 0.35, x + tankR * 2.3, top + 1.9, z + 0.35, PAL.iron);
  S.box(x + tankR * 2.1, top - 1.2, z - 0.35, x + tankR * 2.35, top + 1.6, z + 0.35, PAL.iron);
  S.addGlow(x, top + tankH * 0.5, z, 7.5, 1.0, 0.72, 0.4);
  return { top, tankR };
}

/* ---------------- 钟楼（地标） ---------------- */
function buildBellTower(S, x, z){
  const gy = heightAt(x, z);
  const W = 5.2, H = 23.5;
  S.box(x - W / 2 - 0.6, gy - 1.2, z - W / 2 - 0.6, x + W / 2 + 0.6, gy + 1.2, z + W / 2 + 0.6, PAL.sandstone);
  S.box(x - W / 2, gy, z - W / 2, x + W / 2, gy + H, z + W / 2, PAL.woodPlank);
  S.clear(x - W / 2 + 0.5, gy + 0.2, z - W / 2 + 0.5, x + W / 2 - 0.5, gy + H - 0.6, z + W / 2 - 0.5);
  // 竖向板条
  for (let i = -2; i <= 2; i++){
    S.box(x + i * 1.15 - 0.14, gy, z - W / 2 - 0.16, x + i * 1.15 + 0.14, gy + H - 3.2, z - W / 2 + 0.02, PAL.woodDark);
    S.box(x + i * 1.15 - 0.14, gy, z + W / 2 - 0.02, x + i * 1.15 + 0.14, gy + H - 3.2, z + W / 2 + 0.16, PAL.woodDark);
  }
  // 钟室（四面开敞）
  const bh = gy + H - 8.4;
  for (const s of [-1, 1]){
    S.box(x - W / 2 - 0.5, bh, z + s * (W / 2 - 0.3) - 0.25, x + W / 2 + 0.5, bh + 0.7, z + s * (W / 2 - 0.3) + 0.25, PAL.woodDark);
    S.box(x + s * (W / 2 - 0.3) - 0.25, bh, z - W / 2 - 0.5, x + s * (W / 2 - 0.3) + 0.25, bh + 0.7, z + W / 2 + 0.5, PAL.woodDark);
  }
  // 大钟
  S.box(x - 1.5, bh + 1.5, z - 1.5, x + 1.5, bh + 2.4, z + 1.5, PAL.gold);
  S.box(x - 1.05, bh + 0.8, z - 1.05, x + 1.05, bh + 1.5, z + 1.05, PAL.gold);
  S.box(x - 1.9, bh + 2.4, z - 1.9, x + 1.9, bh + 2.9, z + 1.9, PAL.woodDark);
  S.box(x - 0.3, bh + 0.2, z - 0.3, x + 0.3, bh + 1.2, z + 0.3, PAL.iron);
  // 钟面（四面）
  const cy = gy + H - 3.0;
  for (const s of [-1, 1]){
    S.box(x - 2.1, cy - 2.1, z + s * (W / 2) - 0.12, x + 2.1, cy + 2.1, z + s * (W / 2) + 0.22, PAL.clockFace);
    S.box(x - 2.45, cy - 2.45, z + s * (W / 2) - 0.16, x + 2.45, cy - 2.1, z + s * (W / 2) + 0.26, PAL.woodDark);
    S.box(x - 2.45, cy + 2.1, z + s * (W / 2) - 0.16, x + 2.45, cy + 2.45, z + s * (W / 2) + 0.26, PAL.woodDark);
    S.box(x + s * (W / 2) - 0.12, cy - 2.1, z - 2.1, x + s * (W / 2) + 0.22, cy + 2.1, z + 2.1, PAL.clockFace);
    S.box(x + s * (W / 2) - 0.16, cy - 2.45, z - 2.45, x + s * (W / 2) + 0.26, cy - 2.1, z + 2.45, PAL.woodDark);
    S.box(x + s * (W / 2) - 0.16, cy + 2.1, z - 2.45, x + s * (W / 2) + 0.26, cy + 2.45, z + 2.45, PAL.woodDark);
    S.addGlow(x, cy, z + s * (W / 2 + 0.8), 3.4, 1.0, 0.86, 0.6);
    S.addGlow(x + s * (W / 2 + 0.8), cy, z, 3.4, 1.0, 0.86, 0.6);
  }
  // 塔顶
  S.box(x - W / 2 - 0.8, gy + H, z - W / 2 - 0.8, x + W / 2 + 0.8, gy + H + 0.6, z + W / 2 + 0.8, PAL.woodDark);
  for (let i = 0; i < 8; i++){
    const r = (W / 2 + 0.75) * (1 - i / 8);
    S.box(x - r, gy + H + 0.6 + i * 0.85, z - r, x + r, gy + H + 1.45 + i * 0.85, z + r, PAL.roofRed);
  }
  S.box(x - 0.16, gy + H + 7.4, z - 0.16, x + 0.16, gy + H + 9.6, z + 0.16, PAL.iron);
  S.box(x - 0.8, gy + H + 8.6, z - 0.16, x + 0.8, gy + H + 8.95, z + 0.16, PAL.gold);
  return { top: gy + H };
}

/* ---------------- 风车（塔身；叶片为动态件） ---------------- */
function buildWindmill(S, x, z){
  const gy = heightAt(x, z);
  const H = 15.5, R0 = 3.1, R1 = 1.15;
  for (let i = 0; i < 4; i++){
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    for (let s = 0; s < 14; s++){
      const t0 = s / 14, t1 = (s + 1) / 14;
      const y0 = gy + t0 * H, y1 = gy + t1 * H;
      const r0 = lerp(R0, R1, t0), r1 = lerp(R0, R1, t1);
      S.box(x + Math.cos(a) * r0 - 0.19, y0, z + Math.sin(a) * r0 - 0.19,
            x + Math.cos(a) * r1 + 0.19, y1, z + Math.sin(a) * r1 + 0.19, PAL.woodGray);
    }
  }
  for (const t of [0.16, 0.38, 0.6, 0.82]){
    const r = lerp(R0, R1, t) * 1.12;
    S.box(x - r, gy + t * H, z - r, x + r, gy + t * H + 0.22, z + r, PAL.woodDark);
    S.clear(x - r + 0.25, gy + t * H - 0.1, z - r + 0.25, x + r - 0.25, gy + t * H + 0.32, z + r - 0.25);
  }
  // 机头
  S.box(x - 1.05, gy + H, z - 1.35, x + 1.05, gy + H + 2.1, z + 1.35, PAL.metalDark);
  S.box(x - 0.55, gy + H + 2.1, z - 0.75, x + 0.55, gy + H + 2.75, z + 0.75, PAL.metal);
  // 尾舵
  S.box(x - 0.16, gy + H + 0.5, z + 1.35, x + 0.16, gy + H + 1.7, z + 5.6, PAL.iron);
  S.box(x - 0.18, gy + H + 0.35, z + 4.6, x + 0.18, gy + H + 2.5, z + 6.4, PAL.canvasRed);
  // 水槽
  S.box(x - 4.2, gy - 0.2, z + 4.4, x + 4.2, gy + 1.0, z + 6.6, PAL.woodDark);
  S.clear(x - 3.8, gy + 0.45, z + 4.8, x + 3.8, gy + 1.15, z + 6.2);
  S.box(x - 3.8, gy + 0.45, z + 4.8, x + 3.8, gy + 0.62, z + 6.2, PAL.water);
  return { hub: [x, gy + H + 1.35, z - 1.7] };
}

/* ---------------- 火车站 ---------------- */
function buildStation(S, x, z){
  const w = 21, d = 9.5, h = 5.2;
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const yF = 0.85;
  S.box(x0 - 0.4, -0.6, z0 - 0.4, x1 + 0.4, yF - 0.3, z1 + 0.4, PAL.sandstone);
  S.box(x0, yF - 0.35, z0, x1, yF, z1, PAL.woodDark);
  S.box(x0, yF, z0, x1, h, z1, PAL.cream);
  S.clear(x0 + 0.45, yF, z0 + 0.45, x1 - 0.45, h, z1 - 0.45);
  doorOpening(S, x, yF, z1, 2.2, 3.2, 1, PAL.woodDark);
  for (const ox of [-7.6, -3.9, 3.9, 7.6]) windowBox(S, x + ox, yF + 1.25, z1, 1.6, 2.0, 1, PAL.woodDark);
  windowBox(S, x0, yF + 1.25, z - 1.6, 1.5, 1.9, -1, PAL.woodDark);
  windowBox(S, x0, yF + 1.25, z + 1.6, 1.5, 1.9, -1, PAL.woodDark);
  windowBox(S, x1, yF + 1.25, z - 1.6, 1.5, 1.9, 1, PAL.woodDark);
  windowBox(S, x1, yF + 1.25, z + 1.6, 1.5, 1.9, 1, PAL.woodDark);
  gableRoof(S, x0, x1, z0, z1, h, 2.6, PAL.roofRed, 1.0, true);
  signBoard(S, 'STATION', x, h - 2.2, z1, 1, PAL.red, PAL.whitePlaster, 0.26);
  // 站台 + 雨棚
  S.box(x0 - 3.0, yF - 0.35, z1, x1 + 3.0, yF, z1 + 6.2, PAL.woodPlank);
  S.box(x0 - 3.2, yF - 0.9, z1 + 5.9, x1 + 3.2, yF - 0.3, z1 + 6.4, PAL.woodDark);
  for (let i = -3; i <= 3; i++){
    const px = x + i * 3.4;
    S.box(px - 0.18, yF, z1 + 5.3, px + 0.18, yF + 3.4, z1 + 5.66, PAL.woodDark);
  }
  S.box(x0 - 3.4, yF + 3.4, z1 - 0.2, x1 + 3.4, yF + 3.95, z1 + 6.4, PAL.roofShingle);
  // 长椅与行李
  S.box(x - 6.5, yF, z1 + 3.9, x - 3.2, yF + 0.85, z1 + 4.5, PAL.woodDark);
  S.box(x + 3.2, yF, z1 + 3.9, x + 6.5, yF + 0.85, z1 + 4.5, PAL.woodDark);
  S.box(x + 7.6, yF, z1 + 2.2, x + 9.2, yF + 1.25, z1 + 3.4, PAL.woodPlank);
  S.addGlow(x, yF + 2.2, z1 + 2.6, 4.2, 1.0, 0.74, 0.4);
  // 站牌灯
  S.box(x - 0.16, yF + 3.2, z1 + 6.3, x + 0.16, yF + 5.0, z1 + 6.6, PAL.woodDark);
  S.box(x - 0.55, yF + 5.0, z1 + 6.1, x + 0.55, yF + 6.0, z1 + 6.8, PAL.lampGlass);
  S.addGlow(x, yF + 5.5, z1 + 6.6, 2.4, 1.0, 0.68, 0.3);
}

/* ---------------- 山顶瞭望台 ---------------- */
function buildLookout(S, x, z){
  const gy = heightAt(x, z);
  const W = 8.4;
  S.box(x - W / 2 - 1.2, gy - 1.4, z - W / 2 - 1.2, x + W / 2 + 1.2, gy + 0.5, z + W / 2 + 1.2, PAL.sandstone);
  for (const sx of [-1, 1]){
    for (const sz of [-1, 1]){
      S.box(x + sx * (W / 2 - 0.6) - 0.28, gy, z + sz * (W / 2 - 0.6) - 0.28,
            x + sx * (W / 2 - 0.6) + 0.28, gy + 5.4, z + sz * (W / 2 - 0.6) + 0.28, PAL.woodDark);
    }
  }
  S.box(x - W / 2, gy + 5.4, z - W / 2, x + W / 2, gy + 5.85, z + W / 2, PAL.woodPlank);
  // 栏杆
  for (let i = -4; i <= 4; i++){
    S.box(x + i * 0.95 - 0.11, gy + 5.85, z - W / 2 + 0.12, x + i * 0.95 + 0.11, gy + 6.95, z - W / 2 + 0.34, PAL.woodDark);
    S.box(x + i * 0.95 - 0.11, gy + 5.85, z + W / 2 - 0.34, x + i * 0.95 + 0.11, gy + 6.95, z + W / 2 - 0.12, PAL.woodDark);
    S.box(x - W / 2 + 0.12, gy + 5.85, z + i * 0.95 - 0.11, x - W / 2 + 0.34, gy + 6.95, z + i * 0.95 + 0.11, PAL.woodDark);
    S.box(x + W / 2 - 0.34, gy + 5.85, z + i * 0.95 - 0.11, x + W / 2 - 0.12, gy + 6.95, z + i * 0.95 + 0.11, PAL.woodDark);
  }
  for (const s of [-1, 1]){
    S.box(x - W / 2, gy + 6.75, z + s * (W / 2 - 0.22), x + W / 2, gy + 6.95, z + s * (W / 2 - 0.05), PAL.woodDark);
    S.box(x + s * (W / 2 - 0.22), gy + 6.75, z - W / 2, x + s * (W / 2 - 0.05), gy + 6.95, z + W / 2, PAL.woodDark);
  }
  // 顶棚
  for (const sx of [-1, 1]){
    for (const sz of [-1, 1]){
      S.box(x + sx * (W / 2 - 1.4) - 0.22, gy + 5.85, z + sz * (W / 2 - 1.4) - 0.22,
            x + sx * (W / 2 - 1.4) + 0.22, gy + 10.2, z + sz * (W / 2 - 1.4) + 0.22, PAL.woodDark);
    }
  }
  S.box(x - W / 2 - 0.8, gy + 10.2, z - W / 2 - 0.8, x + W / 2 + 0.8, gy + 10.75, z + W / 2 + 0.8, PAL.roofShingle);
  for (let i = 0; i < 4; i++){
    const r = (W / 2 + 0.8) * (1 - i * 0.22);
    S.box(x - r, gy + 10.75 + i * 0.6, z - r, x + r, gy + 11.35 + i * 0.6, z + r, PAL.roofShingle);
  }
  // 梯子
  for (let i = 0; i < 11; i++){
    S.box(x - 0.75, gy + i * 0.55, z - W / 2 + 0.35, x + 0.75, gy + i * 0.55 + 0.15, z - W / 2 + 0.62, PAL.woodGray);
  }
  // 火盆 + 旗帜
  S.box(x - 1.0, gy + 5.85, z + 1.6, x + 1.0, gy + 6.55, z + 3.4, PAL.iron);
  S.addGlow(x, gy + 6.9, z + 2.5, 4.0, 1.0, 0.55, 0.22);
  S.box(x + W / 2 - 1.0, gy + 6.95, z - 0.12, x + W / 2 - 0.75, gy + 12.2, z + 0.12, PAL.woodDark);
  S.box(x + W / 2 - 4.4, gy + 10.2, z - 0.1, x + W / 2 - 1.0, gy + 12.2, z + 0.1, PAL.red);
  return { top: gy + 5.85 };
}

/* ---------------- 小型附属建筑 ---------------- */
function buildShed(S, x, z, w, d, h, face, mat, roofM){
  const F = pick(face, 1);
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const zf = F > 0 ? z1 : z0;
  S.box(x0 - 0.15, -0.5, z0 - 0.15, x1 + 0.15, 0.35, z1 + 0.15, PAL.dirt);
  S.box(x0, 0.35, z0, x1, h, z1, pick(mat, PAL.woodGray));
  S.clear(x0 + 0.35, 0.35, z0 + 0.35, x1 - 0.35, h, z1 - 0.35);
  S.clear(x - 1.0, 0.35, zf - 0.4 * F, x + 1.0, 0.35 + 2.6, zf + 0.4 * F);
  gableRoof(S, x0, x1, z0, z1, h, 1.5, pick(roofM, PAL.roofShingle), 0.5, true);
}

function buildHouse(S, x, z, face, w, d, h, mat){
  westernBuilding(S, {
    x, z, w: pick(w, 9), d: pick(d, 8), h: pick(h, 4.0), face: pick(face, 1),
    wall: pick(mat, PAL.woodGray), trim: PAL.cream, roof: PAL.roofShingle,
    ff: 0, porch: true, porchDepth: 2.0, rise: 1.8
  });
}

function buildSilo(S, x, z, r, h){
  const gy = heightAt(x, z);
  const seg = 10;
  for (let i = 0; i < seg; i++){
    const a = (i / seg) * Math.PI * 2;
    const cx = x + Math.cos(a) * r * 0.9, cz = z + Math.sin(a) * r * 0.9;
    const ws = 2 * r * Math.sin(Math.PI / seg) * 1.12;
    S.box(cx - ws / 2, gy, cz - ws / 2, cx + ws / 2, gy + h, cz + ws / 2, PAL.woodPlank);
  }
  for (let i = 0; i < 6; i++){
    const rr = r * 1.1 * (1 - i / 6);
    S.box(x - rr, gy + h + i * 0.7, z - rr, x + rr, gy + h + 0.7 + i * 0.7, z + rr, PAL.metalDark);
  }
}

/* ============================================================
   05_props.js — 道具与动态对象
   静态道具并入世界网格；动态件（机车、风车叶、风滚草、火焰、云、
   钟针）以独立网格输出，由应用层每帧驱动。
   ============================================================ */
'use strict';

/* ---------------- 静态道具 ---------------- */
function cactus(S, x, z, scale){
  scale = pick(scale, 1);
  const gy = heightAt(x, z);
  const th = (3.4 + fbm(x * 0.7, z * 0.7, 2) * 4.2) * scale;
  const r = 0.42 * scale;
  S.box(x - r, gy - 0.6, z - r, x + r, gy + th, z + r, PAL.cactus);
  S.box(x - r * 0.8, gy + th, z - r * 0.8, x + r * 0.8, gy + th + 0.35, z + r * 0.8, PAL.cactusDark);
  const arms = fbm(x * 1.3 + 4, z * 1.3 + 9, 2) > 0.42 ? 2 : 1;
  for (let a = 0; a < arms; a++){
    const dir = a === 0 ? 1 : -1;
    const ay = gy + th * (0.42 + a * 0.16);
    const al = (1.5 + a * 0.5) * scale;
    S.box(x + dir * r * 0.4, ay, z - r * 0.8, x + dir * (r + al), ay + r * 1.5, z + r * 0.8, PAL.cactus);
    S.box(x + dir * (r + al) - r * 0.75, ay, z - r * 0.75, x + dir * (r + al) + r * 0.75, ay + 1.9 * scale, z + r * 0.75, PAL.cactus);
    S.box(x + dir * (r + al) - r * 0.6, ay + 1.9 * scale, z - r * 0.6, x + dir * (r + al) + r * 0.6, ay + 2.2 * scale, z + r * 0.6, PAL.cactusDark);
  }
}

function fenceLine(S, x0, z0, x1, z1, h, mat){
  mat = pick(mat, PAL.woodGray);
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 2.6));
  for (let i = 0; i <= n; i++){
    const t = i / n;
    const px = lerp(x0, x1, t), pz = lerp(z0, z1, t);
    const gy = heightAt(px, pz);
    S.box(px - 0.16, gy - 0.4, pz - 0.16, px + 0.16, gy + h, pz + 0.16, mat);
  }
  for (const ry of [h * 0.45, h * 0.8]){
    for (let i = 0; i < n; i++){
      const t0 = i / n, t1 = (i + 1) / n;
      const ax = lerp(x0, x1, t0), az = lerp(z0, z1, t0);
      const bx = lerp(x0, x1, t1), bz = lerp(z0, z1, t1);
      const gy = Math.max(heightAt(ax, az), heightAt(bx, bz));
      const xmin = Math.min(ax, bx), xmax = Math.max(ax, bx);
      const zmin = Math.min(az, bz), zmax = Math.max(az, bz);
      S.box(xmin - 0.12, gy + ry - 0.1, zmin - 0.12, xmax + 0.12, gy + ry + 0.12, zmax + 0.12, mat);
    }
  }
}

function boardwalk(S, x0, x1, z0, z1, y){
  S.box(x0, y - 0.5, z0, x1, y, z1, PAL.woodPlank);
  for (let x = x0 + 1; x < x1; x += 2.2){
    S.box(x - 0.16, y - 1.6, z0 + 0.15, x + 0.16, y - 0.5, z0 + 0.45, PAL.woodDark);
    S.box(x - 0.16, y - 1.6, z1 - 0.45, x + 0.16, y - 0.5, z1 - 0.15, PAL.woodDark);
  }
}

function barrel(S, x, z, y, mat){
  y = pick(y, 0);
  const gy = y > 0 ? y : heightAt(x, z);
  const r = 0.55;
  const seg = 8;
  for (let i = 0; i < seg; i++){
    const a = (i / seg) * Math.PI * 2;
    const cx = x + Math.cos(a) * r * 0.82, cz = z + Math.sin(a) * r * 0.82;
    const ws = 2 * r * Math.sin(Math.PI / seg) * 1.15;
    S.box(cx - ws / 2, gy, cz - ws / 2, cx + ws / 2, gy + 1.15, cz + ws / 2, pick(mat, PAL.woodPlank));
  }
  S.box(x - r * 0.85, gy + 1.15, z - r * 0.85, x + r * 0.85, gy + 1.3, z + r * 0.85, PAL.woodDark);
  S.box(x - r * 0.95, gy + 0.18, z - r * 0.95, x + r * 0.95, gy + 0.32, z + r * 0.95, PAL.iron);
  S.box(x - r * 0.95, gy + 0.85, z - r * 0.95, x + r * 0.95, gy + 0.99, z + r * 0.95, PAL.iron);
}

function crate(S, x, z, y, s){
  y = pick(y, 0);
  s = pick(s, 1.15);
  const gy = y > 0 ? y : heightAt(x, z);
  S.box(x - s / 2, gy, z - s / 2, x + s / 2, gy + s, z + s / 2, PAL.woodLight);
  S.box(x - s / 2 - 0.04, gy + s * 0.42, z - s / 2 - 0.04, x + s / 2 + 0.04, gy + s * 0.58, z + s / 2 + 0.04, PAL.woodDark);
}

function hayBale(S, x, z, y){
  y = pick(y, 0);
  const gy = y > 0 ? y : heightAt(x, z);
  S.box(x - 1.1, gy, z - 0.75, x + 1.1, gy + 1.4, z + 0.75, PAL.grassDry);
  S.box(x - 1.1, gy + 0.3, z - 0.79, x + 1.1, gy + 0.44, z + 0.79, PAL.canvas);
  S.box(x - 1.1, gy + 0.95, z - 0.79, x + 1.1, gy + 1.09, z + 0.79, PAL.canvas);
}

function lanternPost(S, x, z, h, y){
  const gy = pick(y, 0) > 0 ? y : heightAt(x, z);
  h = pick(h, 4.2);
  S.box(x - 0.17, gy, z - 0.17, x + 0.17, gy + h, z + 0.17, PAL.woodDark);
  S.box(x - 0.55, gy + h, z - 0.55, x + 0.55, gy + h + 0.22, z + 0.55, PAL.woodDark);
  S.box(x - 0.42, gy + h + 0.22, z - 0.42, x + 0.42, gy + h + 1.15, z + 0.42, PAL.lampGlass);
  S.box(x - 0.55, gy + h + 1.15, z - 0.55, x + 0.55, gy + h + 1.42, z + 0.55, PAL.metalDark);
  S.box(x - 0.2, gy + h + 1.42, z - 0.2, x + 0.2, gy + h + 1.75, z + 0.2, PAL.metalDark);
  S.addGlow(x, gy + h + 0.7, z, 3.6, 1.0, 0.66, 0.30);
}

function hitchRail(S, x0, x1, z, y){
  const gy = pick(y, 0) > 0 ? y : heightAt((x0 + x1) / 2, z);
  for (let x = x0; x <= x1 + 0.01; x += 2.8){
    S.box(x - 0.15, gy, z - 0.15, x + 0.15, gy + 1.35, z + 0.15, PAL.woodDark);
  }
  S.box(x0, gy + 1.1, z - 0.13, x1, gy + 1.32, z + 0.13, PAL.woodDark);
  S.box(x0, gy + 0.55, z - 0.11, x1, gy + 0.73, z + 0.11, PAL.woodDark);
}

function telegraphPole(S, x, z){
  const gy = heightAt(x, z);
  S.box(x - 0.19, gy - 0.5, z - 0.19, x + 0.19, gy + 7.6, z + 0.19, PAL.woodDark);
  S.box(x - 1.5, gy + 6.4, z - 0.15, x + 1.5, gy + 6.65, z + 0.15, PAL.woodDark);
  S.box(x - 1.2, gy + 7.1, z - 0.15, x + 1.2, gy + 7.32, z + 0.15, PAL.woodDark);
  for (const ox of [-1.35, -0.45, 0.45, 1.35]){
    S.box(x + ox - 0.13, gy + 6.65, z - 0.13, x + ox + 0.13, gy + 6.95, z + 0.13, PAL.glass);
    S.box(x + ox - 0.13, gy + 7.32, z - 0.13, x + ox + 0.13, gy + 7.58, z + 0.13, PAL.glass);
  }
}

function boulder(S, x, z, r){
  const gy = heightAt(x, z);
  const seg = 7;
  for (let i = 0; i < seg; i++){
    const a = (i / seg) * Math.PI * 2;
    const cx = x + Math.cos(a) * r * 0.55, cz = z + Math.sin(a) * r * 0.55;
    const ws = r * 1.05;
    const hh = r * (0.6 + fbm(x * 0.3 + i, z * 0.3, 2) * 0.7);
    S.box(cx - ws / 2, gy - r * 0.4, cz - ws / 2, cx + ws / 2, gy + hh, cz + ws / 2, i % 2 ? PAL.rockRed : PAL.rockRedDark);
  }
}

function campfire(S, x, z, y){
  const gy = pick(y, 0) > 0 ? y : heightAt(x, z);
  for (let i = 0; i < 9; i++){
    const a = (i / 9) * Math.PI * 2;
    S.box(x + Math.cos(a) * 1.35 - 0.32, gy, z + Math.sin(a) * 1.35 - 0.32,
          x + Math.cos(a) * 1.35 + 0.32, gy + 0.5, z + Math.sin(a) * 1.35 + 0.32, i % 2 ? PAL.rockRedDark : PAL.rockPurple);
  }
  for (const a of [0.4, 2.1, 3.9]){
    S.box(x - Math.cos(a) * 1.0, gy + 0.12, z - Math.sin(a) * 1.0, x + Math.cos(a) * 1.0, gy + 0.62, z + Math.sin(a) * 1.0, PAL.woodDark);
  }
  S.addGlow(x, gy + 1.0, z, 6.5, 1.0, 0.52, 0.20);
  return gy;
}

function tent(S, x, z, face){
  const gy = heightAt(x, z);
  const F = pick(face, 1);
  S.box(x - 2.6, gy - 0.1, z - 2.0, x + 2.6, gy + 0.18, z + 2.0, PAL.canvas);
  for (let i = 0; i < 6; i++){
    const w = 2.6 * (1 - i / 6);
    S.box(x - w, gy + 0.18 + i * 0.42, z - 2.0 + i * 0.34, x + w, gy + 0.6 + i * 0.42, z + 2.0 - i * 0.34, PAL.canvas);
  }
  S.box(x - 2.7, gy, z - 2.1, x + 2.7, gy + 0.35, z - 1.9, PAL.woodDark);
  S.clear(x - 0.9, gy, z + 1.2 * F - 0.4, x + 0.9, gy + 2.1, z + 1.2 * F + 0.4);
  S.box(x - 1.1, gy, z + 1.55 * F - 0.12, x + 1.1, gy + 2.35, z + 1.55 * F + 0.12, PAL.canvasRed);
}

function gravestone(S, x, z, kind){
  const gy = heightAt(x, z);
  if (kind === 1){
    S.box(x - 0.16, gy, z - 0.16, x + 0.16, gy + 1.9, z + 0.16, PAL.woodGray);
    S.box(x - 0.62, gy + 1.35, z - 0.16, x + 0.62, gy + 1.65, z + 0.16, PAL.woodGray);
  } else {
    S.box(x - 0.55, gy, z - 0.16, x + 0.55, gy + 1.25, z + 0.16, PAL.bone);
    S.box(x - 0.42, gy + 1.25, z - 0.16, x + 0.42, gy + 1.55, z + 0.16, PAL.bone);
  }
}

/* ---------------- 蒸汽机车（动态，局部坐标：车头朝 +X） ---------------- */
function wheelDisc(S, cx, cy, cz, r, thick, mat, hub){
  const n = 8;
  for (let i = 0; i < n; i++){
    const y0 = cy - r + (2 * r) * i / n, y1 = cy - r + (2 * r) * (i + 1) / n;
    const ym = (y0 + y1) / 2;
    const hw = Math.sqrt(Math.max(0, r * r - (ym - cy) * (ym - cy)));
    S.box(cx - thick / 2, y0, cz - hw, cx + thick / 2, y1, cz + hw, mat);
    S.box(cx - thick / 2 - 0.1, y0, cz - hw, cx - thick / 2 + 0.12, y1, cz + hw, hub || PAL.metalDark);
    S.box(cx + thick / 2 - 0.12, y0, cz - hw, cx + thick / 2 + 0.1, y1, cz + hw, hub || PAL.metalDark);
  }
}

function buildTrain(){
  const S = new Solid('train');
  // ---- 车架 ----
  S.box(-17.2, 1.15, -1.75, 1.2, 1.75, 1.75, PAL.iron);
  // ---- 锅炉 ----
  const seg = 8;
  for (let i = 0; i < seg; i++){
    const a = (i / seg) * Math.PI * 2;
    const cy = 3.55 + Math.sin(a) * 1.28, cz = Math.cos(a) * 1.28;
    S.box(-6.6, cy - 0.42, cz - 0.42, 0.6, cy + 0.42, cz + 0.42, i % 2 ? PAL.black : PAL.metalDark);
  }
  S.box(-6.9, 2.2, -1.45, 0.9, 4.9, 1.45, PAL.black);
  S.clear(-6.6, 2.55, -1.15, 0.55, 4.6, 1.15);
  // 烟囱
  S.box(-4.85, 4.6, -0.95, -3.55, 7.0, 0.95, PAL.black);
  S.box(-5.25, 6.6, -1.35, -3.15, 7.35, 1.35, PAL.black);
  S.box(-5.05, 7.35, -1.15, -3.35, 7.75, 1.15, PAL.metalDark);
  // 汽包
  S.box(-2.85, 4.55, -0.85, -1.15, 5.75, 0.85, PAL.metalDark);
  S.box(-3.05, 5.55, -1.05, -0.95, 5.95, 1.05, PAL.metal);
  // 排障器
  for (let i = 0; i < 5; i++){
    const t = i / 5;
    S.box(0.6 + t * 1.9, 0.75 - t * 0.35, -2.1 + t * 0.55, 0.95 + t * 1.9, 1.5 - t * 0.2, 2.1 - t * 0.55, PAL.iron);
  }
  S.box(0.6, 0.55, -2.35, 2.6, 0.95, 2.35, PAL.iron);
  // 车灯
  S.box(0.65, 4.55, -0.62, 1.35, 5.5, 0.62, PAL.lampGlass);
  S.addGlow(1.6, 5.0, 0, 5.0, 1.0, 0.82, 0.5);
  // ---- 驾驶室 ----
  S.box(-10.4, 1.75, -1.85, -6.4, 6.35, 1.85, PAL.black);
  S.clear(-10.05, 2.1, -1.5, -6.75, 5.85, 1.5);
  S.box(-10.75, 6.35, -2.15, -6.05, 6.85, 2.15, PAL.metalDark);
  S.box(-9.85, 3.95, -1.86, -8.35, 5.35, -1.72, PAL.lampGlass);
  S.box(-9.85, 3.95, 1.72, -8.35, 5.35, 1.86, PAL.lampGlass);
  S.addGlow(-9.1, 4.6, -2.2, 2.4, 1.0, 0.7, 0.35);
  S.addGlow(-9.1, 4.6, 2.2, 2.4, 1.0, 0.7, 0.35);
  // ---- 煤水车 ----
  S.box(-17.0, 1.75, -1.75, -10.6, 4.35, 1.75, PAL.woodDark);
  S.clear(-16.6, 2.15, -1.4, -11.0, 4.1, 1.4);
  for (let i = 0; i < 26; i++){
    const bx = -16.4 + (i % 7) * 0.78, bz = -1.15 + Math.floor(i / 7) * 0.72;
    S.box(bx, 4.1, bz, bx + 0.68, 4.45 + (i % 3) * 0.16, bz + 0.62, PAL.black);
  }
  // ---- 车轮（轨距 1.66m）----
  for (const wz of [-0.83, 0.83]){
    wheelDisc(S, -4.6, 1.55, wz, 1.55, 0.55, PAL.iron, PAL.red);
    wheelDisc(S, -0.9, 1.55, wz, 1.55, 0.55, PAL.iron, PAL.red);
    wheelDisc(S, -14.4, 0.95, wz, 0.95, 0.5, PAL.iron);
    wheelDisc(S, -11.6, 0.95, wz, 0.95, 0.5, PAL.iron);
  }
  // 连杆
  for (const wz of [-1.22, 1.22]){
    S.box(-5.4, 1.35, wz, -0.1, 1.75, wz + 0.22, PAL.metal);
    S.box(-5.4, 1.55, wz - 0.1, -5.0, 2.9, wz + 0.32, PAL.metal);
  }
  // ---- 货车车厢 x3 ----
  for (let c = 0; c < 3; c++){
    const bx = -32.4 + c * 9.2;
    const col = c === 1 ? PAL.woodRed : PAL.woodPlank;
    S.box(bx, 1.75, -1.75, bx + 8.2, 5.15, 1.75, col);
    S.clear(bx + 0.35, 2.1, -1.4, bx + 7.85, 4.8, 1.4);
    S.box(bx - 0.25, 5.15, -1.95, bx + 8.45, 5.6, 1.95, PAL.metalDark);
    for (let k = 0; k < 6; k++){
      S.box(bx + 0.5 + k * 1.25, 2.2, -1.86, bx + 1.15 + k * 1.25, 4.7, -1.72, PAL.woodDark);
      S.box(bx + 0.5 + k * 1.25, 2.2, 1.72, bx + 1.15 + k * 1.25, 4.7, 1.86, PAL.woodDark);
    }
    for (const wz of [-0.83, 0.83]){
      wheelDisc(S, bx + 1.9, 0.95, wz, 0.95, 0.5, PAL.iron);
      wheelDisc(S, bx + 6.3, 0.95, wz, 0.95, 0.5, PAL.iron);
    }
    S.box(bx + 8.2, 1.35, -0.35, bx + 9.0, 1.85, 0.35, PAL.iron);
  }
  // ---- 守车 ----
  const bx = -42.4;
  S.box(bx, 1.75, -1.75, bx + 8.2, 5.35, 1.75, PAL.woodRed);
  S.clear(bx + 0.35, 2.1, -1.4, bx + 7.85, 5.0, 1.4);
  S.box(bx - 0.3, 5.35, -2.05, bx + 8.5, 5.85, 2.05, PAL.roofRed);
  S.box(bx + 2.6, 3.1, -1.86, bx + 5.6, 4.6, -1.72, PAL.lampGlass);
  S.box(bx + 2.6, 3.1, 1.72, bx + 5.6, 4.6, 1.86, PAL.lampGlass);
  S.addGlow(bx + 4.1, 3.9, -2.2, 2.6, 1.0, 0.7, 0.35);
  S.addGlow(bx + 4.1, 3.9, 2.2, 2.6, 1.0, 0.7, 0.35);
  for (const wz of [-0.83, 0.83]){
    wheelDisc(S, bx + 1.9, 0.95, wz, 0.95, 0.5, PAL.iron);
    wheelDisc(S, bx + 6.3, 0.95, wz, 0.95, 0.5, PAL.iron);
  }
  S.box(bx - 1.0, 1.35, -0.35, bx - 0.2, 1.85, 0.35, PAL.iron);
  return S;
}

/* ---------------- 风车叶（动态） ---------------- */
function buildWindmillBlades(){
  const S = new Solid('windmill-blades');
  S.box(-0.85, -0.85, -0.95, 0.85, 0.85, 0.35, PAL.metalDark);
  for (let i = 0; i < 12; i++){
    const a = (i / 12) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let s = 0; s < 5; s++){
      const r0 = 1.3 + s * 1.15, r1 = r0 + 1.2;
      const w0 = 0.42 + s * 0.06;
      S.box(ca * r0 - w0 * Math.abs(sa) - 0.12, sa * r0 - w0 * Math.abs(ca) - 0.12, -0.1,
            ca * r1 + w0 * Math.abs(sa) + 0.12, sa * r1 + w0 * Math.abs(ca) + 0.12, 0.32, PAL.metal);
    }
    S.box(ca * 1.15 - 0.16, sa * 1.15 - 0.16, -0.4, ca * 1.15 + 0.16, sa * 1.15 + 0.16, 0.62, PAL.metalDark);
  }
  return S;
}

/* ---------------- 风滚草（动态） ---------------- */
function buildTumbleweed(){
  const S = new Solid('tumbleweed');
  for (let i = 0; i < 16; i++){
    const a = i * 0.6284, b = i * 1.1173;
    const r = 0.95;
    const x0 = Math.cos(a) * r, y0 = Math.sin(b) * r, z0 = Math.sin(a * 1.3) * r;
    const x1 = -x0 * 0.92, y1 = -y0 * 0.92, z1 = -z0 * 0.92;
    const lo = [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)];
    const hi = [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)];
    S.box(lo[0], lo[1], lo[2], hi[0] + 0.12, hi[1] + 0.12, hi[2] + 0.12, i % 3 ? PAL.scrub : PAL.grassDry);
  }
  return S;
}

/* ---------------- 云（动态） ---------------- */
function buildCloud(seed){
  const S = new Solid('cloud');
  const n = 7 + (seed % 4);
  for (let i = 0; i < n; i++){
    const a = hash2i(seed * 13 + i, seed * 7 + i * 3);
    const b = hash2i(seed * 5 + i * 11, seed * 17 + i);
    const c = hash2i(seed * 3 + i * 7, seed * 23 + i * 5);
    const x = (a - 0.5) * 46, y = (b - 0.5) * 7, z = (c - 0.5) * 22;
    const w = 12 + a * 22, h = 3.5 + b * 5.5, d = 8 + c * 13;
    S.box(x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2, PAL.whitePlaster);
    S.box(x - w / 2 - 4, y - h / 2 + 1.2, z - d / 2 + 2, x + w / 2 + 4, y + h / 2 - 1.0, z + d / 2 - 2, PAL.cream);
  }
  return S;
}

/* ---------------- 钟针（动态） ---------------- */
function buildClockHand(len, width, mat){
  const S = new Solid('clock-hand');
  S.box(-width / 2, 0, -0.12, width / 2, len, 0.12, mat);
  return S;
}

/* ---------------- 马车（静态） ---------------- */
function buildStagecoach(S, x, z, y, rot){
  const gy = pick(y, 0) > 0 ? y : heightAt(x, z);
  const R = rot || 0;
  const ca = Math.cos(R), sa = Math.sin(R);
  const P = (lx, ly, lz) => [x + lx * ca - lz * sa, gy + ly, z + lx * sa + lz * ca];
  const B = (ax, ay, az, bx, by, bz, mat) => {
    const p0 = P(Math.min(ax, bx), Math.min(ay, by), Math.min(az, bz));
    const p1 = P(Math.max(ax, bx), Math.max(ay, by), Math.max(az, bz));
    S.box(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], mat);
  };
  // 车厢
  B(-2.6, 1.75, -1.15, 2.6, 3.6, 1.15, PAL.woodRed);
  B(-2.35, 2.15, -0.95, 2.35, 3.45, 0.95, PAL.woodDark);
  B(-2.75, 3.6, -1.3, 2.75, 3.95, 1.3, PAL.canvas);
  B(-2.4, 1.5, -1.0, 2.4, 1.85, 1.0, PAL.woodDark);
  // 车顶行李
  B(-1.7, 3.95, -0.85, 1.7, 4.55, 0.85, PAL.canvas);
  B(-1.2, 4.55, -0.6, 1.2, 5.0, 0.6, PAL.woodLight);
  // 座位
  B(1.9, 3.95, -0.95, 2.9, 4.45, 0.95, PAL.woodDark);
  // 车辕
  B(2.6, 1.9, -0.16, 8.2, 2.15, 0.16, PAL.woodDark);
  B(2.6, 1.9, -1.15, 8.2, 2.15, -0.85, PAL.woodDark);
  B(2.6, 1.9, 0.85, 8.2, 2.15, 1.15, PAL.woodDark);
  // 车轮
  for (const [wz, wr] of [[-1.65, 1.6], [1.65, 1.6]]){
    for (let i = 0; i < 8; i++){
      const y0 = 1.6 - wr + (2 * wr) * i / 8, y1 = 1.6 - wr + (2 * wr) * (i + 1) / 8;
      const ym = (y0 + y1) / 2;
      const hw = Math.sqrt(Math.max(0, wr * wr - (ym - 1.6) * (ym - 1.6)));
      const q0 = P(-2.6, y0, wz - hw), q1 = P(2.6, y1, wz + hw);
      S.box(q0[0], q0[1], q0[2], q1[0], q1[1], q1[2], PAL.woodDark);
    }
  }
  for (const [wz, wr] of [[-1.55, 1.15], [1.55, 1.15]]){
    for (let i = 0; i < 6; i++){
      const y0 = 1.15 - wr + (2 * wr) * i / 6, y1 = 1.15 - wr + (2 * wr) * (i + 1) / 6;
      const ym = (y0 + y1) / 2;
      const hw = Math.sqrt(Math.max(0, wr * wr - (ym - 1.15) * (ym - 1.15)));
      const q0 = P(2.35, y0, wz - hw), q1 = P(4.35, y1, wz + hw);
      S.box(q0[0], q0[1], q0[2], q1[0], q1[1], q1[2], PAL.woodDark);
    }
  }
  // 两匹马（简模）
  for (const hz of [-1.25, 1.25]){
    B(8.0, 1.9, hz - 0.62, 11.6, 3.45, hz + 0.62, PAL.woodDark);
    B(11.2, 2.6, hz - 0.5, 12.6, 4.3, hz + 0.5, PAL.woodDark);
    B(11.9, 3.4, hz - 0.42, 13.1, 4.15, hz + 0.42, PAL.woodDark);
    for (const lx of [8.5, 11.0]){
      B(lx, 0.1, hz - 0.5, lx + 0.38, 2.0, hz - 0.14, PAL.woodDark);
      B(lx, 0.1, hz + 0.14, lx + 0.38, 2.0, hz + 0.5, PAL.woodDark);
    }
    B(8.1, 2.2, hz - 0.42, 8.6, 3.1, hz + 0.42, PAL.woodDark);
    B(8.15, 2.3, hz - 0.3, 8.45, 3.5, hz + 0.3, PAL.woodDark);
  }
}

/* ============================================================
   06_world.js — 黄沙边镇总装
   汇总地形、建筑、道具、动态件、灯火与游览路径。
   ============================================================ */
'use strict';

function buildFlame(){
  const S = new Solid('flame');
  S.box(-0.55, 0, -0.55, 0.55, 1.05, 0.55, PAL.fire);
  S.box(-0.34, 1.0, -0.34, 0.34, 1.95, 0.34, PAL.fireYellow);
  S.box(-0.16, 1.9, -0.16, 0.16, 2.55, 0.16, PAL.fireYellow);
  S.box(-0.07, 2.45, -0.07, 0.07, 2.85, 0.07, PAL.fire);
  return S;
}

function buildWorld(){
  const t0 = Date.now();
  buildTerrain();

  const solids = [];
  const add = (name, fn) => { const s = new Solid(name); fn(s); solids.push(s); return s; };

  /* ============ 主街：木栈道 ============ */
  add('boardwalk', s => {
    boardwalk(s, -74, 74, -8.5, -6.0, 0.55);
    boardwalk(s, -74, 74, 6.0, 8.5, 0.55);
    // 街口木桥（跨过干河谷支沟）
    s.box(-96, 0.2, -7.0, -74, 0.62, 7.0, PAL.woodPlank);
  });

  /* ============ 北侧建筑（面朝 +Z） ============ */
  const NB = -8.5;                                   // 北侧前墙线
  add('saloon', s => {
    const d = 13;
    westernBuilding(s, {
      x: -52, z: NB - d / 2, w: 17, d, h: 5.6, face: 1, floors: 2, ff: 8.8,
      sign: 'SALOON', wall: PAL.woodPlank, trim: PAL.whitePlaster, rise: 2.8, doorX: -2.4
    });
    // 室内：吧台
    s.box(-59.4, 0.55, -12.6, -54.6, 1.55, -11.4, PAL.woodDark);
    s.box(-59.4, 1.55, -12.75, -54.6, 1.8, -11.25, PAL.woodLight);
    for (let i = 0; i < 8; i++){
      s.box(-59.1 + i * 0.62, 1.8, -12.5, -58.7 + i * 0.62, 2.3 + (i % 3) * 0.18, -11.6, i % 2 ? PAL.glass : PAL.gold);
    }
    s.box(-59.6, 0.55, -21.0, -53.0, 3.6, -20.4, PAL.woodDark);
    for (let i = 0; i < 7; i++) s.box(-59.2 + i * 0.95, 1.6, -20.3, -58.5 + i * 0.95, 2.2, -19.6, PAL.glass);
    // 桌椅
    for (const [tx, tz] of [[-56, -15.5], [-49, -17], [-47, -12.5], [-52.5, -18.5]]){
      s.box(tx - 0.85, 0.55, tz - 0.85, tx + 0.85, 1.15, tz + 0.85, PAL.woodPlank);
      s.box(tx - 0.22, 0.55, tz - 0.22, tx + 0.22, 1.15, tz + 0.22, PAL.woodDark);
      s.box(tx - 1.5, 0.55, tz - 0.35, tx - 0.95, 1.05, tz + 0.35, PAL.woodDark);
      s.box(tx + 0.95, 0.55, tz - 0.35, tx + 1.5, 1.05, tz + 0.35, PAL.woodDark);
    }
    // 三角钢琴
    s.box(-46.6, 0.55, -20.6, -43.2, 1.45, -18.2, PAL.black);
    s.box(-46.6, 1.45, -20.9, -43.2, 1.62, -19.4, PAL.bone);
    // 楼梯
    for (let i = 0; i < 8; i++) s.box(-44.2, 0.55 + i * 0.36, -19.4 + i * 0.42, -42.2, 0.91 + i * 0.36, -18.98 + i * 0.42, PAL.woodDark);
    // 吊灯
    s.box(-52.2, 4.35, -15.2, -51.8, 4.6, -14.8, PAL.iron);
    s.box(-52.75, 3.75, -15.35, -51.25, 4.35, -14.65, PAL.lampGlass);
    s.addGlow(-52, 3.9, -15, 3.4, 1.0, 0.72, 0.36);
  });

  add('hotel', s => {
    const d = 12;
    westernBuilding(s, {
      x: -31, z: NB - d / 2, w: 15, d, h: 6.6, face: 1, floors: 2, ff: 8.4,
      sign: 'HOTEL', wall: PAL.woodGray, trim: PAL.cream, rise: 2.6, doorX: 0
    });
    s.box(-36.5, 0.55, -13.2, -25.5, 1.15, -12.4, PAL.woodDark);        // 前台
    s.box(-36.5, 1.15, -13.35, -25.5, 1.38, -12.25, PAL.woodLight);
    for (let i = 0; i < 5; i++) s.box(-35.5 + i * 2.4, 0.55, -19.4, -33.6 + i * 2.4, 1.05, -17.6, PAL.woodPlank);
    s.addGlow(-31, 3.2, -13, 3.0, 1.0, 0.74, 0.4);
  });

  add('general-store', s => {
    const d = 11;
    westernBuilding(s, {
      x: -12, z: NB - d / 2, w: 16, d, h: 5.2, face: 1, ff: 7.2,
      sign: 'GENERAL STORE', signScale: 0.2, wall: PAL.woodPlank, trim: PAL.whitePlaster, rise: 2.2, doorX: 1.6
    });
    s.box(-18.6, 0.55, -12.6, -6.2, 1.45, -11.7, PAL.woodDark);
    for (let i = 0; i < 6; i++){
      s.box(-18.2 + i * 2.1, 0.55, -18.4, -17.2 + i * 2.1, 3.3, -17.7, PAL.woodLight);
      s.box(-18.2 + i * 2.1, 1.6, -18.35, -17.2 + i * 2.1, 1.8, -17.65, PAL.woodDark);
      s.box(-18.2 + i * 2.1, 2.55, -18.35, -17.2 + i * 2.1, 2.75, -17.65, PAL.woodDark);
    }
    for (let i = 0; i < 4; i++) barrel(s, -17.4 + i * 1.35, -12.0, 0.55, PAL.woodPlank);
    crate(s, -7.0, -12.4, 0.55, 1.2);
    crate(s, -7.2, -13.8, 0.55, 1.0);
    s.addGlow(-12, 3.0, -12.2, 3.2, 1.0, 0.74, 0.4);
  });

  add('sheriff', s => {
    const d = 10;
    westernBuilding(s, {
      x: 6, z: NB - d / 2, w: 11, d, h: 4.8, face: 1, ff: 6.2,
      sign: 'SHERIFF', wall: PAL.woodGray, trim: PAL.whitePlaster, rise: 2.0, doorX: 0
    });
    s.box(3.4, 0.55, -12.4, 8.6, 1.35, -11.4, PAL.woodDark);             // 办公桌
    s.box(3.2, 0.55, -13.6, 4.2, 1.45, -12.6, PAL.woodDark);
    s.box(1.2, 0.55, -17.4, 2.4, 1.9, -16.2, PAL.iron);                  // 火炉
    s.box(1.65, 1.9, -16.95, 1.95, 4.2, -16.65, PAL.iron);
    for (let i = 0; i < 4; i++) s.box(3.0, 1.9 + i * 0.0, -18.2 + i * 0.5, 9.0, 2.15, -17.9 + i * 0.5, PAL.woodDark);
    s.addGlow(6, 3.0, -12.5, 2.8, 1.0, 0.76, 0.42);
  });

  add('jail', s => {
    const d = 10;
    westernBuilding(s, {
      x: 19, z: NB - d / 2, w: 10, d, h: 4.6, face: 1, ff: 0,
      wall: PAL.sandstone, trim: PAL.rockTop, roof: PAL.metalDark, rise: 1.6, doorX: 0, sign: 'JAIL'
    });
    for (let i = 0; i < 5; i++){
      s.box(15.6, 0.9, -12.9 + i * 0.55, 22.4, 3.6, -12.75 + i * 0.55, PAL.iron);
    }
    s.box(14.6, 0.55, -16.4, 18.2, 0.95, -15.2, PAL.iron);
    s.box(19.8, 0.55, -16.4, 23.4, 0.95, -15.2, PAL.iron);
    s.addGlow(19, 3.0, -12.6, 2.2, 1.0, 0.72, 0.38);
  });

  add('bank', s => {
    const d = 11;
    westernBuilding(s, {
      x: 32, z: NB - d / 2, w: 13, d, h: 6.2, face: 1, ff: 8.6,
      sign: 'BANK', wall: PAL.sandstone, trim: PAL.whitePlaster, roof: PAL.metalDark, rise: 2.0, doorX: 0
    });
    for (const cx of [-4.4, -1.5, 1.5, 4.4]){
      s.box(32 + cx - 0.55, 0.55, NB - 0.4, 32 + cx + 0.55, 6.0, NB + 0.75, PAL.whitePlaster);
      s.box(32 + cx - 0.75, 0.55, NB - 0.55, 32 + cx + 0.75, 1.05, NB + 0.9, PAL.whitePlaster);
      s.box(32 + cx - 0.75, 5.5, NB - 0.55, 32 + cx + 0.75, 6.0, NB + 0.9, PAL.whitePlaster);
    }
    s.box(27.4, 0.55, -12.4, 36.6, 1.55, -11.5, PAL.woodDark);
    s.box(29.4, 0.55, -18.2, 33.0, 3.2, -15.4, PAL.iron);                // 保险柜
    s.box(29.9, 1.2, -18.35, 32.5, 2.7, -18.15, PAL.metal);
    s.addGlow(32, 3.2, -12.4, 3.0, 1.0, 0.82, 0.5);
  });

  add('barber', s => {
    const d = 9;
    westernBuilding(s, {
      x: 47, z: NB - d / 2, w: 11, d, h: 4.6, face: 1, ff: 6.4,
      sign: 'BARBER', wall: PAL.woodRed, trim: PAL.whitePlaster, rise: 1.9, doorX: 1.2
    });
    s.box(43.2, 0.55, -11.8, 50.8, 1.25, -11.1, PAL.woodDark);
    s.box(44.6, 0.55, -12.8, 46.2, 1.75, -11.6, PAL.red);
    s.addGlow(47, 2.9, -11.6, 2.6, 1.0, 0.78, 0.44);
  });

  add('house-n1', s => buildHouse(s, 62, NB - 4.6, 1, 9, 9, 4.2, PAL.woodPlank));
  add('house-n2', s => buildHouse(s, -68, NB - 5.2, 1, 10, 10, 4.4, PAL.woodGray));

  /* ============ 南侧建筑（面朝 -Z） ============ */
  const SB = 8.5;
  add('church', s => buildChurch(s, -40, SB + 11.5, -1));
  add('stable', s => {
    const d = 14;
    westernBuilding(s, {
      x: -16, z: SB + d / 2, w: 17, d, h: 5.6, face: -1, ff: 0,
      sign: 'LIVERY', wall: PAL.woodPlank, trim: PAL.woodDark, roof: PAL.roofShingle, rise: 3.0, doorX: 0
    });
    // 大门洞
    s.clear(-21.2, 0.55, SB - 0.5, -10.8, 3.6, SB + 0.5);
    for (let i = 0; i < 3; i++){
      const zx = SB + 2.6 + i * 3.4;
      s.box(-23.4, 0.55, zx, -23.0, 2.2, zx + 2.8, PAL.woodDark);
      s.box(-8.6, 0.55, zx, -8.2, 2.2, zx + 2.8, PAL.woodDark);
      s.box(-23.4, 0.55, zx, -8.2, 0.95, zx + 0.35, PAL.woodDark);
      hayBale(s, -21.5 + i * 3.2, zx + 1.2, 0.95);
    }
    buildStagecoach(s, -16, SB + 9.5, 0, 0);
    s.addGlow(-16, 3.2, SB + 1.6, 3.4, 1.0, 0.72, 0.36);
  });

  add('blacksmith', s => {
    const d = 10;
    westernBuilding(s, {
      x: 3, z: SB + d / 2, w: 12, d, h: 4.8, face: -1, ff: 6.0,
      sign: 'BLACKSMITH', signScale: 0.2, wall: PAL.woodDark, trim: PAL.woodGray, rise: 2.0, doorX: 0
    });
    s.clear(-1.6, 0.55, SB - 0.5, 1.6, 3.2, SB + 0.5);                    // 开敞门脸
    s.box(-3.4, 0.55, SB + 2.2, -0.6, 2.1, SB + 4.6, PAL.rockRed);        // 锻炉
    s.box(-3.0, 2.1, SB + 2.6, -1.0, 2.6, SB + 4.2, PAL.iron);
    s.box(-2.4, 2.6, SB + 3.0, -1.6, 6.6, SB + 3.8, PAL.rockRedDark);
    s.box(0.6, 0.55, SB + 3.4, 2.6, 1.25, SB + 4.4, PAL.iron);            // 铁砧
    s.box(1.2, 1.25, SB + 3.2, 2.0, 1.75, SB + 4.6, PAL.iron);
    s.addGlow(-2.0, 1.6, SB + 3.4, 3.2, 1.0, 0.5, 0.18);
  });

  add('school', s => {
    const d = 10;
    westernBuilding(s, {
      x: 21, z: SB + d / 2, w: 13, d, h: 5.0, face: -1, ff: 6.6,
      sign: 'SCHOOL', wall: PAL.woodRed, trim: PAL.whitePlaster, rise: 2.2, doorX: 0
    });
    s.box(18.2, 3.4, SB - 0.6, 23.8, 4.2, SB + 0.2, PAL.woodDark);        // 校钟架
    s.box(20.5, 3.0, SB - 0.35, 21.5, 3.75, SB + 0.05, PAL.gold);
    for (let i = 0; i < 3; i++) s.box(16.6, 0.55, SB + 2.6 + i * 1.9, 25.4, 1.15, SB + 3.3 + i * 1.9, PAL.woodPlank);
    s.addGlow(21, 3.1, SB + 1.4, 3.0, 1.0, 0.78, 0.44);
  });

  add('post', s => {
    const d = 9;
    westernBuilding(s, {
      x: 37, z: SB + d / 2, w: 11, d, h: 4.5, face: -1, ff: 6.0,
      sign: 'POST', wall: PAL.cream, trim: PAL.woodDark, rise: 1.8, doorX: -1.4
    });
    s.box(33.4, 0.55, SB + 1.2, 40.6, 1.35, SB + 2.0, PAL.woodDark);
    s.addGlow(37, 2.9, SB + 1.4, 2.6, 1.0, 0.78, 0.44);
  });

  add('house-s1', s => buildHouse(s, 52, SB + 4.8, -1, 9, 9, 4.0, PAL.woodPlank));
  add('house-s2', s => buildHouse(s, -66, SB + 6.2, -1, 11, 10, 4.4, PAL.woodGray));
  add('shed-s1', s => buildShed(s, -28, SB + 12.5, 7, 5, 3.2, -1, PAL.woodGray, PAL.roofShingle));
  add('shed-s2', s => buildShed(s, 30, SB + 12.5, 7, 5, 3.2, -1, PAL.woodGray, PAL.roofShingle));

  /* ============ 铁路 ============ */
  const RZ = 52;
  add('railway', s => {
    s.box(-126, -0.1, RZ - 3.1, 126, 0.56, RZ + 3.1, PAL.gravel);
    for (let x = -125; x <= 125; x += 0.8){
      s.box(x - 0.22, 0.54, RZ - 1.62, x + 0.22, 0.82, RZ + 1.62, PAL.woodDark);
    }
    s.box(-125, 0.82, RZ - 0.96, 125, 1.04, RZ - 0.7, PAL.metal);
    s.box(-125, 0.82, RZ + 0.7, 125, 1.04, RZ + 0.96, PAL.metal);
    s.box(-125, 0.82, RZ - 0.96, -124.2, 1.04, RZ + 0.96, PAL.metalDark);
  });
  add('station', s => buildStation(s, 10, 41));
  add('rail-tank', s => buildWaterTower(s, 52, 61.5, { baseY: heightAt(52, 61.5), legH: 8.5, tankR: 2.6, tankH: 4.0 }));
  add('rail-signal', s => {
    const gy = heightAt(-38, 58);
    s.box(-38.25, gy, 57.75, -37.75, gy + 7.2, 58.25, PAL.iron);
    s.box(-38.85, gy + 5.4, 57.15, -37.15, gy + 6.6, 58.85, PAL.iron);
    s.box(-38.6, gy + 5.65, 56.9, -37.4, gy + 6.35, 57.16, PAL.lampGlass);
    s.addGlow(-38, gy + 6.0, 56.4, 2.2, 1.0, 0.55, 0.25);
    s.box(-40.4, gy - 0.2, 55.6, -35.6, gy + 0.4, 56.2, PAL.gravel);
  });
  add('telegraph', s => {
    for (let x = -112; x <= 112; x += 22) telegraphPole(s, x, 58.5);
    for (let x = -112; x < 112; x += 22){
      for (const dy of [0, 0.7]){
        s.box(x, 7.65 + dy, 58.35, x + 22, 7.78 + dy, 58.5, PAL.iron);
      }
    }
  });

  /* ============ 地标：峡谷水塔 + 钟楼 + 风车 ============ */
  add('canyon-tank', s => buildWaterTower(s, -58, -32, { legH: 12.5, tankR: 4.0, tankH: 6.2 }));
  add('bell-tower', s => buildBellTower(s, -44, -33));
  add('windmill', s => buildWindmill(s, -78, 24));
  add('lookout', s => buildLookout(s, 62, -58));
  add('silo', s => buildSilo(s, -30, 26, 3.2, 9.5));

  /* ============ 街道家具（逐件独立 Solid） ============ */
  for (let x = -70; x <= 70; x += 14){
    add('lamp-n' + x, s => lanternPost(s, x, -7.3, 4.4, 0.55));
    add('lamp-s' + x, s => lanternPost(s, x + 7, 7.3, 4.4, 0.55));
  }
  const hitches = [
    [-60, -44, -9.6], [-26, -8, -9.6], [2, 14, -9.6], [24, 40, -9.6],
    [-56, -36, 9.8], [-24, -8, 9.8]
  ];
  hitches.forEach((h, i) => add('hitch' + i, s => hitchRail(s, h[0], h[1], h[2], 0)));
  const barrels = [
    [-45, -10.2], [-33.5, -10.4], [-21, -10.2], [-2, -10.4], [12, -10.2], [26, -10.4], [43, -10.2], [56, -10.3],
    [-46, 10.4], [-25, 10.2], [-6, 10.4], [14, 10.2], [31, 10.4], [47, 10.2]
  ];
  barrels.forEach((b, i) => add('barrel' + i, s => barrel(s, b[0], b[1], 0, PAL.woodPlank)));
  const crates = [[-41, -10.6], [-15, -10.6], [8, -10.6], [35, -10.6], [-30, 10.8], [3, 10.8], [26, 10.8]];
  crates.forEach((c, i) => add('crate' + i, s => {
    crate(s, c[0], c[1], 0, 1.15);
    crate(s, c[0] + 1.3, c[1] + 0.4, 0, 0.95);
  }));

  /* ============ 荒野道具（每个道具独立 Solid，避免巨型包围盒） ============ */
  {
    // 仙人掌
    for (let i = 0; i < 64; i++){
      const a = hash2i(i * 7 + 3, i * 13 + 5);
      const b = hash2i(i * 17 + 11, i * 29 + 7);
      const x = (a - 0.5) * 216, z = (b - 0.5) * 216;
      if (Math.abs(x) < 82 && Math.abs(z) < 34) continue;
      if (Math.abs(z - RZ) < 8) continue;
      if (Math.hypot(x - 62, z + 58) < 22) continue;
      if (Math.hypot(x + 58, z + 32) < 14) continue;
      if (Math.hypot(x + 78, z - 24) < 12) continue;
      add('cactus' + i, s => cactus(s, x, z, 0.8 + a * 0.7));
    }
    // 巨石
    for (let i = 0; i < 26; i++){
      const a = hash2i(i * 31 + 5, i * 3 + 17);
      const b = hash2i(i * 11 + 23, i * 41 + 9);
      const x = (a - 0.5) * 220, z = (b - 0.5) * 220;
      if (Math.abs(x) < 74 && Math.abs(z) < 30) continue;
      if (Math.abs(z - RZ) < 7) continue;
      add('boulder' + i, s => boulder(s, x, z, 1.1 + b * 2.6));
    }
    // 栅栏
    const fences = [
      [-116, -30, -86, -22], [-116, 30, -86, 22], [86, -22, 116, -30], [86, 22, 116, 30],
      [-30, 44, -30, 24], [-30, 24, -6, 24], [-6, 24, -6, 44], [-6, 44, -30, 44],
      [64, 30, 100, 30], [100, 30, 100, 62], [-100, 62, -100, 30], [-100, 30, -64, 30],
      [-63, 29, -49, 29], [-63, 41, -49, 41], [-63, 29, -63, 41], [-49, 29, -49, 41]
    ];
    fences.forEach((f, i) => {
      const dark = i >= 12;
      add('fence' + i, s => fenceLine(s, f[0], f[1], f[2], f[3], dark ? 1.2 : 1.5, dark ? PAL.woodDark : PAL.woodGray));
    });
    // 墓地
    for (let i = 0; i < 12; i++){
      const gx = -60 + (i % 4) * 2.6 + (i % 2) * 0.5;
      const gz = 32 + Math.floor(i / 4) * 3.0;
      add('grave' + i, s => gravestone(s, gx, gz, i % 3 === 0 ? 1 : 0));
    }
  }

  /* ============ 营地 ============ */
  {
    const fires = [[-34, 36], [30, -26], [76, 18]];
    fires.forEach((f, i) => add('campfire' + i, s => campfire(s, f[0], f[1], 0)));
    add('tent1', s => tent(s, -38.5, 38.5, 1));
    add('tent2', s => tent(s, -29.5, 39.5, -1));
    add('tent3', s => tent(s, 25.5, -28.5, 1));
    add('tent4', s => tent(s, 71.5, 15.5, -1));
    add('camp-props', s => {
      barrel(s, -30.5, 33.5, 0, PAL.woodDark);
      crate(s, -37.5, 33.0, 0, 1.1);
      crate(s, 79.5, 15.5, 0, 1.2);
    });
  }

  /* ============ 山道 ============ */
  add('trail', s => {
    const pts = trailPoints();
    for (let i = 0; i < pts.length; i += 2){
      const p = pts[i];
      s.box(p[0] - 1.5, p[2] - 0.25, p[1] - 1.5, p[0] + 1.5, p[2] + 0.12, p[1] + 1.5, PAL.dirt);
      if (i % 6 === 0){
        s.box(p[0] + 1.7, p[2] - 0.2, p[1] - 0.14, p[0] + 2.0, p[2] + 1.35, p[1] + 0.14, PAL.woodDark);
        s.box(p[0] + 1.6, p[2] + 1.2, p[1] - 0.2, p[0] + 2.1, p[2] + 1.5, p[1] + 0.2, PAL.woodDark);
      }
    }
  });

  /* ============ 静态合并 ============ */
  const sm = solidsToMesh(solids);
  const ter = buildTerrainMesh();
  const opaque = mergeMeshParts([ter, sm.opaque]);
  const emissive = sm.emissive;

  /* ============ 动态件 ============ */
  const dynamics = [];
  dynamics.push({ kind: 'train', name: '蒸汽机车', x: -70, y: 1.04, z: RZ, speed: 7.5, span: 122, ...solidEntry(buildTrain()) });
  dynamics.push({ kind: 'windmill', name: '风车', x: -78, y: heightAt(-78, 24) + 15.5 + 1.35, z: 24 - 1.7, speed: 0.55, ...solidEntry(buildWindmillBlades()) });
  for (let i = 0; i < 6; i++){
    dynamics.push({
      kind: 'tumbleweed', name: '风滚草',
      x: -100 + i * 34, y: heightAt(-100 + i * 34, 20 + i * 9) + 1.1, z: 20 + i * 9,
      speed: 2.2 + i * 0.55, phase: i * 1.7, ...solidEntry(buildTumbleweed())
    });
  }
  for (let i = 0; i < 9; i++){
    dynamics.push({
      kind: 'cloud', name: '云',
      x: -180 + i * 46, y: 96 + (i % 3) * 17, z: -120 + (i * 53) % 240,
      speed: 0.9 + (i % 4) * 0.35, ...solidEntry(buildCloud(i + 3))
    });
  }
  const fireSpots = [[-34, 36], [30, -26], [76, 18], [62, -55.5]];
  for (let i = 0; i < fireSpots.length; i++){
    const [fx, fz] = fireSpots[i];
    const fy = i === 3 ? heightAt(62, -58) + 5.85 : heightAt(fx, fz);
    dynamics.push({ kind: 'fire', name: '营火', x: fx, y: fy, z: fz, phase: i * 2.1, ...solidEntry(buildFlame()) });
  }

  /* ============ 烟雾源 ============ */
  const smokes = [
    { x: -52, y: 9.6, z: -15, scale: 1.5, rate: 1.0 },
    { x: 1.6, y: 7.2, z: 11.6, scale: 1.3, rate: 0.8 },
    { x: -31, y: 10.2, z: -14.5, scale: 1.2, rate: 0.6 },
    { x: -44, y: heightAt(-44, -33) + 33, z: -33, scale: 1.6, rate: 0.45 },
    { x: 10, y: 8.4, z: 41, scale: 1.2, rate: 0.5 }
  ];

  /* ============ 游览路径 ============ */
  const tour = [
    [[-118, 46, 96], [-20, 8, 0]],
    [[-86, 26, 58], [-10, 8, 0]],
    [[-62, 11, 16], [10, 6, -2]],
    [[-30, 8.5, 10], [26, 6, -3]],
    [[8, 9, 12], [52, 8, -14]],
    [[36, 13, 30], [10, 6, 50]],
    [[16, 11, 62], [-46, 8, 52]],
    [[-28, 12, 62], [-70, 12, 44]],
    [[-62, 16, 30], [-58, 18, -32]],
    [[-52, 26, -14], [-44, 22, -33]],
    [[-30, 30, -46], [10, 18, -30]],
    [[10, 40, -40], [52, 46, -52]],
    [[54, 58, -50], [62, 62, -58]],
    [[70, 70, -62], [0, 10, 0]],
    [[30, 66, -84], [-50, 20, -32]],
    [[-40, 52, -78], [-58, 16, -32]],
    [[-92, 40, -20], [-20, 10, 10]]
  ];

  const stats = {
    buildMs: Date.now() - t0,
    tris: opaque.tris + emissive.tris,
    verts: opaque.verts + emissive.verts
  };

  return { opaque, emissive, glows: sm.glows, dynamics, smokes, tour, stats };
}

function solidEntry(S){
  const m = S.toMesh();
  return { opaque: m.opaque, emissive: m.emissive, glows: S.glow };
}


module.exports = { terrainHeight, buildWorld, buildTerrain, buildTerrainMesh, heightAt, PAL, PAL_LIST, terrainHeight, trailPoints, Solid };
