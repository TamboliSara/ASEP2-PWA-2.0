import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, Loader2, Volume2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type AssistantState = 'idle' | 'listening' | 'processing' | 'speaking';

export function VoiceAssistant() {
  const navigate = useNavigate();
  const [state, setState] = useState<AssistantState>('idle');
  const [showHint, setShowHint] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [mounted, setMounted] = useState(false);
  const [isRealSpeech, setIsRealSpeech] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1; // Slightly faster for a more modern feel
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  }, []);

  const handleProcess = useCallback((finalTranscript: string) => {
    setState('processing');
    
    // Clean and normalize input
    const input = finalTranscript.toLowerCase().trim();
    let response = "I heard you say: \"" + finalTranscript + "\". I'm not sure how to help with that yet. Try asking for 'Help', 'Admin Statistics', or 'Donate'.";
    
    // Action Mapping
    if (input.match(/help|guide|process|how to/)) {
      window.dispatchEvent(new CustomEvent("open-help-widget"));
      response = "I've opened the process guide for you. You can see the donor and receiver steps on the left.";
    } else if (input.match(/admin|dashboard|statistics|metrics|reports/)) {
      response = "Of course. Navigating to the administrator dashboard.";
      navigate("/admin");
    } else if (input.match(/donate|give|share|mode|selection/)) {
      response = "Taking you to the mode selection screen to start a donation. Thank you!";
      navigate("/");
    } else if (input.match(/receive|collect|get food|dashboard/)) {
      response = "Opening the receiver dashboard. You can browse available lockers here.";
      navigate("/receive");
    } else if (input.match(/status|check|system|health/)) {
      response = "All systems are green. Locker temperatures are nominal and biometric sensors are active.";
    } else if (input.match(/hello|hi|hey/)) {
      response = "Hello! I am the EcoLocker AI. I can help you navigate, check system status, or guide you through the process.";
    }

    setTimeout(() => {
      setResponseMessage(response);
      setState('speaking');
      speak(response);
      
      const duration = Math.max(3500, response.length * 55);
      setTimeout(() => {
        setState('idle');
        setResponseMessage("");
      }, duration);
    }, 800);
  }, [speak, navigate]);

  useEffect(() => {
    let recognition: any = null;
    
    if (state === 'listening') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        setIsRealSpeech(true);
        recognition = new SpeechRecognition();
        recognition.continuous = false; // Stop after one command
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              setLiveTranscript(transcript);
              handleProcess(transcript);
            } else {
              interimTranscript += transcript;
              setLiveTranscript(interimTranscript);
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsRealSpeech(false);
          setState('idle');
        };

        recognition.onend = () => {
          if (state === 'listening' && !liveTranscript) {
             setState('idle');
          }
        };

        recognition.start();
      } else {
        setIsRealSpeech(false);
        // Mock fallback
        const phrase = "Help me donate food";
        const words = phrase.split(" ");
        let currentText = "";
        words.forEach((word, index) => {
          setTimeout(() => {
            currentText += (index === 0 ? "" : " ") + word;
            setLiveTranscript(currentText);
            if (index === words.length - 1) {
              setTimeout(() => handleProcess(phrase), 500);
            }
          }, index * 400);
        });
      }
    }

    return () => {
      if (recognition) recognition.stop();
    };
  }, [state, handleProcess]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (state === 'idle') {
        setShowHint(true);
        setTimeout(() => setShowHint(false), 4000);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [state]);

  const toggleAssistant = () => {
    if (state === 'idle') {
      setShowHint(false);
      setState('listening');
    } else if (state === 'listening') {
      handleProcess(liveTranscript);
    } else {
      setState('idle');
      setResponseMessage("");
    }
  };

  if (!mounted) return null;

  return (
    <div className="voice-assistant-container">
      {/* Live Transcript Display - Portalled for Visibility */}
      {createPortal(
        <AnimatePresence>
          {state === 'listening' && (
            <motion.div
              className="live-transcript-container"
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              style={{ zIndex: 100002 }}
            >
              <div className="transcript-badge">
                <div className="live-dot" />
                <span>{isRealSpeech ? 'REAL-TIME VOICE' : 'SIMULATED VOICE'}</span>
              </div>
              <p className="transcript-text">
                {liveTranscript || (
                  <motion.span 
                    animate={{ opacity: [0.4, 1, 0.4] }} 
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ color: 'rgba(255,255,255,0.5)' }}
                  >
                    {isRealSpeech ? 'Listening to you...' : 'Processing audio...'}
                  </motion.span>
                )}
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="cursor"
                >
                  |
                </motion.span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <motion.button
        className={`voice-assistant-trigger state-${state} ${showHint ? 'showing-hint' : ''}`}
        onClick={toggleAssistant}
        initial={{ opacity: 0, y: 20 }}
        animate={{ 
          opacity: 1, 
          y: 0,
          width: (showHint || state === 'speaking') ? "auto" : 60,
          paddingRight: (showHint || state === 'speaking') ? "1.5rem" : 0,
          paddingLeft: (showHint || state === 'speaking') ? "1.5rem" : 0,
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Voice Assistant"
        layout
      >
        <div className="trigger-content">
          <AnimatePresence mode="wait">
            {state === 'processing' ? (
              <motion.div
                key="processing"
                initial={{ opacity: 0, rotate: 0 }}
                animate={{ opacity: 1, rotate: 360 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 size={28} />
              </motion.div>
            ) : state === 'listening' ? (
              <motion.div
                key="listening"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <Mic size={28} />
              </motion.div>
            ) : state === 'speaking' ? (
              <motion.div
                key="speaking"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <Volume2 size={28} />
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <MicOff size={28} opacity={0.7} />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showHint && state === 'idle' && (
              <motion.span
                className="hint-text"
                initial={{ opacity: 0, x: -10, width: 0 }}
                animate={{ opacity: 1, x: 0, width: "auto" }}
                exit={{ opacity: 0, x: -10, width: 0 }}
                transition={{ duration: 0.3 }}
              >
                Ask for help
              </motion.span>
            )}
            {state === 'speaking' && responseMessage && (
              <motion.span
                className="response-text"
                initial={{ opacity: 0, x: -10, width: 0 }}
                animate={{ opacity: 1, x: 0, width: "auto" }}
                exit={{ opacity: 0, x: -10, width: 0 }}
                transition={{ duration: 0.3 }}
              >
                {responseMessage}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {(state === 'listening' || state === 'speaking' || showHint) && (
          <motion.div
            className="pulse-ring"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
          />
        )}
      </motion.button>

      <AnimatePresence>
        {state === 'listening' && (
          <motion.div
            className="voice-status-popover glass-panel"
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
          >
            <div className="voice-wave">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p>Listening...</p>
            <button className="close-btn" onClick={() => setState('idle')}>
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
