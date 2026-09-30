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
