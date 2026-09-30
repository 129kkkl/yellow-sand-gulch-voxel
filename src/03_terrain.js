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
  const northMask = smoothstep(-32, -45, z);
  const gap = smoothstep(32, 12, Math.abs(x + 30));          // 峡谷豁口（干河谷穿行）
  const canyonH = 18 + ridge * 26 + smoothstep(-56, -112, z) * 24;
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
  const townMask = smoothstep(98, 80, Math.abs(x)) * smoothstep(44, 33, Math.abs(z - 2));
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
  // 3x3 中值滤波：消除台地边缘的孤立薄片/尖刺（侧视时会产生"悬空细线"）
  {
    const H2 = new Int16Array(TW * TH);
    H2.set(TER.H);
    const w3 = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let j = 1; j < TH - 1; j++){
      const row = j * TW;
      for (let i = 1; i < TW - 1; i++){
        const k = row + i;
        const h0 = TER.H[k];
        let n = 0, lo = 0, hi = 0;
        for (let b = -1; b <= 1; b++){
          const r = k + b * TW;
          for (let a = -1; a <= 1; a++){
            const v = TER.H[r + a];
            w3[n++] = v;
            if (v < h0) lo++;
            else if (v > h0) hi++;
          }
        }
        if (lo >= 4 || hi >= 4){
          w3.sort((p, q) => p - q);
          H2[k] = w3[4];
        }
      }
    }
    TER.H.set(H2);
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
    // 按法线决定三角形绕序（保证正面朝外）
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const flip = (cx * n[0] + cy * n[1] + cz * n[2]) < 0;
    if (flip) idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
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
      while (i + w < TW && w < 24){
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
  const strataMat = (yVox) => {
    const band = Math.floor(yVox / 7);
    const kk = ((band % 4) + 4) % 4;
    return [PAL.rockRedDark, PAL.rockRed, PAL.rockOrange, PAL.rockRed][kk];
  };
  const wallColor = (top, bot, c) => {
    const drop = top - bot;
    return drop > 3 ? strataMat((top + bot) / 2) : c;
  };

  /* 侧壁：+X / -X 朝向的墙位于 x 边界，沿 z 方向合并等高等色游程 */
  for (let i = 0; i < TW - 1; i++){
    let j = 0;
    while (j < TH){
      const a = j * TW + i, b = a + 1;
      if (H[a] > H[b]){
        const top = H[a], bot = H[b], c = C[a];
        let w = 1;
        while (j + w < TH){
          const a2 = (j + w) * TW + i, b2 = a2 + 1;
          if (!(H[a2] > H[b2]) || H[a2] !== top || H[b2] !== bot || C[a2] !== c) break;
          w++;
        }
        const xw = xOf(i + 1), yTop = top * VOXM, yBot = bot * VOXM;
        const m = wallColor(top, bot, c);
        pushQuad([xw, yBot, zOf(j)], [xw, yTop, zOf(j)], [xw, yTop, zOf(j + w)], [xw, yBot, zOf(j + w)],
          [1, 0, 0], m, 0.74);
        j += w;
      } else j++;
    }
  }
  /* 侧壁：+Z / -Z 朝向的墙位于 z 边界，沿 x 方向合并游程 */
  for (let j = 0; j < TH - 1; j++){
    let i = 0;
    while (i < TW){
      const a = j * TW + i, b = a + TW;
      if (H[a] > H[b]){
        const top = H[a], bot = H[b], c = C[a];
        let w = 1;
        while (i + w < TW){
          const a2 = j * TW + i + w, b2 = a2 + TW;
          if (!(H[a2] > H[b2]) || H[a2] !== top || H[b2] !== bot || C[a2] !== c) break;
          w++;
        }
        const zw = zOf(j + 1), yTop = top * VOXM, yBot = bot * VOXM;
        const m = wallColor(top, bot, c);
        pushQuad([xOf(i), yBot, zw], [xOf(i), yTop, zw], [xOf(i + w), yTop, zw], [xOf(i + w), yBot, zw],
          [0, 0, 1], m, 0.74);
        i += w;
      } else i++;
    }
  }

  /* 远荒漠裙摆：四块大平面（外缘靠雾隐藏） */
  const SKIRT = 420, SKIRT_V = 2;
  const sy = SKIRT_V * VOXM;
  {
    const x0 = xOf(0), x1 = xOf(TW), z0 = zOf(0), z1 = zOf(TH);
    pushQuad([x0 - SKIRT, sy, z0 - SKIRT], [x1 + SKIRT, sy, z0 - SKIRT], [x1 + SKIRT, sy, z0], [x0 - SKIRT, sy, z0], [0, 1, 0], PAL.sand, 0.92);
    pushQuad([x0 - SKIRT, sy, z1], [x1 + SKIRT, sy, z1], [x1 + SKIRT, sy, z1 + SKIRT], [x0 - SKIRT, sy, z1 + SKIRT], [0, 1, 0], PAL.sand, 0.92);
    pushQuad([x0 - SKIRT, sy, z0], [x0, sy, z0], [x0, sy, z1], [x0 - SKIRT, sy, z1], [0, 1, 0], PAL.sandDark, 0.92);
    pushQuad([x1, sy, z0], [x1 + SKIRT, sy, z0], [x1 + SKIRT, sy, z1], [x1, sy, z1], [0, 1, 0], PAL.sandDark, 0.92);
  }
  /* 世界边缘外壁 */
  for (let j = 0; j < TH; j++){
    const hw = H[j * TW], he = H[j * TW + TW - 1];
    const cw = C[j * TW], ce = C[j * TW + TW - 1];
    if (hw > SKIRT_V){
      pushQuad([xOf(0), sy, zOf(j)], [xOf(0), hw * VOXM, zOf(j)], [xOf(0), hw * VOXM, zOf(j + 1)], [xOf(0), sy, zOf(j + 1)],
        [-1, 0, 0], cw, 0.74);
    }
    if (he > SKIRT_V){
      pushQuad([xOf(TW), sy, zOf(j + 1)], [xOf(TW), he * VOXM, zOf(j + 1)], [xOf(TW), he * VOXM, zOf(j)], [xOf(TW), sy, zOf(j)],
        [1, 0, 0], ce, 0.74);
    }
  }
  for (let i = 0; i < TW; i++){
    const hn = H[i], hs = H[(TH - 1) * TW + i];
    const cn = C[i], cs = C[(TH - 1) * TW + i];
    if (hn > SKIRT_V){
      pushQuad([xOf(i + 1), sy, zOf(0)], [xOf(i + 1), hn * VOXM, zOf(0)], [xOf(i), hn * VOXM, zOf(0)], [xOf(i), sy, zOf(0)],
        [0, 0, -1], cn, 0.74);
    }
    if (hs > SKIRT_V){
      pushQuad([xOf(i), sy, zOf(TH)], [xOf(i), hs * VOXM, zOf(TH)], [xOf(i + 1), hs * VOXM, zOf(TH)], [xOf(i + 1), sy, zOf(TH)],
        [0, 0, 1], cs, 0.74);
    }
  }

  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), col: new Float32Array(col), idx: new Uint32Array(idx), verts: pos.length / 3, tris: idx.length / 3 };
}
