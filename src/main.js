import * as CANNON from "../vendor/cannon-es.js";
import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "../vendor/examples/jsm/utils/SkeletonUtils.js";

const canvas = document.querySelector("#scene");
const resultLabel = document.querySelector("#result");
const speedSlider = document.querySelector("#speed-slider");
const speedValue = document.querySelector("#speed-value");
const rollSound = new Audio(new URL("../roll.wav", import.meta.url).href);
const tromboneSound = new Audio(new URL("../trombone.wav", import.meta.url).href);
rollSound.preload = "auto";
rollSound.volume = 0.75;
tromboneSound.preload = "auto";
tromboneSound.volume = 0.82;

const critterConfig = {
  modelUrl: new URL("../blackrat/blackrat.glb", import.meta.url).href,
  count: 3,
  walkClipIndex: 0,
  interactionMode: "visual",
  wanderRadius: 18,
  turnRateMin: 1.8,
  turnRateMax: 3.5,
  moveSpeedMin: 0.85,
  moveSpeedMax: 1.6,
  pauseMin: 0.12,
  pauseMax: 0.9,
  reachDistance: 0.7,
  targetLongestSide: 14.5
};

const critterRuntime = {
  isReady: false,
  baseY: -1.48,
  entities: [],
  walkClip: null,
  scratchMove: new THREE.Vector3()
};

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
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.28;

const createStudioEnvironment = () => {
  const width = 1024;
  const height = 512;
  const envCanvas = document.createElement("canvas");
  envCanvas.width = width;
  envCanvas.height = height;
  const ctx = envCanvas.getContext("2d");

  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, "#ffe9b8");
  base.addColorStop(0.28, "#c9d7ff");
  base.addColorStop(0.58, "#33486f");
  base.addColorStop(1, "#050914");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const topWarm = ctx.createRadialGradient(width * 0.34, height * 0.2, 1, width * 0.34, height * 0.2, width * 0.45);
  topWarm.addColorStop(0, "rgba(255, 232, 170, 0.95)");
  topWarm.addColorStop(0.4, "rgba(255, 211, 120, 0.35)");
  topWarm.addColorStop(1, "rgba(255, 190, 110, 0)");
  ctx.fillStyle = topWarm;
  ctx.fillRect(0, 0, width, height);

  const coolRim = ctx.createRadialGradient(width * 0.76, height * 0.3, 1, width * 0.76, height * 0.3, width * 0.38);
  coolRim.addColorStop(0, "rgba(174, 214, 255, 0.65)");
  coolRim.addColorStop(1, "rgba(100, 150, 255, 0)");
  ctx.fillStyle = coolRim;
  ctx.fillRect(0, 0, width, height);

  const horizon = ctx.createLinearGradient(0, height * 0.55, 0, height * 0.74);
  horizon.addColorStop(0, "rgba(255, 226, 170, 0)");
  horizon.addColorStop(1, "rgba(255, 215, 140, 0.33)");
  ctx.fillStyle = horizon;
  ctx.fillRect(0, 0, width, height);

  const envTexture = new THREE.CanvasTexture(envCanvas);
  envTexture.colorSpace = THREE.SRGBColorSpace;
  envTexture.mapping = THREE.EquirectangularReflectionMapping;
  return envTexture;
};

const studioEnvMap = createStudioEnvironment();
scene.environment = studioEnvMap;
scene.background = new THREE.Color(0x0b1220);

const hemisphereLight = new THREE.HemisphereLight(0xe8efff, 0x0b1323, 0.55);
scene.add(hemisphereLight);

const dirLight = new THREE.DirectionalLight(0xffefc6, 2.8);
dirLight.position.set(5.6, 8.4, 3.8);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 26;
dirLight.shadow.camera.left = -9;
dirLight.shadow.camera.right = 9;
dirLight.shadow.camera.top = 9;
dirLight.shadow.camera.bottom = -9;
scene.add(dirLight);

const rimLight = new THREE.DirectionalLight(0x8fc3ff, 1.35);
rimLight.position.set(-6.4, 5.2, -4.6);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0xffc388, 1.15, 22, 2);
fillLight.position.set(-1.3, 2.4, 4.8);
scene.add(fillLight);

