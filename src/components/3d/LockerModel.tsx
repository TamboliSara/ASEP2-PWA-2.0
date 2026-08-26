import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useAppContext } from '../../store/AppContext';

/* ── helpers ── */
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function easeInOut(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function easeOutBack(t: number) { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

/* Maps a global scroll progress to a local [0,1] within [start,end] */
function phase(progress: number, start: number, end: number) {
  return clamp01((progress - start) / (end - start));
}

/* ── Sleek HUD-style label rendered as sprite ── */
function makeLabel(text: string, color = '#00f3ff'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const w = 1024; const h = 128; // Higher resolution for crisp text
  canvas.width = w; canvas.height = h;
  
  const labelText = text.toUpperCase();
  ctx.font = '600 42px "Space Grotesk", Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(labelText);
  const textW = metrics.width + 80;
  
  // Dark HUD-style background for extreme readability
  ctx.fillStyle = 'rgba(0, 8, 12, 0.9)';
  ctx.fillRect(w / 2 - textW / 2, h / 2 - 45, textW, 90);
  
  // Cyber-style border
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.strokeRect(w / 2 - textW / 2, h / 2 - 45, textW, 90);

  // Text with subtle glow
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(labelText, w / 2, h / 2 - 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  
  // Dramatically reduce the scale to avoid giant overlapping text
  sprite.scale.set(1.1, 1.1 * (h / w), 1);
  sprite.visible = false;
  return sprite;
}

function makeLeaderLine(from: THREE.Vector3, to: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.7 });
  const line = new THREE.Line(geo, mat);
  group.add(line);
  
  const sphereGeo = new THREE.SphereGeometry(0.025, 8, 8);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.copy(from);
  group.add(sphere);

  group.visible = false;
  return group;
}

/* ── Hinge helper: wraps an object so it rotates around its edge ── */
function createHinge(obj: THREE.Object3D, side: 'left' | 'right'): THREE.Group {
  // Ensure world matrices are current
  obj.updateWorldMatrix(true, true);

  // Get world-space bounding box
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  // Hinge point in world space: at the outer vertical edge and front depth
  const hingeWorld = new THREE.Vector3(
    side === 'left' ? box.min.x : box.max.x,
    center.y,
    box.max.z // Pivot from the front of the door thickness
  );

  const parent = obj.parent!;

  // Create hinge group in parent's local space
  const hinge = new THREE.Group();
  parent.add(hinge);
  
  // Convert world hinge point to parent local
  const hingeLocal = parent.worldToLocal(hingeWorld.clone());
  hinge.position.copy(hingeLocal);

  // Reparent the object under the hinge (preserves world transform)
  hinge.attach(obj);

  console.log('[Hinge]', obj.name, '| side:', side, '| bbox size:', size, '| hinge world:', hingeWorld);

  return hinge;
}

interface Props { onProgressChange?: (p: number) => void; onPhaseChange?: (phase: number) => void; }

const LockerModel: React.FC<Props> = ({ onProgressChange, onPhaseChange }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { state: appState } = useAppContext();
  const theme = appState.themeMode;

  // Scene refs for real-time theme updates
  const sceneRef = useRef<THREE.Scene | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const groundRef = useRef<THREE.Mesh | null>(null);
  const bloomRef = useRef<UnrealBloomPass | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Sync theme changes to Three.js scene
  useEffect(() => {
    const isLight = theme === 'light';
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(isLight ? '#f1f5f9' : '#050a08');
      sceneRef.current.environmentIntensity = isLight ? 0.3 : 0.6;
    }
    if (ambientLightRef.current) ambientLightRef.current.intensity = isLight ? 0.6 : 0.7;
    if (directionalLightRef.current) directionalLightRef.current.intensity = isLight ? 0.7 : 3.0;
    if (gridRef.current) {
      (gridRef.current.material as any).color.set(isLight ? '#cbd5e1' : '#1e293b');
      (gridRef.current.material as any).opacity = isLight ? 0.3 : 0.15;
    }
    if (groundRef.current) {
      (groundRef.current.material as any).color.set(isLight ? '#e2e8f0' : '#050a08');
      (groundRef.current.material as any).opacity = isLight ? 0.3 : 0.5;
    }
    if (bloomRef.current) {
      bloomRef.current.threshold = isLight ? 1.0 : 0.85;
      bloomRef.current.strength = isLight ? 0.08 : 0.25;
    }
    if (rendererRef.current) {
      rendererRef.current.toneMappingExposure = isLight ? 0.8 : 1.0;
    }
  }, [theme]);

  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;

    /* ── Scene ── */
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(theme === 'light' ? '#f8fafc' : '#050a08');

    const camera = new THREE.PerspectiveCamera(40, el.clientWidth / el.clientHeight, 0.1, 1000);
    camera.position.set(5, 3, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    rendererRef.current = renderer;
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = theme === 'light' ? 0.8 : 1.2;
    el.appendChild(renderer.domElement);

    // Environment Lighting for hyper-realistic PBR reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = theme === 'light' ? 0.3 : 0.6;

    // Post processing with Anti-Aliasing support via WebGLRenderTarget
    const renderTarget = new THREE.WebGLRenderTarget(el.clientWidth, el.clientHeight, {
      samples: renderer.getPixelRatio() === 1 ? 4 : 2,
      type: THREE.HalfFloatType,
    });
    const composer = new EffectComposer(renderer, renderTarget);
    composer.addPass(new RenderPass(scene, camera));
    
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(el.clientWidth, el.clientHeight), 
      theme === 'light' ? 0.05 : 0.15, 
      0.8, 
      theme === 'light' ? 0.95 : 0.85
    );
    bloomRef.current = bloom;
    composer.addPass(bloom);
    
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    /* ── Lights ── */
    const isLight = theme === 'light';
    const ambientLight = new THREE.AmbientLight(0xffffff, isLight ? 0.8 : 0.7);
    ambientLightRef.current = ambientLight;
    scene.add(ambientLight);

    const key = new THREE.DirectionalLight(0xffffff, isLight ? 0.8 : 3.0);
    directionalLightRef.current = key;
    key.position.set(6, 10, 6); key.castShadow = true; 
    key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x00f3ff, isLight ? 0.4 : 1.2); rim.position.set(-5, 4, -4); scene.add(rim);
    const fill = new THREE.PointLight(0x14b8a6, isLight ? 0.3 : 0.8, 15); fill.position.set(-3, 1, 4); scene.add(fill);
    const top = new THREE.DirectionalLight(0xeeffee, isLight ? 0.5 : 1.0); top.position.set(0, 10, 0); scene.add(top);
    const front = new THREE.PointLight(0xffffff, isLight ? 0.2 : 0.5, 20); front.position.set(0, 2, 8); scene.add(front);
    // Internal light that turns on when doors open
    const innerLight = new THREE.PointLight(0x00f3ff, 0, 6);
    innerLight.position.set(0, 0, 0.5);
    scene.add(innerLight);

    /* ── Particle System ── */
    const particleCount = 200;
    const particlesGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);
    for(let i = 0; i < particleCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 15; // 15x15x15 spread
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.03,
      color: theme === 'light' ? 0x88aa88 : 0x00f3ff,
      transparent: true,
      opacity: theme === 'light' ? 0.2 : 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const particleMesh = new THREE.Points(particlesGeo, particleMat);
    scene.add(particleMesh);

    /* ── Grid ── */
    const grid = new THREE.GridHelper(30, 60, isLight ? '#cbd5e1' : '#00f3ff', isLight ? '#e2e8f0' : '#112222');
    gridRef.current = grid;
    (grid.material as THREE.Material).opacity = isLight ? 0.3 : 0.08;
    (grid.material as THREE.Material).transparent = true;
    grid.position.y = -2; scene.add(grid);

    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: isLight ? '#e2e8f0' : '#050a08', 
      roughness: 0.8, 
      metalness: 0.2, 
      transparent: true, 
      opacity: isLight ? 0.3 : 0.5 
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    groundRef.current = ground;
    ground.rotation.x = -Math.PI / 2; ground.position.y = -2; ground.receiveShadow = true;
    scene.add(ground);

    /* ── Animation state ── */
    const INIT_ANGLE = Math.PI * 0.28;
    const st = { progress: 0, target: 0, time: 0, angle: INIT_ANGLE };
    let modelWrapperGroup: THREE.Group | null = null;

    /* ── Premium Materials ── */
    const matChassis = new THREE.MeshPhysicalMaterial({ color: 0xb0b5bc, roughness: 0.6, metalness: 0.8, clearcoat: 0.1, clearcoatRoughness: 0.5 });
    const matMainDoor = new THREE.MeshPhysicalMaterial({ color: 0xeef7ff, metalness: 0.0, roughness: 0.08, transmission: 0.98, transparent: true, opacity: 1, ior: 1.45, thickness: 0.25, clearcoat: 0.2, clearcoatRoughness: 0.1 });
    const matSafeDoor = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.0, roughness: 0.1, transmission: 0.92, transparent: true, opacity: 1.0, ior: 1.45, thickness: 0.1, clearcoat: 0.2 });
    const matSafe = new THREE.MeshPhysicalMaterial({ color: 0x12181b, roughness: 0.8, metalness: 0.4, clearcoat: 0.0 });
    const matScreen = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x00f3ff, emissiveIntensity: 1.0, roughness: 0.5, metalness: 0.5 });
    const matHardware = new THREE.MeshPhysicalMaterial({ color: 0x88929b, roughness: 0.4, metalness: 0.9, clearcoat: 0.0 });
    const matBME = new THREE.MeshPhysicalMaterial({ color: 0x22cc88, roughness: 0.5, metalness: 0.7, emissive: 0x00ff88, emissiveIntensity: 0.5, clearcoat: 0.1 });

    /* ── References filled on load ── */
    const mainDoorHinges: { hinge: THREE.Group; dir: number }[] = [];
    const safeDoorHinges: { hinge: THREE.Group; dir: number }[] = [];
    const bmeObjects: THREE.Object3D[] = [];
    const labels: { group: THREE.Group; target: THREE.Object3D; anchorLocal: THREE.Vector3 }[] = [];

    /* ── Load Model ── */
    const loader = new GLTFLoader();
    loader.load('/models/asep_2_revised.glb', (gltf) => {
      const model = gltf.scene;

      // Identify parts by name
      const parts: Record<string, THREE.Object3D> = {};
      model.traverse((child) => {
        if ((child as THREE.Light).isLight) {
          (child as THREE.Light).intensity = 0;
          child.visible = false;
        }
        if (child.name) {
          parts[child.name.trim()] = child;
        }
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true; mesh.receiveShadow = true;
        }
      });

      // Helper to apply material to an object and all its children
      const applyMat = (obj: THREE.Object3D | undefined, mat: THREE.Material) => {
        if (!obj) return;
        obj.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).material = mat;
          }
        });
      };

      // Apply materials
      const fridgeBodyParts = [
        parts['fridge_bottom'], parts['fridge_top'], parts['fridge_left'], parts['fride_right'], parts['fridge_back']
      ];
      fridgeBodyParts.forEach(p => applyMat(p, matChassis));
      
      const fridgeBody = parts['fridge_left']; // Used for label attachment

      const mainDoor1 = parts['fridge_door_left'];
      const mainDoor2 = parts['fridge_door_right'];
      
      applyMat(mainDoor1, matMainDoor.clone());
      applyMat(mainDoor2, matMainDoor.clone());

      const screen = parts['screen'];
      applyMat(screen, matScreen);

      const safeBases: Record<number, THREE.Object3D> = {};

      for (let i = 1; i <= 8; i++) {
        const safeBaseKeys = i === 1 
          ? ['safe_1_top', 'safe_1_bottom', 'safe_1_right', 'safe_1_left', 'safe_1_back']
          : [`top_safe_${i}`, `bottom_safe_${i}`, `right_safe_${i}`, `left_safe_${i}`, `back_safe_${i}`];
          
        safeBaseKeys.forEach(k => {
          if (parts[k]) applyMat(parts[k], matSafe.clone());
        });
        
        safeBases[i] = i === 1 ? parts['safe_1_back'] : parts[`back_safe_${i}`];

        const dKey = i === 1 ? 'safe_1_door' : `door_safe_${i}`;
        if (parts[dKey]) applyMat(parts[dKey], matSafeDoor.clone());

        const solKey = i === 1 ? 'safe_1_lock' : `lock_safe_${i}`;
        if (solKey && parts[solKey]) {
          applyMat(parts[solKey], matHardware);
          if (parts[dKey]) parts[dKey].attach(parts[solKey]);
        }

        const bmeKey = i === 1 ? 'safe_1_bme688' : (i === 8 ? 'bme688_safe_7 2' : `bme688_safe_${i}`);
        if (bmeKey && parts[bmeKey]) {
          applyMat(parts[bmeKey], matBME.clone());
          bmeObjects.push(parts[bmeKey]);
        }
      }

      const esp = parts['esp32'];
      applyMat(esp, matHardware);
      const i2c = parts['i2c_multiplxer'];
      applyMat(i2c, matHardware);

      // Attach components to the main door so they swing with it
      if (mainDoor1) {
        if (screen) mainDoor1.attach(screen);
        if (esp) mainDoor1.attach(esp);
        if (i2c) mainDoor1.attach(i2c);
      }

      // Center & normalize
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const sz = box.getSize(new THREE.Vector3());
      const scale = 3 / Math.max(sz.x, sz.y, sz.z);
      model.position.sub(center);
      model.scale.multiplyScalar(scale);
      
      // Wrapper for floating animation
      const wrapper = new THREE.Group();
      wrapper.add(model);
      scene.add(wrapper);
      scene.updateMatrixWorld(true);
      modelWrapperGroup = wrapper;

      // Debug: log all discovered parts
      console.log('[LockerModel] Found parts:', Object.keys(parts));
      console.log('[LockerModel] mainDoor1:', !!mainDoor1, 'mainDoor2:', !!mainDoor2);

      // ── Create hinges for main doors ──
      // After centering, objects on the left half have world x < 0
      if (mainDoor1) {
        const box1 = new THREE.Box3().setFromObject(mainDoor1);
        const c1 = box1.getCenter(new THREE.Vector3());
        const isLeft = c1.x < 0;
        const h = createHinge(mainDoor1, isLeft ? 'left' : 'right');
        mainDoorHinges.push({ hinge: h, dir: isLeft ? -1 : 1 });
      }
      if (mainDoor2) {
        const box2 = new THREE.Box3().setFromObject(mainDoor2);
        const c2 = box2.getCenter(new THREE.Vector3());
        const isLeft = c2.x < 0;
        const h = createHinge(mainDoor2, isLeft ? 'left' : 'right');
        mainDoorHinges.push({ hinge: h, dir: isLeft ? -1 : 1 });
      }

      console.log('[LockerModel] mainDoorHinges count:', mainDoorHinges.length);

      // ── Create hinges for SAFE doors ──
      for (let i = 1; i <= 8; i++) {
        const dKey = i === 1 ? 'safe_1_door' : `door_safe_${i}`;
        const door = parts[dKey];
        if (!door) continue;
        const db = new THREE.Box3().setFromObject(door);
        const dc = db.getCenter(new THREE.Vector3());
        const isLeft = dc.x < 0;
        const h = createHinge(door, isLeft ? 'left' : 'right');
        safeDoorHinges.push({ hinge: h, dir: isLeft ? -1 : 1 });
      }

      // ── Labels ──
      const addLabel = (text: string, target: THREE.Object3D, offsetY = 0.35) => {
        if (!target) return -1;
        target.updateWorldMatrix(true, false);
        const b = new THREE.Box3().setFromObject(target);
        const centerWorld = b.getCenter(new THREE.Vector3());
        const topOffset = (b.max.y - centerWorld.y) + offsetY;

        const group = new THREE.Group();
        group.visible = false;
        
        const spr = makeLabel(text);
        spr.position.set(0, topOffset, 0);
        spr.visible = true; // visibility managed by group
        group.add(spr);

        const line = makeLeaderLine(new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0, topOffset - 0.12, 0));
        line.visible = true;
        group.add(line);

        group.position.copy(centerWorld);
        scene.add(group);

        const anchorLocal = target.worldToLocal(centerWorld.clone());
        labels.push({ group, target, anchorLocal });
        return labels.length - 1;
      };

      // Main door labels
      const lblMainDoor1 = mainDoor1 ? addLabel('MAIN DOOR (Screen Side)', mainDoor1, 0.5) : -1;
      const lblMainDoor2 = mainDoor2 ? addLabel('MAIN DOOR 2', mainDoor2, 0.5) : -1;
      const lblScreen = screen ? addLabel('TOUCHSCREEN DISPLAY', screen, 0.4) : -1;
      
      // Permanent Brand Title (not a floating label)
      if (fridgeBody) {
        const brandSpr = makeLabel('SAFE');
        brandSpr.scale.set(3.5, 3.5 * (128 / 1024), 1);
        fridgeBody.updateWorldMatrix(true, false);
        const b = new THREE.Box3().setFromObject(fridgeBody);
        const center = b.getCenter(new THREE.Vector3());
        scene.add(brandSpr);
        brandSpr.position.set(center.x, b.max.y + 0.6, center.z);
        brandSpr.visible = true;
      }
      const lblFridge = -1; // Removed as it is now a permanent brand mark

      // SAFE labels
      const lblSafes: number[] = [];
      for (let i = 1; i <= 8; i++) {
        const safe = safeBases[i];
        if (safe) lblSafes.push(addLabel(`SAFE ${i}`, safe, 0.25));
      }

      // SAFE door labels
      const lblSafeDoors: number[] = [];
      for (let i = 1; i <= 8; i++) {
        const door = parts[i === 1 ? 'safe_1_door' : `door_safe_${i}`];
        if (door) lblSafeDoors.push(addLabel(`SAFE ${i}`, door, 0.15));
      }

      // BME688 label (just one for focus)
      const lblBME = bmeObjects.length > 0 ? addLabel('BME688: ENVIRONMENTAL SENSOR UNIT', bmeObjects[0], 0.15) : -1;

      // Solenoid labels
      const lblSolenoids: number[] = [];
      for (let i = 1; i <= 8; i++) {
        const sk = i === 1 ? 'safe_1_lock' : `lock_safe_${i}`;
        if (parts[sk]) lblSolenoids.push(addLabel(`Solenoid Lock ${i}`, parts[sk], 0.2));
      }

      const lblESP = esp ? addLabel('ESP32-S3 Microcontroller', esp, 0.3) : -1;
      const lblI2C = i2c ? addLabel('I²C Multiplexer', i2c, 0.3) : -1;

      /* Helper to show/hide label */
      const setLabelVis = (idx: number, vis: boolean) => {
        if (idx < 0 || idx >= labels.length) return;
        labels[idx].group.visible = vis;
      };

      /* ══════════════════════════════════════════════
         SCROLL PHASES — driven every frame
         Phase 0 (0.00–0.05): Idle hero shot
         Phase 1 (0.05–0.30): Main doors open, labels appear
         Phase 2 (0.30–0.55): Camera moves in, 8 SAFEs labelled
         Phase 3 (0.55–0.80): 8 SAFE doors open
         Phase 4 (0.80–1.00): Zoom to BME688 sensor
      ══════════════════════════════════════════════ */
      const applyAnimation = (p: number) => {
        const p1 = easeInOut(phase(p, 0.05, 0.30)); // main doors
        const p2 = easeInOut(phase(p, 0.30, 0.55)); // reveal SAFEs
        const rawP3 = phase(p, 0.55, 0.80); // SAFE doors open (raw phase for staggered calculation)
        const p3 = easeInOut(rawP3); 
        const p4 = easeInOut(phase(p, 0.80, 1.00)); // BME688 focus

        // ── Phase 1: Main doors open ──
        mainDoorHinges.forEach(({ hinge, dir }, i) => {
          const staggerStart = i === 0 ? 0 : 0.15;
          const staggerEnd = i === 0 ? 0.85 : 1.0;
          const localP = clamp01((phase(p, 0.05, 0.30) - staggerStart) / (staggerEnd - staggerStart));
          const p1Stagger = easeOutBack(localP);
          hinge.rotation.y = dir * p1Stagger * (Math.PI / 2.1);
        });
        innerLight.intensity = p1 * 2.0;

        // Dynamic Label Positions (sticks to moving objects)
        labels.forEach(lbl => {
          if (lbl.group.visible) {
            lbl.target.updateWorldMatrix(true, false);
            lbl.group.position.copy(lbl.target.localToWorld(lbl.anchorLocal.clone()));
          }
        });

        // Labels - Hide initial main door/screen labels as animation starts
        if (lblFridge >= 0) setLabelVis(lblFridge, p < 0.2);
        if (lblMainDoor1 >= 0) setLabelVis(lblMainDoor1, p > 0.01 && p < 0.06);
        if (lblMainDoor2 >= 0) setLabelVis(lblMainDoor2, p > 0.01 && p < 0.06);
        if (lblScreen >= 0) setLabelVis(lblScreen, p > 0.01 && p < 0.06);
        
        // Show ESP and I2C labels as the door opens, since they are attached to the back of the door
        if (lblESP >= 0) setLabelVis(lblESP, p1 > 0.5 && p < 0.55);
        if (lblI2C >= 0) setLabelVis(lblI2C, p1 > 0.5 && p < 0.55);

        // ── Phase 2: SAFEs revealed ──
        // Only label a couple of SAFEs to prevent text clutter
        lblSafes.forEach((idx, i) => setLabelVis(idx, (i === 0 || i === 4) && p2 > 0.2 && p < 0.80));

        // ── Phase 3: SAFE doors open ──
        safeDoorHinges.forEach(({ hinge, dir }, i) => {
          const staggerStart = safeDoorHinges.length ? (i / safeDoorHinges.length) * 0.5 : 0;
          const staggerEnd = staggerStart + 0.5;
          const localP = clamp01((rawP3 - staggerStart) / (staggerEnd - staggerStart));
          const p3Stagger = easeOutBack(localP);
          hinge.rotation.y = dir * p3Stagger * (Math.PI / 2.3);
        });
        
        // Label each door of the safe as safe 1, safe 2 etc. with a slight stagger
        lblSafeDoors.forEach((idx, i) => {
          const stagger = (i / 8) * 0.4;
          setLabelVis(idx, p3 > (0.1 + stagger) && p < 0.95);
        });
        lblSolenoids.forEach((idx, i) => setLabelVis(idx, i === 0 && p3 > 0.4 && p < 0.95));

        // ── Phase 4: BME688 focus ──
        if (lblBME >= 0) {
          setLabelVis(lblBME, p4 > 0.6);
          // Aggressively scale down the label as we get closer to the macro view
          const s = lerp(1, 0.22, p4);
          labels[lblBME].group.scale.set(s, s, s);
        }

        // Highlight BME688 emissive during phase 4
        bmeObjects.forEach(obj => {
          const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (m.emissiveIntensity !== undefined) {
            m.emissiveIntensity = 0.4 + p4 * 0.8;
          }
        });

        // ── Cinematic Camera Choreography ──
        let camR = 8.5;
        let camY = 0.5;
        let lookX = 0;
        let lookY = 0.8;
        let lookZ = 0;
        let orbitAngle = INIT_ANGLE;
        let camFov = 40;

        // Move 1: Hero to Reveal (0.0 to 0.3)
        const p1_cam = clamp01(p / 0.3);
        const e1 = easeInOut(p1_cam);
        camR = lerp(camR, 5.5, e1);
        camY = lerp(camY, 2.5, e1);
        lookY = lerp(lookY, 0.5, e1);
        orbitAngle += e1 * Math.PI * 0.15; // Sweep right

        // Move 2: Push in to Safe Array (0.3 to 0.55)
        const p2_cam = clamp01((p - 0.3) / 0.25);
        const e2 = easeInOut(p2_cam);
        camR = lerp(camR, 3.8, e2);
        camY = lerp(camY, 1.8, e2);
        lookY = lerp(lookY, 1.0, e2);
        lookX = lerp(lookX, -0.3, e2); // Rule of thirds composition
        orbitAngle -= e2 * Math.PI * 0.2; // Dramatic sweep back left
        camFov = lerp(camFov, 32, e2); // Slight dolly zoom

        // Move 3: Tilt down to observe inner workings (0.55 to 0.8)
        const p3_cam = clamp01((p - 0.55) / 0.25);
        const e3 = easeInOut(p3_cam);
        camR = lerp(camR, 2.8, e3);
        camY = lerp(camY, 1.2, e3);
        lookY = lerp(lookY, 0.6, e3);
        lookX = lerp(lookX, 0.2, e3);
        orbitAngle += e3 * Math.PI * 0.1;
        camFov = lerp(camFov, 45, e3); // Widen back up

        // Move 4: Macro Zoom into BME688 (0.8 to 1.0)
        const p4_cam = clamp01((p - 0.8) / 0.2);
        const e4 = easeInOut(p4_cam);
        
        let orbitCamX = Math.cos(orbitAngle) * camR;
        let orbitCamZ = Math.sin(orbitAngle) * camR;
        let orbitCamY = camY + Math.sin(st.time * 1.5) * 0.08;
        
        let finalCamPos = new THREE.Vector3(orbitCamX, orbitCamY, orbitCamZ);
        
        if (e4 > 0 && bmeObjects.length > 0) {
          const bmePos = new THREE.Vector3();
          bmeObjects[0].getWorldPosition(bmePos);
          
          const idealCamPos = new THREE.Vector3(
             bmePos.x + 0.12,
             bmePos.y + 0.02,
             bmePos.z + 0.35
          );
          
          finalCamPos.lerp(idealCamPos, e4);
          lookX = lerp(lookX, bmePos.x, e4);
          lookY = lerp(lookY, bmePos.y, e4);
          lookZ = lerp(lookZ, bmePos.z, e4);
          camFov = lerp(camFov, 22, e4); // Macro lens effect
        }

        // Apply FOV changes
        if (Math.abs(camera.fov - camFov) > 0.01) {
          camera.fov = camFov;
          camera.updateProjectionMatrix();
        }

        // Dynamic label pulse effect
        labels.forEach(lbl => {
          if (lbl.group.visible) {
            const scale = 1.0 + Math.sin(st.time * 3.0 + lbl.group.id) * 0.05;
            if (lbl.group.id !== (lblBME >= 0 ? labels[lblBME].group.id : -1)) {
               lbl.group.scale.set(scale, scale, scale);
            }
          }
        });

        // Add mouse parallax
        mouse.lerp(targetMouse, 0.05);
        
        // Applying parallax offset to final camera position (WOW effect)
        // Enhance parallax dynamically based on macro zoom phase
        const parallaxStrength = 0.4 + (e4 * 0.4); 
        finalCamPos.x += mouse.x * parallaxStrength;
        finalCamPos.y += mouse.y * parallaxStrength;

        camera.position.copy(finalCamPos);
        camera.lookAt(lookX, lookY, lookZ);
        
        // Drone bank effect - slight camera roll based on interactive mouse
        camera.rotation.z = mouse.x * -0.05;

        // Report phase
        if (onPhaseChange) {
          if (p < 0.05) onPhaseChange(0);
          else if (p < 0.30) onPhaseChange(1);
          else if (p < 0.55) onPhaseChange(2);
          else if (p < 0.80) onPhaseChange(3);
          else onPhaseChange(4);
        }
      };

      // Store the animation function
      animateFn = applyAnimation;
    }, undefined, (err) => console.error('Model load error:', err));

    /* ── Interaction ── */
    const mouse = new THREE.Vector2(0, 0);
    const targetMouse = new THREE.Vector2(0, 0);
    const onMouseMove = (e: MouseEvent) => {
      targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove);

    /* ── Scroll → progress ── */
    const updateScroll = () => {
      if (!wrapperRef.current) return;
      const wr = wrapperRef.current;
      const rect = wr.getBoundingClientRect();
      const wTop = window.scrollY + rect.top;
      const range = wr.offsetHeight - window.innerHeight;
      if (range <= 0) return;
      st.target = clamp01((window.scrollY - wTop) / range);
    };
    window.addEventListener('scroll', updateScroll, { passive: true });

    /* ── Render loop ── */
    let animateFn: ((p: number) => void) | null = null;
    const clock = new THREE.Clock();
    let frameId: number;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      st.time += clock.getDelta();
      st.progress += (st.target - st.progress) * 0.05; // Smoother scroll interpolation

      if (animateFn) animateFn(st.progress);
      if (onProgressChange) onProgressChange(st.progress);

      bloom.strength = (theme === 'light' ? 0.05 : 0.15) + Math.sin(st.progress * Math.PI) * 0.05;
      
      if (modelWrapperGroup) {
        // Subtle floating effect
        modelWrapperGroup.position.y = Math.sin(st.time * 2.0) * 0.05;
      }
      
      if (particleMesh) {
        particleMesh.rotation.y = st.time * 0.05;
        particleMesh.position.y = Math.sin(st.time * 0.5) * 0.2;
      }

      composer.render();
    };
    animate();

    /* ── Resize ── */
    const onResize = () => {
      if (!el) return;
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h); composer.setSize(w, h);
    };
    onResize();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('mousemove', onMouseMove);
      if (el && renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [onProgressChange, onPhaseChange]);

  return (
    <>
      <div ref={mountRef} style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: theme === 'light' 
          ? 'radial-gradient(circle at 50% 50%, #f0fdf4 0%, #f8fafc 80%)'
          : 'radial-gradient(circle at 50% 50%, #0c1a17 0%, #030806 80%)',
        overflow: 'hidden', zIndex: 0,
      }} />
      <div ref={wrapperRef} style={{
        position: 'relative', height: '500vh', width: '100%', pointerEvents: 'none',
      }} />
    </>
  );
};

export default LockerModel;
