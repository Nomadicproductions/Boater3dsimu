import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue

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

// --- GRID HELPER & WATER PLANE ---
const grid = new THREE.GridHelper(100, 100, 0x555555, 0xaaaaaa);
grid.position.y = 0.01; // Ensure above water for visibility
scene.add(grid);

const waterGeometry = new THREE.PlaneGeometry(500, 500, 100, 100);
const waterMaterial = new THREE.MeshStandardMaterial({
  color: 0x1e90ff,
  transparent: true,
  opacity: 0.8,
  side: THREE.DoubleSide,
});
const water = new THREE.Mesh(waterGeometry, waterMaterial);
water.rotation.x = -Math.PI / 2;
water.position.y = 0; // Boat sits slightly above this
scene.add(water);

// --- BOAT ---
const boatGeometry = new THREE.BoxGeometry(1, 0.5, 2);
const boatMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });
const boat = new THREE.Mesh(boatGeometry, boatMaterial);
boat.position.y = 0.27; // Just above water
scene.add(boat);

// --- DYNAMIC WAVES (BASE RIPPLE) ---
function animateWater(time) {
  const verts = water.geometry.attributes.position;
  for (let i = 0; i < verts.count; i++) {
    const x = verts.getX(i);
    const y = verts.getY(i);
    // Make waves more prominent
    const z =
      Math.sin(x / 5 + time / 900) * 0.7 +
      Math.cos(y / 7 + time / 1100) * 0.4;
    verts.setZ(i, z);
  }
  verts.needsUpdate = true;
  water.geometry.computeVertexNormals();
}

// --- SWELL/BREAKING WAVE SYSTEM ---

// Coordinate system: X (left-right), Z (forward-backward)
// All wave overlays are drawn in 2D on #wave-overlay, mapped from 3D world to 2D screen

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

// Swell/wave set parameters
const SWELL_SPAWN_INTERVAL = 4500; // ms
const SWELL_SPAWN_RADIUS = 180; // how far from center
const SWELL_MIN_SET = 3;
const SWELL_MAX_SET = 5;
const SWELL_MIN_LENGTH = 10;
const SWELL_MAX_LENGTH = 30;
const SWELL_MIN_WIDTH = 18;
const SWELL_MAX_WIDTH = 28;
const SWELL_MIN_DURATION = 5000;
const SWELL_MAX_DURATION = 9000;
const SWELL_BARREL_SPEED = 0.06; // units per frame (relative to world units)

let swells = [];  // Active swells

function spawnSwellSet() {
  const setCount = Math.floor(Math.random() * (SWELL_MAX_SET - SWELL_MIN_SET + 1)) + SWELL_MIN_SET;
  let baseCenter = new THREE.Vector3(
    (Math.random() - 0.5) * SWELL_SPAWN_RADIUS,
    0,
    (Math.random() - 0.5) * SWELL_SPAWN_RADIUS
  );
  let setAngle = Math.random() * 2 * Math.PI;
  let dir = new THREE.Vector2(Math.cos(setAngle), Math.sin(setAngle));
  let spacing = SWELL_MAX_WIDTH * 1.2;

  for (let i = 0; i < setCount; i++) {
    // Each swell is offset along the direction
    let center = baseCenter.clone().add(new THREE.Vector3(dir.x * i * spacing, 0, dir.y * i * spacing));
    let width = Math.random() * (SWELL_MAX_WIDTH - SWELL_MIN_WIDTH) + SWELL_MIN_WIDTH;
    let length = Math.random() * (SWELL_MAX_LENGTH - SWELL_MIN_LENGTH) + SWELL_MIN_LENGTH;
    let duration = Math.random() * (SWELL_MAX_DURATION - SWELL_MIN_DURATION) + SWELL_MIN_DURATION;
    let barrelDir = Math.random() < 0.5 ? -1 : 1; // barrel travels left or right
    let willBreak = Math.random() < 0.8; // 80% will break/whitewash, others fade out

    swells.push({
      center,
      width,
      length,
      duration,
      time: 0,
      phase: 'growing', // growing, steady, shrinking, done
      barrelProgress: 0,
      barrelDir,
      willBreak,
      breakLength: 0,
      barrelAt: 0, // 0..1 along width
      fade: 0,
    });
  }
}