const createGlitterFloorMaterial = () => {
  const size = 1024;
  const floorCanvas = document.createElement("canvas");
  floorCanvas.width = size;
  floorCanvas.height = size;
  const ctx = floorCanvas.getContext("2d");

  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, "#45107a");
  base.addColorStop(0.4, "#6627a1");
  base.addColorStop(1, "#2a0c4f");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2900; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = 0.35 + Math.random() * 1.45;
    const hue = 260 + Math.random() * 55;
    const alpha = 0.16 + Math.random() * 0.42;
    ctx.beginPath();
    ctx.fillStyle = `hsla(${hue.toFixed(0)}, 95%, 74%, ${alpha.toFixed(2)})`;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 180; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const arm = 2.2 + Math.random() * 3.6;
    ctx.strokeStyle = `rgba(255, 245, 255, ${(0.22 + Math.random() * 0.44).toFixed(2)})`;
    ctx.lineWidth = 0.8 + Math.random() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x - arm, y);
    ctx.lineTo(x + arm, y);
    ctx.moveTo(x, y - arm);
    ctx.lineTo(x, y + arm);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(floorCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(18, 18);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.38,
    metalness: 0.48,
    emissive: 0x21053f,
    emissiveIntensity: 0.32
  });
};

const floorSize = 120;
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(floorSize, floorSize),
  createGlitterFloorMaterial()
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.5;
floor.receiveShadow = true;
scene.add(floor);

const critterGroup = new THREE.Group();
critterGroup.name = "critters";
scene.add(critterGroup);

const critterLoader = new GLTFLoader();

const randomInRange = (min, max) => min + Math.random() * (max - min);

const normalizeAngle = (angle) => {
  let wrapped = angle;
  while (wrapped > Math.PI) {
    wrapped -= Math.PI * 2;
  }
  while (wrapped < -Math.PI) {
    wrapped += Math.PI * 2;
  }
  return wrapped;
};

const getRandomWanderTarget = (target, minRadius = 0) => {
  const boundedMinRadius = THREE.MathUtils.clamp(minRadius, 0, critterConfig.wanderRadius);
  const radius = Math.sqrt(Math.random()) * (critterConfig.wanderRadius - boundedMinRadius) + boundedMinRadius;
  const angle = Math.random() * Math.PI * 2;
  target.set(Math.cos(angle) * radius, critterRuntime.baseY, Math.sin(angle) * radius);
  return target;
};

const clearCritters = () => {
  for (const entity of critterRuntime.entities) {
    critterGroup.remove(entity.root);
    if (entity.mixer) {
      entity.mixer.stopAllAction();
    }
  }
  critterRuntime.entities.length = 0;
};

const prepareCritterTemplate = (rawTemplate) => {
  rawTemplate.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    node.castShadow = true;
    node.receiveShadow = false;
  });

  rawTemplate.updateMatrixWorld(true);
  const startingBounds = new THREE.Box3().setFromObject(rawTemplate);
  const startingSize = startingBounds.getSize(new THREE.Vector3());
  const longestSide = Math.max(startingSize.x, startingSize.y, startingSize.z) || 1;
  const scale = critterConfig.targetLongestSide / longestSide;
  rawTemplate.scale.setScalar(scale);

  rawTemplate.updateMatrixWorld(true);
  const centeredBounds = new THREE.Box3().setFromObject(rawTemplate);
  const center = centeredBounds.getCenter(new THREE.Vector3());
  rawTemplate.position.x -= center.x;
  rawTemplate.position.z -= center.z;

  rawTemplate.updateMatrixWorld(true);
  const alignedBounds = new THREE.Box3().setFromObject(rawTemplate);
  rawTemplate.position.y += floor.position.y - alignedBounds.min.y + 0.01;
  rawTemplate.updateMatrixWorld(true);

  critterRuntime.baseY = rawTemplate.position.y;
  return rawTemplate;
};

const setNextCritterTarget = (entity, { minRadius = 0 } = {}) => {
  getRandomWanderTarget(entity.target, minRadius);
  entity.speed = randomInRange(critterConfig.moveSpeedMin, critterConfig.moveSpeedMax);
  entity.turnRate = randomInRange(critterConfig.turnRateMin, critterConfig.turnRateMax);
};

const spawnCritters = (template, walkClip) => {
  clearCritters();

  for (let i = 0; i < critterConfig.count; i += 1) {
    const root = cloneSkinned(template);
    root.position.set(0, critterRuntime.baseY, 0);
    root.rotation.y = Math.random() * Math.PI * 2;
    getRandomWanderTarget(root.position, 3.5);
    root.position.y = critterRuntime.baseY;

    const mixer = new THREE.AnimationMixer(root);
    if (walkClip) {
      const action = mixer.clipAction(walkClip);
      action.play();
      action.timeScale = randomInRange(0.9, 1.2);
    }

    const entity = {
      root,
      mixer,
      target: new THREE.Vector3(),
      speed: 0,
      turnRate: 0,
      pauseTime: randomInRange(0, 0.6)
    };
    setNextCritterTarget(entity, { minRadius: 2.2 });

    critterRuntime.entities.push(entity);
    critterGroup.add(root);
  }
};

