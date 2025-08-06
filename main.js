import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 50, 300);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- DEBUG MODE ---
const DEBUG_MODE = false; // Set to true to see collision boxes

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
scene.add(directionalLight);

// --- WATER PLANE ---
const WATER_SIZE = 500;
const WATER_RES = 100;
const waterGeometry = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_RES, WATER_RES);
const waterMaterial = new THREE.MeshStandardMaterial({
  color: 0x1e90ff,
  transparent: true,
  opacity: 0.85,
  roughness: 0.1,
  metalness: 0.2,
  side: THREE.DoubleSide,
});
const water = new THREE.Mesh(waterGeometry, waterMaterial);
water.rotation.x = -Math.PI / 2;
water.position.y = 0;
water.receiveShadow = true;
scene.add(water);

// --- BOAT GROUP ---
const boatGroup = new THREE.Group();

// Hull
const hullGeometry = new THREE.BufferGeometry();
const hullVertices = new Float32Array([
  // Bottom vertices
  -0.4, 0, -1,    // 0
   0.4, 0, -1,    // 1
   0.5, 0, 0.8,   // 2
   0, 0, 1,       // 3
  -0.5, 0, 0.8,   // 4
  // Top vertices
  -0.3, 0.3, -0.8,  // 5
   0.3, 0.3, -0.8,  // 6
   0.4, 0.3, 0.6,   // 7
   0, 0.3, 0.8,     // 8
  -0.4, 0.3, 0.6,   // 9
]);

const hullIndices = new Uint16Array([
  // Bottom
  0, 1, 2, 0, 2, 3, 0, 3, 4,
  // Sides
  0, 5, 1, 1, 5, 6,
  1, 6, 2, 2, 6, 7,
  2, 7, 3, 3, 7, 8,
  3, 8, 4, 4, 8, 9,
  4, 9, 0, 0, 9, 5,
  // Top
  5, 7, 6, 5, 8, 7, 5, 9, 8
]);

hullGeometry.setAttribute('position', new THREE.BufferAttribute(hullVertices, 3));
hullGeometry.setIndex(new THREE.BufferAttribute(hullIndices, 1));
hullGeometry.computeVertexNormals();

const boatMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x8B4513,
  roughness: 0.7,
  metalness: 0.1 
});
const hull = new THREE.Mesh(hullGeometry, boatMaterial);
hull.castShadow = true;
hull.receiveShadow = true;
boatGroup.add(hull);

// Mast
const mastGeometry = new THREE.CylinderGeometry(0.03, 0.03, 2);
const mastMaterial = new THREE.MeshStandardMaterial({ color: 0x4B3621 });
const mast = new THREE.Mesh(mastGeometry, mastMaterial);
mast.position.set(0, 1.15, -0.2);
mast.castShadow = true;
boatGroup.add(mast);

// Sail
const sailGeometry = new THREE.BufferGeometry();
const sailVertices = new Float32Array([
  0, 0.3, 0,
  0, 1.8, 0,
  0.6, 1.5, 0.3,
  0.5, 0.3, 0.2
]);
const sailIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
sailGeometry.setAttribute('position', new THREE.BufferAttribute(sailVertices, 3));
sailGeometry.setIndex(new THREE.BufferAttribute(sailIndices, 1));
sailGeometry.computeVertexNormals();

const sailMaterial = new THREE.MeshStandardMaterial({ 
  color: 0xFFFFFF,
  side: THREE.DoubleSide,
  roughness: 0.9
});
const sail = new THREE.Mesh(sailGeometry, sailMaterial);
sail.position.set(0.05, 0, -0.2);
sail.castShadow = true;
boatGroup.add(sail);

boatGroup.position.y = 0.27;
scene.add(boatGroup);

