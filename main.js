import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// --- SCENE SETUP ---
let scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue

let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

let renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- LIGHTING ---
let light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7.5);
scene.add(light);

// --- GRID HELPER & WATER PLANE ---
// Grid
const grid = new THREE.GridHelper(100, 100, 0x555555, 0xaaaaaa);
grid.position.y = 0.01; // Ensure above water for visibility
scene.add(grid);

// Water
let waterGeometry = new THREE.PlaneGeometry(500, 500, 100, 100);
let waterMaterial = new THREE.MeshStandardMaterial({
  color: 0x1e90ff,
  transparent: true,
  opacity: 0.8,
  side: THREE.DoubleSide,
});
let water = new THREE.Mesh(waterGeometry, waterMaterial);
water.rotation.x = -Math.PI / 2;
water.position.y = 0; // Boat sits slightly above this
scene.add(water);

// --- BOAT ---
let geometry = new THREE.BoxGeometry(1, 0.5, 2);
let material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
let boat = new THREE.Mesh(geometry, material);
boat.position.y = 0.27; // Just above water
scene.add(boat);

// --- DYNAMIC WAVES ---
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

// --- DYNAMIC WATER CURRENT (VISIBLE & STRONG FOR TESTING) ---
let current = new THREE.Vector2(0, 0); // x: world X, y: world Z
let targetCurrent = new THREE.Vector2(0, 0);
let currentChangeTimer = 0;
const CURRENT_UPDATE_INTERVAL = 3500; // ms, faster for demo
const CURRENT_MAX_STRENGTH = 0.06; // STRONGER for demo; lower later

function randomizeTargetCurrent() {
  const angle = Math.random() * 2 * Math.PI;
  const strength = Math.random() * CURRENT_MAX_STRENGTH * 0.8 + CURRENT_MAX_STRENGTH * 0.2;
  targetCurrent.set(Math.cos(angle) * strength, Math.sin(angle) * strength);
}
randomizeTargetCurrent();

// --- MOVEMENT ---
let move = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

let boatVelocity = new THREE.Vector2(0, 0); // X and Z velocity

function updateBoatMovement() {
  // Input
  let speed = 0.12;
  let turnSpeed = 0.05;

  let forward = 0;
  if (move.forward) forward += speed;
  if (move.backward) forward -= speed * 0.7;

  if (move.left) boat.rotation.y += turnSpeed;
  if (move.right) boat.rotation.y -= turnSpeed;

  // Boat moves in facing direction
  let dir = new THREE.Vector2(-Math.sin(boat.rotation.y), -Math.cos(boat.rotation.y));
  boatVelocity.addScaledVector(dir, forward);

  // Apply water current (visible drift)
  boatVelocity.add(current);

  // Friction
  boatVelocity.multiplyScalar(0.96);

  // Move boat
  boat.position.x += boatVelocity.x;
  boat.position.z += boatVelocity.y;

  // Log position and current
  // (Uncomment if you want logs!)
  // console.log(
  //   `Boat: x=${boat.position.x.toFixed(2)}, z=${boat.position.z.toFixed(2)} | Current: (${current.x.toFixed(3)}, ${current.y.toFixed(3)})`
  // );
}

// --- BUTTON CONTROLS ---
const btnLeft = document.getElementById('left');
const btnRight = document.getElementById('right');
const btnForward = document.getElementById('forward');
const btnBackward = document.getElementById('backward');

function setupButton(button, dir) {
  button.addEventListener('touchstart', e => {
    e.preventDefault();
    move[dir] = true;
  });
  button.addEventListener('touchend', e => {
    e.preventDefault();
    move[dir] = false;
  });
  button.addEventListener('mousedown', () => (move[dir] = true));
  button.addEventListener('mouseup', () => (move[dir] = false));
  button.addEventListener('mouseleave', () => (move[dir] = false));
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

// --- ON-SCREEN CURRENT INDICATOR ---
function drawCurrentArrow() {
  // Create/reuse overlay canvas
  let overlay = document.getElementById('current-arrow-overlay');
  if (!overlay) {
    overlay = document.createElement('canvas');
    overlay.id = 'current-arrow-overlay';
    overlay.style.position = 'absolute';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.pointerEvents = 'none';
    overlay.width = window.innerWidth;
    overlay.height = window.innerHeight;
    overlay.style.zIndex = 2;
    document.body.appendChild(overlay);
  }
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  // Draw arrow in upper right
  const cx = overlay.width - 60;
  const cy = 60;
  const arrowLength = 40;
  const strength = current.length();
  const angle = Math.atan2(current.x, current.y);

  // Arrow color/opacity based on strength
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-angle); // Y forward is up

  ctx.lineWidth = 5;
  ctx.strokeStyle = `rgba(30,144,255,${0.5 + 0.5 * (strength / CURRENT_MAX_STRENGTH)})`;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -arrowLength);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(-8, -arrowLength + 15);
  ctx.lineTo(0, -arrowLength);
  ctx.lineTo(8, -arrowLength + 15);
  ctx.stroke();

  // Text
  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#1e90ff";
  ctx.fillText("Current", -30, 40);

  ctx.restore();
}

// --- RESIZE HANDLER ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  let overlay = document.getElementById('current-arrow-overlay');
  if (overlay) {
    overlay.width = window.innerWidth;
    overlay.height = window.innerHeight;
  }
});

// --- ANIMATION LOOP ---
function animate(time) {
  requestAnimationFrame(animate);

  // Animate water
  animateWater(time);

  // Smoothly update current toward target
  current.lerp(targetCurrent, 0.01);

  // Change target every interval
  currentChangeTimer += (1 / 60) * 1000;
  if (currentChangeTimer > CURRENT_UPDATE_INTERVAL) {
    randomizeTargetCurrent();
    currentChangeTimer = 0;
  }

  updateBoatMovement();
  updateCamera();
  drawCurrentArrow();

  renderer.render(scene, camera);
}
animate();
