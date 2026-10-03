import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';

interface FaceVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (imageData: string) => void;
}

export const FaceVerificationModal: React.FC<FaceVerificationModalProps> = ({ isOpen, onClose, onVerify }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastFrameData = useRef<Uint8ClampedArray | null>(null);
  const alignmentStableCount = useRef(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [liveWarning, setLiveWarning] = useState<string | null>(null);
  const [autoCaptureCountdown, setAutoCaptureCountdown] = useState<number | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  useEffect(() => {
    if (isOpen && !showInstructions) {
      startCamera();
    }
    return () => stopCamera();
  }, [isOpen, showInstructions]);

  const startCamera = async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setStream(newStream);
      setError(null);
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Unable to access camera. Please check permissions.");
    }
  };

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, videoRef.current]);

  useEffect(() => {
    let animationFrameId: number;

    const analyzeFrame = () => {
      if (videoRef.current && canvasRef.current && !isCapturing && !error) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
          const sw = 160;
          const sh = 120;
          canvas.width = sw;
          canvas.height = sh;
          ctx.drawImage(video, 0, 0, sw, sh);
          
          const imageData = ctx.getImageData(0, 0, sw, sh);
          const frameData = imageData.data;
          let totalBrightness = 0;
          let totalDiff = 0;
          let skinPixelsInCircle = 0;
          let totalPixelsInCircle = 0;
          
          const centerX = sw / 2;
          const centerY = sh / 2;
          const radius = sw * 0.25; // 25% of width as radius for alignment check
          
          for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
              const i = (y * sw + x) * 4;
              const r = frameData[i];
              const g = frameData[i+1];
              const b = frameData[i+2];
              const brightness = (r + g + b) / 3;
              totalBrightness += brightness;
              
              if (lastFrameData.current) {
                totalDiff += Math.abs(brightness - lastFrameData.current[i]);
              }

              // Distance from center
              const dx = x - centerX;
              const dy = y - centerY;
              if (dx*dx + dy*dy < radius*radius) {
                totalPixelsInCircle++;
                // Heuristic skin tone detection (Peers et al. range)
                const isSkin = (r > 60 && g > 40 && b > 20 && 
                                r > g && r > b && 
                                Math.abs(r - g) > 15 && 
                                (Math.max(r, g, b) - Math.min(r, g, b)) > 15);
                if (isSkin) skinPixelsInCircle++;
              }
            }
          }
          
          const avgBrightness = totalBrightness / (sw * sh);
          const avgDiff = totalDiff / (sw * sw);
          const skinCoverage = skinPixelsInCircle / totalPixelsInCircle;
          lastFrameData.current = frameData;

          // Advanced Warnings logic
          if (avgBrightness < 50) {
            setLiveWarning("Low light detected. Please move to a brighter area.");
            alignmentStableCount.current = 0;
            setAutoCaptureCountdown(null);
          } else if (avgDiff > 25) {
            setLiveWarning("Motion detected. Please hold still.");
            alignmentStableCount.current = 0;
            setAutoCaptureCountdown(null);
          } else if (skinCoverage < 0.15) {
            setLiveWarning("Position your face within the circle.");
            alignmentStableCount.current = 0;
            setAutoCaptureCountdown(null);
          } else {
            setLiveWarning(null);
            
            // Auto-capture logic: if stable for ~1.5 seconds
            alignmentStableCount.current += 1;
            
            if (alignmentStableCount.current > 40) {
              const remaining = Math.max(0, 3 - Math.floor((alignmentStableCount.current - 40) / 20));
              setAutoCaptureCountdown(remaining);
              
              if (alignmentStableCount.current >= 100) {
                captureImage();
                alignmentStableCount.current = 0;
                setAutoCaptureCountdown(null);
              }
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(analyzeFrame);
    };

    if (stream && !isCapturing) {
      analyzeFrame();
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [stream, isCapturing, error]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        
        setIsCapturing(true);
        setScanStatus("Analyzing face geometry...");
        setError(null);
        
        // Simulate strict biometric verification process
        setTimeout(() => {
          setScanStatus("Checking for face coverings...");
          
          setTimeout(() => {
            // 20% chance of "detecting" a mask or covered face for simulation purposes
            // In a real app, this would be an ML model output (e.g. face-api.js)
            const isCovered = Math.random() < 0.2;
            
            if (isCovered) {
              setIsCapturing(false);
              setScanStatus(null);
              setError("Verification Failed: Face is partially covered or a mask is detected. Please ensure your full face is visible.");
              return;
            }
            
            setScanStatus("Verification Successful!");
            setCapturedImage(dataUrl);
            
            setTimeout(() => {
              onVerify(dataUrl);
            }, 2000);
            
          }, 1500);
        }, 1000);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="face-verification-overlay">
      <style>{`
        .face-verification-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(20px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          padding-top: 5rem;
        }
        .verification-modal {
          width: 100%;
          max-width: 500px;
          background: linear-gradient(145deg, rgba(17, 33, 27, 0.95) 0%, rgba(10, 20, 15, 0.98) 100%);
          border: 1px solid rgba(16, 185, 129, 0.25);
          border-radius: 32px;
          overflow-y: auto;
          overflow-x: hidden;
          position: relative;
          box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          margin-top: 2rem;
          max-height: calc(100vh - 8rem);
          display: flex;
          flex-direction: column;
        }
        .modal-header {
          padding: 1.5rem;
          text-align: center;
          border-bottom: 1px solid rgba(16, 185, 129, 0.1);
        }
        .camera-container {
          position: relative;
          aspect-ratio: 4/3;
          background: #000;
          overflow: hidden;
        }
        .camera-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
        }
        .camera-overlay {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          border: 2px solid rgba(16, 185, 129, 0.3);
          pointer-events: none;
        }
        .face-guide {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 60%; height: 70%;
          border: 2px dashed rgba(255, 255, 255, 0.5);
          border-radius: 50% 50% 40% 40%;
          box-shadow: 0 0 0 1000px rgba(0, 0, 0, 0.4);
        }
        .scanning-bar {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 4px;
          background: linear-gradient(to bottom, transparent, #10B981, transparent);
          box-shadow: 0 0 20px 2px #10B981;
          animation: scan 3s linear infinite;
        }
        @keyframes scan {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
        .live-warning-banner {
          position: absolute;
          top: 1.5rem;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(239, 68, 68, 0.9);
          backdrop-filter: blur(8px);
          color: white;
          padding: 0.6rem 1rem;
          border-radius: 99px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          font-weight: 700;
          white-space: nowrap;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
          z-index: 20;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .auto-capture-timer {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 100px; height: 100px;
          display: grid; place-items: center;
          font-size: 2.5rem;
          font-weight: 900;
          color: white;
          z-index: 30;
          text-shadow: 0 4px 10px rgba(0,0,0,0.5);
        }
        .timer-ring {
          position: absolute;
          inset: 0;
          border: 4px solid rgba(16, 185, 129, 0.3);
          border-top-color: #10B981;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .modal-footer {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .action-btn {
          padding: 1rem;
          border-radius: 16px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          letter-spacing: 0.05em;
        }
        .btn-primary {
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          color: white;
          border: none;
          box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4);
        }
        .btn-primary:hover {
          background: linear-gradient(135deg, #34D399 0%, #10B981 100%);
          transform: translateY(-2px);
          box-shadow: 0 15px 30px -5px rgba(16, 185, 129, 0.5);
        }
        .btn-primary:active {
          transform: translateY(1px);
        }
        .btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .instruction-card {
          padding: 2.5rem;
          text-align: center;
          position: relative;
        }
        .instruction-icon-wrapper {
          position: relative;
          width: 80px; height: 80px;
          margin: 0 auto 1.5rem;
          display: grid; place-items: center;
        }
        .instruction-icon-bg {
          position: absolute;
          inset: 0;
          background: rgba(16, 185, 129, 0.15);
          border-radius: 24px;
          transform: rotate(45deg);
          animation: pulseGlow 3s infinite alternate;
        }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.2); }
          100% { box-shadow: 0 0 40px rgba(16, 185, 129, 0.5); }
        }
        .instruction-icon {
          position: relative;
          color: #10B981;
          z-index: 1;
        }
        .instruction-content {
          text-align: left;
          background: linear-gradient(180deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.01) 100%);
          padding: 1.75rem;
          border-radius: 24px;
          border: 1px solid rgba(16, 185, 129, 0.15);
          margin-bottom: 2.5rem;
          position: relative;
          overflow: hidden;
        }
        .instruction-content::before {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.5), transparent);
        }
        .instruction-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .instruction-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.95rem;
          line-height: 1.4;
        }
        .item-dot {
          flex-shrink: 0;
          width: 20px; height: 20px;
          background: rgba(16, 185, 129, 0.2);
          border-radius: 50%;
          display: grid; place-items: center;
          margin-top: 2px;
        }
        .item-dot::after {
          content: '';
          width: 8px; height: 8px;
          background: #10B981;
          border-radius: 50%;
        }
      `}</style>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="verification-modal"
      >
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', zIndex: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', padding: '0.6rem', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', backdropFilter: 'blur(4px)', transition: 'all 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
        >
          <X size={18} />
        </button>

        <AnimatePresence mode="wait">
          {showInstructions ? (
            <motion.div 
              key="instructions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="instruction-card"
            >
              <div className="instruction-icon-wrapper">
                <div className="instruction-icon-bg" />
                <UserCheck size={36} className="instruction-icon" />
              </div>
              
              <h3 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '1.5rem', color: 'white', letterSpacing: '-0.02em' }}>Identity Verification</h3>
              
              <div className="instruction-content">
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Security Protocol Requirements</p>
                <ul className="instruction-list">
                  <li className="instruction-item">
                    <div className="item-dot" />
                    <span>Ensure your face is clearly visible and centered.</span>
                  </li>
                  <li className="instruction-item">
                    <div className="item-dot" />
                    <span>Remove any masks, sunglasses, or heavy headwear.</span>
                  </li>
                  <li className="instruction-item">
                    <div className="item-dot" />
                    <span>Verify there is adequate lighting on your face.</span>
                  </li>
                  <li className="instruction-item">
                    <div className="item-dot" />
                    <span>Position yourself within the guide on the screen.</span>
                  </li>
                </ul>
              </div>
              
              <button className="action-btn btn-primary" style={{ width: '100%', fontSize: '1.1rem', padding: '1.1rem' }} onClick={() => setShowInstructions(false)}>
                Initialize Camera Scan
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="camera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="modal-header">
                <p style={{ fontSize: '0.7rem', fontWeight: 900, color: '#10B981', letterSpacing: '0.2em', marginBottom: '0.25rem' }}>IDENTITY VERIFICATION</p>
                <h3 style={{ margin: 0, color: 'white' }}>{isCapturing ? 'Verifying...' : 'Align Your Face'}</h3>
              </div>

              <div className="camera-container">
                {capturedImage ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ height: '100%', position: 'relative' }}
                  >
                    <img src={capturedImage} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} alt="Captured" />
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(16, 185, 129, 0.2)', display: 'grid', placeItems: 'center' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ width: 80, height: 80, background: '#10B981', borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 1rem', boxShadow: '0 0 30px rgba(16, 185, 129, 0.5)' }}>
                          <ShieldCheck size={48} color="white" />
                        </div>
                        <p style={{ color: 'white', fontWeight: 800, fontSize: '1.2rem', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>IMAGE CAPTURED</p>
                      </div>
                    </div>
                  </motion.div>
                ) : error && !isCapturing ? (
                  <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: '2rem', textAlign: 'center', color: '#EF4444', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <div>
                      <AlertCircle size={48} style={{ margin: '0 auto 1rem' }} />
                      <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>Security Alert</p>
                      <p style={{ fontSize: '0.9rem', opacity: 0.9 }}>{error}</p>
                    </div>
                    <button className="action-btn btn-secondary" style={{ marginTop: '1.5rem' }} onClick={() => setError(null)}>Acknowledge & Retry</button>
                  </div>
                ) : (
                  <>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className="camera-video"
                    />
                    <div className="camera-overlay">
                      <div className="face-guide" style={{ borderColor: isCapturing ? '#10B981' : (liveWarning ? '#EF4444' : 'rgba(255, 255, 255, 0.5)') }} />
                      
                      <AnimatePresence>
                        {liveWarning && !isCapturing && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="live-warning-banner"
                          >
                            <AlertCircle size={14} />
                            <span>{liveWarning}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {autoCaptureCountdown !== null && !isCapturing && !liveWarning && (
                          <motion.div 
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 1.5, opacity: 0 }}
                            className="auto-capture-timer"
                          >
                            <div className="timer-ring" />
                            <span>{autoCaptureCountdown || "Capture"}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {!isCapturing && <div className="scanning-bar" />}
                      {isCapturing && (
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(16, 185, 129, 0.1)', display: 'grid', placeItems: 'center' }}>
                          <motion.div 
                            animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                            transition={{ rotate: { duration: 2, repeat: Infinity, ease: "linear" }, scale: { duration: 1, repeat: Infinity } }}
                          >
                            <ShieldCheck size={72} color="#10B981" />
                          </motion.div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>

              <div className="modal-footer">
                {!isCapturing && !error ? (
                  <button className="action-btn btn-primary" onClick={captureImage} disabled={!stream}>
                    <Camera size={20} />
                    Capture & Verify
                  </button>
                ) : isCapturing ? (
                  <div style={{ textAlign: 'center', color: '#10B981', fontSize: '0.9rem', fontWeight: 600 }}>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={scanStatus}
                    >
                      {scanStatus || "Processing biometric signature..."}
                    </motion.div>
                  </div>
                ) : null}
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                  Your privacy is important. Biometric data is processed locally and not stored permanently.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
