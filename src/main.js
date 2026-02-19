import * as CANNON from "../vendor/cannon-es.js";
import * as THREE from "../vendor/three.module.js";

const canvas = document.querySelector("#scene");
const rollButton = document.querySelector("#roll-btn");
const colorButton = document.querySelector("#color-btn");
const resultLabel = document.querySelector("#result");
const speedSlider = document.querySelector("#speed-slider");
const speedValue = document.querySelector("#speed-value");
const rollSound = new Audio(new URL("../roll.wav", import.meta.url).href);
rollSound.preload = "auto";
rollSound.volume = 0.75;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1220);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(4.7, 4.5, 5.4);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const hemisphereLight = new THREE.HemisphereLight(0xcbd5e1, 0x020617, 1.2);
scene.add(hemisphereLight);

const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.55);
dirLight.position.set(5.5, 8, 4);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 20;
dirLight.shadow.camera.left = -6;
dirLight.shadow.camera.right = 6;
dirLight.shadow.camera.top = 6;
dirLight.shadow.camera.bottom = -6;
scene.add(dirLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(12, 12),
  new THREE.MeshStandardMaterial({
    color: 0x141d33,
    roughness: 0.88,
    metalness: 0.03
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.5;
floor.receiveShadow = true;
scene.add(floor);

const arenaHalfSize = 6.2;
const wallThickness = 0.3;
const wallHeight = 3.5;
const wallCenterY = floor.position.y + wallHeight / 2;

const boundaryMaterial = new THREE.MeshStandardMaterial({
  color: 0x334155,
  roughness: 0.7,
  metalness: 0.08,
  transparent: true,
  opacity: 0.24
});

const wallGeometryX = new THREE.BoxGeometry(wallThickness, wallHeight, arenaHalfSize * 2 + wallThickness * 2);
const wallGeometryZ = new THREE.BoxGeometry(arenaHalfSize * 2 + wallThickness * 2, wallHeight, wallThickness);
const boundaryWalls = [
  [arenaHalfSize + wallThickness / 2, wallCenterY, 0, wallGeometryX],
  [-arenaHalfSize - wallThickness / 2, wallCenterY, 0, wallGeometryX],
  [0, wallCenterY, arenaHalfSize + wallThickness / 2, wallGeometryZ],
  [0, wallCenterY, -arenaHalfSize - wallThickness / 2, wallGeometryZ]
];

for (const [x, y, z, geometry] of boundaryWalls) {
  const wallMesh = new THREE.Mesh(geometry, boundaryMaterial);
  wallMesh.position.set(x, y, z);
  wallMesh.receiveShadow = true;
  scene.add(wallMesh);
}

const createPastelPalette = () => {
  const baseHue = Math.random() * 360;
  return Array.from({ length: 6 }, (_, index) => {
    const hue = (baseHue + index * 60 + (Math.random() - 0.5) * 18 + 360) % 360;
    const saturation = 56 + Math.random() * 14;
    const lightness = 78 + Math.random() * 10;
    return `hsl(${hue.toFixed(0)} ${saturation.toFixed(0)}% ${lightness.toFixed(0)}%)`;
  });
};

const createFaceTexture = (value, backgroundColor) => {
  const size = 512;
  const tCanvas = document.createElement("canvas");
  tCanvas.width = size;
  tCanvas.height = size;
  const ctx = tCanvas.getContext("2d");

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(15, 23, 42, 0.18)";
  ctx.lineWidth = 24;
  ctx.strokeRect(14, 14, size - 28, size - 28);

  ctx.fillStyle = "#111827";
  ctx.font = "700 290px 'Avenir Next', 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), size / 2, size / 2 + 6);

  const texture = new THREE.CanvasTexture(tCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
};

const faceValues = [3, 4, 1, 6, 2, 5];
const faceColors = createPastelPalette();
const diceMaterials = faceValues.map(
  (value, index) =>
    new THREE.MeshStandardMaterial({
      map: createFaceTexture(value, faceColors[index]),
      roughness: 0.36,
      metalness: 0.08
    })
);

const diceMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), diceMaterials);
diceMesh.castShadow = true;
diceMesh.receiveShadow = true;
scene.add(diceMesh);

const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0)
});
world.allowSleep = true;
world.solver.iterations = 12;
world.defaultContactMaterial.friction = 0.38;
world.defaultContactMaterial.restitution = 0.34;

const floorMaterial = new CANNON.Material("floor");
const dieMaterial = new CANNON.Material("die");

const floorBody = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Plane(),
  material: floorMaterial
});
floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
floorBody.position.set(0, -1.5, 0);
world.addBody(floorBody);

world.addContactMaterial(
  new CANNON.ContactMaterial(floorMaterial, dieMaterial, {
    friction: 0.42,
    restitution: 0.33
  })
);

const addWallBody = (x, y, z, halfX, halfY, halfZ) => {
  const wallBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(halfX, halfY, halfZ)),
    material: floorMaterial
  });
  wallBody.position.set(x, y, z);
  world.addBody(wallBody);
};

addWallBody(
  arenaHalfSize + wallThickness / 2,
  wallCenterY,
  0,
  wallThickness / 2,
  wallHeight / 2,
  arenaHalfSize + wallThickness
);
addWallBody(
  -arenaHalfSize - wallThickness / 2,
  wallCenterY,
  0,
  wallThickness / 2,
  wallHeight / 2,
  arenaHalfSize + wallThickness
);
addWallBody(
  0,
  wallCenterY,
  arenaHalfSize + wallThickness / 2,
  arenaHalfSize + wallThickness,
  wallHeight / 2,
  wallThickness / 2
);
addWallBody(
  0,
  wallCenterY,
  -arenaHalfSize - wallThickness / 2,
  arenaHalfSize + wallThickness,
  wallHeight / 2,
  wallThickness / 2
);