// --- COLLISION SYSTEM ---
class WaveCollisionBox {
  constructor(ripple, breakingWave) {
    this.ripple = ripple;
    this.breakingWave = breakingWave;
    this.active = false;
    
    // Create collision box mesh (only visible in debug mode)
    const geometry = new THREE.BoxGeometry(1, 3, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.3,
      wireframe: true
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.visible = DEBUG_MODE;
    
    if (DEBUG_MODE) {
      scene.add(this.mesh);
    }
  }
  
  update(time) {
    if (!this.ripple || !this.breakingWave) return;
    
    // Only activate collision when wave is in steady or shrinking phase
    this.active = (this.breakingWave.phase === 'steady' || 
                   this.breakingWave.phase === 'shrinking') && 
                  this.breakingWave.length > 10;
    
    if (!this.active) {
      this.mesh.visible = false;
      return;
    }
    
    // Calculate wave position
    const age = time - this.ripple.spawnTime;
    const rippleFrontPos = age * RIPPLE_SPEED + RIPPLE_LENGTH / 2;
    
    // Position collision box at wave center
    const center = this.ripple.start.clone().add(
      new THREE.Vector3(
        this.ripple.dir.x * rippleFrontPos,
        1.5, // Height of collision box
        this.ripple.dir.y * rippleFrontPos
      )
    );
    
    this.mesh.position.copy(center);
    
    // Align box with wave direction (perpendicular to wave movement)
    const angle = Math.atan2(this.ripple.dir.x, this.ripple.dir.y);
    this.mesh.rotation.y = -angle;
    
    // Scale box to match wave length and height
    const length = this.breakingWave.length;
    const height = 3; // Height of collision box
    const thickness = BREAKING_WAVE_HEIGHT * 0.3; // Depth of collision box
    
    this.mesh.scale.set(length, height, thickness);
    
    if (DEBUG_MODE) {
      this.mesh.visible = true;
    }
  }
  
  checkCollision(position, radius = 1) {
    if (!this.active) return false;
    
    // Get wave collision box bounds in world space
    const boxPos = this.mesh.position;
    const boxScale = this.mesh.scale;
    const boxRotation = this.mesh.rotation.y;
    
    // Transform boat position to wave's local space
    const dx = position.x - boxPos.x;
    const dz = position.z - boxPos.z;
    
    // Rotate to align with box
    const cos = Math.cos(-boxRotation);
    const sin = Math.sin(-boxRotation);
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;
    
    // Check if within box bounds (accounting for boat radius)
    const halfLength = boxScale.x / 2;
    const halfThickness = boxScale.z / 2;
    
    return Math.abs(localX) < halfLength + radius &&
           Math.abs(localZ) < halfThickness + radius &&
           Math.abs(position.y - boxPos.y) < boxScale.y / 2 + radius;
  }
  
  getImpactForce(position) {
    if (!this.active) return new THREE.Vector3(0, 0, 0);
    
    // Calculate force based on wave direction and strength
    const force = new THREE.Vector3(
      this.ripple.dir.x * 0.02,
      0.01, // Upward force
      this.ripple.dir.y * 0.02
    );
    
    // Scale force based on wave phase
    if (this.breakingWave.phase === 'shrinking') {
      force.multiplyScalar(0.5);
    }
    
    return force;
  }
  
  destroy() {
    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
  }
}

// --- BOAT PHYSICS ---
const boatPhysics = {
  velocity: new THREE.Vector2(0, 0),
  angularVelocity: 0,
  bobOffset: 0,
  rollAngle: 0,
  pitchAngle: 0,
  wakeParticles: [],
  isHitByWave: false,
  waveImpactCooldown: 0
};

// --- WAKE PARTICLES ---
class WakeParticle {
  constructor(x, z) {
    this.position = new THREE.Vector3(x, 0.1, z);
    this.lifetime = 3000; // ms
    this.age = 0;
    this.size = 0.5;
    
    const geometry = new THREE.SphereGeometry(this.size, 6, 6);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }
  
  update(dt) {
    this.age += dt;
    const ageRatio = this.age / this.lifetime;
    
    // Fade out and grow
    this.mesh.material.opacity = 0.6 * (1 - ageRatio);
    const scale = 1 + ageRatio * 2;
    this.mesh.scale.set(scale, scale * 0.3, scale);
    
    // Spread out slowly
    this.mesh.position.y = 0.1 - ageRatio * 0.05;
    
    return this.age < this.lifetime;
  }
  
