/* Node 冒烟测试：只运行纯几何生成层（无 DOM / WebGL） */
'use strict';
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const parts = ['01_core.js', '02_voxel.js', '03_terrain.js', '04_buildings.js', '05_props.js', '06_world.js'];
let code = '';
for (const p of parts) code += fs.readFileSync(path.join(srcDir, p), 'utf8') + '\n';
code += '\nmodule.exports = { buildWorld, buildTerrain, buildTerrainMesh, heightAt, PAL, PAL_LIST, terrainHeight, trailPoints, Solid };\n';

const genPath = path.join(__dirname, 'gen.js');
fs.writeFileSync(genPath, code, 'utf8');

const t0 = Date.now();
const mod = require(genPath);
console.log('模块加载耗时:', Date.now() - t0, 'ms');

const t1 = Date.now();
const world = mod.buildWorld();
console.log('世界生成耗时:', Date.now() - t1, 'ms (含地形)');

// 分项统计
const t2 = Date.now();
mod.buildTerrain();
const terMesh = mod.buildTerrainMesh();
console.log('地形网格: verts=' + terMesh.verts, 'tris=' + terMesh.tris, '耗时', Date.now() - t2, 'ms');
console.log('建筑/道具: verts=' + (world.opaque.verts - terMesh.verts), 'tris=' + (world.opaque.tris - terMesh.tris));

const chk = (name, m) => {
  if (!m) return;
  let nan = 0;
  for (let i = 0; i < m.pos.length; i++) if (!Number.isFinite(m.pos[i])) nan++;
  for (let i = 0; i < m.col.length; i++) if (!Number.isFinite(m.col[i])) nan++;
  let maxC = 0;
  for (let i = 0; i < m.col.length; i++) if (m.col[i] > maxC) maxC = m.col[i];
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < m.pos.length; i += 3){ if (m.pos[i] < minY) minY = m.pos[i]; if (m.pos[i] > maxY) maxY = m.pos[i]; }
  console.log(`  ${name}: verts=${m.verts} tris=${m.tris} NaN=${nan} maxColor=${maxC.toFixed(2)} y=[${minY.toFixed(1)},${maxY.toFixed(1)}]`);
  if (nan) throw new Error(name + ' 含 NaN');
};

console.log('静态不透明:'); chk('opaque', world.opaque);
console.log('静态发光:'); chk('emissive', world.emissive);
console.log('动态件:');
let dynTris = 0;
for (const d of world.dynamics){
  chk(d.kind + '(' + d.name + ')', d.opaque);
  if (d.emissive) chk(d.kind + '.emis', d.emissive);
  dynTris += d.opaque.tris + (d.emissive ? d.emissive.tris : 0);
}
console.log('动态三角形合计:', dynTris);
console.log('灯火光斑:', (world.glows || []).length);
console.log('烟雾源:', world.smokes.length);
console.log('游览路径点:', world.tour.length);
console.log('统计:', JSON.stringify(world.stats));

// 地形高度抽样
const H = mod.heightAt;
console.log('高度采样: 主街(0,0)=', H(0, 0).toFixed(2),
  ' 峡谷(-58,-32)=', H(-58, -32).toFixed(2),
  ' 瞭望山(62,-58)=', H(62, -58).toFixed(2),
  ' 铁路(0,52)=', H(0, 52).toFixed(2),
  ' 世界边缘(115,0)=', H(115, 0).toFixed(2));

let minH = Infinity, maxH = -Infinity;
for (let j = 0; j < 1200; j += 7) for (let i = 0; i < 1200; i += 7){
  const v = H((i - 600) * 0.2, (j - 600) * 0.2);
  if (v < minH) minH = v; if (v > maxH) maxH = v;
}
console.log('地形高度范围(米):', minH.toFixed(1), '..', maxH.toFixed(1));
console.log('OK');
