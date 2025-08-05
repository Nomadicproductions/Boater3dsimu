import * as THREE from 'https://cdn.skypack.dev/three@0.150.1';

let scene, camera, renderer;
let boat;
let clock = new THREE.Clock();
let waveSpeed = 0.5;

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Sky blue

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Light
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(0, 10, 10);
  scene.add(light);

  // Water (animated shader-like surface)
  const geometry = new THREE.PlaneGeometry(1000, 1000, 100, 100);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshPhongMaterial({
    color: 0x1e90ff,
    flatShading: true,
    shininess: 80,
    side: THREE.DoubleSide
  });

  const water = new THREE.Mesh(geometry, material);
  scene.add(water);

  // Simple boat (cube placeholder)
  const boatGeo = new THREE.BoxGeometry(1, 0.5, 2);
  const boatMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
  boat = new THREE.Mesh(boatGeo, boatMat);
  boat.position.y = 0.3;
  scene.add(boat);

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Keyboard controls
  document.addEventListener('keydown', onKeyDown);

  // Mobile touch button controls
  document.getElementById('up').addEventListener('touchstart', () => boat.position.z -= 0.2);
  document.getElementById('down').addEventListener('touchstart', () => boat.position.z += 0.2);
  document.getElementById('left').addEventListener('touchstart', () => boat.rotation.y += 0.1);
  document.getElementById('right').addEventListener('touchstart', () => boat.rotation.y -= 0.1);
}

function onKeyDown(event) {
  const speed = 0.2;
  if (event.key === 'ArrowUp') boat.position.z -= speed;
  if (event.key === 'ArrowDown') boat.position.z += speed;
  if (event.key === 'ArrowLeft') boat.rotation.y += 0.1;
  if (event.key === 'ArrowRight') boat.rotation.y -= 0.1;
}

function animate() {
  requestAnimationFrame(animate);

  // Simulate wave movement by updating vertices
  const time = clock.getElapsedTime();
  scene.children.forEach(obj => {
    if (obj.geometry && obj.geometry.isBufferGeometry) {
      const pos = obj.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const y = Math.sin(x * 0.1 + time * waveSpeed) * 0.1 + Math.cos(z * 0.1 + time * waveSpeed) * 0.1;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
  });

  // Keep camera behind the boat
  camera.position.x = boat.position.x - Math.sin(boat.rotation.y) * 10;
  camera.position.z = boat.position.z - Math.cos(boat.rotation.y) * 10;
  camera.lookAt(boat.position);

  renderer.render(scene, camera);
}