const loadCritters = async () => {
  try {
    const gltf = await critterLoader.loadAsync(critterConfig.modelUrl);
    const template = prepareCritterTemplate(gltf.scene);
    critterRuntime.walkClip = gltf.animations[critterConfig.walkClipIndex] || gltf.animations[0] || null;
    spawnCritters(template, critterRuntime.walkClip);
    critterRuntime.isReady = true;
  } catch (error) {
    console.warn("Failed to load critter model:", error);
  }
};

const updateCrittersVisual = (deltaSeconds) => {
  const maxRadiusSq = (critterConfig.wanderRadius + 3) * (critterConfig.wanderRadius + 3);
  for (const entity of critterRuntime.entities) {
    entity.mixer.update(deltaSeconds);

    if (entity.pauseTime > 0) {
      entity.pauseTime -= deltaSeconds;
      continue;
    }

    if (entity.root.position.x * entity.root.position.x + entity.root.position.z * entity.root.position.z > maxRadiusSq) {
      entity.target.set(0, critterRuntime.baseY, 0);
    }

    const toTarget = critterRuntime.scratchMove;
    toTarget.set(entity.target.x - entity.root.position.x, 0, entity.target.z - entity.root.position.z);
    const distance = toTarget.length();

    if (distance < critterConfig.reachDistance) {
      entity.pauseTime = randomInRange(critterConfig.pauseMin, critterConfig.pauseMax);
      setNextCritterTarget(entity, { minRadius: 1.5 });
      continue;
    }

    const desiredYaw = Math.atan2(toTarget.x, toTarget.z);
    const yawDelta = normalizeAngle(desiredYaw - entity.root.rotation.y);
    const maxTurn = entity.turnRate * deltaSeconds;
    entity.root.rotation.y += THREE.MathUtils.clamp(yawDelta, -maxTurn, maxTurn);

    const turnSlowdown = 1 - Math.min(Math.abs(yawDelta) / Math.PI, 0.68);
    const step = Math.min(distance, Math.max(0.01, entity.speed * turnSlowdown * deltaSeconds));
    entity.root.position.x += Math.sin(entity.root.rotation.y) * step;
    entity.root.position.z += Math.cos(entity.root.rotation.y) * step;
    entity.root.position.y = critterRuntime.baseY;
  }
};

const updateCrittersPhysics = (_deltaSeconds) => {
  // Reserved for future CANNON-driven critter bodies.
};

const updateCritters = (deltaSeconds) => {
  if (!critterRuntime.isReady) {
    return;
  }

  if (critterConfig.interactionMode === "physics") {
    updateCrittersPhysics(deltaSeconds);
    return;
  }

  updateCrittersVisual(deltaSeconds);
};

