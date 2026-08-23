import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './styles.css';

const JOINTS = [
  { name: 'Base yaw', axis: 'Y', min: -180, max: 180, value: 28 },
  { name: 'Shoulder', axis: 'Z', min: -105, max: 105, value: -24 },
  { name: 'Elbow', axis: 'Z', min: -135, max: 135, value: 68 },
  { name: 'Wrist roll', axis: 'Y', min: -180, max: 180, value: 12 },
  { name: 'Wrist pitch', axis: 'Z', min: -120, max: 120, value: -36 },
  { name: 'Tool roll', axis: 'Y', min: -180, max: 180, value: 42 },
];

const PRESETS = {
  home: [28, -24, 68, 12, -36, 42],
  reach: [-18, -55, 18, 0, 38, -15],
  inspect: [56, 16, 92, -62, -74, 110],
};

const controlsRoot = document.querySelector('#joint-controls');
const sliders = [];

JOINTS.forEach((joint, index) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'joint-control';
  wrapper.innerHTML = `
    <div class="joint-row">
      <span class="joint-index">0${index + 1}</span>
      <span class="joint-name">${joint.name}<small>${joint.axis} AXIS</small></span>
      <output class="joint-value" for="joint-${index}">${joint.value > 0 ? '+' : ''}${joint.value}°</output>
    </div>
    <input id="joint-${index}" type="range" min="${joint.min}" max="${joint.max}" value="${joint.value}" step="1" aria-label="${joint.name}" />
  `;
  controlsRoot.append(wrapper);
  const input = wrapper.querySelector('input');
  const output = wrapper.querySelector('output');
  sliders.push({ input, output, joint });
});

const sceneContainer = document.querySelector('#scene-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x20231f);
// Keep atmospheric depth without dimming the arm when the camera is zoomed out.
// OrbitControls caps the camera at 9.5 units, so fog begins beyond that range.
scene.fog = new THREE.Fog(0x20231f, 12, 24);

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
camera.position.set(4.6, 3.25, 5.1);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
sceneContainer.append(renderer.domElement);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.055;
orbit.target.set(0, 1.45, 0);
orbit.minDistance = 3.1;
orbit.maxDistance = 9.5;
orbit.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.HemisphereLight(0xf2f3ed, 0x21241f, 1.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
keyLight.position.set(3, 6, 4);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xd8ff4f, 1.25);
rimLight.position.set(-4, 3, -2);
scene.add(rimLight);

const floor = new THREE.GridHelper(8, 16, 0x555b51, 0x363a34);
floor.material.transparent = true;
floor.material.opacity = 0.58;
scene.add(floor);

const floorDisc = new THREE.Mesh(
  new THREE.CircleGeometry(1.1, 72),
  new THREE.MeshBasicMaterial({ color: 0x2b2f29, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
);
floorDisc.rotation.x = -Math.PI / 2;
floorDisc.position.y = 0.004;
scene.add(floorDisc);

const workspaceRing = new THREE.Mesh(
  new THREE.RingGeometry(2.7, 2.715, 128),
  new THREE.MeshBasicMaterial({ color: 0xd8ff4f, transparent: true, opacity: 0.24, side: THREE.DoubleSide })
);
workspaceRing.rotation.x = -Math.PI / 2;
workspaceRing.position.y = 0.01;
scene.add(workspaceRing);

const armRoot = new THREE.Group();
scene.add(armRoot);

const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x10120f, metalness: 0.45, roughness: 0.32 });
const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xe8ece4, metalness: 0.12, roughness: 0.38 });
const lineInnerMaterial = new THREE.MeshBasicMaterial({ color: 0xd8ff4f });
const jointMaterial = new THREE.MeshStandardMaterial({ color: 0xff5f36, metalness: 0.08, roughness: 0.3 });

function cylinderBetween(start, end, radius, material) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 12), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  return mesh;
}

function addLine(parent, length, radius = 0.024) {
  const start = new THREE.Vector3(0, 0, 0);
  const end = new THREE.Vector3(0, length, 0);
  const outer = cylinderBetween(start, end, radius, lineMaterial);
  const inner = cylinderBetween(start, end, radius * 0.34, lineInnerMaterial);
  parent.add(outer, inner);
}

function addJoint(parent, axis, index) {
  const group = new THREE.Group();
  parent.add(group);

  const radius = index < 3 ? 0.105 : 0.082;
  const node = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), jointMaterial);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.2, 0.017, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0xd8ff4f, transparent: true, opacity: 0.9 })
  );
  if (axis === 'Y') ring.rotation.x = Math.PI / 2;
  group.add(node, ring);

  const axisHelper = new THREE.ArrowHelper(
    axis === 'Y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(),
    index < 3 ? 0.38 : 0.28,
    axis === 'Y' ? 0xd8ff4f : 0x4d7dff,
    0.08,
    0.045
  );
  axisHelper.name = 'joint-axis';
  group.add(axisHelper);
  return group;
}

// A parent-child transform chain: every rotation is inherited by every link after it.
const base = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.56, 0.16, 48), darkMaterial);
base.position.y = 0.08;
armRoot.add(base);

const baseRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.5, 0.016, 8, 64),
  new THREE.MeshBasicMaterial({ color: 0xd8ff4f, transparent: true, opacity: 0.75 })
);
baseRing.rotation.x = Math.PI / 2;
baseRing.position.y = 0.17;
armRoot.add(baseRing);

const jointNodes = [];
let cursor = armRoot;

