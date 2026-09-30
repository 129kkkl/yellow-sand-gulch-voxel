/* ============================================================
   02_voxel.js — Solid 体素模型生成器
   以“盒体堆叠”描述模型，栅格化后做面剔除 + 逐顶点环境光遮蔽(AO)，
   并按（材质 + AO 签名）做贪心面合并，输出 { pos, nrm, col, idx }
   纯数组网格（可合并、可在 Node 中测试）。
   ============================================================ */
'use strict';

const FACE_DIRS = [
  { n: [ 1, 0, 0], na: 0, ua: 1, va: 2, flip: 0 },
  { n: [-1, 0, 0], na: 0, ua: 1, va: 2, flip: 1 },
  { n: [0,  1, 0], na: 1, ua: 0, va: 2, flip: 1 },
  { n: [0, -1, 0], na: 1, ua: 0, va: 2, flip: 0 },
  { n: [0, 0,  1], na: 2, ua: 0, va: 1, flip: 0 },
  { n: [0, 0, -1], na: 2, ua: 0, va: 1, flip: 1 }
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
  const diagFlip = (ao[0] + ao[2] > ao[1] + ao[3]);
  if (D.flip){
    if (diagFlip) dst.idx.push(base, base + 3, base + 1, base + 1, base + 3, base + 2);
    else dst.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  } else {
    if (diagFlip) dst.idx.push(base, base + 1, base + 3, base + 1, base + 2, base + 3);
    else dst.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
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
