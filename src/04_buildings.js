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
  const H = 15.5, R0 = 3.4, R1 = 1.25;
  const radAt = (t) => lerp(R0, R1, t);
  const px = (a, t) => x + Math.cos(a) * radAt(t);
  const pz = (a, t) => z + Math.sin(a) * radAt(t);
  const ANG = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
  // 四根主腿（分段内收）
  for (const a of ANG){
    for (let s = 0; s < 16; s++){
      const t0 = s / 16, t1 = (s + 1) / 16;
      S.box(px(a, t0) - 0.26, gy + t0 * H, pz(a, t0) - 0.26,
            px(a, t1) + 0.26, gy + t1 * H, pz(a, t1) + 0.26, PAL.woodGray);
    }
  }
  // 横梁与斜撑
  for (const t of [0.10, 0.28, 0.46, 0.64, 0.82]){
    for (let k = 0; k < 4; k++){
      const a0 = ANG[k], a1 = ANG[(k + 1) % 4];
      const y = gy + t * H;
      S.box(px(a0, t) - 0.14, y, pz(a0, t) - 0.14, px(a1, t) + 0.14, y + 0.34, pz(a1, t) + 0.14, PAL.woodDark);
      // 斜撑（相邻两腿之间，之字形）
      const t2 = Math.min(1, t + 0.18);
      S.box(px(a0, t2) - 0.13, y + 0.34, pz(a0, t2) - 0.13, px(a1, t) + 0.13, y + 1.05, pz(a1, t) + 0.13, PAL.woodGray);
    }
    const r = radAt(t) * 1.02;
    S.box(x - r, gy + t * H, z - r, x + r, gy + t * H + 0.3, z + r, PAL.woodDark);
    S.clear(x - r + 0.3, gy + t * H - 0.1, z - r + 0.3, x + r - 0.3, gy + t * H + 0.42, z + r - 0.3);
  }
  // 底部平台
  S.box(x - R0 - 1.0, gy - 0.35, z - R0 - 1.0, x + R0 + 1.0, gy + 0.15, z + R0 + 1.0, PAL.woodDark);
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