const createGoldDiamondFaceTexture = (value) => {
  const size = 512;
  const tCanvas = document.createElement("canvas");
  tCanvas.width = size;
  tCanvas.height = size;
  const ctx = tCanvas.getContext("2d");

  const baseGradient = ctx.createLinearGradient(0, 0, size, size);
  baseGradient.addColorStop(0, "#5f3e00");
  baseGradient.addColorStop(0.23, "#a06b00");
  baseGradient.addColorStop(0.45, "#ffd56f");
  baseGradient.addColorStop(0.72, "#b57e05");
  baseGradient.addColorStop(1, "#4e3300");
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, size, size);

  const sheen = ctx.createRadialGradient(size * 0.32, size * 0.28, size * 0.08, size * 0.34, size * 0.3, size * 0.78);
  sheen.addColorStop(0, "rgba(255, 246, 196, 0.82)");
  sheen.addColorStop(0.3, "rgba(255, 224, 140, 0.35)");
  sheen.addColorStop(1, "rgba(255, 215, 128, 0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);

  const tile = size / 6.5;
  ctx.lineWidth = 2.2;
  for (let rowY = -tile; rowY < size + tile; rowY += tile * 0.82) {
    const rowOffset = ((Math.round(rowY / (tile * 0.82)) & 1) * tile) / 2;
    for (let x = -tile; x < size + tile; x += tile) {
      const cx = x + rowOffset;
      const cy = rowY;
      ctx.beginPath();
      ctx.moveTo(cx, cy - tile * 0.3);
      ctx.lineTo(cx + tile * 0.34, cy);
      ctx.lineTo(cx, cy + tile * 0.3);
      ctx.lineTo(cx - tile * 0.34, cy);
      ctx.closePath();
      ctx.fillStyle = "rgba(255, 245, 190, 0.16)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 248, 210, 0.24)";
      ctx.stroke();
    }
  }

  for (let i = 0; i < 22; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = 1 + Math.random() * 2.4;
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
    ctx.lineWidth = 1;
    ctx.moveTo(x - radius * 2.2, y);
    ctx.lineTo(x + radius * 2.2, y);
    ctx.moveTo(x, y - radius * 2.2);
    ctx.lineTo(x, y + radius * 2.2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 246, 200, 0.38)";
  ctx.lineWidth = 20;
  ctx.strokeRect(16, 16, size - 32, size - 32);

  ctx.fillStyle = "rgba(51, 30, 0, 0.9)";
  ctx.strokeStyle = "rgba(255, 239, 184, 0.72)";
  ctx.lineWidth = 8;
  ctx.font = "700 290px 'Avenir Next', 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText(String(value), size / 2, size / 2 + 7);
  ctx.fillText(String(value), size / 2, size / 2 + 7);

  const texture = new THREE.CanvasTexture(tCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
};

const faceValues = [3, 4, 1, 6, 2, 5];
const diceMaterials = faceValues.map(
  (value) =>
    new THREE.MeshPhysicalMaterial({
      map: createGoldDiamondFaceTexture(value),
      metalness: 1,
      roughness: 0.17,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      color: 0xffcf5a,
      envMapIntensity: 1.95
    })
);

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

const fireworksGroup = new THREE.Group();
scene.add(fireworksGroup);

const fireworksBursts = [];
const celebration = {
  active: false,
  elapsed: 0,
  nextBurstAt: 0,
  duration: 3.8
};
const baseDirLightIntensity = dirLight.intensity;

const createFireworkBurst = (origin, particleCount = 160) => {
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const color = new THREE.Color();

  for (let i = 0; i < particleCount; i += 1) {
    const i3 = i * 3;
    positions[i3] = origin.x;
    positions[i3 + 1] = origin.y;
    positions[i3 + 2] = origin.z;

    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const radial = Math.sqrt(1 - u * u);
    const speed = 2.6 + Math.random() * 4.4;

    velocities[i3] = radial * Math.cos(theta) * speed;
    velocities[i3 + 1] = (u * 0.7 + 0.7) * speed;
    velocities[i3 + 2] = radial * Math.sin(theta) * speed;

    color.setHSL(Math.random(), 0.9, 0.64 + Math.random() * 0.12);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.14,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(geometry, material);
  fireworksGroup.add(points);

  fireworksBursts.push({
    points,
    positionAttribute,
    velocities,
    age: 0,
    life: 1.5 + Math.random() * 0.9
  });
};

const clearFireworks = () => {
  for (const burst of fireworksBursts) {
    fireworksGroup.remove(burst.points);
    burst.points.geometry.dispose();
    burst.points.material.dispose();
  }
  fireworksBursts.length = 0;
};

const updateFireworks = (deltaSeconds) => {
  for (let b = fireworksBursts.length - 1; b >= 0; b -= 1) {
    const burst = fireworksBursts[b];
    burst.age += deltaSeconds;
    const t = burst.age / burst.life;

    if (t >= 1) {
      fireworksGroup.remove(burst.points);
      burst.points.geometry.dispose();
      burst.points.material.dispose();
      fireworksBursts.splice(b, 1);
      continue;
    }

    const positions = burst.positionAttribute.array;
    for (let i = 0; i < positions.length; i += 3) {
      burst.velocities[i] *= 0.985;
      burst.velocities[i + 1] *= 0.982;
      burst.velocities[i + 2] *= 0.985;
      burst.velocities[i + 1] -= 7.4 * deltaSeconds;

      positions[i] += burst.velocities[i] * deltaSeconds;
      positions[i + 1] += burst.velocities[i + 1] * deltaSeconds;
      positions[i + 2] += burst.velocities[i + 2] * deltaSeconds;
    }

    burst.positionAttribute.needsUpdate = true;
    burst.points.material.opacity = (1 - t) * (1 - t);
    burst.points.material.size = 0.1 + (1 - t) * 0.08;
  }
};

const triggerSixCelebration = () => {
  celebration.active = true;
  celebration.elapsed = 0;
  celebration.nextBurstAt = 0;
  resultLabel.classList.add("celebrate");
};

const stopCelebration = ({ clearBursts = false } = {}) => {
  celebration.active = false;
  celebration.elapsed = 0;
  celebration.nextBurstAt = 0;
  resultLabel.classList.remove("celebrate");
  dirLight.intensity = baseDirLightIntensity;
  if (clearBursts) {
    clearFireworks();
  }
};

const updateCelebration = (deltaSeconds) => {
  if (!celebration.active) {
    return;
  }

  celebration.elapsed += deltaSeconds;

  while (celebration.elapsed >= celebration.nextBurstAt && celebration.nextBurstAt < celebration.duration) {
    const burstOrigin = new THREE.Vector3(
      diceMesh.position.x + (Math.random() - 0.5) * 4.2,
      floor.position.y + 1.8 + Math.random() * 2.7,
      diceMesh.position.z + (Math.random() - 0.5) * 4.2
    );
    createFireworkBurst(burstOrigin, 140 + Math.floor(Math.random() * 80));
    celebration.nextBurstAt += 0.15 + Math.random() * 0.2;
  }

  const pulse = Math.sin(celebration.elapsed * 18) * 0.3 + Math.sin(celebration.elapsed * 7.5) * 0.22;
  dirLight.intensity = baseDirLightIntensity + Math.max(pulse, -0.1);

  if (celebration.elapsed >= celebration.duration) {
    stopCelebration();
  }
};

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

  stopCelebration({ clearBursts: true });
  tromboneSound.pause();
  tromboneSound.currentTime = 0;
  rollSound.currentTime = 0;
  rollSound.play().catch(() => {
    // Ignore blocked autoplay errors; button click usually allows playback.
  });

  isRolling = true;
  stableFrames = 0;
  resultLabel.textContent = "Rolling...";

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
  if (value === 6) {
    resultLabel.textContent = "You rolled 6! Celebration!";
    triggerSixCelebration();
  } else {
    resultLabel.textContent = `You rolled ${value}`;
    resultLabel.classList.remove("celebrate");
    if (value === 1) {
      tromboneSound.currentTime = 0;
      tromboneSound.play().catch(() => {
        // Ignore blocked playback errors.
      });
    }
  }
};

const clock = new THREE.Clock();
const cameraOffset = new THREE.Vector3(4.7, 4.5, 5.4);
const cameraTarget = new THREE.Vector3(0, 0, 0);
const desiredTarget = new THREE.Vector3(0, 0, 0);
const desiredCameraPosition = new THREE.Vector3(0, 0, 0);
const tapRaycaster = new THREE.Raycaster();
const tapPointer = new THREE.Vector2();
const tapState = {
  pointerId: null,
  startX: 0,
  startY: 0
};
const tapMoveThresholdPx = 14;

const updateTapRay = (clientX, clientY) => {
  const rect = canvas.getBoundingClientRect();
  tapPointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  tapPointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  tapRaycaster.setFromCamera(tapPointer, camera);
};

const tryRollFromTap = (clientX, clientY) => {
  updateTapRay(clientX, clientY);
  const hits = tapRaycaster.intersectObjects([shimmerMesh, diceMesh], false);
  if (hits.length > 0) {
    rollDice();
  }
};

const onCanvasPointerDown = (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  tapState.pointerId = event.pointerId;
  tapState.startX = event.clientX;
  tapState.startY = event.clientY;
};

const onCanvasPointerUp = (event) => {
  if (event.pointerId !== tapState.pointerId) {
    return;
  }

  tapState.pointerId = null;
  const dx = event.clientX - tapState.startX;
  const dy = event.clientY - tapState.startY;
  if (dx * dx + dy * dy > tapMoveThresholdPx * tapMoveThresholdPx) {
    return;
  }

  tryRollFromTap(event.clientX, event.clientY);
};

const clearTapState = () => {
  tapState.pointerId = null;
};

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
  updateCelebration(realDelta);
  updateFireworks(realDelta);
  updateCritters(realDelta);

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
canvas.addEventListener("pointerdown", onCanvasPointerDown);
canvas.addEventListener("pointerup", onCanvasPointerUp);
canvas.addEventListener("pointercancel", clearTapState);
canvas.addEventListener("pointerleave", clearTapState);
speedSlider.addEventListener("input", (event) => updateSimulationSpeed(event.target.value));
updateSimulationSpeed(speedSlider.value);

resetDice();
loadCritters();
animate();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}
