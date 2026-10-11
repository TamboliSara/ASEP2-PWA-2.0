/**
 * ChamberCamPage.tsx — Permanent IoT Smart Camera Node
 * 
 * Route: /chamber-lens
 * Usage:
 *   Opened ONCE on the smartphone permanently mounted inside the locker.
 *   Acts as an embedded optical sensor node.
 * 
 * Capabilities:
 *   - Secure Context Guard: 1-tap switch to HTTPS with clear guidance for Android Chrome
 *   - Resilient Multi-Tier Camera Access (Rear environment -> Rear -> Any)
 *   - Dual-Mode Torch: Hardware LED Flash + High-Lumen Screen Illuminator
 *   - OLED Stealth Black Mode: 0% power, zero heat in sealed compartment
 *   - Screen WakeLock: prevents sleep when locker door closes
 *   - Dual-Path Streaming: WebRTC P2P (<50ms) + Firebase RTDB JPEG snapshots (~2 FPS fallback)
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { set, onValue } from "firebase/database";
import { chamberCameraRef, chamberCameraSignalingRef } from "../services/firebase";
import { HARDWARE_LOCKER_ID } from "../store/appState";
import { yoloVisionEngine, type DetectedObject } from "../features/camera/yoloVisionEngine";
import { 
  Camera, 
  Flashlight, 
  EyeOff, 
  Radio, 
  AlertCircle, 
  ShieldAlert,
  RefreshCw,
  Sun,
  Lock,
  ArrowRight,
  ExternalLink,
  SwitchCamera,
  Smartphone,
  Unplug
} from "lucide-react";

export function ChamberCamPage() {
  const [searchParams] = useSearchParams();
  const lockerId = searchParams.get("locker") || HARDWARE_LOCKER_ID;

  // Unique session ID for this specific phone instance
  const [sessionId] = useState(() => {
    const existing = sessionStorage.getItem("safe_chamber_session_id");
    if (existing) return existing;
    const newId = "dev_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now().toString(36);
    sessionStorage.setItem("safe_chamber_session_id", newId);
    return newId;
  });

  const [deviceLabel] = useState(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    return isIOS ? "iPhone" : isAndroid ? "Android Phone" : "Desktop Browser";
  });

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || 
    (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
  const allowDesktop = searchParams.get("allowDesktop") === "true";
  const isDesktopBlocked = !isMobile && !allowDesktop;

  const [displacedByOtherDevice, setDisplacedByOtherDevice] = useState(false);
  const [detectedItem, setDetectedItem] = useState<DetectedObject | null>(null);
  const detectedItemRef = useRef<DetectedObject | null>(null);
  const [detectedItems, setDetectedItems] = useState<DetectedObject[]>([]);
  const [otherDeviceLabel, setOtherDeviceLabel] = useState<string>("Another phone");

  const [isStreaming, setIsStreaming] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [screenTorchOn, setScreenTorchOn] = useState(false);
  const [stealthMode, setStealthMode] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [sentFrames, setSentFrames] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isRetrying, setIsRetrying] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const rtdbSyncIntervalRef = useRef<any>(null);
  const wakeLockRef = useRef<any>(null);
  const toastTimeoutRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check if browser is blocking camera due to plain HTTP
  const isHttp = window.location.protocol === "http:";
  const isRemoteIp = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
  const isInsecureContext = isHttp && isRemoteIp;

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMsg(null), 3000);
  }, []);

  const handleCapturePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setSentFrames(prev => prev + 1);
        setIsStreaming(true);
        showToast("Chamber Photo Synced to Kiosk!");
        await set(chamberCameraRef(lockerId), {
          connected: true,
          activeSessionId: sessionId,
          deviceLabel,
          latestFrame: dataUrl,
          torchActive: torchOn || screenTorchOn,
          fps: 1,
          lastHeartbeat: Date.now()
        });
        try {
          const bc = new BroadcastChannel("safe_chamber_cam_sync");
          bc.postMessage({
            lockerId,
            activeSessionId: sessionId,
            deviceLabel,
            connected: true,
            latestFrame: dataUrl,
            timestamp: Date.now()
          });
          bc.close();
        } catch {}
      }
    };
    reader.readAsDataURL(file);
  };

  // ── 1. Screen WakeLock API ───────────────────────────────────────────
  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        setWakeLockActive(true);
        wakeLockRef.current.addEventListener("release", () => {
          setWakeLockActive(false);
        });
      }
    } catch (e) {
      console.warn("[Chamber Lens] WakeLock unavailable:", e);
    }
  };

  // ── 2. Initialize Camera with Multi-Tier Fallback ────────────────────
  const startCamera = async (facing: "environment" | "user" = facingMode) => {
    setIsRetrying(true);
    setErrorMsg(null);

    // Stop existing stream if any
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    // Safety check for getUserMedia availability
    if (!navigator.mediaDevices?.getUserMedia) {
      setIsRetrying(false);
      setErrorMsg("Mobile browser blocks camera over plain HTTP. Tap 'Switch to HTTPS (Port 5174)' below or snap a photo with Native Camera.");
      return;
    }

    try {
      let stream: MediaStream | null = null;

      // Tier 1: Ideal high-resolution rear camera
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 }
          },
          audio: false
        });
      } catch (e1) {
        console.warn("[Chamber Lens] Tier 1 camera constraints failed, attempting fallback...", e1);
        // Tier 2: Basic facing mode constraint
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing },
            audio: false
          });
        } catch (e2) {
          console.warn("[Chamber Lens] Tier 2 camera constraints failed, attempting basic video...", e2);
          // Tier 3: Any available video stream
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      if (!stream) {
        throw new Error("No video stream returned by device.");
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("[Chamber Lens] Video auto-play restricted, user interaction needed:", playErr);
        }
      }

      setIsStreaming(true);
      showToast("Chamber Camera Active");
      await requestWakeLock();
      initWebRtcSignaling(stream);
      startRtdbSync();
    } catch (err: any) {
      console.error("[Chamber Lens] Camera error:", err);
      setIsStreaming(false);

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setErrorMsg("Camera permission denied. Tap the lock/tune icon in the browser address bar to allow Camera access.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setErrorMsg("No camera device found on this smartphone.");
      } else if (err.name === "NotReadableError") {
        setErrorMsg("Camera is in use by another app. Please close other camera apps and retry.");
      } else {
        setErrorMsg(err.message || "Failed to initialize camera. Tap Retry below.");
      }
    } finally {
      setIsRetrying(false);
    }
  };

  // ── 3. Toggle Physical Hardware LED Torch or Screen Illuminator ──────
  const toggleTorch = async () => {
    // If hardware camera is running, try hardware LED torch first
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities: any = track.getCapabilities?.() || {};
          if (capabilities.torch) {
            const nextState = !torchOn;
            await (track as any).applyConstraints({
              advanced: [{ torch: nextState }]
            });
            setTorchOn(nextState);
            setScreenTorchOn(false);
            showToast(nextState ? "Hardware LED Torch: ON" : "Hardware LED Torch: OFF");
            return;
          }
        } catch (e) {
          console.warn("[Chamber Lens] Hardware torch applyConstraints error:", e);
        }
      }
    }

    // Fallback: Screen Illuminator mode (glows bright white to illuminate sealed locker)
    const nextScreenTorch = !screenTorchOn;
    setScreenTorchOn(nextScreenTorch);
    setTorchOn(false);
    showToast(nextScreenTorch ? "Screen Illuminator: ON (White Glow)" : "Illuminator: OFF");
  };

  // ── 4. Flip Camera (Front / Rear) ────────────────────────────────────
  const handleFlipCamera = () => {
    const nextFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacing);
    startCamera(nextFacing);
    showToast(`Switched to ${nextFacing === "environment" ? "Rear" : "Front"} Camera`);
  };

  // ── 5. Switch to HTTPS 1-Tap Handler ──────────────────────────────────
  const handleSwitchToHttps = () => {
    const targetUrl = `https://${window.location.hostname}:5174${window.location.pathname}${window.location.search}`;
    window.location.href = targetUrl;
  };

  // ── 6. WebRTC Publisher Engine ───────────────────────────────────────
  const initWebRtcSignaling = async (stream: MediaStream) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ]
      });

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = async (event) => {
        if (!event.candidate) {
          const offer = pc.localDescription;
          if (offer) {
            await set(chamberCameraSignalingRef(lockerId), {
              offer: { type: offer.type, sdp: offer.sdp },
              offeredAt: Date.now()
            });
          }
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      peerConnectionRef.current = pc;

      // Listen for Answer from laptop PWA
      onValue(chamberCameraSignalingRef(lockerId), async (snap) => {
        const data = snap.val();
        if (data?.answer && pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log("[Chamber Lens] WebRTC peer connection established with PWA!");
        }
      });
    } catch (e) {
      console.warn("[Chamber Lens] WebRTC signaling notice:", e);
    }
  };

  // ── 7. RTDB Compressed Snapshot Sync (~2 FPS) ────────────────────────
  const startRtdbSync = () => {
    if (rtdbSyncIntervalRef.current) clearInterval(rtdbSyncIntervalRef.current);

    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");

    let count = 0;
    rtdbSyncIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !ctx || videoRef.current.readyState < 2) return;
      try {
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.55);

        count++;
        setSentFrames(count);

        const curDetected = detectedItemRef.current;
        const isCurFood = Boolean(curDetected && !curDetected.label.toLowerCase().includes("person") && curDetected.category !== "general_item");

        await set(chamberCameraRef(lockerId), {
          connected: true,
          activeSessionId: sessionId,
          deviceLabel,
          latestFrame: dataUrl,
          torchActive: torchOn || screenTorchOn,
          fps: 15,
          isFoodPresent: isCurFood,
          detectedLabel: curDetected?.label || "",
          confidence: curDetected?.score || 0,
          lastHeartbeat: Date.now()
        });

        try {
          const bc = new BroadcastChannel("safe_chamber_cam_sync");
          bc.postMessage({
            lockerId,
            activeSessionId: sessionId,
            deviceLabel,
            connected: true,
            latestFrame: dataUrl,
            isFoodPresent: isCurFood,
            detectedLabel: curDetected?.label || "",
            confidence: curDetected?.score || 0,
            timestamp: Date.now()
          });
          bc.close();
        } catch {}
      } catch (e) {
        // Suppress interval errors
      }
    }, 180);
  };

  // ── 7.1 Real-Time Local AI Object Detection on Phone ─────────────────
  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const res = await yoloVisionEngine.analyzeFrame(videoRef.current);
        setDetectedItems(res.detectedObjects);
        if (res.detectedObjects.length > 0) {
          const foodObj = res.detectedObjects.find(o => 
            o.category === "fruit" || 
            o.category === "vegetable" || 
            o.category === "cooked_meal" || 
            o.category === "container" || 
            o.category === "beverage" || 
            o.category === "bakery"
          );
          const topItem = foodObj || res.detectedObjects[0];
          detectedItemRef.current = topItem;
          setDetectedItem(topItem);
        } else {
          detectedItemRef.current = null;
          setDetectedItem(null);
        }
      } catch {}
    }, 100);
    return () => clearInterval(interval);
  }, [isStreaming]);

  // ── 8. Displacement Watcher: Detect when another phone connects ───────
  useEffect(() => {
    const camRef = chamberCameraRef(lockerId);
    const unsub = onValue(camRef, (snap) => {
      const data = snap.val();
      if (!data) return;

      // If another device claimed this chamber camera, displace this device
      if (data.activeSessionId && data.activeSessionId !== sessionId) {
        console.warn("[Chamber Lens] Another phone took over this chamber:", data.activeSessionId);
        setDisplacedByOtherDevice(true);
        if (data.deviceLabel) setOtherDeviceLabel(data.deviceLabel);
        setIsStreaming(false);

        // Turn off illumination and screen modes
        setTorchOn(false);
        setScreenTorchOn(false);
        setStealthMode(false);

        // Release camera hardware tracks immediately
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (rtdbSyncIntervalRef.current) {
          clearInterval(rtdbSyncIntervalRef.current);
          rtdbSyncIntervalRef.current = null;
        }
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
      }
    });

    // Also listen on BroadcastChannel for instant same-browser cross-tab displacement
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("safe_chamber_cam_sync");
      bc.onmessage = (event) => {
        if (event.data?.lockerId === lockerId && event.data?.activeSessionId && event.data.activeSessionId !== sessionId) {
          setDisplacedByOtherDevice(true);
          if (event.data.deviceLabel) setOtherDeviceLabel(event.data.deviceLabel);
          setIsStreaming(false);
          setTorchOn(false);
          setScreenTorchOn(false);
          setStealthMode(false);

          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          if (rtdbSyncIntervalRef.current) {
            clearInterval(rtdbSyncIntervalRef.current);
            rtdbSyncIntervalRef.current = null;
          }
        }
      };
    } catch {}

    return () => {
      unsub();
      bc?.close();
    };
  }, [lockerId, sessionId]);

  useEffect(() => {
    if (isDesktopBlocked) {
      // Clear any camera state previously sent by this tab or desktop
      set(chamberCameraRef(lockerId), {
        connected: false,
        activeSessionId: "",
        latestFrame: "",
        lastHeartbeat: 0
      }).catch(() => {});
      return;
    }

    startCamera();

    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (rtdbSyncIntervalRef.current) clearInterval(rtdbSyncIntervalRef.current);
      if (peerConnectionRef.current) peerConnectionRef.current.close();
      if (wakeLockRef.current) wakeLockRef.current.release();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      set(chamberCameraRef(lockerId), {
        connected: false,
        activeSessionId: "",
        latestFrame: "",
        lastHeartbeat: 0
      }).catch(() => {});
    };
  }, [lockerId, isDesktopBlocked]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      set(chamberCameraRef(lockerId), {
        connected: false,
        activeSessionId: "",
        latestFrame: "",
        lastHeartbeat: 0
      }).catch(() => {});
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [lockerId]);

  return (
    <div className={`min-h-screen ${screenTorchOn ? "bg-white text-slate-900" : "bg-slate-950 text-slate-100"} flex flex-col font-sans select-none overflow-x-hidden relative transition-colors duration-300`}>
      {/* ── Toast Notification Pill ── */}
      {toastMsg && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full bg-slate-900/95 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold shadow-2xl backdrop-blur-md animate-fade-in flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ── Displaced / Overridden by Another Device Screen ── */}
      {displacedByOtherDevice && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/98 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center select-none animate-fade-in">
          <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border-2 border-rose-500/30 flex items-center justify-center text-rose-400 mb-5 shadow-2xl shadow-rose-500/10">
            <Unplug className="w-10 h-10 animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-mono font-bold mb-3">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
            <span>SESSION DISCONNECTED</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
            Another Device Connected
          </h2>

          <p className="text-sm text-slate-300 max-w-sm mx-auto leading-relaxed mb-3">
            Another mobile phone (<span className="text-white font-semibold font-mono">{otherDeviceLabel}</span>) just scanned the QR code and took over streaming for <strong className="text-emerald-400">Chamber #1</strong>.
          </p>

          <p className="text-xs text-slate-400 max-w-xs mx-auto mb-8 leading-normal">
            This phone's camera has been automatically stopped and released to prevent conflicts and conserve battery.
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={() => {
                setDisplacedByOtherDevice(false);
                startCamera();
              }}
              className="w-full py-3.5 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reconnect This Phone</span>
            </button>
          </div>
        </div>
      )}

      {/* ── OLED Stealth Black Screen Overlay ── */}
      {stealthMode && (
        <div 
          onClick={() => {
            setStealthMode(false);
            showToast("OLED Stealth Disabled — Controls Restored");
          }}
          className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-between p-6 cursor-pointer touch-manipulation"
        >
          <div className="flex items-center gap-2 text-emerald-400/80 text-xs font-mono tracking-widest uppercase mt-4">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Chamber Node Active — Locker #1</span>
          </div>
          
          <div className="text-center space-y-3 opacity-60">
            <Radio className="w-10 h-10 text-emerald-400 mx-auto animate-pulse" />
            <p className="text-xs font-mono text-slate-300 font-bold">OLED Stealth Mode Enabled</p>
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
              Screen dimmed to 0% to prevent heat inside the sealed locker.<br />
              Camera streaming continuously to PWA.
            </p>
            <div className="pt-2">
              <span className="inline-block px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-mono text-emerald-400 font-bold">
                Tap anywhere to wake screen
              </span>
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-600 pb-4">
            Frames Synced: {sentFrames} • Illuminator: {torchOn ? "LED ON" : screenTorchOn ? "SCREEN ON" : "OFF"}
          </div>
        </div>
      )}

      {/* ── Header Bar ── */}
      <header className={`px-4 py-3.5 ${screenTorchOn ? "bg-white border-b border-slate-200" : "bg-slate-900/90 border-b border-slate-800"} backdrop-blur-md flex items-center justify-between z-10`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h1 className={`text-sm font-black tracking-wide ${screenTorchOn ? "text-slate-900" : "text-white"} flex items-center gap-2`}>
              Chamber Optical Node
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                SAFE 1
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              Embedded Vision Component
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-xs font-mono font-bold text-slate-300">
            {isStreaming ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
      </header>

      {/* ── Main Viewfinder & Controls ── */}
      <main className="flex-1 flex flex-col p-4 gap-4 max-w-md mx-auto w-full">
        {isDesktopBlocked ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Chamber Optical Node</h2>
              <p className="text-xs text-emerald-400 font-mono mt-1">Locker #1 Dedicated Smartphone Mount</p>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This node is strictly reserved for the <strong className="text-white">smartphone mounted inside Locker #1</strong>.
              Desktop webcam broadcast is disabled so the chamber vision feed only accepts the real phone camera.
            </p>
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-left space-y-2 text-xs text-slate-300 w-full">
              <div className="font-semibold text-emerald-400 font-mono uppercase text-[10px]">How to Pair Your Phone:</div>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-400">
                <li>Go to the <strong>Connect</strong> page on the Kiosk.</li>
                <li>Scan the <strong>Node 2 QR Code</strong> with your mobile phone camera.</li>
                <li>Mount the phone inside Locker #1 and close the door.</li>
              </ol>
            </div>
          </div>
        ) : (
          <>
            {/* ── INSECURE HTTP WARNING CARD (1-TAP HTTPS SWITCH OR NATIVE PHOTO) ── */}
            {isInsecureContext && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-200 space-y-3 shadow-xl">
                <div className="flex items-center gap-2 font-bold text-sm text-amber-300">
                  <Lock className="w-5 h-5 flex-shrink-0 text-amber-400" />
                  <span>Camera Connection Options</span>
                </div>

            <p className="text-xs text-amber-200/90 leading-relaxed">
              Mobile browsers require HTTPS for continuous 30 FPS video streaming. Tap below to switch to the secure stream, or take a direct photo.
            </p>

            <button
              onClick={handleSwitchToHttps}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs tracking-wider uppercase transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>1-Tap Switch to HTTPS Stream (:5174)</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Hidden native camera capture input */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              onChange={handleCapturePhoto}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>Take Chamber Photo (Native Camera)</span>
            </button>

            <div className="p-2.5 rounded-lg bg-black/30 border border-amber-500/20 text-[11px] text-amber-200/80 space-y-1">
              <div className="font-bold text-amber-300">First time on HTTPS (:5174)?</div>
              <ol className="list-decimal list-inside space-y-0.5 text-[10px]">
                <li>Tap <strong>Switch to HTTPS Stream</strong> above.</li>
                <li>When Chrome says <em>"Your connection is not private"</em>, tap <strong>Advanced</strong> &rarr; <strong>Proceed to {window.location.hostname} (unsafe)</strong>.</li>
                <li>Tap <strong>Allow</strong> for camera access.</li>
              </ol>
            </div>
          </div>
        )}

        {/* ── Standard Error Banner ── */}
        {!isInsecureContext && errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
            <button
              onClick={() => startCamera()}
              disabled={isRetrying}
              className="self-end px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-mono text-[11px] font-bold border border-rose-500/40 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>Retry Camera</span>
            </button>
          </div>
        )}

        {/* ── Camera Viewfinder Container ── */}
        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover"
          />

          {/* Standby Placeholder if not streaming */}
          {!isStreaming && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-950/80 gap-3">
              <Camera className="w-10 h-10 text-slate-600 animate-pulse" />
              <div className="text-xs font-mono text-slate-400">
                {isRetrying ? "Initializing Optical Sensor..." : "Camera Inactive"}
              </div>
              <button
                onClick={() => startCamera()}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold font-mono tracking-wider flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Initialize Camera</span>
              </button>
            </div>
          )}

          {/* HUD Target Overlay */}
          <div className="absolute inset-3 border border-emerald-500/30 rounded-xl pointer-events-none flex flex-col justify-between p-3">
            <div className="flex justify-between text-[10px] font-mono text-emerald-400/80 font-bold">
              <span>[OPTICAL SENSOR ACTIVE]</span>
              <span>LOCKER: #1</span>
            </div>
            
            {/* Center Crosshair or Live AI Detection Pill */}
            {detectedItem ? (
              <div className={`self-center px-3 py-1.5 rounded-full text-slate-950 text-[11px] font-black tracking-wider uppercase font-mono shadow-2xl flex items-center gap-1.5 border ${
                detectedItem.label.toLowerCase().includes("person") || detectedItem.category === "general_item"
                  ? "bg-sky-400 border-sky-300"
                  : "bg-emerald-500/95 border-emerald-300"
              }`}>
                <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                <span>{detectedItem.label} • {Math.round(detectedItem.score * 100)}%</span>
              </div>
            ) : (
              <div className="self-center w-9 h-9 border-t-2 border-b-2 border-emerald-500/50 rounded-full flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400" />
              </div>
            )}

            {/* Multi-Object Bounding Boxes on Phone */}
            {detectedItems.map((item, idx) => (
              <div
                key={`phone-bbox-${idx}-${item.label}`}
                style={{
                  position: "absolute",
                  left: `${Math.max(4, Math.min(80, item.bbox[0] * 100))}%`,
                  top: `${Math.max(4, Math.min(80, item.bbox[1] * 100))}%`,
                  width: `${Math.max(12, Math.min(90, item.bbox[2] * 100))}%`,
                  height: `${Math.max(12, Math.min(90, item.bbox[3] * 100))}%`
                }}
                className={`border-2 rounded-xl pointer-events-none ${
                  item.label.toLowerCase().includes("person") || item.category === "general_item"
                    ? "border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.4)]"
                    : "border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                }`}
              />
            ))}

            <div className="flex justify-between text-[10px] font-mono text-emerald-400/80 font-bold">
              <span>SYNC: {sentFrames} FRAMES</span>
              <span>WAKELOCK: {wakeLockActive ? "LOCKED" : "OFF"}</span>
            </div>
          </div>
        </div>

        {/* ── Primary Action Buttons ── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Torch Button (LED + Screen Torch fallback) */}
          <button
            onClick={toggleTorch}
            className={`flex items-center justify-center gap-2 p-3.5 rounded-xl font-bold text-xs transition-all border active:scale-95 cursor-pointer ${
              torchOn
                ? "bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/30 font-black"
                : screenTorchOn
                ? "bg-white text-slate-950 border-slate-300 shadow-lg shadow-white/30 font-black"
                : "bg-slate-900 text-slate-200 border-slate-800 hover:bg-slate-800"
            }`}
          >
            {screenTorchOn ? (
              <Sun className="w-4 h-4 fill-current text-amber-500" />
            ) : (
              <Flashlight className={`w-4 h-4 ${torchOn ? "fill-current" : ""}`} />
            )}
            <span>
              {torchOn ? "Torch: ON (LED)" : screenTorchOn ? "Torch: ON (Screen)" : "Torch: OFF"}
            </span>
          </button>

          {/* OLED Stealth Mode Button */}
          <button
            onClick={() => {
              setStealthMode(true);
              showToast("OLED Stealth Enabled — Screen Dimmed");
            }}
            className="flex items-center justify-center gap-2 p-3.5 rounded-xl font-bold text-xs bg-slate-900 text-slate-200 border border-slate-800 hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
          >
            <EyeOff className="w-4 h-4 text-emerald-400" />
            <span>OLED Stealth</span>
          </button>
        </div>

        {/* ── Secondary Camera Controls ── */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => startCamera()}
            disabled={isRetrying}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-slate-900/80 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-mono transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Restart Camera</span>
          </button>

          <button
            onClick={handleFlipCamera}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-slate-900/80 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-mono transition-colors"
          >
            <SwitchCamera className="w-3.5 h-3.5 text-emerald-400" />
            <span>Flip ({facingMode === "environment" ? "Rear" : "Front"})</span>
          </button>
        </div>

        {/* ── Hardware State Telemetry Card ── */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2 text-xs font-mono">
          <div className="flex justify-between items-center text-slate-400">
            <span>Mounting State</span>
            <span className="text-emerald-400 font-bold">Locker Shelf Ready</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Transmission Mode</span>
            <span className="text-slate-200">WebRTC P2P + RTDB Fallback</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Illuminator Type</span>
            <span className="text-slate-200">
              {torchOn ? "Hardware LED Flash" : screenTorchOn ? "Screen White High-Lumen" : "Standby (OFF)"}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Protocol Context</span>
            <span className={window.isSecureContext ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
              {window.location.protocol.toUpperCase()} {window.isSecureContext ? "(Secure Context)" : "(Insecure Context)"}
            </span>
          </div>
        </div>

        {/* Instructions */}
        <p className="text-[11px] text-slate-500 text-center leading-relaxed mt-auto pb-2">
          Place phone inside Locker #1 facing the food shelf with the torch turned ON, tap <strong>OLED Stealth</strong> and close the door.
        </p>
        </>
        )}
      </main>
    </div>
  );
}
