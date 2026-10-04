import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useAppContext } from '../../store/AppContext';
import { useTranslation } from '../../store/useTranslation';
import { toLocalDigits } from '../../utils/format';

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
  const w = 1024; const h = 128;
  canvas.width = w; canvas.height = h;
  
  const labelText = text;
  ctx.font = '600 36px "Space Grotesk", Inter, "Noto Sans Devanagari", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(labelText);
  const textW = metrics.width + 60;
  
  // Dark glass HUD-style background
  ctx.fillStyle = 'rgba(5, 12, 18, 0.88)';
  ctx.beginPath();
  ctx.roundRect(w / 2 - textW / 2, h / 2 - 40, textW, 80, 10);
  ctx.fill();
  
  // Cyber-style border
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(w / 2 - textW / 2, h / 2 - 40, textW, 80, 10);
  ctx.stroke();

  // Text with subtle glow
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(labelText, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  
  sprite.scale.set(0.95, 0.95 * (h / w), 1);
  sprite.visible = false;
  return sprite;
}

function makeLeaderLine(from: THREE.Vector3, to: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.7 });
  const line = new THREE.Line(geo, mat);
  group.add(line);
  
  const sphereGeo = new THREE.SphereGeometry(0.02, 8, 8);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.copy(from);
  group.add(sphere);

  group.visible = false;
  return group;
}

