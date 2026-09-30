/* ============================================================
   07_app.js — 渲染 / 昼夜循环 / 交互（依赖 three.js）
   ============================================================ */
'use strict';

(function(){
  const statusEl = document.getElementById('status');
  const setStatus = (s) => { if (statusEl) statusEl.textContent = s; };
  window.addEventListener('error', (e) => setStatus('ERROR: ' + (e.message || e.type)));

  if (typeof THREE === 'undefined'){
    setStatus('ERROR: three.js 未加载');
    return;
  }

  const clamp01 = (v) => v < 0 ? 0 : (v > 1 ? 1 : v);
  const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------------- 参数 ---------------- */
  const P = new URLSearchParams(location.search);
  const NUM = (k, d) => P.has(k) ? parseFloat(P.get(k)) : d;

  /* ---------------- 世界构建 ---------------- */
  setStatus('正在生成体素世界（0.2m/voxel）…');
  const world = buildWorld();
  const STATS = world.stats;

  /* ---------------- 渲染器 ---------------- */
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = P.get('shadow') !== '0';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.4, 3600);

  /* ---------------- 网格上传 ---------------- */
  function makeGeometry(m){
    const g = new THREE.BufferGeometry();
    const pos = m.pos instanceof Float32Array ? m.pos : new Float32Array(m.pos);
    const nrm = m.nrm instanceof Float32Array ? m.nrm : new Float32Array(m.nrm);
    const col = m.col instanceof Float32Array ? m.col : new Float32Array(m.col);
    const idx = m.idx instanceof Uint32Array ? m.idx : new Uint32Array(m.idx);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    if (pos.length) g.computeBoundingSphere();
    return g;
  }
  const matOpaque = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const matEmissive = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, side: THREE.DoubleSide });
  let emissiveMeshCullOff = false;

  const worldMesh = new THREE.Mesh(makeGeometry(world.opaque), matOpaque);
  worldMesh.castShadow = true;
  worldMesh.receiveShadow = true;
  if (P.get('nocull') === '1'){ worldMesh.frustumCulled = false; emissiveMeshCullOff = true; }
  if (P.get('noworld') !== '1') scene.add(worldMesh);
  const emissiveMesh = new THREE.Mesh(makeGeometry(world.emissive), matEmissive);
  emissiveMesh.frustumCulled = false;
  scene.add(emissiveMesh);

  /* ---------------- 天空 ---------------- */
  const skyUniforms = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uZenith: { value: new THREE.Color(0x2a5cb8) },
    uHorizon: { value: new THREE.Color(0x9ab6d8) },
    uSunset: { value: new THREE.Color(0xff7a2e) },
    uGround: { value: new THREE.Color(0x6b563e) },
    uSunDisc: { value: new THREE.Color(0xfff2d8) },
    uMoonDisc: { value: new THREE.Color(0xdfe6f2) },
    uTime: { value: 0 },
    uStars: { value: 1 },
    uSunSize: { value: 1 },
    uSunsetF: { value: 0 }
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main(){
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      precision highp float;
      varying vec3 vDir;
      uniform vec3 uSunDir, uMoonDir, uZenith, uHorizon, uSunset, uGround, uSunDisc, uMoonDisc;
      uniform float uTime, uStars, uSunSize, uSunsetF;
      float hash31(vec3 p){
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }
      void main(){
        vec3 rd = normalize(vDir);
        float h = rd.y;
        vec3 sky = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.42));
        float sunAz = pow(max(dot(normalize(vec3(rd.x, 0.0, rd.z) + 1e-5), normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 1e-5)), 0.0), 1.6);
        sky = mix(sky, uSunset, sunAz * pow(1.0 - clamp(h, 0.0, 1.0), 2.6) * uSunsetF * 0.9);
        sky = mix(uGround, sky, smoothstep(-0.06, 0.035, h));
        // 太阳
        float sd = dot(rd, uSunDir);
        float disc = smoothstep(0.99955, 0.99988, sd);
        float glow = pow(max(sd, 0.0), 64.0) * 0.28 + pow(max(sd, 0.0), 12.0) * 0.10;
        sky += uSunDisc * (disc * 1.35 + glow * uSunSize);
        // 月亮
        float md = dot(rd, uMoonDir);
        float mdisc = smoothstep(0.99948, 0.99986, md);
        vec3 mcol = uMoonDisc * (0.72 + 0.28 * hash31(floor(rd * 260.0)));
        sky += mcol * mdisc * 0.9;
        sky += uMoonDisc * pow(max(md, 0.0), 90.0) * 0.10;
        // 星空
        if (uStars > 0.001){
          vec3 sp = rd * 230.0;
          vec3 cell = floor(sp);
          float hh = hash31(cell);
          if (hh > 0.9935){
            vec3 f = fract(sp) - 0.5;
            float d = length(f);
            float tw = 0.55 + 0.45 * sin(uTime * 1.7 + hh * 90.0);
            sky += vec3(0.85, 0.9, 1.0) * smoothstep(0.30, 0.02, d) * tw * uStars * (0.35 + hh * 0.9);
          }
        }
        gl_FragColor = vec4(sky, 1.0);
        #include <colorspace_fragment>
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1600, 40, 24), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  if (P.get('nosky') !== '1') scene.add(sky);

  /* ---------------- 灯光 ---------------- */
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.castShadow = true;
  const shadowSize = P.get('shadow') === 'big' ? 2048 : 1024;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const sc = sun.shadow.camera;
  sc.left = -130; sc.right = 130; sc.top = 130; sc.bottom = -130; sc.near = 30; sc.far = 760;
  sc.updateProjectionMatrix();
  sun.shadow.bias = -0.00045;
  sun.shadow.normalBias = 0.45;
  scene.add(sun);
  scene.add(sun.target);

  const moon = new THREE.DirectionalLight(0x9db4e6, 0.22);
  scene.add(moon);
  scene.add(moon.target);
  const hemi = new THREE.HemisphereLight(0x7fa2d8, 0xb08a5c, 0.85);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0x30364a, 0.35);
  scene.add(amb);

  scene.fog = new THREE.Fog(0x9ab0c8, 110, 520);

  /* ---------------- 灯火光斑（加法混合点精灵） ---------------- */
  const glowCount = world.glows.length;
  const glowPos = new Float32Array(glowCount * 3);
  const glowCol = new Float32Array(glowCount * 3);
  const glowSize = new Float32Array(glowCount);
  for (let i = 0; i < glowCount; i++){
    const g = world.glows[i];
    glowPos[i * 3] = g.x; glowPos[i * 3 + 1] = g.y; glowPos[i * 3 + 2] = g.z;
    glowCol[i * 3] = g.r; glowCol[i * 3 + 1] = g.g; glowCol[i * 3 + 2] = g.b;
    glowSize[i] = g.size;
  }
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  glowGeo.setAttribute('acolor', new THREE.BufferAttribute(glowCol, 3));
  glowGeo.setAttribute('asize', new THREE.BufferAttribute(glowSize, 1));
  const glowUniforms = { uScale: { value: 1 }, uOpacity: { value: 0 } };
  const glowMat = new THREE.ShaderMaterial({
    uniforms: glowUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 acolor;
      attribute float asize;
      varying vec3 vColor;
      uniform float uScale;
      void main(){
        vColor = acolor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(asize * uScale / max(0.001, -mv.z), 1.0, 520.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      precision highp float;
      varying vec3 vColor;
      uniform float uOpacity;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d) * 2.0;
        float a = smoothstep(1.0, 0.0, r);
        gl_FragColor = vec4(vColor, a * a * uOpacity);
        #include <colorspace_fragment>
      }`
  });
  const glowPoints = new THREE.Points(glowGeo, glowMat);
  glowPoints.frustumCulled = false;
  glowPoints.renderOrder = 8;
  scene.add(glowPoints);

  /* ---------------- 烟雾粒子 ---------------- */
  const SMOKE_MAX = 260;
  const smokePos = new Float32Array(SMOKE_MAX * 3);
  const smokeCol = new Float32Array(SMOKE_MAX * 3);
  const smokeSize = new Float32Array(SMOKE_MAX);
  const smokeAlpha = new Float32Array(SMOKE_MAX);
  const smokeParts = [];
  for (let i = 0; i < SMOKE_MAX; i++){
    smokeParts.push({ x: 0, y: -9999, z: 0, vx: 0, vy: 0, vz: 0, age: 9e9, life: 1, size: 1 });
    smokeSize[i] = 1;
  }
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  smokeGeo.setAttribute('acolor', new THREE.BufferAttribute(smokeCol, 3));
  smokeGeo.setAttribute('asize', new THREE.BufferAttribute(smokeSize, 1));
  smokeGeo.setAttribute('aalpha', new THREE.BufferAttribute(smokeAlpha, 1));
  const smokeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uScale: { value: 1 } },
    vertexShader: `
      attribute vec3 acolor;
      attribute float asize;
      attribute float aalpha;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uScale;
      void main(){
        vColor = acolor; vAlpha = aalpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(asize * uScale / max(0.001, -mv.z), 1.0, 760.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      precision highp float;
      varying vec3 vColor;
      varying float vAlpha;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d) * 2.0;
        float a = smoothstep(1.0, 0.15, r) * vAlpha;
        gl_FragColor = vec4(vColor, a);
        #include <colorspace_fragment>
      }`
  });
  const smokePoints = new THREE.Points(smokeGeo, smokeMat);
  smokePoints.frustumCulled = false;
  smokePoints.renderOrder = 9;
  scene.add(smokePoints);
  let smokeCursor = 0;
  function emitSmoke(x, y, z, size, speed){
    const p = smokeParts[smokeCursor];
    smokeCursor = (smokeCursor + 1) % SMOKE_MAX;
    p.x = x + (Math.random() - 0.5) * 0.5;
    p.y = y;
    p.z = z + (Math.random() - 0.5) * 0.5;
    p.vx = (Math.random() - 0.5) * 0.5 + 0.35;
    p.vy = speed * (0.75 + Math.random() * 0.5);
    p.vz = (Math.random() - 0.5) * 0.5;
    p.age = 0;
    p.life = 7 + Math.random() * 6;
    p.size = size;
  }

  /* ---------------- 动态对象 ---------------- */
  const dyn = [];
  for (const d of world.dynamics){
    const grp = new THREE.Group();
    grp.position.set(d.x, d.y, d.z);
    if (d.opaque.idx.length){
      const m = new THREE.Mesh(makeGeometry(d.opaque), matOpaque);
      m.castShadow = true; m.receiveShadow = true;
      grp.add(m);
    }
    if (d.emissive && d.emissive.idx.length){
      const m = new THREE.Mesh(makeGeometry(d.emissive), matEmissive);
      grp.add(m);
    }
    scene.add(grp);
    dyn.push({ def: d, obj: grp });
  }

  /* ---------------- 相机控制 ---------------- */
  const cam = {
    target: new THREE.Vector3(-6, 7, -2),
    dist: 72,
    yaw: 2.05,
    pitch: 0.30,
    pos: null, look: null
  };
  const tourState = { active: false, t: 0, duration: 170 };
  if (P.has('cam')){
    const v = P.get('cam').split(',').map(Number);
    cam.pos = new THREE.Vector3(v[0], v[1], v[2]);
    cam.look = new THREE.Vector3(v[3] || 0, v[4] || 0, v[5] || 0);
  }
  if (P.get('tour') === '1') tourState.active = true;

  const keys = Object.create(null);
  let dragging = 0, lastX = 0, lastY = 0;

  function applyCamera(){
    if (cam.pos){
      camera.position.copy(cam.pos);
      camera.lookAt(cam.look);
      return;
    }
    if (tourState.active) return;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    camera.position.set(
      cam.target.x + cam.dist * cp * Math.sin(cam.yaw),
      cam.target.y + cam.dist * sp,
      cam.target.z + cam.dist * cp * Math.cos(cam.yaw)
    );
    camera.lookAt(cam.target);
  }

  function stopTour(){
    if (!tourState.active) return;
    tourState.active = false;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    cam.target.copy(camera.position).addScaledVector(dir, Math.max(12, cam.dist * 0.5));
    cam.dist = Math.max(3, camera.position.distanceTo(cam.target));
    cam.yaw = Math.atan2(camera.position.x - cam.target.x, camera.position.z - cam.target.z);
    cam.pitch = Math.max(-1.42, Math.min(1.42, Math.asin((camera.position.y - cam.target.y) / cam.dist)));
    updateTourButton();
  }

  canvas.addEventListener('pointerdown', (e) => {
    dragging = e.button === 2 ? 2 : 1;
    lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    if (cam.pos) return;
    stopTour();
    if (dragging === 1){
      cam.yaw -= dx * 0.0052;
      cam.pitch = Math.max(-1.42, Math.min(1.42, cam.pitch + dy * 0.0042));
    } else {
      const s = cam.dist * 0.0016;
      const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
      const fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
      cam.target.addScaledVector(right, dx * s);
      cam.target.addScaledVector(fwd, dy * s);
    }
    applyCamera();
  });
  canvas.addEventListener('pointerup', (e) => { dragging = 0; try { canvas.releasePointerCapture(e.pointerId); } catch (_){} });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (cam.pos) return;
    stopTour();
    cam.dist = Math.max(3, Math.min(420, cam.dist * Math.exp(e.deltaY * 0.0011)));
    applyCamera();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    keys[e.code] = true;
    if (e.code === 'Space'){ e.preventDefault(); togglePlay(); }
    else if (e.code === 'KeyT'){ toggleTour(); }
    else if (e.code === 'KeyH'){ toggleHelp(); }
    else if (e.code === 'KeyR'){ resetCamera(); }
    else if (e.code === 'BracketRight'){ setHour(time.hour + 0.5); }
    else if (e.code === 'BracketLeft'){ setHour(time.hour - 0.5); }
    else if (/^Digit[1-5]$/.test(e.code)){
      const idx = parseInt(e.code.slice(5), 10) - 1;
      setHour(PRESETS[idx].h);
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)){
      stopTour();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  function updateCamera(dt){
    if (cam.pos) return;
    if (tourState.active){
      tourState.t += dt / tourState.duration;
      const t = tourState.t % 1;
      const pos = tourCurve.getPointAt(t);
      const look = lookCurve.getPointAt(t);
      camera.position.copy(pos);
      camera.lookAt(look);
      return;
    }
    const speed = (keys.ShiftLeft || keys.ShiftRight) ? 46 : 13;
    const cp = Math.cos(cam.yaw), sp = Math.sin(cam.yaw);
    const fwd = new THREE.Vector3(-sp, 0, -cp);
    const right = new THREE.Vector3(cp, 0, -sp);
    let moved = false;
    const step = speed * dt;
    if (keys.KeyW || keys.ArrowUp){ cam.target.addScaledVector(fwd, step); moved = true; }
    if (keys.KeyS || keys.ArrowDown){ cam.target.addScaledVector(fwd, -step); moved = true; }
    if (keys.KeyD || keys.ArrowRight){ cam.target.addScaledVector(right, step); moved = true; }
    if (keys.KeyA || keys.ArrowLeft){ cam.target.addScaledVector(right, -step); moved = true; }
    if (keys.KeyE){ cam.target.y += step; moved = true; }
    if (keys.KeyQ){ cam.target.y -= step; moved = true; }
    cam.target.x = Math.max(-190, Math.min(190, cam.target.x));
    cam.target.z = Math.max(-190, Math.min(190, cam.target.z));
    cam.target.y = Math.max(0.5, Math.min(150, cam.target.y));
    if (moved) applyCamera();
  }

  function resetCamera(){
    cam.pos = null; cam.look = null;
    cam.target.set(-6, 7, -2);
    cam.dist = 72; cam.yaw = 2.05; cam.pitch = 0.30;
    applyCamera();
  }

  /* ---------------- 游览路径 ---------------- */
  const tourCurve = new THREE.CatmullRomCurve3(world.tour.map(w => new THREE.Vector3(w[0][0], w[0][1], w[0][2])), true, 'catmullrom', 0.32);
  const lookCurve = new THREE.CatmullRomCurve3(world.tour.map(w => new THREE.Vector3(w[1][0], w[1][1], w[1][2])), true, 'catmullrom', 0.32);

  /* ---------------- 昼夜系统 ---------------- */
  const time = {
    hour: NUM('hour', 6.4),
    daySeconds: NUM('day', 300),
    // 指定 hour 时默认定格时间（便于截图/演示），auto=1 强制自动推进
    paused: P.get('auto') === '0' || (P.has('hour') && P.get('auto') !== '1')
  };
  const sunDirV = new THREE.Vector3();
  const moonDirV = new THREE.Vector3();

  function celestial(){
    const ang = (time.hour - 6) / 12 * Math.PI;
    sunDirV.set(Math.cos(ang) * 0.9, Math.sin(ang), 0.42).normalize();
    moonDirV.copy(sunDirV).multiplyScalar(-1);
  }

  const cDayZen = new THREE.Color(0x2c62c4), cNightZen = new THREE.Color(0x050a1c);
  const cDayHor = new THREE.Color(0xa8c2de), cNightHor = new THREE.Color(0x111a33);
  const cSunset = new THREE.Color(0xff7327), cGround = new THREE.Color(0x5d4632);
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();

  function updateLighting(){
    celestial();
    const elev = sunDirV.y;
    const dayF = sstep(-0.16, 0.14, elev);
    const nightF = 1 - sstep(-0.22, 0.03, elev);
    const sunsetF = Math.exp(-Math.pow((elev - 0.015) / 0.15, 2)) * (elev > -0.32 ? 1 : 0);
    const warm = sstep(0.0, 0.32, elev);

    // 天空
    skyUniforms.uSunDir.value.copy(sunDirV);
    skyUniforms.uMoonDir.value.copy(moonDirV);
    skyUniforms.uZenith.value.copy(cNightZen).lerp(cDayZen, dayF);
    tmpC.copy(cNightHor).lerp(cDayHor, dayF);
    tmpC.lerp(cSunset, sunsetF * 0.55);
    skyUniforms.uHorizon.value.copy(tmpC);
    skyUniforms.uSunset.value.copy(cSunset).lerp(cDayHor, dayF * 0.35);
    skyUniforms.uSunsetF.value = sunsetF;
    skyUniforms.uGround.value.copy(cGround).lerp(tmpC2.copy(cGround).lerp(cNightHor, 1 - dayF), 0.55);
    skyUniforms.uStars.value = nightF * nightF;
    skyUniforms.uSunSize.value = 1 - 0.25 * sunsetF;
    skyUniforms.uTime.value += 0.016;

    // 太阳 / 月亮
    sun.position.copy(sunDirV).multiplyScalar(340);
    sun.target.position.set(0, 0, 0);
    sun.intensity = Math.pow(clamp01(elev), 0.6) * 3.15 * (1 - 0.28 * sunsetF);
    tmpC.setRGB(1, lerp(0.52, 0.97, warm), lerp(0.24, 0.90, warm));
    sun.color.copy(tmpC);
    const sunUp = elev > -0.02;
    if (sunUp !== sun.castShadow){
      sun.castShadow = sunUp && renderer.shadowMap.enabled;
    }
    moon.position.copy(moonDirV).multiplyScalar(320);
    moon.target.position.set(0, 0, 0);
    moon.intensity = clamp01(-elev) * 0.42 * (0.35 + 0.65 * nightF);

    // 环境
    hemi.intensity = 0.16 + dayF * 1.02 + sunsetF * 0.18;
    hemi.color.copy(tmpC.copy(cNightHor).lerp(cDayZen, dayF));
    hemi.groundColor.setRGB(0.42 + 0.16 * dayF, 0.30 + 0.16 * dayF, 0.18 + 0.12 * dayF);
    amb.intensity = 0.16 + dayF * 0.18;

    // 雾（加强景深，隐藏远端接缝）
    scene.fog.color.copy(skyUniforms.uHorizon.value).lerp(skyUniforms.uZenith.value, 0.22);
    scene.fog.near = lerp(42, 72, dayF);
    scene.fog.far = lerp(260, 390, dayF);

    // 灯火
    const glowF = clamp01(nightF * 1.05 + sunsetF * 0.32);
    glowUniforms.uOpacity.value = glowF * 0.92;
    const eg = 0.30 + nightF * 2.25 + sunsetF * 0.35;
    matEmissive.color.setRGB(eg, eg * 0.945, eg * 0.87);
    return { dayF, nightF, sunsetF, elev };
  }

  /* ---------------- UI ---------------- */
  const $ = (id) => document.getElementById(id);
  const PRESETS = [
    { h: 5.7, name: '黎明' }, { h: 9.2, name: '上午' }, { h: 12.5, name: '正午' },
    { h: 18.6, name: '黄昏' }, { h: 23.2, name: '深夜' }
  ];
  const SPEEDS = [
    { v: 45, label: '1天/45秒' }, { v: 120, label: '1天/2分钟' }, { v: 300, label: '1天/5分钟' },
    { v: 900, label: '1天/15分钟' }, { v: 2400, label: '1天/40分钟' }
  ];

  function fmtHour(h){
    const hh = Math.floor(h) % 24;
    const mm = Math.floor((h - Math.floor(h)) * 60);
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }
  function phaseName(h, elev){
    if (elev !== undefined && elev > 0.42) return '正午烈日';
    if (h >= 4.6 && h < 7.2) return '黎明';
    if (h >= 7.2 && h < 11) return '上午';
    if (h >= 11 && h < 14) return '正午';
    if (h >= 14 && h < 17.4) return '午后';
    if (h >= 17.4 && h < 19.8) return '黄昏';
    if (h >= 19.8 && h < 22) return '入夜';
    return '深夜';
  }

  const timeSlider = $('timeSlider');
  const speedSlider = $('speedSlider');
  const playBtn = $('playBtn');
  const tourBtn = $('tourBtn');
  const clockText = $('clockText');
  const phaseText = $('phaseText');
  const helpPanel = $('helpPanel');

  function setHour(h){
    time.hour = ((h % 24) + 24) % 24;
    if (timeSlider) timeSlider.value = time.hour;
  }
  function togglePlay(){
    time.paused = !time.paused;
    if (playBtn) playBtn.textContent = time.paused ? '▶ 继续' : '⏸ 暂停';
    if (playBtn) playBtn.classList.toggle('paused', time.paused);
    setStatus(time.paused ? '昼夜循环已暂停（可拖动时间轴手动调节）' : '昼夜循环自动推进中');
  }
  function toggleTour(){
    if (tourState.active){ stopTour(); }
    else {
      tourState.active = true;
      tourState.t = 0;
      updateTourButton();
    }
  }
  function updateTourButton(){
    if (tourBtn) tourBtn.textContent = tourState.active ? '◼ 停止游览' : '▶ 自动游览';
    if (tourBtn) tourBtn.classList.toggle('active', tourState.active);
  }
  function toggleHelp(){
    if (helpPanel) helpPanel.classList.toggle('open');
  }

  if (playBtn) playBtn.addEventListener('click', togglePlay);
  if (tourBtn) tourBtn.addEventListener('click', toggleTour);
  const helpBtn = $('helpBtn');
  if (helpBtn) helpBtn.addEventListener('click', toggleHelp);
  const helpClose = $('helpClose');
  if (helpClose) helpClose.addEventListener('click', toggleHelp);
  const resetBtn = $('resetBtn');
  if (resetBtn) resetBtn.addEventListener('click', () => { resetCamera(); stopTour(); });

  if (timeSlider){
    timeSlider.value = time.hour;
    timeSlider.addEventListener('input', () => {
      time.hour = parseFloat(timeSlider.value);
    });
  }
  if (speedSlider){
    let idx = SPEEDS.findIndex(s => s.v === time.daySeconds);
    if (idx < 0) idx = 2;
    speedSlider.value = idx;
    speedSlider.addEventListener('input', () => {
      time.daySeconds = SPEEDS[parseInt(speedSlider.value, 10)].v;
      const lbl = $('speedLabel');
      if (lbl) lbl.textContent = SPEEDS[parseInt(speedSlider.value, 10)].label;
    });
    const lbl = $('speedLabel');
    if (lbl) lbl.textContent = SPEEDS[idx].label;
  }
  const presetWrap = $('presets');
  if (presetWrap){
    PRESETS.forEach((p) => {
      const b = document.createElement('button');
      b.textContent = p.name;
      b.addEventListener('click', () => setHour(p.h));
      presetWrap.appendChild(b);
    });
  }

  /* ---------------- 主循环 ---------------- */
  let last = performance.now();
  let frames = 0, fpsT = 0, fps = 0;
  const smokeSrcTimers = world.smokes.map(() => 0);
  const camDir = new THREE.Vector3();

  function frame(now){
    const dt = Math.min(0.06, Math.max(0.0005, (now - last) / 1000));
    last = now;
    frames++; fpsT += dt;
    if (fpsT > 0.5){ fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }

    if (!time.paused){
      time.hour += dt * 24 / time.daySeconds;
      if (time.hour >= 24) time.hour -= 24;
      if (timeSlider && document.activeElement !== timeSlider) timeSlider.value = time.hour;
    }

    const light = updateLighting();

    // 天空随相机
    sky.position.copy(camera.position);

    // 粒子发光尺度
    const scale = (renderer.domElement.height) * 0.5 / Math.tan(camera.fov * Math.PI / 360);
    glowUniforms.uScale.value = scale;
    smokeMat.uniforms.uScale.value = scale;

    // 动态件
    for (const d of dyn){
      const def = d.def, o = d.obj;
      if (def.kind === 'train'){
        const span = def.span;
        o.position.x = -span + ((def.x + span + now * 0.001 * def.speed) % (span * 2));
        o.rotation.y = 0;
      } else if (def.kind === 'windmill'){
        o.rotation.z += dt * def.speed;
      } else if (def.kind === 'tumbleweed'){
        const t = now * 0.001 * def.speed + def.phase;
        o.position.x = -120 + ((t * 5.2) % 240);
        o.position.z = def.z + Math.sin(t * 0.23) * 9;
        o.position.y = heightAt(o.position.x, o.position.z) + 1.05;
        o.rotation.x -= dt * def.speed * 1.6;
        o.rotation.z += dt * def.speed * 0.8;
      } else if (def.kind === 'cloud'){
        o.position.x = -260 + ((def.x + 260 + now * 0.001 * def.speed * 2.2) % 520);
      } else if (def.kind === 'fire'){
        const f = 1 + Math.sin(now * 0.011 + def.phase) * 0.12 + Math.sin(now * 0.027 + def.phase * 2) * 0.07;
        o.scale.set(f, 1.05 + Math.sin(now * 0.017 + def.phase) * 0.18, f);
      } else if (def.kind === 'clock'){
        const a = (time.hour % 12) / 12 * Math.PI * 2;
        const m = (time.hour % 1) * Math.PI * 2;
        o.rotation.z = -(def.part === 'hour' ? a : m) * def.dir;
      }
    }

    // 烟雾
    for (let i = 0; i < world.smokes.length; i++){
      const s = world.smokes[i];
      smokeSrcTimers[i] -= dt;
      if (smokeSrcTimers[i] <= 0){
        smokeSrcTimers[i] = s.rate;
        emitSmoke(s.x, s.y, s.z, s.scale, 1.25);
      }
    }
    for (let i = 0; i < SMOKE_MAX; i++){
      const p = smokeParts[i];
      if (p.age > p.life){
        smokeAlpha[i] = 0;
        smokePos[i * 3 + 1] = -9999;
        continue;
      }
      p.age += dt;
      p.x += p.vx * dt * 2.2;
      p.y += p.vy * dt * 1.6;
      p.z += p.vz * dt * 1.6;
      p.vx += (Math.random() - 0.5) * dt * 1.2;
      p.vz += (Math.random() - 0.5) * dt * 1.2;
      const t = p.age / p.life;
      smokePos[i * 3] = p.x;
      smokePos[i * 3 + 1] = p.y;
      smokePos[i * 3 + 2] = p.z;
      smokeSize[i] = p.size * (1 + t * 3.2);
      smokeAlpha[i] = Math.sin(Math.min(1, t * 1.25) * Math.PI) * 0.30;
      const g = 0.62 + 0.18 * light.dayF;
      smokeCol[i * 3] = g * 0.98; smokeCol[i * 3 + 1] = g * 0.95; smokeCol[i * 3 + 2] = g * 0.92;
    }
    smokeGeo.attributes.position.needsUpdate = true;
    smokeGeo.attributes.asize.needsUpdate = true;
    smokeGeo.attributes.aalpha.needsUpdate = true;
    smokeGeo.attributes.acolor.needsUpdate = true;

    updateCamera(dt);
    if (cam.pos){
      camera.position.copy(cam.pos);
      camera.lookAt(cam.look);
    }

    renderer.render(scene, camera);

    // HUD
    if (clockText) clockText.textContent = fmtHour(time.hour);
    if (phaseText) phaseText.textContent = phaseName(time.hour, light.elev);
    const fpsEl = $('fpsText');
    if (fpsEl) fpsEl.textContent = fps + ' FPS · ' + (STATS.tris / 1000).toFixed(0) + 'k tris';

    if (!frame.ready){
      frame.ready = true;
      const load = document.getElementById('loading');
      if (load && P.get('noui') !== '1') load.classList.add('hide');
      if (P.get('dbg') === '1'){
        const gl = renderer.getContext();
        const grid = [];
        for (let gy = 0; gy < 3; gy++){
          for (let gx = 0; gx < 3; gx++){
            const px = new Uint8Array(4);
            gl.readPixels((canvas.width * (gx + 0.5) / 3) | 0, (canvas.height * (gy + 0.5) / 3) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
            grid.push(Array.from(px).slice(0, 3));
          }
        }
        setStatus('DBG ' + JSON.stringify({
          rev: THREE.REVISION, gl2: renderer.capabilities.isWebGL2,
          outCS: renderer.outputColorSpace, srgbConst: THREE.SRGBColorSpace,
          tm: renderer.toneMapping, ac: THREE.ACESFilmicToneMapping, exp: renderer.toneMappingExposure,
          hour: +time.hour.toFixed(2), elev: +sunDirV.y.toFixed(3),
          sunI: +sun.intensity.toFixed(3), sunC: sun.color.getHexString(),
          hemiI: +hemi.intensity.toFixed(3), fog: [scene.fog.near, scene.fog.far],
          px: grid, buf: [canvas.width, canvas.height],
          search: location.search.slice(0, 160),
          camPos: cam.pos ? [+cam.pos.x.toFixed(1), +cam.pos.y.toFixed(1), +cam.pos.z.toFixed(1)] : null,
          camLook: cam.look ? [+cam.look.x.toFixed(1), +cam.look.y.toFixed(1), +cam.look.z.toFixed(1)] : null,
          paused: time.paused,
          bs: worldMesh.geometry.boundingSphere ? [worldMesh.geometry.boundingSphere.center.toArray().map(v => +v.toFixed(1)), +worldMesh.geometry.boundingSphere.radius.toFixed(1)] : null,
          idx: world.opaque.idx.length, vtx: world.opaque.pos.length / 3,
          culled: worldMesh.frustumCulled, inScene: !!worldMesh.parent
        }));
      } else {
        setStatus('READY ' + JSON.stringify({ tris: STATS.tris, buildMs: STATS.buildMs, hour: +time.hour.toFixed(2) }));
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- 尺寸 ---------------- */
  function onResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  /* ---------------- 启动 ---------------- */
  applyCamera();
  updateTourButton();
  if (P.get('noui') === '1'){
    const hud = document.getElementById('hud');
    if (hud) hud.style.display = 'none';
    const ld = document.getElementById('loading');
    if (ld) ld.style.display = 'none';
  }
  if (P.has('day')){ /* 由 NUM 初始化 */ }
  requestAnimationFrame(frame);
  setStatus('READY ' + JSON.stringify({ tris: STATS.tris, buildMs: STATS.buildMs }));
})();
