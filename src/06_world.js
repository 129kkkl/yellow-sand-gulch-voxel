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

  /* ============ 钟楼指针（随时间转动） ============ */
  {
    const gyB = heightAt(-44, -33);
    const cyB = gyB + 23.5 - 3.0;
    for (const s of [1, -1]){
      dynamics.push({
        kind: 'clock', part: 'hour', dir: s, name: '时针',
        x: -44, y: cyB, z: -33 + s * 2.92, ...solidEntry(buildClockHand(1.35, 0.24, PAL.iron))
      });
      dynamics.push({
        kind: 'clock', part: 'minute', dir: s, name: '分针',
        x: -44, y: cyB, z: -33 + s * 2.98, ...solidEntry(buildClockHand(1.95, 0.17, PAL.iron))
      });
    }
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
