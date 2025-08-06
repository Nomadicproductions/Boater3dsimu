import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- LIGHTING ---
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7.5);
scene.add(light);

// --- WATER PLANE ---
const WATER_SIZE = 500;
const WATER_RES = 100;
const waterGeometry = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_RES, WATER_RES);
const waterMaterial = new THREE.MeshStandardMaterial({
  color: 0x1e90ff,
  transparent: true,
  opacity: 0.8,
  side: THREE.DoubleSide,
});
const water = new THREE.Mesh(waterGeometry, waterMaterial);
water.rotation.x = -Math.PI / 2;
water.position.y = 0;
scene.add(water);

// --- BOAT ---
const boatGeometry = new THREE.BoxGeometry(1, 0.5, 2);
const boatMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });
const boat = new THREE.Mesh(boatGeometry, boatMaterial);
boat.position.y = 0.27;
scene.add(boat);

// --- RIPPLE/WAVEFRONT SYSTEM ---
const waveOverlay = document.getElementById('wave-overlay');
function resizeWaveOverlay() {
  waveOverlay.width = window.innerWidth;
  waveOverlay.height = window.innerHeight;
}
resizeWaveOverlay();
window.addEventListener('resize', resizeWaveOverlay);

// Utility: project 3D world coords to 2D screen
function worldToScreen(pos) {
  const vector = pos.clone().project(camera);
  return {
    x: (vector.x + 1) / 2 * waveOverlay.width,
    y: (-vector.y + 1) / 2 * waveOverlay.height,
  };
}

// --- RIPPLE WAVEFRONT OBJECTS ---
const RIPPLE_SPEED = 0.14; // units per frame
const RIPPLE_LENGTH = 260; // map-wide
const RIPPLE_DURATION = 40000; // ms (40s)
const RIPPLE_HEIGHT = 2.0; // amplitude on water mesh
const RIPPLE_WIDTH = 15; // visual thickness

// Each ripple is a moving wavefront, spans the whole water mesh
let ripples = [];

// --- BREAKING WAVE OBJECTS ---
const BREAKING_WAVE_MIN_DURATION = 32000; // ms
const BREAKING_WAVE_MAX_DURATION = 42000; // ms
const BREAKING_WAVE_GROW_TIME = 0.22; // % of duration to grow
const BREAKING_WAVE_SHRINK_TIME = 0.22; // % of duration to shrink
const BREAKING_WAVE_MAX_LENGTH = WATER_SIZE * 0.95; // nearly map-wide
const BREAKING_WAVE_HEIGHT = 12; // thickness of rectangle (how tall visually)
const BREAKING_WAVE_BARREL_WIDTH = 18; // width of barrel highlight

let breakingWaves = [];

// --- SPAWN RIPPLE/WAVEFRONT ---
function spawnRippleSet() {
  // random direction (angle)
  let angle = Math.random() * Math.PI * 2;
  let dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle)).normalize();
  let start = new THREE.Vector3(
    -dir.x * WATER_SIZE * 0.45,
    0,
    -dir.y * WATER_SIZE * 0.45
  );
  // Spawn a ripple (wavefront), with a breaking wave attached
  ripples.push({
    start: start.clone(),
    dir: dir.clone(),
    progress: 0,
    spawnTime: performance.now(),
    duration: RIPPLE_DURATION,
    breakingWaveId: null,
  });

  // Breaking wave always spawns on a ripple
  let bwDuration =
    Math.random() * (BREAKING_WAVE_MAX_DURATION - BREAKING_WAVE_MIN_DURATION) +
    BREAKING_WAVE_MIN_DURATION;
  breakingWaves.push({
    rippleIdx: ripples.length - 1,
    spawnTime: performance.now(),
    duration: bwDuration,
    phase: 'growing', // growing, steady, shrinking
    length: 0,
    maxLength: BREAKING_WAVE_MAX_LENGTH,
    barrelPos: 0, // position along wavefront
    barrelSpeed: 0.55 + Math.random() * 0.25, // how fast barrel moves along crest [0,1]
  });
  ripples[ripples.length - 1].breakingWaveId = breakingWaves.length - 1;
}