let timeSinceLastSwell = 0;

// --- ANIMATE SWELLS ---
function updateSwells(dt) {
  for (let swell of swells) {
    swell.time += dt;
    // Animation phases
    let growT = Math.min(1, swell.time / (swell.duration * 0.2));
    let shrinkT = Math.max(0, (swell.time - swell.duration * 0.7) / (swell.duration * 0.3));
    if (swell.phase === 'growing') {
      swell.breakLength = growT * swell.length;
      if (growT >= 1) swell.phase = 'steady';
    } else if (swell.phase === 'steady') {
      swell.breakLength = swell.length;
      if (swell.time > swell.duration * 0.7) swell.phase = 'shrinking';
    } else if (swell.phase === 'shrinking') {
      swell.breakLength = (1 - shrinkT) * swell.length;
      if (shrinkT >= 1) swell.phase = 'done';
    }
    // Barrel travels along width during lifetime, leaving whitewash behind
    if (swell.phase !== 'done') {
      let barrelSpeed = SWELL_BARREL_SPEED * swell.barrelDir;
      let t = swell.time / swell.duration;
      swell.barrelAt = Math.max(0, Math.min(1, 0.1 + t * 0.8));
    }
  }
  // Remove finished swells
  swells = swells.filter(swell => swell.phase !== 'done');
}

// --- DRAW SWELLS/BREAKING WAVES (2D Overlay) ---
function drawSwells() {
  const ctx = waveOverlay.getContext('2d');
  ctx.clearRect(0, 0, waveOverlay.width, waveOverlay.height);

  for (let swell of swells) {
    // Project center to screen
    let center2d = worldToScreen(swell.center);

    // Draw white wash/broken wave as a translucent rectangle
    if (swell.phase !== 'done' && swell.willBreak) {
      let barrelPos = (swell.barrelAt - 0.5) * swell.width;
      let length = swell.breakLength;
      let left = -swell.width / 2;
      let right = swell.width / 2;
      let barrelX = barrelPos;

      // Rectangle area: grows from barrel origin, then shrinks
      ctx.save();
      ctx.translate(center2d.x, center2d.y);
      ctx.rotate(0); // Could add orientation if desired

      // White foam (broken wave)
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#eaf7ff';
      ctx.fillRect(
        left,
        -length / 2,
        right - left,
        length
      );
      // Barrel highlight
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = '#b4e1ff';
      ctx.fillRect(
        barrelX - 8,
        -length / 2,
        16,
        length
      );
      ctx.restore();
    }

    // Draw main swell as subtle blue ellipse (not breaking)
    if (!swell.willBreak) {
      ctx.save();
      ctx.translate(center2d.x, center2d.y);
      ctx.globalAlpha = 0.2 + 0.3 * (1 - Math.abs(0.5 - swell.barrelAt));
      ctx.strokeStyle = '#aef';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, swell.width / 2, swell.length / 2, 0, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// --- SWELL SPAWNER TIMER ---
function updateSwellSpawner(dt) {
  timeSinceLastSwell += dt;
  if (timeSinceLastSwell > SWELL_SPAWN_INTERVAL) {
    spawnSwellSet();
    timeSinceLastSwell = 0;
  }
}

// --- MOVEMENT (AS BEFORE) ---
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

// --- ANIMATION LOOP ---
let lastTime = performance.now();
function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  let dt = now - lastTime;
  lastTime = now;

  animateWater(now);

  // Swell system
  updateSwellSpawner(dt);
  updateSwells(dt);
  drawSwells();

  updateBoatMovement();
  updateCamera();

  renderer.render(scene, camera);
}
animate();