const diceBody = new CANNON.Body({
  mass: 1,
  shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
  position: new CANNON.Vec3(0, 2.2, 0),
  material: dieMaterial,
  linearDamping: 0.23,
  angularDamping: 0.22,
  allowSleep: true,
  sleepTimeLimit: 0.35,
  sleepSpeedLimit: 0.12
});
world.addBody(diceBody);

const faceNormals = [
  { value: 1, normal: new CANNON.Vec3(0, 1, 0) },
  { value: 6, normal: new CANNON.Vec3(0, -1, 0) },
  { value: 2, normal: new CANNON.Vec3(0, 0, 1) },
  { value: 5, normal: new CANNON.Vec3(0, 0, -1) },
  { value: 3, normal: new CANNON.Vec3(1, 0, 0) },
  { value: 4, normal: new CANNON.Vec3(-1, 0, 0) }
];

const getTopFaceValue = () => {
  let top = 1;
  let maxY = -Infinity;
  for (const face of faceNormals) {
    const worldNormal = diceBody.quaternion.vmult(face.normal);
    if (worldNormal.y > maxY) {
      maxY = worldNormal.y;
      top = face.value;
    }
  }
  return top;
};

const randomizeDiceFaceColors = () => {
  const nextColors = createPastelPalette();
  for (let i = 0; i < diceMaterials.length; i += 1) {
    const nextTexture = createFaceTexture(faceValues[i], nextColors[i]);
    const previousTexture = diceMaterials[i].map;
    diceMaterials[i].map = nextTexture;
    diceMaterials[i].needsUpdate = true;
    if (previousTexture) {
      previousTexture.dispose();
    }
  }
};

const resetDice = () => {
  const x = (Math.random() - 0.5) * 1.2;
  const z = (Math.random() - 0.5) * 1.2;

  diceBody.position.set(x, 2.2 + Math.random() * 0.8, z);
  diceBody.velocity.set(0, 0, 0);
  diceBody.angularVelocity.set(0, 0, 0);
  diceBody.quaternion.setFromEuler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  diceBody.wakeUp();
};

let isRolling = false;
let stableFrames = 0;
let simulationSpeed = 1;

const updateSimulationSpeed = (value) => {
  const parsed = Number.parseFloat(value);
  simulationSpeed = Number.isFinite(parsed) ? THREE.MathUtils.clamp(parsed, 0.25, 2.5) : 1;
  speedSlider.value = simulationSpeed.toFixed(2);
  speedValue.textContent = `${simulationSpeed.toFixed(2)}x`;
};

const rollDice = () => {
  if (isRolling) {
    return;
  }

  rollSound.currentTime = 0;
  rollSound.play().catch(() => {
    // Ignore blocked autoplay errors; button click usually allows playback.
  });

  isRolling = true;
  stableFrames = 0;
  resultLabel.textContent = "Rolling...";
  rollButton.disabled = true;

  resetDice();

  const lateral = new CANNON.Vec3(Math.random() - 0.5, 0, Math.random() - 0.5);
  if (lateral.lengthSquared() < 0.001) {
    lateral.set(1, 0, 0);
  }
  lateral.normalize();

  const impulse = new CANNON.Vec3(
    lateral.x * (3.8 + Math.random() * 1.6),
    6.2 + Math.random() * 1.2,
    lateral.z * (3.8 + Math.random() * 1.6)
  );

  diceBody.applyImpulse(impulse, diceBody.position);
  diceBody.angularVelocity.set(
    (Math.random() - 0.5) * 20,
    (Math.random() - 0.5) * 20,
    (Math.random() - 0.5) * 20
  );
};

const finishRollIfStable = () => {
  if (!isRolling) {
    return;
  }

  const motion = diceBody.velocity.length() + diceBody.angularVelocity.length();
  if (motion < 0.13) {
    stableFrames += 1;
  } else {
    stableFrames = 0;
  }

  if (stableFrames < 18) {
    return;
  }

  isRolling = false;
  const value = getTopFaceValue();
  resultLabel.textContent = `You rolled ${value}`;
  rollButton.disabled = false;
};

const clock = new THREE.Clock();
const cameraOffset = new THREE.Vector3(4.7, 4.5, 5.4);
const cameraTarget = new THREE.Vector3(0, 0, 0);
const desiredTarget = new THREE.Vector3(0, 0, 0);
const desiredCameraPosition = new THREE.Vector3(0, 0, 0);

const animate = () => {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta() * simulationSpeed, 0.12);
  world.step(1 / 60, dt, 5);

  diceMesh.position.copy(diceBody.position);
  diceMesh.quaternion.copy(diceBody.quaternion);

  desiredTarget.set(diceMesh.position.x, Math.max(-0.2, diceMesh.position.y * 0.2), diceMesh.position.z);
  cameraTarget.lerp(desiredTarget, 0.1);
  desiredCameraPosition.copy(cameraTarget).add(cameraOffset);
  camera.position.lerp(desiredCameraPosition, 0.1);
  camera.lookAt(cameraTarget);

  finishRollIfStable();
  renderer.render(scene, camera);
};

const onResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

window.addEventListener("resize", onResize);
rollButton.addEventListener("click", rollDice);
colorButton.addEventListener("click", randomizeDiceFaceColors);
speedSlider.addEventListener("input", (event) => updateSimulationSpeed(event.target.value));
updateSimulationSpeed(speedSlider.value);

resetDice();
animate();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}
