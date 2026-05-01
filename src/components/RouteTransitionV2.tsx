import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
// @ts-ignore
import * as THREE from "three";
import { useTranslation } from "../store/useTranslation";

const routeDepth: Record<string, number> = {
  "/connect": 0,
  "/": 1,
  "/donate": 2,
  "/receive": 2,
  "/admin": 3,
  "/admin/sign-in": 4
};

function routeKey(pathname: string) {
  if (pathname === "/connect") return "connect";
  if (pathname === "/donate") return "donor";
  if (pathname === "/receive") return "receive";
  if (pathname === "/admin") return "admin";
  return "mode";
}

export function RouteTransitionV2() {
  const location = useLocation();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const prevDepth = useRef(routeDepth[location.pathname] || 0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const firstRender = useRef(true);
  const key = routeKey(location.pathname);

  const copy = useMemo(
    () => ({
      title: t(`transition${key[0].toUpperCase()}${key.slice(1)}Title`),
      body: t(`transition${key[0].toUpperCase()}${key.slice(1)}Body`)
    }),
    [key, t]
  );

  useEffect(() => {
    const currentDepth = routeDepth[location.pathname] || 0;
    if (currentDepth > prevDepth.current) {
      setDirection("forward");
    } else if (currentDepth < prevDepth.current) {
      setDirection("back");
    }
    prevDepth.current = currentDepth;

    if (firstRender.current) {
      firstRender.current = false;
      if (!sessionStorage.getItem("ecolocker-splash-seen")) {
        setVisible(false);
        return;
      }
    }

    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), 2400); // Reduced time for snappier feel
    return () => window.clearTimeout(timeout);
  }, [location.pathname]);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.5, 7.6);

    const ambient = new THREE.AmbientLight(0xf9f1df, 1.5);
    const keyLight = new THREE.DirectionalLight(0xfff0d6, 3.2);
    keyLight.position.set(5, 6, 7);
    const rim = new THREE.DirectionalLight(0x79b7bc, 1.4);
    rim.position.set(-4, 3, -5);
    scene.add(ambient, keyLight, rim);

    const group = new THREE.Group();
    scene.add(group);

    const baseMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x2c6a5a,
      roughness: 0.35,
      metalness: 0.12,
      transmission: 0.06,
      thickness: 0.8,
      clearcoat: 0.55,
      clearcoatRoughness: 0.22
    });
    const acrylicMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xe9e1cf,
      transparent: true,
      opacity: 0.16,
      roughness: 0.08,
      metalness: 0,
      transmission: 0.88,
      thickness: 1.2,
      clearcoat: 1
    });
    const chipMaterial = new THREE.MeshStandardMaterial({ color: 0x101e1a, roughness: 0.42, metalness: 0.4 });
    const sensorMaterial = new THREE.MeshStandardMaterial({ color: 0xd8b084, roughness: 0.52, metalness: 0.1 });
    const wireMaterial = new THREE.MeshStandardMaterial({ color: 0x87b094, roughness: 0.5, metalness: 0.2 });

    const platform = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.22, 3.6), baseMaterial);
    platform.position.y = -1.3;
    group.add(platform);

    const controller = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 1.6), chipMaterial);
    controller.position.set(-0.7, -0.7, 0.25);
    group.add(controller);

    const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), sensorMaterial);
    sensor.position.set(1.05, -0.55, 0.75);
    group.add(sensor);

    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.32, 0.1), new THREE.MeshStandardMaterial({ color: 0xefe4d3, roughness: 0.18 }));
    phone.position.set(-1.22, -0.32, 1.26);
    phone.rotation.y = 0.32;
    group.add(phone);

    const panels = [
      new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.06, 3.7), acrylicMaterial),
      new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.5, 3.7), acrylicMaterial),
      new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.5, 3.7), acrylicMaterial),
      new THREE.Mesh(new THREE.BoxGeometry(3.7, 2.5, 0.06), acrylicMaterial),
      new THREE.Mesh(new THREE.BoxGeometry(3.7, 2.5, 0.06), acrylicMaterial)
    ];
    panels[0].position.set(0, 1.2, 0);
    panels[1].position.set(-1.85, 0, 0);
    panels[2].position.set(1.85, 0, 0);
    panels[3].position.set(0, 0, -1.85);
    panels[4].position.set(0, 0, 1.85);
    panels.forEach((panel) => group.add(panel));

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(3.7, 2.5, 3.7)),
      new THREE.LineBasicMaterial({ color: 0xf8f0de, transparent: true, opacity: 0.55 })
    );
    group.add(edges);

    const arcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.15, -0.7, 0.6),
      new THREE.Vector3(-0.25, -0.15, 0.25),
      new THREE.Vector3(0.75, -0.4, 0.65)
    ]);
    const wire = new THREE.Mesh(new THREE.TubeGeometry(arcCurve, 48, 0.028, 8, false), wireMaterial);
    group.add(wire);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.95, 0.03, 20, 120),
      new THREE.MeshBasicMaterial({ color: 0xeec693, transparent: true, opacity: 0.4 })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = -0.1;
    group.add(halo);

    const clock = new THREE.Clock();

    const resize = () => {
      const width = canvas.clientWidth || 720;
      const height = canvas.clientHeight || 420;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    window.addEventListener("resize", resize);

    let frame = 0;

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const progress = Math.min(elapsed / 2.2, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const reverse = 1 - eased;

      group.rotation.y = 0.24 + elapsed * 0.15;
      group.rotation.x = -0.18 + Math.sin(elapsed * 0.28) * 0.02;

      platform.position.y = -1.3 + reverse * 1.7;
      controller.position.x = -0.7 - reverse * 1.8;
      sensor.position.z = 0.75 + reverse * 1.8;
      phone.position.y = -0.32 + reverse * 1.5;

      panels[0].position.y = 1.2 + reverse * 1.9;
      panels[1].position.x = -1.85 - reverse * 2.2;
      panels[2].position.x = 1.85 + reverse * 2.2;
      panels[3].position.z = -1.85 - reverse * 2.2;
      panels[4].position.z = 1.85 + reverse * 2.2;

      halo.scale.setScalar(0.9 + eased * 0.18);
      halo.material.opacity = 0.12 + Math.sin(elapsed * 1.8) * 0.05 + eased * 0.12;
      edges.material.opacity = 0.12 + eased * 0.55;

      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      scene.traverse((object: any) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material: any) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
        if (object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          if (!Array.isArray(object.material)) {
            object.material.dispose();
          }
        }
      });
    };
  }, [visible, location.pathname]);

  return (
    <div 
      className={`route-transition-overlay is-${direction} ${visible ? "is-visible" : "is-hidden"}`} 
      aria-hidden="true"
      onClick={() => setVisible(false)}
      style={{ cursor: visible ? 'pointer' : 'default' }}
    >
      <div className="route-transition-card route-transition-card-premium">
        <div className="route-transition-scene">
          <canvas ref={canvasRef} className="route-transition-canvas" />
        </div>
        <div className="transition-copy">
          <p className="eyebrow">EcoLocker transition</p>
          <h3>{copy.title}</h3>
          <p>{copy.body}</p>
          <div className="transition-legend">
            <span>Base frame</span>
            <span>Phone + controller</span>
            <span>Sensors + wiring</span>
            <span>Acrylic shell</span>
          </div>
        </div>
      </div>
    </div>
  );
}