const j1 = addJoint(cursor, 'Y', 0); j1.position.y = 0.2; jointNodes.push(j1);
addLine(j1, 0.55, 0.027);
const j2 = addJoint(j1, 'Z', 1); j2.position.y = 0.55; jointNodes.push(j2);
addLine(j2, 1.26, 0.03);
const j3 = addJoint(j2, 'Z', 2); j3.position.y = 1.26; jointNodes.push(j3);
addLine(j3, 1.05, 0.028);
const j4 = addJoint(j3, 'Y', 3); j4.position.y = 1.05; jointNodes.push(j4);
addLine(j4, 0.48, 0.023);
const j5 = addJoint(j4, 'Z', 4); j5.position.y = 0.48; jointNodes.push(j5);
addLine(j5, 0.34, 0.021);
const j6 = addJoint(j5, 'Y', 5); j6.position.y = 0.34; jointNodes.push(j6);
addLine(j6, 0.28, 0.018);

const tool = new THREE.Group();
tool.position.y = 0.28;
j6.add(tool);
const toolRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.12, 0.025, 10, 36),
  new THREE.MeshBasicMaterial({ color: 0xd8ff4f })
);
toolRing.rotation.x = Math.PI / 2;
tool.add(toolRing);
const toolCross = new THREE.Group();
toolCross.add(cylinderBetween(new THREE.Vector3(-0.16, 0, 0), new THREE.Vector3(0.16, 0, 0), 0.012, lineInnerMaterial));
toolCross.add(cylinderBetween(new THREE.Vector3(0, 0, -0.16), new THREE.Vector3(0, 0, 0.16), 0.012, lineInnerMaterial));
tool.add(toolCross);

const endMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.045, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0xffffff })
);
tool.add(endMarker);

const ghostPoints = [];
const ghostGeometry = new THREE.BufferGeometry();
const trailPositions = new THREE.BufferAttribute(new Float32Array(90 * 3), 3);
trailPositions.setUsage(THREE.DynamicDrawUsage);
ghostGeometry.setAttribute('position', trailPositions);
ghostGeometry.setDrawRange(0, 0);
const ghostLine = new THREE.Line(
  ghostGeometry,
  new THREE.LineBasicMaterial({ color: 0xff5f36, transparent: true, opacity: 0.44 })
);
scene.add(ghostLine);

const positionEls = {
  x: document.querySelector('#position-x'),
  y: document.querySelector('#position-y'),
  z: document.querySelector('#position-z'),
};
const orientationEl = document.querySelector('#orientation-value');
const toolPosition = new THREE.Vector3();
const toolQuaternion = new THREE.Quaternion();
const toolEuler = new THREE.Euler();

function updateSliderFill(input) {
  const progress = ((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
  input.style.setProperty('--fill', `${progress}%`);
}

function updateArm({ recordTrail = true } = {}) {
  sliders.forEach(({ input, output, joint }, index) => {
    const degrees = Number(input.value);
    const radians = THREE.MathUtils.degToRad(degrees);
    joint.value = degrees;
    output.textContent = `${degrees > 0 ? '+' : ''}${degrees}°`;
    updateSliderFill(input);
    if (joint.axis === 'Y') jointNodes[index].rotation.y = radians;
    else jointNodes[index].rotation.z = radians;
  });

  armRoot.updateMatrixWorld(true);
  tool.getWorldPosition(toolPosition);
  tool.getWorldQuaternion(toolQuaternion);
  toolEuler.setFromQuaternion(toolQuaternion, 'XYZ');
  positionEls.x.textContent = toolPosition.x.toFixed(3);
  positionEls.y.textContent = toolPosition.y.toFixed(3);
  positionEls.z.textContent = toolPosition.z.toFixed(3);
  orientationEl.textContent = `${Math.round(THREE.MathUtils.radToDeg(toolEuler.x))}° / ${Math.round(THREE.MathUtils.radToDeg(toolEuler.y))}° / ${Math.round(THREE.MathUtils.radToDeg(toolEuler.z))}°`;

  if (recordTrail) {
    const last = ghostPoints.at(-1);
    if (!last || last.distanceTo(toolPosition) > 0.025) {
      ghostPoints.push(toolPosition.clone());
      if (ghostPoints.length > 90) ghostPoints.shift();
      ghostPoints.forEach((point, index) => trailPositions.setXYZ(index, point.x, point.y, point.z));
      trailPositions.needsUpdate = true;
      ghostGeometry.setDrawRange(0, ghostPoints.length);
    }
  }
}

function applyPose(values, activeName) {
  values.forEach((value, index) => { sliders[index].input.value = value; });
  ghostPoints.length = 0;
  updateArm({ recordTrail: true });
  document.querySelectorAll('[data-preset]').forEach((button) => {
    button.classList.toggle('active', button.dataset.preset === activeName);
  });
}

sliders.forEach(({ input }) => {
  input.addEventListener('input', () => {
    document.querySelectorAll('[data-preset]').forEach((button) => button.classList.remove('active'));
    updateArm();
  });
});

document.querySelectorAll('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => applyPose(PRESETS[button.dataset.preset], button.dataset.preset));
});

document.querySelector('#reset-button').addEventListener('click', () => applyPose(PRESETS.home, 'home'));

let axesVisible = true;
document.querySelector('#toggle-axes').addEventListener('click', (event) => {
  axesVisible = !axesVisible;
  armRoot.traverse((object) => { if (object.name === 'joint-axis') object.visible = axesVisible; });
  event.currentTarget.classList.toggle('active', axesVisible);
});

function fitView() {
  camera.position.set(4.6, 3.25, 5.1);
  orbit.target.set(0, 1.45, 0);
  orbit.update();
}
document.querySelector('#fit-view').addEventListener('click', fitView);

function resize() {
  const { clientWidth, clientHeight } = sceneContainer;
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight, false);
}

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(sceneContainer);

function animate() {
  requestAnimationFrame(animate);
  orbit.update();
  renderer.render(scene, camera);
}

applyPose(PRESETS.home, 'home');
resize();
animate();
