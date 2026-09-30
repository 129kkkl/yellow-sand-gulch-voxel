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
