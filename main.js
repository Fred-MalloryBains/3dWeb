import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { load_animation_data } from './movies.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

//chatgpt
const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(1, 1, 2);
scene.add(light);


scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const POSITION_ROOM = new THREE.Vector3(2, 1, 0);
const POSITION_VINYL = new THREE.Vector3(-1, 1, -1.5);
const POSITION_COMPUTER = new THREE.Vector3(1.5, 1, -1.5);
camera.position.set(POSITION_ROOM.x, POSITION_ROOM.y, POSITION_ROOM.z);

scene.rotation.y = -Math.PI / 2;
//orbit controls 
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = true;
controls.enableZoom = false;
controls.target.set(POSITION_ROOM.x - 0.5, POSITION_ROOM.y, POSITION_ROOM.z);

//  Rotation limits
controls.minAzimuthAngle = -Math.PI / 4; // rotate 45° left
controls.maxAzimuthAngle = Math.PI / 4;  // rotate 45° right
controls.minPolarAngle = Math.PI / 4;    // can't look straight down
controls.maxPolarAngle = Math.PI / 2;    // stops before flipping

controls.update();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let computerMesh = null;
let vinylMesh = null;
let SuzanneMesh = null;


// Load 
const loader = new GLTFLoader();
loader.load(
  '/models/scene.gltf', // URL relative to /public
  (gltf) => {
    const model = gltf.scene;
    model.scale.set(1,1,1); // adjust if needed
    scene.add(model);
    computerMesh = model.getObjectByName('computer_'); // GLTF JSON
    vinylMesh = model.getObjectByName('box');
    SuzanneMesh = model.getObjectByName('Suzanne');
  },
  
  (xhr) => {
    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
  },
  (error) => {
    console.error('An error happened:', error);
  }
);

window.addEventListener('click', (event) => {
  // Normalized device coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  if (computerMesh) {
    const intersects = raycaster.intersectObject(computerMesh, true);
    if (intersects.length > 0) {
      if (camera.position.equals(POSITION_COMPUTER)) return;
      transition(
        camera.position.clone(),
        POSITION_COMPUTER.clone(),
      );
    }
  }

  if (vinylMesh) {
    const intersects = raycaster.intersectObject(vinylMesh, true);
    if (intersects.length > 0) {
      if (camera.position.equals(POSITION_VINYL)) return;
      transition(
        camera.position.clone(),
        POSITION_VINYL.clone(),
      );
      animate_box();
      load_animation_data();
    }
  }
  if (SuzanneMesh) {
    const intersects = raycaster.intersectObject(SuzanneMesh, true);
    if (intersects.length > 0) {
      window.location.href = '/movies.html';
    }
  }
});

function transition(cameraStart, cameraEnd) {
  const duration = 2000; // milliseconds
  const startTime = performance.now();
  const targetStart = controls.target.clone();
  const targetEnd = cameraEnd.clone().sub(new THREE.Vector3(0.5, 0, 0)); // Adjust target to look slightly left of center

  function animateTransition() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1);

    // Smoothstep easing (optional, smoother than linear)
    const easeT = t * t * (3 - 2 * t);

    camera.position.lerpVectors(cameraStart, cameraEnd, easeT);
    controls.target.lerpVectors(targetStart, targetEnd, easeT);
    controls.update();

    if (t < 1) {
      requestAnimationFrame(animateTransition);
    }
  }

  animateTransition();
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (camera.position.equals(POSITION_ROOM)) return;
    transition(camera.position, POSITION_ROOM);
  }
});

function animate() {
  controls.update();
  renderer.render(scene, camera);
}

function animate_box() {
  function rotateVinyl() {
    console.log('camera pos', camera.position);
    console.log('vinyl pos', POSITION_VINYL);
    if (camera.position.distanceTo(POSITION_VINYL) < 1) { // Check if the camera is near the vinyl
      vinylMesh.rotation.y += 0.01;
      requestAnimationFrame(rotateVinyl);
    }
  }
  rotateVinyl();
}