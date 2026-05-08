import { useState, useEffect, useRef, useCallback } from "react";
import * as faceapi from "face-api.js";

interface UseBiometricsOptions {
  onVerified?: (descriptor: Float32Array) => void;
  onRuleBreach?: (reason: "no_face" | "multiple_faces" | "not_centered" | "unstable") => void;
}

export function useBiometrics({ onVerified, onRuleBreach }: UseBiometricsOptions = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isFaceValid, setIsFaceValid] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [currentDescriptor, setCurrentDescriptor] = useState<Float32Array | null>(null);

  // Load models on mount
  useEffect(() => {
    async function loadModels() {
      try {
        // Using external CDN to avoid local file issues
        const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models"; 
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (e: any) {
        console.error("Failed to load face-api models", e);
        setModelError(e.message || "Failed to load AI models.");
      }
    }
    loadModels();
  }, []);

  // Request camera and setup video stream
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 480, height: 480, facingMode: "user" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setHasPermission(true);
        setIsInitializing(false);
      }
    } catch (err) {
      console.error("Camera access denied", err);
      setHasPermission(false);
      setIsInitializing(false);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  // The continuous tracking loop
  useEffect(() => {
    if (!modelsLoaded || !hasPermission || !videoRef.current) return;

    let animationFrameId: number;
    let detectionHistory: boolean[] = []; // for multi-frame consistency

    const detectFace = async () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        // Detect single face with landmarks and descriptor
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          // Check if face is relatively centered and taking up enough frame
          const { box } = detection.detection;
          const videoWidth = videoRef.current.videoWidth;
          const videoHeight = videoRef.current.videoHeight;
          
          const isCentered = 
            box.x > videoWidth * 0.1 && 
            box.right < videoWidth * 0.9 &&
            box.y > videoHeight * 0.1 && 
            box.bottom < videoHeight * 0.9;

          if (!isCentered) {
            detectionHistory.push(false);
            onRuleBreach?.("not_centered");
          } else {
            detectionHistory.push(true);
            setCurrentDescriptor(detection.descriptor);
          }
        } else {
          detectionHistory.push(false);
          onRuleBreach?.("no_face");
        }

        // Keep history to last 5 frames for consistency check (Liveness)
        if (detectionHistory.length > 5) detectionHistory.shift();

        // If at least 4 out of last 5 frames had a valid face, consider it verified
        const validFrames = detectionHistory.filter(Boolean).length;
        const isValidNow = validFrames >= 4;

        setIsFaceValid(isValidNow);
        
        if (isValidNow && detection?.descriptor) {
          onVerified?.(detection.descriptor);
        } else if (!isValidNow && validFrames < 2) {
          onRuleBreach?.("unstable");
        }
      }
      
      // Schedule next frame
      animationFrameId = requestAnimationFrame(detectFace);
    };

    // Give video a moment to play before starting loop
    const timeoutId = setTimeout(() => detectFace(), 500);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(timeoutId);
    };
  }, [modelsLoaded, hasPermission, onVerified, onRuleBreach]);

  // Clean up on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return {
    videoRef,
    isInitializing,
    modelsLoaded,
    modelError,
    hasPermission,
    isFaceValid,
    currentDescriptor,
    startCamera,
    stopCamera
  };
}
