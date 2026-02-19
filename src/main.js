import * as CANNON from "../vendor/cannon-es.js";
import * as THREE from "../vendor/three.module.js";

const canvas = document.querySelector("#scene");
const rollButton = document.querySelector("#roll-btn");
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

const randomPastelColor = () => ({
  h: Math.random() * 360,
  s: 56 + Math.random() * 14,
  l: 78 + Math.random() * 10
});

const hslToCss = (color) => `hsl(${color.h.toFixed(0)} ${color.s.toFixed(0)}% ${color.l.toFixed(0)}%)`;

const lerp = (a, b, t) => a + (b - a) * t;
const lerpHue = (a, b, t) => {
  const delta = ((((b - a) % 360) + 540) % 360) - 180;
  return (a + delta * t + 360) % 360;
};

const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

const createFaceTexture = (value, initialColor) => {
  const size = 512;
  const tCanvas = document.createElement("canvas");
  tCanvas.width = size;
  tCanvas.height = size;
  const ctx = tCanvas.getContext("2d");

  const texture = new THREE.CanvasTexture(tCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const drawFace = (color) => {
    ctx.fillStyle = hslToCss(color);
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = "rgba(15, 23, 42, 0.18)";
    ctx.lineWidth = 24;
    ctx.strokeRect(14, 14, size - 28, size - 28);

    ctx.fillStyle = "#111827";
    ctx.font = "700 290px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), size / 2, size / 2 + 6);
    texture.needsUpdate = true;
  };

  drawFace(initialColor);

  return {
    drawFace,
    texture
  };
};

const faceValues = [3, 4, 1, 6, 2, 5];
const faceTransitions = faceValues.map((value) => {
  const from = randomPastelColor();
  return {
    from,
    painter: createFaceTexture(value, from),
    progress: Math.random(),
    target: randomPastelColor(),
    transitionDuration: 1.5 + Math.random() * 2.2
  };
});

const diceMaterials = faceTransitions.map(
  (transition) =>
    new THREE.MeshStandardMaterial({
      map: transition.painter.texture,
      roughness: 0.36,
      metalness: 0.08
    })
);

let faceColorAccumulator = 0;
const faceColorStep = 1 / 30;

const updateDiceFaceColors = (deltaSeconds) => {
  faceColorAccumulator += deltaSeconds;

  while (faceColorAccumulator >= faceColorStep) {
    faceColorAccumulator -= faceColorStep;

    for (const transition of faceTransitions) {
      transition.progress += faceColorStep / transition.transitionDuration;

      if (transition.progress >= 1) {
        transition.from = transition.target;
        transition.target = randomPastelColor();
        transition.progress = 0;
        transition.transitionDuration = 1.5 + Math.random() * 2.2;
      }

      const eased = easeInOut(transition.progress);
      transition.painter.drawFace({
        h: lerpHue(transition.from.h, transition.target.h, eased),
        s: lerp(transition.from.s, transition.target.s, eased),
        l: lerp(transition.from.l, transition.target.l, eased)
      });
    }
  }
};

const diceMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), diceMaterials);
diceMesh.castShadow = true;
diceMesh.receiveShadow = true;
scene.add(diceMesh);

const shimmerUniforms = {
  uTime: { value: 0 }
};

const shimmerMaterial = new THREE.ShaderMaterial({
  uniforms: shimmerUniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;

    void main() {
      vUv = uv;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;

    float hash(vec3 p) {
      p = fract(p * 0.1031);
      p += dot(p, p.yzx + 33.33);
      return fract((p.x + p.y) * p.z);
    }

    vec3 hsv2rgb(vec3 c) {
      vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      rgb = rgb * rgb * (3.0 - 2.0 * rgb);
      return c.z * mix(vec3(1.0), rgb, c.y);
    }

    void main() {
      vec3 normal = normalize(vWorldNormal);
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.2);

      float ripple = sin((vUv.x - vUv.y) * 20.0 + uTime * 5.5) * 0.5 + 0.5;
      float hue = fract(vUv.x * 0.85 + vUv.y * 0.55 + uTime * 0.08 + ripple * 0.25);
      vec3 rainbow = hsv2rgb(vec3(hue, 0.88, 1.0));

      float sparkleSeed = hash(vec3(floor(vUv * 85.0), floor(uTime * 16.0)));
      float sparkle = smoothstep(0.985, 1.0, sparkleSeed);
      sparkle *= 0.6 + 0.4 * sin(uTime * 34.0 + vUv.x * 130.0 + vUv.y * 90.0);

      float shimmer = 0.5 + 0.5 * sin(uTime * 3.1 + (vUv.x + vUv.y) * 12.0);
      vec3 color = rainbow * (0.25 + fresnel * 0.9) * (0.65 + shimmer * 0.35);
      color += vec3(1.0, 0.98, 0.9) * sparkle * (0.45 + fresnel);

      float alpha = clamp(fresnel * 0.78 + sparkle * 0.7, 0.0, 0.92);
      gl_FragColor = vec4(color, alpha * 0.72);
    }
  `
});

const shimmerMesh = new THREE.Mesh(new THREE.BoxGeometry(1.04, 1.04, 1.04), shimmerMaterial);
shimmerMesh.renderOrder = 2;
scene.add(shimmerMesh);

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

  const realDelta = Math.min(clock.getDelta(), 0.05);
  const physicsDelta = Math.min(realDelta * simulationSpeed, 0.12);
  world.step(1 / 60, physicsDelta, 5);

  diceMesh.position.copy(diceBody.position);
  diceMesh.quaternion.copy(diceBody.quaternion);
  shimmerMesh.position.copy(diceBody.position);
  shimmerMesh.quaternion.copy(diceBody.quaternion);
  shimmerUniforms.uTime.value += realDelta;
  updateDiceFaceColors(realDelta);

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
