import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

let scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue

let camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
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

// Movement
let move = {
  forward: false,
  left: false,
  right: false
};

function updateBoatMovement() {
  if (move.forward) {
    boat.position.z -= Math.cos(boat.rotation.y) * 0.1;
    boat.position.x -= Math.sin(boat.rotation.y) * 0.1;
  }
  if (move.left) boat.rotation.y += 0.05;
  if (move.right) boat.rotation.y -= 0.05;

  console.log(`Boat position: x=${boat.position.x.toFixed(2)}, z=${boat.position.z.toFixed(2)}`);
}

// Button controls
const btnLeft = document.getElementById('left');
const btnRight = document.getElementById('right');
const btnForward = document.getElementById('forward');

function setupButton(button, dir) {
  button.addEventListener('touchstart', e => {
    e.preventDefault();
    move[dir] = true;
  });
  button.addEventListener('touchend', e => {
    e.preventDefault();
    move[dir] = false;
  });
  button.addEventListener('mousedown', () => move[dir] = true);
  button.addEventListener('mouseup', () => move[dir] = false);
  button.addEventListener('mouseleave', () => move[dir] = false);
}
setupButton(btnLeft, 'left');
setupButton(btnRight, 'right');
setupButton(btnForward, 'forward');

// Animate
function animate(time) {
  requestAnimationFrame(animate);
  animateWater(time);
  updateBoatMovement();
  renderer.render(scene, camera);
}
animate();
