import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// Scene setup
let scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue

let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

let renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
let light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7.5);
scene.add(light);

// Grid Helper
const grid = new THREE.GridHelper(100, 100, 0x555555, 0xaaaaaa);
grid.rotation.x = Math.PI / 2;
scene.add(grid);

// Boat (cube)
let geometry = new THREE.BoxGeometry(1, 0.5, 2);
let material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
let boat = new THREE.Mesh(geometry, material);
boat.position.y = 0.25;
scene.add(boat);

// Water plane
let waterGeometry = new THREE.PlaneGeometry(500, 500, 100, 100);
let waterMaterial = new THREE.MeshStandardMaterial({
  color: 0x1e90ff,
  transparent: true,
  opacity: 0.7,
  side: THREE.DoubleSide,
});
let water = new THREE.Mesh(waterGeometry, waterMaterial);
water.rotation.x = -Math.PI / 2;
scene.add(water);

// Animate waves
function animateWater(time) {
  const verts = water.geometry.attributes.position;
  for (let i = 0; i < verts.count; i++) {
    const x = verts.getX(i);
    const y = verts.getY(i);
    const z = Math.sin(x / 5 + time / 1000) * 0.5 + Math.cos(y / 5 + time / 800) * 0.3;
    verts.setZ(i, z);
  }
  verts.needsUpdate = true;
  water.geometry.computeVertexNormals();
}

// --- DYNAMIC WATER CURRENT CODE ---

// Water current properties
let current = new THREE.Vector2(0, 0); // x and y = world X and Z
let targetCurrent = new THREE.Vector2(0, 0);
let currentChangeTimer = 0;
const CURRENT_UPDATE_INTERVAL = 5000; // ms
const CURRENT_MAX_STRENGTH = 0.02; // tweak for realism

// Randomize the target current direction and strength
function randomizeTargetCurrent() {
  const angle = Math.random() * 2 * Math.PI;
  const strength = Math.random() * CURRENT_MAX_STRENGTH;
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
  // Handle user input for movement
  let speed = 0.12;
  let turnSpeed = 0.05;

  // Forward/backward acceleration
  let forward = 0;
  if (move.forward) forward += speed;
  if (move.backward) forward -= speed * 0.7;

  // Turning
  if (move.left) boat.rotation.y += turnSpeed;
  if (move.right) boat.rotation.y -= turnSpeed;

  // Movement in facing direction
  let dir = new THREE.Vector2(-Math.sin(boat.rotation.y), -Math.cos(boat.rotation.y));
  boatVelocity.addScaledVector(dir, forward);

  // Apply water current (smoothed)
  boatVelocity.add(current);

  // Friction/damping
  boatVelocity.multiplyScalar(0.96);

  // Move boat
  boat.position.x += boatVelocity.x;
  boat.position.z += boatVelocity.y;

  // Log position for debugging
  console.log(
    `Boat position: x=${boat.position.x.toFixed(2)}, z=${boat.position.z.toFixed(2)} | Current: (${current.x.toFixed(3)}, ${current.y.toFixed(3)})`
  );
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

// --- HANDLE WINDOW RESIZE ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- ANIMATION LOOP ---

function animate(time) {
  requestAnimationFrame(animate);

  // Animate water
  animateWater(time);

  // Smoothly update current toward target current
  current.lerp(targetCurrent, 0.005);

  // Change target current every interval
  currentChangeTimer += (1 / 60) * 1000;
  if (currentChangeTimer > CURRENT_UPDATE_INTERVAL) {
    randomizeTargetCurrent();
    currentChangeTimer = 0;
  }

  updateBoatMovement();
  updateCamera();

  renderer.render(scene, camera);
}

animate();