// --- WATER MESH ANIMATION ---
// Animate a wide wavefront ripple moving across the map
function animateWater(time) {
  const verts = water.geometry.attributes.position;
  let t = time * 0.00045;
  for (let i = 0; i < verts.count; i++) {
    const x = verts.getX(i);
    const z = verts.getY(i); // plane rotated, so Y is Z
    let rippleHeight = 0;
    for (let ripple of ripples) {
      let age = time - ripple.spawnTime;
      if (age > ripple.duration) continue;
      let frontPos =
        age * RIPPLE_SPEED +
        RIPPLE_LENGTH / 2; // progress along direction
      // Project point onto ripple direction
      let dx = x - ripple.start.x;
      let dz = z - ripple.start.z;
      let along = dx * ripple.dir.x + dz * ripple.dir.y;
      let distToFront = along - frontPos;
      // Only affect region near wavefront
      if (Math.abs(distToFront) < RIPPLE_WIDTH) {
        rippleHeight +=
          Math.sin((distToFront / RIPPLE_WIDTH) * Math.PI) * RIPPLE_HEIGHT;
      }
    }
    verts.setZ(i, rippleHeight);
  }
  verts.needsUpdate = true;
  water.geometry.computeVertexNormals();
}

// --- BREAKING WAVE ANIMATION ---
function updateBreakingWaves(dt) {
  let now = performance.now();
  for (let bw of breakingWaves) {
    let elapsed = now - bw.spawnTime;
    // Determine phase
    let growDuration = bw.duration * BREAKING_WAVE_GROW_TIME;
    let steadyDuration = bw.duration * (1 - BREAKING_WAVE_GROW_TIME - BREAKING_WAVE_SHRINK_TIME);
    let shrinkDuration = bw.duration * BREAKING_WAVE_SHRINK_TIME;
    if (elapsed < growDuration) {
      bw.phase = 'growing';
      bw.length = (elapsed / growDuration) * bw.maxLength;
    } else if (elapsed < growDuration + steadyDuration) {
      bw.phase = 'steady';
      bw.length = bw.maxLength;
    } else if (elapsed < bw.duration) {
      bw.phase = 'shrinking';
      let t = (elapsed - growDuration - steadyDuration) / shrinkDuration;
      bw.length = (1 - t) * bw.maxLength;
    } else {
      bw.phase = 'done';
      bw.length = 0;
    }
    // Barrel position moves along the crest during the breaking wave lifetime
    let barrelProgress =
      Math.min(1, elapsed / bw.duration) * bw.barrelSpeed + 0.1;
    bw.barrelPos = Math.min(1, barrelProgress);
  }
  // Remove finished breaking waves
  breakingWaves = breakingWaves.filter((bw) => bw.phase !== 'done');
}

// --- RIPPLE/WAVEFRONT UPDATE ---
function updateRipples(dt) {
  let now = performance.now();
  ripples = ripples.filter(r => now - r.spawnTime < r.duration);
}