  destroy() {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

// --- RIPPLE/WAVEFRONT SYSTEM ---
const waveOverlay = document.getElementById('wave-overlay');
function resizeWaveOverlay() {
  waveOverlay.width = window.innerWidth;
  waveOverlay.height = window.innerHeight;
}
resizeWaveOverlay();
window.addEventListener('resize', () => {
  resizeWaveOverlay();
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Utility: project 3D world coords to 2D screen
function worldToScreen(pos) {
  const vector = pos.clone().project(camera);
  return {
    x: (vector.x + 1) / 2 * waveOverlay.width,
    y: (-vector.y + 1) / 2 * waveOverlay.height,
  };
}

// --- RIPPLE WAVEFRONT OBJECTS ---
const RIPPLE_SPEED = 0.037;
const RIPPLE_LENGTH = 260;
const RIPPLE_DURATION = 40000;
const RIPPLE_HEIGHT = 2.0;
const RIPPLE_WIDTH = 16;
const RIPPLE_SET_MIN = 3;
const RIPPLE_SET_MAX = 6;
const RIPPLE_SET_SPACING = 28;

let ripples = [];
let waveCollisionBoxes = [];

// --- BREAKING WAVE OBJECTS ---
const BREAKING_WAVE_MIN_DURATION = 32000;
const BREAKING_WAVE_MAX_DURATION = 42000;
const BREAKING_WAVE_GROW_TIME = 0.22;
const BREAKING_WAVE_SHRINK_TIME = 0.22;
const BREAKING_WAVE_MAX_LENGTH = WATER_SIZE * 0.93;
const BREAKING_WAVE_HEIGHT = 12;
const BREAKING_WAVE_BARREL_WIDTH = 18;

let breakingWaves = [];

// --- SPAWN RIPPLE SET ---
function spawnRippleSet() {
  let angle = Math.random() * Math.PI * 2;
  let dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle)).normalize();
  let setCount = Math.floor(Math.random() * (RIPPLE_SET_MAX - RIPPLE_SET_MIN + 1)) + RIPPLE_SET_MIN;

  let baseStart = new THREE.Vector3(
    -dir.x * WATER_SIZE * 0.45,
    0,
    -dir.y * WATER_SIZE * 0.45
  );
  
  for (let i = 0; i < setCount; i++) {
    let offset = (i - (setCount - 1) / 2) * RIPPLE_SET_SPACING;
    let start = baseStart.clone().add(
      new THREE.Vector3(-dir.y * offset, 0, dir.x * offset)
    );
    
    const rippleIndex = ripples.length;
    ripples.push({
      start: start.clone(),
      dir: dir.clone(),
      progress: 0,
      spawnTime: performance.now(),
      duration: RIPPLE_DURATION,
      breakingWaveId: null,
    });

    let bwDuration = Math.random() * (BREAKING_WAVE_MAX_DURATION - BREAKING_WAVE_MIN_DURATION) + BREAKING_WAVE_MIN_DURATION;
    const breakingWaveIndex = breakingWaves.length;
    breakingWaves.push({
      rippleIdx: rippleIndex,
      spawnTime: performance.now(),
      duration: bwDuration,
      phase: 'growing',
      length: 0,
      maxLength: BREAKING_WAVE_MAX_LENGTH,
      barrelPos: 0,
      barrelSpeed: 0.55 + Math.random() * 0.25,
    });
    ripples[rippleIndex].breakingWaveId = breakingWaveIndex;
    
    // Create collision box for this wave
    const collisionBox = new WaveCollisionBox(ripples[rippleIndex], breakingWaves[breakingWaveIndex]);
    waveCollisionBoxes.push(collisionBox);
  }
}

// --- WATER MESH ANIMATION ---
function animateWater(time) {
  const verts = water.geometry.attributes.position;
  for (let i = 0; i < verts.count; i++) {
    const x = verts.getX(i);
    const z = verts.getY(i);
    
    // Base wave animation
    let baseHeight = Math.sin(x * 0.05 + time * 0.001) * 0.3 + 
                    Math.sin(z * 0.05 + time * 0.0015) * 0.2;
    
    // Ripple waves
    let rippleHeight = 0;
    for (let ripple of ripples) {
      let age = time - ripple.spawnTime;
      if (age > ripple.duration) continue;
      let frontPos = age * RIPPLE_SPEED + RIPPLE_LENGTH / 2;
      
      let dx = x - ripple.start.x;
      let dz = z - ripple.start.z;
      let along = dx * ripple.dir.x + dz * ripple.dir.y;
      let distToFront = along - frontPos;
      
      if (Math.abs(distToFront) < RIPPLE_WIDTH) {
        rippleHeight += Math.sin((distToFront / RIPPLE_WIDTH) * Math.PI) * RIPPLE_HEIGHT;
      }
    }
    
    verts.setZ(i, baseHeight + rippleHeight);
  }
  verts.needsUpdate = true;
  water.geometry.computeVertexNormals();
}

// --- BREAKING WAVE ANIMATION ---
function updateBreakingWaves(dt) {
  let now = performance.now();
  for (let bw of breakingWaves) {
    let elapsed = now - bw.spawnTime;
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
    
    let barrelProgress = Math.min(1, elapsed / bw.duration) * bw.barrelSpeed + 0.1;
    bw.barrelPos = Math.min(1, barrelProgress);
  }
  breakingWaves = breakingWaves.filter((bw) => bw.phase !== 'done');
}

// --- RIPPLE UPDATE ---
function updateRipples(dt, time) {
  let now = performance.now();
  
  // Clean up expired ripples and their collision boxes
  const activeRipples = [];
  const activeCollisionBoxes = [];
  
  for (let i = 0; i < ripples.length; i++) {
    if (now - ripples[i].spawnTime < ripples[i].duration) {
      activeRipples.push(ripples[i]);
      if (waveCollisionBoxes[i]) {
        activeCollisionBoxes.push(waveCollisionBoxes[i]);
      }
    } else {
      // Clean up collision box
      if (waveCollisionBoxes[i]) {
        waveCollisionBoxes[i].destroy();
      }
    }
  }
  
  ripples = activeRipples;
  waveCollisionBoxes = activeCollisionBoxes;
  
  // Update collision boxes
  for (let box of waveCollisionBoxes) {
    box.update(time);
  }
}

// --- DRAW BREAKING WAVES ---
function drawBreakingWaves() {
  const ctx = waveOverlay.getContext('2d');
  ctx.clearRect(0, 0, waveOverlay.width, waveOverlay.height);

  for (let i = 0; i < breakingWaves.length; i++) {
    const bw = breakingWaves[i];
    if (bw.phase === 'done') continue;
    if (!ripples[bw.rippleIdx]) continue;
    
    const ripple = ripples[bw.rippleIdx];
    let now = performance.now();
    let age = now - ripple.spawnTime;
    let rippleFrontPos = age * RIPPLE_SPEED + RIPPLE_LENGTH / 2;
    
    let center = ripple.start.clone().add(
      new THREE.Vector3(
        ripple.dir.x * rippleFrontPos,
        0,
        ripple.dir.y * rippleFrontPos
      )
    );

    let length = bw.length;
    let thickness = BREAKING_WAVE_HEIGHT;
    let angle = Math.atan2(ripple.dir.x, ripple.dir.y);

    let center2d = worldToScreen(center);
    ctx.save();
    ctx.translate(center2d.x, center2d.y);
    ctx.rotate(-angle);

    // Gradient for foam
    const gradient = ctx.createLinearGradient(0, -thickness/2, 0, thickness/2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.5, 'rgba(234, 247, 255, 0.85)');
    gradient.addColorStop(1, 'rgba(200, 230, 255, 0.7)');
    
    ctx.globalAlpha = 0.81;
    ctx.fillStyle = gradient;
    ctx.fillRect(-length / 2, -thickness / 2, length, thickness);

    // Barrel highlight with gradient
    let barrelX = -length / 2 + bw.barrelPos * length;
    const barrelGradient = ctx.createLinearGradient(
      barrelX - BREAKING_WAVE_BARREL_WIDTH / 2, 0,
      barrelX + BREAKING_WAVE_BARREL_WIDTH / 2, 0
    );
    barrelGradient.addColorStop(0, 'rgba(180, 225, 255, 0.4)');
    barrelGradient.addColorStop(0.5, 'rgba(180, 225, 255, 1)');
    barrelGradient.addColorStop(1, 'rgba(180, 225, 255, 0.4)');
    
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = barrelGradient;
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
  if (now - lastRippleSpawn > 12000) {
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

function updateBoatMovement(dt) {
  const speed = 0.012;
  const turnSpeed = 0.009;
  const maxSpeed = 0.5;
  
  // Reduce wave impact cooldown
  if (boatPhysics.waveImpactCooldown > 0) {
    boatPhysics.waveImpactCooldown -= dt;
  }
  
  // Check for wave collisions
  boatPhysics.isHitByWave = false;
  for (let box of waveCollisionBoxes) {
    if (box.checkCollision(boatGroup.position, 1)) {
      if (boatPhysics.waveImpactCooldown <= 0) {
        // Apply wave impact
        const impactForce = box.getImpactForce(boatGroup.position);
        boatPhysics.velocity.x += impactForce.x;
        boatPhysics.velocity.y += impactForce.z;
        
        // Add rotation from impact
        boatPhysics.angularVelocity += (Math.random() - 0.5) * 0.05;
        
        // Visual feedback
        boatPhysics.isHitByWave = true;
        boatPhysics.waveImpactCooldown = 500; // Half second cooldown
        
        // Extra bobbing from impact
        boatPhysics.bobOffset += impactForce.y * 10;
      }
    }
  }
  
  // Turning
  if (controls.left) {
    boatPhysics.angularVelocity += turnSpeed;
  }
  if (controls.right) {
    boatPhysics.angularVelocity -= turnSpeed;
  }
  
  // Apply angular velocity and damping
  boatGroup.rotation.y += boatPhysics.angularVelocity;
  boatPhysics.angularVelocity *= 0.92;
  
  // Forward/backward thrust
  let thrust = 0;
  if (controls.forward) thrust += speed;
  if (controls.backward) thrust -= speed * 0.7;
  
  // Calculate boat direction
  const dir = new THREE.Vector2(-Math.sin(boatGroup.rotation.y), -Math.cos(boatGroup.rotation.y));
  boatPhysics.velocity.addScaledVector(dir, thrust);
  
  // Speed limit
  if (boatPhysics.velocity.length() > maxSpeed) {
    boatPhysics.velocity.normalize().multiplyScalar(maxSpeed);
  }
  
  // Water resistance (increased when hit by wave)
  const resistance = boatPhysics.isHitByWave ? 0.88 : 0.94;
  boatPhysics.velocity.multiplyScalar(resistance);
  
  // Update position
  boatGroup.position.x += boatPhysics.velocity.x;
  boatGroup.position.z += boatPhysics.velocity.y;
  
  // Boat bobbing and tilting
  const bobSpeed = 0.002;
  const bobAmount = boatPhysics.isHitByWave ? 0.3 : 0.15;
  const time = performance.now();
  const targetBobOffset = Math.sin(time * bobSpeed) * bobAmount + Math.cos(time * bobSpeed * 0.7) * bobAmount * 0.5;
  boatPhysics.bobOffset = boatPhysics.bobOffset * 0.9 + targetBobOffset * 0.1;
  boatGroup.position.y = 0.27 + boatPhysics.bobOffset;
  
  // Tilt based on movement
  const speedFactor = boatPhysics.velocity.length() / maxSpeed;
  boatPhysics.pitchAngle = thrust * speedFactor * 15 * (Math.PI / 180);
  boatPhysics.rollAngle = boatPhysics.angularVelocity * speedFactor * 10;
  
  // Extra tilt when hit by wave
  if (boatPhysics.isHitByWave) {
    boatPhysics.pitchAngle += Math.sin(time * 0.01) * 0.1;
    boatPhysics.rollAngle += Math.cos(time * 0.01) * 0.1;
  }
  
  boatGroup.rotation.x = boatPhysics.pitchAngle;
  boatGroup.rotation.z = boatPhysics.rollAngle;
  
  // Sail animation
  if (sail) {
    sail.rotation.y = Math.sin(time * 0.001) * 0.1 - boatPhysics.velocity.length() * 0.3;
  }
  
  // Create wake particles
  if (boatPhysics.velocity.length() > 0.01 && Math.random() < speedFactor) {
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      0,
      1
    ).applyEuler(boatGroup.rotation);
    
    boatPhysics.wakeParticles.push(
      new WakeParticle(
        boatGroup.position.x + offset.x,
        boatGroup.position.z + offset.z
      )
    );
  }
  
  // Update wake particles
  boatPhysics.wakeParticles = boatPhysics.wakeParticles.filter(particle => {
    const alive = particle.update(dt);
    if (!alive) {
      particle.destroy();
    }
    return alive;
  });
}

// --- HUD UPDATE ---
function updateHUD() {
  if (window.updateHUD) {
    const speed = boatPhysics.velocity.length() * 100; // Convert to display units
    const angle = boatGroup.rotation.y % (Math.PI * 2);
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const dirIndex = Math.round((angle + Math.PI * 2) / (Math.PI / 4)) % 8;
    const direction = directions[dirIndex];
    const waveCount = ripples.length;
    
    window.updateHUD(speed, direction, waveCount);
  }
  
  if (window.updateCompass) {
    window.updateCompass(boatGroup.rotation.y);
  }
}

// --- BUTTON CONTROLS ---
const btnLeft = document.getElementById('left');
const btnRight = document.getElementById('right');
const btnForward = document.getElementById('forward');
const btnBackward = document.getElementById('backward');

function setupButton(button, dir) {
  button.addEventListener('touchstart', e => { 
    e.preventDefault(); 
    controls[dir] = true; 
  });
  button.addEventListener('touchend', e => { 
    e.preventDefault(); 
    controls[dir] = false; 
  });
  button.addEventListener('mousedown', () => (controls[dir] = true));
  button.addEventListener('mouseup', () => (controls[dir] = false));
  button.addEventListener('mouseleave', () => (controls[dir] = false));
}

setupButton(btnLeft, 'left');
setupButton(btnRight, 'right');
setupButton(btnForward, 'forward');
setupButton(btnBackward, 'backward');

// Keyboard controls
window.addEventListener('keydown', (e) => {
  switch(e.key) {
    case 'ArrowUp':
    case 'w':
      controls.forward = true;
      break;
    case 'ArrowDown':
    case 's':
      controls.backward = true;
      break;
    case 'ArrowLeft':
    case 'a':
      controls.left = true;
      break;
    case 'ArrowRight':
    case 'd':
      controls.right = true;
      break;
  }
});

window.addEventListener('keyup', (e) => {
  switch(e.key) {
    case 'ArrowUp':
    case 'w':
      controls.forward = false;
      break;
    case 'ArrowDown':
    case 's':
      controls.backward = false;
      break;
    case 'ArrowLeft':
    case 'a':
      controls.left = false;
      break;
    case 'ArrowRight':
    case 'd':
      controls.right = false;
      break;
  }
});

// --- CAMERA FOLLOWS BOAT ---
function updateCamera() {
  const cameraDistance = 10 + boatPhysics.velocity.length() * 5;
  const cameraHeight = 5 + boatPhysics.velocity.length() * 2;
  const offset = new THREE.Vector3(0, cameraHeight, cameraDistance).applyEuler(boatGroup.rotation);
  const desired = boatGroup.position.clone().add(offset);
  camera.position.lerp(desired, 0.07);
  
  // Look slightly ahead of the boat
  const lookAhead = boatGroup.position.clone().add(
    new THREE.Vector3(
      boatPhysics.velocity.x * 5,
      0,
      boatPhysics.velocity.y * 5
    )
  );
  camera.lookAt(lookAhead);
}

// --- MAIN ANIMATION LOOP ---
let lastTime = performance.now();
function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  const dt = now - lastTime;
  lastTime = now;

  animateWater(now);
  updateSpawner(dt);
  updateRipples(dt, now);
  updateBreakingWaves(dt);
  drawBreakingWaves();

  updateBoatMovement(dt);
  updateCamera();
  updateHUD();

  renderer.render(scene, camera);
}

// Start animation
animate();

// Initial spawn
spawnRippleSet();