/* ── Generate realistic Kiosk UI texture for the door touchscreen ── */
function createScreenTexture(t: (k: string, def?: string) => string, locale: string = "en"): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768; // 2:3 vertical kiosk display
  const ctx = canvas.getContext('2d')!;

  // 1. Dark obsidian background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 768);
  bgGrad.addColorStop(0, '#060f17');
  bgGrad.addColorStop(1, '#020609');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 768);

  // 2. Subtle grid scanlines
  ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let y = 0; y < 768; y += 14) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // 3. Cyber outer frame
  ctx.strokeStyle = 'rgba(0, 243, 255, 0.6)';
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, 488, 744);

  // Corner accents
  ctx.fillStyle = '#00f3ff';
  const cSize = 16;
  ctx.fillRect(12, 12, cSize, 4);
  ctx.fillRect(12, 12, 4, cSize);
  ctx.fillRect(488, 12, cSize, 4);
  ctx.fillRect(496, 12, 4, cSize);
  ctx.fillRect(12, 752, cSize, 4);
  ctx.fillRect(12, 740, 4, cSize);
  ctx.fillRect(488, 752, cSize, 4);
  ctx.fillRect(496, 740, 4, cSize);

  // 4. Header Bar
  ctx.fillStyle = 'rgba(0, 243, 255, 0.12)';
  ctx.fillRect(20, 20, 472, 60);
  ctx.strokeStyle = 'rgba(0, 243, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, 472, 60);

  ctx.font = 'bold 20px "Space Grotesk", Inter, "Noto Sans Devanagari", sans-serif';
  ctx.fillStyle = '#00f3ff';
  ctx.textAlign = 'left';
  ctx.fillText(t("screenKioskOs", "SAFE // KIOSK OS"), 36, 56);

  ctx.font = 'bold 13px monospace, "Noto Sans Devanagari"';
  ctx.fillStyle = '#10b981';
  ctx.textAlign = 'right';
  ctx.fillText(t("screenBleOnline", "● BLE ONLINE"), 472, 56);

  // 5. Environmental Metrics Card
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(24, 96, 464, 116);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.strokeRect(24, 96, 464, 116);

  ctx.font = '11px "Inter", "Noto Sans Devanagari", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.textAlign = 'left';
  ctx.fillText(t("screenEnvMetrics", "ENVIRONMENTAL METRICS (BME688 AI)"), 38, 122);

  ctx.font = 'bold 30px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${toLocalDigits('4.2', locale)}°C`, 38, 166);

  ctx.font = 'bold 18px monospace';
  ctx.fillStyle = '#00f3ff';
  ctx.fillText(`${toLocalDigits('62', locale)}% RH`, 190, 166);

  ctx.font = 'bold 14px monospace, "Noto Sans Devanagari"';
  ctx.fillStyle = '#10b981';
  ctx.fillText(t("screenVocOptimal", "VOC: OPTIMAL"), 320, 166);

  // 6. Compartment Status Grid (8 Safes)
  ctx.font = '11px "Inter", "Noto Sans Devanagari", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText(t("screenStorageComp", "STORAGE COMPARTMENTS (8 AUTONOMOUS SAFES)"), 38, 246);

  const startY = 264;
  const cardW = 224;
  const cardH = 78;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 2; c++) {
      const idx = r * 2 + c + 1;
      const x = 24 + c * (cardW + 16);
      const y = startY + r * (cardH + 12);

      ctx.fillStyle = 'rgba(14, 24, 34, 0.9)';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = idx === 1 ? 'rgba(234, 179, 8, 0.5)' : 'rgba(0, 243, 255, 0.3)';
      ctx.strokeRect(x, y, cardW, cardH);

      ctx.font = 'bold 14px monospace, "Noto Sans Devanagari"';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(`${t("screenSafe", "SAFE")} ${toLocalDigits(idx, locale)}`, x + 16, y + 32);

      ctx.font = '11px monospace, "Noto Sans Devanagari"';
      ctx.fillStyle = idx === 1 ? '#eab308' : '#10b981';
      ctx.fillText(idx === 1 ? t("screenOccupied", "OCCUPIED") : t("screenReady", "READY"), x + 16, y + 54);

      // Status indicator light
      ctx.fillStyle = idx === 1 ? '#eab308' : '#00f3ff';
      ctx.beginPath();
      ctx.arc(x + cardW - 22, y + 38, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 7. Bottom CTA banner
  ctx.fillStyle = 'rgba(0, 243, 255, 0.12)';
  ctx.fillRect(24, 664, 464, 68);
  ctx.strokeStyle = '#00f3ff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(24, 664, 464, 68);

  ctx.font = 'bold 14px "Space Grotesk", Inter, "Noto Sans Devanagari", sans-serif';
  ctx.fillStyle = '#00f3ff';
  ctx.textAlign = 'center';
  ctx.fillText(locale === "hi" ? "अनलॉक करने के लिए QR स्कैन करें" : locale === "mr" ? "अनलॉक करण्यासाठी QR स्कॅन करा" : "SCAN QR CODE OR TAP CARD TO UNLOCK", 256, 705);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ── Hinge helper: wraps an object so it rotates around its outer edge ── */
function createHinge(obj: THREE.Object3D, side: 'left' | 'right'): THREE.Group {
  obj.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());

  const hingeWorld = new THREE.Vector3(
    side === 'left' ? box.min.x : box.max.x,
    center.y,
    box.max.z
  );

  const parent = obj.parent!;
  const hinge = new THREE.Group();
  parent.add(hinge);
  
  const hingeLocal = parent.worldToLocal(hingeWorld.clone());
  hinge.position.copy(hingeLocal);
  hinge.attach(obj);

  return hinge;
}

interface Props { 
  onProgressChange?: (p: number) => void; 
  onPhaseChange?: (phase: number) => void; 
}

const LockerModel: React.FC<Props> = ({ onProgressChange, onPhaseChange }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { state: appState } = useAppContext();
  const { t, locale } = useTranslation();
  const theme = appState.themeMode;

  // Scene refs
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
      sceneRef.current.environmentIntensity = isLight ? 0.35 : 0.6;
    }
    if (ambientLightRef.current) ambientLightRef.current.intensity = isLight ? 0.6 : 0.7;
    if (directionalLightRef.current) directionalLightRef.current.intensity = isLight ? 0.7 : 2.8;
    if (gridRef.current) {
      (gridRef.current.material as any).color.set(isLight ? '#cbd5e1' : '#00f3ff');
      (gridRef.current.material as any).opacity = isLight ? 0.25 : 0.08;
    }
    if (groundRef.current) {
      (groundRef.current.material as any).color.set(isLight ? '#e2e8f0' : '#030806');
      (groundRef.current.material as any).opacity = isLight ? 0.25 : 0.4;
    }
    if (bloomRef.current) {
      bloomRef.current.threshold = isLight ? 0.95 : 0.85;
      bloomRef.current.strength = isLight ? 0.05 : 0.18;
    }
    if (rendererRef.current) {
      rendererRef.current.toneMappingExposure = isLight ? 0.85 : 1.1;
    }
  }, [theme]);

  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;

    /* ── Scene (Transparent background to let CSS radial gradient shine through) ── */
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = null;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(5, 3, 6);

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true, 
      powerPreference: 'high-performance' 
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = theme === 'light' ? 0.85 : 1.1;
    
    // Ensure canvas fills its parent cleanly
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    el.appendChild(renderer.domElement);

    // Environment Lighting
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = theme === 'light' ? 0.35 : 0.6;

    // Post processing
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
      samples: renderer.getPixelRatio() === 1 ? 4 : 2,
      type: THREE.HalfFloatType,
    });
    const composer = new EffectComposer(renderer, renderTarget);
    composer.addPass(new RenderPass(scene, camera));
    
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(width, height), 
      theme === 'light' ? 0.05 : 0.18, 
      0.8, 
      theme === 'light' ? 0.95 : 0.85
    );
    bloomRef.current = bloom;
    composer.addPass(bloom);
    
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    /* ── Lights ── */
    const isLight = theme === 'light';
    const ambientLight = new THREE.AmbientLight(0xffffff, isLight ? 0.9 : 1.1);
    ambientLightRef.current = ambientLight;
    scene.add(ambientLight);

    const key = new THREE.DirectionalLight(0xffffff, isLight ? 0.8 : 3.0);
    directionalLightRef.current = key;
    key.position.set(6, 10, 6); 
    key.castShadow = true; 
    key.shadow.mapSize.set(2048, 2048); 
    key.shadow.bias = -0.0005;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x00f3ff, isLight ? 0.5 : 1.8); 
    rim.position.set(-6, 5, -4); 
    scene.add(rim);

    const fill = new THREE.PointLight(0x14b8a6, isLight ? 0.4 : 1.2, 16); 
    fill.position.set(-4, 2, 5); 
    scene.add(fill);

    const top = new THREE.DirectionalLight(0xeeffee, isLight ? 0.6 : 1.2); 
    top.position.set(0, 10, 0); 
    scene.add(top);

    const front = new THREE.DirectionalLight(0xffffff, isLight ? 0.5 : 1.4); 
    front.position.set(2, 3, 7); 
    scene.add(front);

    // Internal lights that turn on when doors open
    const innerLight = new THREE.PointLight(0x00f3ff, 0, 8);
    innerLight.position.set(0, 0, 0.6);
    scene.add(innerLight);

    const interiorStripLight = new THREE.PointLight(0xe0f2fe, 0, 6);
    interiorStripLight.position.set(0, 1.2, 0.4);
    scene.add(interiorStripLight);

    /* ── Floating Space Dust Particles ── */
    const particleCount = 180;
    const particlesGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);
    for(let i = 0; i < particleCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 16;
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.03,
      color: theme === 'light' ? 0x88aa88 : 0x00f3ff,
      transparent: true,
      opacity: theme === 'light' ? 0.2 : 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const particleMesh = new THREE.Points(particlesGeo, particleMat);
    scene.add(particleMesh);

    /* ── Showroom Holographic Grid Floor ── */
    const grid = new THREE.GridHelper(30, 60, isLight ? '#cbd5e1' : '#00f3ff', isLight ? '#e2e8f0' : '#112222');
    gridRef.current = grid;
    (grid.material as THREE.Material).opacity = isLight ? 0.25 : 0.08;
    (grid.material as THREE.Material).transparent = true;
    grid.position.y = -2; 
    scene.add(grid);

    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: isLight ? '#e2e8f0' : '#030806', 
      roughness: 0.8, 
      metalness: 0.2, 
      transparent: true, 
      opacity: isLight ? 0.25 : 0.4 
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    groundRef.current = ground;
    ground.rotation.x = -Math.PI / 2; 
    ground.position.y = -2; 
    ground.receiveShadow = true;
    scene.add(ground);

    /* ── Animation & Interaction State ── */
    const INIT_ANGLE = Math.PI * 0.28;
    const st = { 
      progress: 0, 
      target: 0, 
      time: 0, 
      angle: INIT_ANGLE,
      dragRotX: 0,
      dragRotY: 0,
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0
    };
    let modelWrapperGroup: THREE.Group | null = null;

    /* ── Screen UI Texture ── */
    const screenTexture = createScreenTexture(t, locale);

    /* ── Premium Architectural & Hardware Materials ── */
    const matChassis = new THREE.MeshPhysicalMaterial({ 
      color: 0x364150, 
      roughness: 0.36, 
      metalness: 0.82, 
      clearcoat: 0.4, 
      clearcoatRoughness: 0.2 
    });

    // Smoked tempered architectural glass with specular highlights
    const matMainDoor = new THREE.MeshPhysicalMaterial({ 
      color: 0x142432, 
      metalness: 0.08, 
      roughness: 0.06, 
      transmission: 0.78, 
      transparent: true, 
      opacity: 0.95, 
      ior: 1.52, 
      thickness: 0.35, 
      clearcoat: 1.0, 
      clearcoatRoughness: 0.05,
      reflectivity: 0.9
    });

    // Smoked acrylic individual safe doors
    const matSafeDoor = new THREE.MeshPhysicalMaterial({ 
      color: 0x0a1c26, 
      metalness: 0.05, 
      roughness: 0.1, 
      transmission: 0.84, 
      transparent: true, 
      opacity: 0.92, 
      ior: 1.48, 
      thickness: 0.15, 
      clearcoat: 0.95 
    });

    const matSafe = new THREE.MeshPhysicalMaterial({ 
      color: 0x161e28, 
      roughness: 0.65, 
      metalness: 0.55, 
      clearcoat: 0.15 
    });

    // Realistic Touchscreen Display Material
    const matScreen = new THREE.MeshStandardMaterial({ 
      color: 0xffffff,
      map: screenTexture,
      emissive: 0xffffff,
      emissiveMap: screenTexture,
      emissiveIntensity: 0.85,
      roughness: 0.15, 
      metalness: 0.2 
    });

    const matHardware = new THREE.MeshPhysicalMaterial({ 
      color: 0x94a3b8, 
      roughness: 0.25, 
      metalness: 0.95, 
      clearcoat: 0.4 
    });

    const matBME = new THREE.MeshPhysicalMaterial({ 
      color: 0x10b981, 
      roughness: 0.35, 
      metalness: 0.6, 
      emissive: 0x059669, 
      emissiveIntensity: 0.45, 
      clearcoat: 0.3 
    });

    /* ── References filled on load ── */
    const mainDoorHinges: { hinge: THREE.Group; dir: number }[] = [];
    const safeDoorHinges: { hinge: THREE.Group; dir: number }[] = [];
    const bmeObjects: THREE.Object3D[] = [];
    const labels: { group: THREE.Group; target: THREE.Object3D; anchorLocal: THREE.Vector3 }[] = [];

    /* ── Load 3D Model ── */
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
          mesh.castShadow = true; 
          mesh.receiveShadow = true;
        }
      });

      // Helper to apply material
      const applyMat = (obj: THREE.Object3D | undefined, mat: THREE.Material) => {
        if (!obj) return;
        obj.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).material = mat;
          }
        });
      };

      // Apply chassis materials
      const fridgeBodyParts = [
        parts['fridge_bottom'], parts['fridge_top'], parts['fridge_left'], parts['fride_right'], parts['fridge_back']
      ];
      fridgeBodyParts.forEach(p => applyMat(p, matChassis));

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

      // Attach components to the left door so they swing with it
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
      
      // Wrapper for floating animation and user drag rotation
      const wrapper = new THREE.Group();
      wrapper.add(model);
      scene.add(wrapper);
      scene.updateMatrixWorld(true);
      modelWrapperGroup = wrapper;

      // ── Create hinges for main doors ──
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

      // ── Clean HUD Labels ──
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
        spr.visible = true;
        group.add(spr);

        const line = makeLeaderLine(new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0, topOffset - 0.1, 0));
        line.visible = true;
        group.add(line);

        group.position.copy(centerWorld);
        scene.add(group);

        const anchorLocal = target.worldToLocal(centerWorld.clone());
        labels.push({ group, target, anchorLocal });
        return labels.length - 1;
      };

      // Annotation labels
      const lblMainDoor1 = mainDoor1 ? addLabel(t("hudTemperedGlassDoor", "TEMPERED GLASS DOOR"), mainDoor1, 0.4) : -1;
      const lblScreen = screen ? addLabel(t("hudKioskTouchscreen", "KIOSK TOUCHSCREEN DISPLAY"), screen, 0.35) : -1;
      const lblSafe1 = safeBases[1] ? addLabel(t("hudSafe1Compartment", "SAFE 1 COMPARTMENT"), safeBases[1], 0.12) : -1;
      const lblSafe4 = safeBases[4] ? addLabel(t("hudSafe4Compartment", "SAFE 4 COMPARTMENT"), safeBases[4], 0.12) : -1;
      const lblSolenoid1 = parts['safe_1_lock'] ? addLabel(t("hudAutonomousSolenoid", "AUTONOMOUS SOLENOID LOCK"), parts['safe_1_lock'], 0.18) : -1;
      const lblESP = esp ? addLabel(t("hudEsp32Core", "ESP32-S3 CORE CONTROLLER"), esp, 0.25) : -1;
      const lblI2C = i2c ? addLabel(t("hudI2cMultiplexer", "I²C MULTIPLEXER"), i2c, 0.25) : -1;
      const lblBME = bmeObjects.length > 0 ? addLabel(t("hudBme688Sensor", "BME688 AI SENSOR UNIT"), bmeObjects[0], 0.16) : -1;

      /* Helper to show/hide label */
      const setLabelVis = (idx: number, vis: boolean) => {
        if (idx < 0 || idx >= labels.length) return;
        labels[idx].group.visible = vis;
      };

      /* ══════════════════════════════════════════════
         SCROLL PHASES — cinematic disassembly
         Phase 0 (0.00–0.05): Hero Overview
         Phase 1 (0.05–0.30): Main Doors Opening
         Phase 2 (0.30–0.55): 8 Internal SAFEs Revealed
         Phase 3 (0.55–0.80): SAFE Doors Opening
         Phase 4 (0.80–1.00): BME688 Sensor Macro Focus
      ══════════════════════════════════════════════ */
      const applyAnimation = (p: number) => {
        const p1 = easeInOut(phase(p, 0.05, 0.30)); 
        const p2 = easeInOut(phase(p, 0.30, 0.55)); 
        const rawP3 = phase(p, 0.55, 0.80); 
        const p3 = easeInOut(rawP3); 
        const p4 = easeInOut(phase(p, 0.80, 1.00)); 

        // ── Phase 1: Main doors open ──
        mainDoorHinges.forEach(({ hinge, dir }, i) => {
          const staggerStart = i === 0 ? 0 : 0.12;
          const staggerEnd = i === 0 ? 0.88 : 1.0;
          const localP = clamp01((phase(p, 0.05, 0.30) - staggerStart) / (staggerEnd - staggerStart));
          const p1Stagger = easeOutBack(localP);
          hinge.rotation.y = dir * p1Stagger * (Math.PI / 2.15);
        });

        // Interior illumination turns on
        innerLight.intensity = p1 * 1.6;
        interiorStripLight.intensity = p1 * 1.8;

        // Dynamic Label Positions (sticks to moving targets)
        labels.forEach(lbl => {
          if (lbl.group.visible) {
            lbl.target.updateWorldMatrix(true, false);
            lbl.group.position.copy(lbl.target.localToWorld(lbl.anchorLocal.clone()));
          }
        });

        // Labels Choreography
        if (lblMainDoor1 >= 0) setLabelVis(lblMainDoor1, p > 0.02 && p < 0.22);
        if (lblScreen >= 0) setLabelVis(lblScreen, p > 0.02 && p < 0.22);
        if (lblESP >= 0) setLabelVis(lblESP, p1 > 0.6 && p < 0.55);
        if (lblI2C >= 0) setLabelVis(lblI2C, p1 > 0.6 && p < 0.55);

        // Phase 2: Internal Safes Revealed
        if (lblSafe1 >= 0) setLabelVis(lblSafe1, p2 > 0.3 && p < 0.78);
        if (lblSafe4 >= 0) setLabelVis(lblSafe4, p2 > 0.3 && p < 0.78);

        // ── Phase 3: SAFE doors open ──
        safeDoorHinges.forEach(({ hinge, dir }, i) => {
          const staggerStart = safeDoorHinges.length ? (i / safeDoorHinges.length) * 0.45 : 0;
          const staggerEnd = staggerStart + 0.55;
          const localP = clamp01((rawP3 - staggerStart) / (staggerEnd - staggerStart));
          const p3Stagger = easeOutBack(localP);
          hinge.rotation.y = dir * p3Stagger * (Math.PI / 2.3);
        });
        
        if (lblSolenoid1 >= 0) setLabelVis(lblSolenoid1, p3 > 0.35 && p < 0.85);

        // ── Phase 4: BME688 focus ──
        if (lblBME >= 0) {
          setLabelVis(lblBME, p4 > 0.4);
          const s = lerp(1, 0.4, p4);
          labels[lblBME].group.scale.set(s, s, s);
        }

        // Highlight BME688 emissive during phase 4
        bmeObjects.forEach(obj => {
          const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (m && m.emissiveIntensity !== undefined) {
            m.emissiveIntensity = 0.4 + p4 * 0.4;
          }
        });

        // ── Cinematic Camera Choreography ──
        let camR = 7.5;
        let camY = 0.4;
        let lookX = 0;
        let lookY = 0.1;
        let lookZ = 0;
        let orbitAngle = INIT_ANGLE;
        let camFov = 38;

        // Move 1: Hero to Reveal (0.0 to 0.3)
        const p1_cam = clamp01(p / 0.3);
        const e1 = easeInOut(p1_cam);
        camR = lerp(camR, 5.2, e1);
        camY = lerp(camY, 1.4, e1);
        lookY = lerp(lookY, 0.2, e1);
        orbitAngle += e1 * Math.PI * 0.12;

        // Move 2: Push in to Safe Array (0.3 to 0.55)
        const p2_cam = clamp01((p - 0.3) / 0.25);
        const e2 = easeInOut(p2_cam);
        camR = lerp(camR, 4.4, e2);
        camY = lerp(camY, 0.8, e2);
        lookY = lerp(lookY, 0.15, e2);
        lookX = lerp(lookX, -0.15, e2);
        orbitAngle -= e2 * Math.PI * 0.14;
        camFov = lerp(camFov, 35, e2);

        // Move 3: Safe Doors Open (0.55 to 0.8)
        const p3_cam = clamp01((p - 0.55) / 0.25);
        const e3 = easeInOut(p3_cam);
        camR = lerp(camR, 3.6, e3);
        camY = lerp(camY, 0.5, e3);
        lookY = lerp(lookY, 0.15, e3);
        lookX = lerp(lookX, 0.08, e3);
        orbitAngle += e3 * Math.PI * 0.10;
        camFov = lerp(camFov, 38, e3);

        // Move 4: Crisp Macro Zoom into BME688 (0.8 to 1.0)
        const p4_cam = clamp01((p - 0.8) / 0.2);
        const e4 = easeInOut(p4_cam);
        
        // Add interactive user drag rotation
        orbitAngle += st.dragRotX;
        camY += st.dragRotY;

        let orbitCamX = Math.cos(orbitAngle) * camR;
        let orbitCamZ = Math.sin(orbitAngle) * camR;
        let orbitCamY = camY + Math.sin(st.time * 1.5) * 0.05;
        
        let finalCamPos = new THREE.Vector3(orbitCamX, orbitCamY, orbitCamZ);
        
        if (e4 > 0 && bmeObjects.length > 0) {
          const bmePos = new THREE.Vector3();
          bmeObjects[0].getWorldPosition(bmePos);
          
          // Clean macro framing that doesn't clip or blow out
          const idealCamPos = new THREE.Vector3(
             bmePos.x + 0.28,
             bmePos.y + 0.12,
             bmePos.z + 0.65
          );
          
          finalCamPos.lerp(idealCamPos, e4);
          lookX = lerp(lookX, bmePos.x, e4);
          lookY = lerp(lookY, bmePos.y, e4);
          lookZ = lerp(lookZ, bmePos.z, e4);
          camFov = lerp(camFov, 34, e4);
        }

        // Apply FOV changes
        if (Math.abs(camera.fov - camFov) > 0.01) {
          camera.fov = camFov;
          camera.updateProjectionMatrix();
        }

        // Dynamic label pulse effect
        labels.forEach(lbl => {
          if (lbl.group.visible) {
            const scale = 1.0 + Math.sin(st.time * 3.0 + lbl.group.id) * 0.04;
            if (lbl.group.id !== (lblBME >= 0 ? labels[lblBME].group.id : -1)) {
               lbl.group.scale.set(scale, scale, scale);
            }
          }
        });

        // Mouse parallax
        mouse.lerp(targetMouse, 0.06);
        const parallaxStrength = 0.3;
        finalCamPos.x += mouse.x * parallaxStrength;
        finalCamPos.y += mouse.y * parallaxStrength;

        camera.position.copy(finalCamPos);
        camera.lookAt(lookX, lookY, lookZ);
        camera.rotation.z = mouse.x * -0.03;

        // Report phase
        if (onPhaseChange) {
          if (p < 0.05) onPhaseChange(0);
          else if (p < 0.30) onPhaseChange(1);
          else if (p < 0.55) onPhaseChange(2);
          else if (p < 0.80) onPhaseChange(3);
          else onPhaseChange(4);
        }
      };

      animateFn = applyAnimation;
    }, undefined, (err) => console.error('Model load error:', err));

    /* ── Mouse & Touch Parallax / Orbit Drag ── */
    const mouse = new THREE.Vector2(0, 0);
    const targetMouse = new THREE.Vector2(0, 0);

    const onMouseMove = (e: MouseEvent) => {
      targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      if (st.isDragging) {
        const dx = e.clientX - st.lastMouseX;
        const dy = e.clientY - st.lastMouseY;
        st.dragRotX += dx * 0.005;
        st.dragRotY = Math.max(-0.8, Math.min(0.8, st.dragRotY - dy * 0.005));
        st.lastMouseX = e.clientX;
        st.lastMouseY = e.clientY;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      // Don't drag if clicking buttons
      if ((e.target as HTMLElement)?.tagName === 'A' || (e.target as HTMLElement)?.tagName === 'BUTTON') return;
      st.isDragging = true;
      st.lastMouseX = e.clientX;
      st.lastMouseY = e.clientY;
    };

    const onMouseUp = () => {
      st.isDragging = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

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
      st.progress += (st.target - st.progress) * 0.06;

      // Smoothly return user drag rotation back to baseline when not dragging
      if (!st.isDragging) {
        st.dragRotX *= 0.95;
        st.dragRotY *= 0.95;
      }

      if (animateFn) animateFn(st.progress);
      if (onProgressChange) onProgressChange(st.progress);

      bloom.strength = (theme === 'light' ? 0.05 : 0.18) + Math.sin(st.progress * Math.PI) * 0.05;
      
      if (modelWrapperGroup) {
        // Subtle floating effect
        modelWrapperGroup.position.y = Math.sin(st.time * 1.8) * 0.04;
      }
      
      if (particleMesh) {
        particleMesh.rotation.y = st.time * 0.04;
        particleMesh.position.y = Math.sin(st.time * 0.5) * 0.15;
      }

      composer.render();
    };
    animate();

    /* ── Responsive Resize ── */
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h; 
      camera.updateProjectionMatrix();
      renderer.setSize(w, h); 
      composer.setSize(w, h);
    };
    onResize();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      if (el && renderer.domElement.parentNode === el) {
        el.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [onProgressChange, onPhaseChange, theme, locale, t]);

  return (
    <>
      <div 
        ref={mountRef} 
        style={{
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh',
          background: theme === 'light' 
            ? 'radial-gradient(circle at 50% 45%, #f1f5f9 0%, #e2e8f0 100%)'
            : 'radial-gradient(circle at 50% 45%, #0a1618 0%, #020706 90%)',
          overflow: 'hidden', 
          zIndex: 0,
        }} 
      />
      <div 
        ref={wrapperRef} 
        style={{
          position: 'relative', 
          height: '450vh', 
          width: '100%', 
          pointerEvents: 'none',
        }} 
      />
    </>
  );
};

export default LockerModel;