// --- DRAW BREAKING WAVES ON OVERLAY ---
function drawBreakingWaves() {
  const ctx = waveOverlay.getContext('2d');
  ctx.clearRect(0, 0, waveOverlay.width, waveOverlay.height);

  for (let i = 0; i < breakingWaves.length; i++) {
    const bw = breakingWaves[i];
    if (bw.phase === 'done') continue;
    // Ripple must exist
    if (!ripples[bw.rippleIdx]) continue;
    const ripple = ripples[bw.rippleIdx];

    // Where is the ripple now?
    let now = performance.now();
    let age = now - ripple.spawnTime;
    let rippleFrontPos = age * RIPPLE_SPEED + RIPPLE_LENGTH / 2;
    // Centerline of ripple
    let center = ripple.start.clone().add(
      new THREE.Vector3(
        ripple.dir.x * rippleFrontPos,
        0,
        ripple.dir.y * rippleFrontPos
      )
    );

    // Draw breaking wave as a long rectangle, oriented along the ripple
    let length = bw.length;
    let thickness = BREAKING_WAVE_HEIGHT;
    let angle = Math.atan2(ripple.dir.x, ripple.dir.y);

    let center2d = worldToScreen(center);
    ctx.save();
    ctx.translate(center2d.x, center2d.y);
    ctx.rotate(-angle);

    // White foam (breaking wave)
    ctx.globalAlpha = 0.81;
    ctx.fillStyle = '#eaf7ff';
    ctx.fillRect(
      -length / 2,
      -thickness / 2,
      length,
      thickness
    );

    // Barrel highlight
    let barrelX = -length / 2 + bw.barrelPos * length;
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#b4e1ff';
    ctx.fillRect(
      barrelX - BREAKING_WAVE_BARREL_WIDTH / 2,
      -thickness / 2,
      BREAKING_WAVE_BARREL_WIDTH,
      thickness
    );
    ctx.restore();
  }
}

// --- SPAWN TIMER ---
let lastRippleSpawn = performance.now();
function updateSpawner(dt) {
  let now = performance.now();
  if (now - lastRippleSpawn > 12000) { // spawn every 12s
    spawnRippleSet();
    lastRippleSpawn = now;
  }
}

// --- MOVEMENT ---
const controls = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

let boatVelocity = new THREE.Vector2(0, 0);

function updateBoatMovement() {
  const speed = 0.009;
  const turnSpeed = 0.007;
  let forward = 0;
  if (controls.forward) forward += speed;
  if (controls.backward) forward -= speed * 0.7;

  if (controls.left) boat.rotation.y += turnSpeed;
  if (controls.right) boat.rotation.y -= turnSpeed;

  // Boat moves in facing direction
  const dir = new THREE.Vector2(-Math.sin(boat.rotation.y), -Math.cos(boat.rotation.y));
  boatVelocity.addScaledVector(dir, forward);

  // Friction
  boatVelocity.multiplyScalar(0.94);

  // Move boat
  boat.position.x += boatVelocity.x;
  boat.position.z += boatVelocity.y;
}

// --- BUTTON CONTROLS ---
const btnLeft = document.getElementById('left');
const btnRight = document.getElementById('right');
const btnForward = document.getElementById('forward');
const btnBackward = document.getElementById('backward');

function setupButton(button, dir) {
  button.addEventListener('touchstart', e => { e.preventDefault(); controls[dir] = true; });
  button.addEventListener('touchend', e => { e.preventDefault(); controls[dir] = false; });
  button.addEventListener('mousedown', () => (controls[dir] = true));
  button.addEventListener('mouseup', () => (controls[dir] = false));
  button.addEventListener('mouseleave', () => (controls[dir] = false));
}
setupButton(btnLeft, 'left');
setupButton(btnRight, 'right');
setupButton(btnForward, 'forward');
setupButton(btnBackward, 'backward');

// --- CAMERA FOLLOWS BOAT ---
function updateCamera() {
  const offset = new THREE.Vector3(0, 5, 10).applyEuler(boat.rotation);
  const desired = boat.position.clone().add(offset);
  camera.position.lerp(desired, 0.07);
  camera.lookAt(boat.position);
}

// --- MAIN ANIMATION LOOP ---
let lastTime = performance.now();
function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  let dt = now - lastTime;
  lastTime = now;

  animateWater(now);
  updateSpawner(dt);
  updateRipples(dt);
  updateBreakingWaves(dt);
  drawBreakingWaves();

  updateBoatMovement();
  updateCamera();

  renderer.render(scene, camera);
}
animate();
