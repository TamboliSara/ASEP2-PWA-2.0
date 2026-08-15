import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { 
  Mic, 
  Volume2, 
  X, 
  Keyboard, 
  Send, 
  Sparkles, 
  RotateCcw, 
  Bot, 
  ArrowRight, 
  Box, 
  HeartHandshake, 
  HelpCircle,
  PackageCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { processVoiceCommandFn } from "../services/firebase";
import { useAppContext } from "../store/AppContext";

type AssistantState = 'idle' | 'listening' | 'processing' | 'speaking';
type ChatMessage = { role: 'user' | 'ai'; text: string; timestamp?: string };

const SUGGESTIONS = [
  { icon: Box, text: "What's in Chamber 4?", label: "Chamber 4 contents" },
  { icon: PackageCheck, text: "Which lockers are empty?", label: "Check available lockers" },
  { icon: HeartHandshake, text: "I want to donate food", label: "Deposit donation" },
  { icon: HelpCircle, text: "How does EcoLocker work?", label: "System guide" },
];

function findBestFemaleVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const femaleKeywords = [
    'female', 'woman', 'zira', 'jenny', 'heera', 'swara', 'veena', 'lekha',
    'neerja', 'samantha', 'karen', 'victoria', 'kalpana', 'priya', 'ananya',
    'aditi', 'moira', 'tessa', 'fiona', 'serena', 'ava', 'allison', 'susan',
    'google uk english female', 'google हिन्दी', 'google मराठी', 'google us english'
  ];

  const maleKeywords = ['male', 'david', 'george', 'mark', 'ravi', 'madhav', 'guy', 'prabhat', 'hemant', 'stefan', 'richard'];

  const cleanLang = lang.toLowerCase().split('-')[0]; // 'hi', 'mr', 'en'

  // 1. Prioritize language match + female keyword
  const langFemaleMatch = voices.find(v => {
    const vLang = v.lang.toLowerCase();
    const vName = v.name.toLowerCase();
    const isLang = vLang.includes(cleanLang) || vLang.replace('_', '-').startsWith(cleanLang);
    const isFemale = femaleKeywords.some(k => vName.includes(k));
    const isNotMale = !maleKeywords.some(k => vName.includes(k));
    return isLang && isFemale && isNotMale;
  });
  if (langFemaleMatch) return langFemaleMatch;

  // 2. Any voice matching language that is not explicitly male
  const langMatch = voices.find(v => {
    const vLang = v.lang.toLowerCase();
    const vName = v.name.toLowerCase();
    const isLang = vLang.includes(cleanLang) || vLang.replace('_', '-').startsWith(cleanLang);
    return isLang && !maleKeywords.some(k => vName.includes(k));
  });
  if (langMatch) return langMatch;

  // 3. Fallback: Any premium female voice
  const generalFemaleMatch = voices.find(v => {
    const vName = v.name.toLowerCase();
    return femaleKeywords.some(k => vName.includes(k)) && !maleKeywords.some(k => vName.includes(k));
  });
  if (generalFemaleMatch) return generalFemaleMatch;

  return null;
}

export function VoiceAssistant() {
  const navigate = useNavigate();
  const [state, setState] = useState<AssistantState>('idle');
  const [showHint, setShowHint] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");
  const [liveTranscript, setLiveTranscriptState] = useState("");
  const [mounted, setMounted] = useState(false);
  const [isRealSpeech, setIsRealSpeech] = useState(false);
  
  const [isTextInput, setIsTextInput] = useState(false);
  const [textInputValue, setTextInputValue] = useState("");
  const [typedResponse, setTypedResponse] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const liveTranscriptRef = useRef("");
  const recognitionRef = useRef<any>(null);
  const pauseDebounceTimeoutRef = useRef<any>(null);
  const typewriterTimeoutRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<AssistantState>('idle');
  const isProcessingRef = useRef(false);

  const { state: appState } = useAppContext();

  useEffect(() => { 
    stateRef.current = state; 
  }, [state]);

  useEffect(() => {
    setMounted(true);
    // Preload system voices
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      const onVoicesChanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.onvoiceschanged = onVoicesChanged;
      return () => {
        if (window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
    return () => setMounted(false);
  }, []);

  // Auto-scroll chat to bottom smoothly
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, typedResponse, liveTranscript, state]);

  const setLiveTranscript = useCallback((val: string) => {
    liveTranscriptRef.current = val;
    setLiveTranscriptState(val);
  }, []);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        setTimeout(resolve, Math.max(3500, text.length * 55));
        return;
      }
      
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      const isHindiMarathi = /[\u0900-\u097F]/.test(text);
      const targetLang = isHindiMarathi 
        ? (appState.locale === 'mr' ? 'mr-IN' : 'hi-IN') 
        : (appState.locale === 'hi' ? 'hi-IN' : appState.locale === 'mr' ? 'mr-IN' : 'en-IN');
      
      utterance.lang = targetLang;
      
      // Select best female voice
      const femaleVoice = findBestFemaleVoice(targetLang);
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }
      
      utterance.rate = 1.02; 
      utterance.pitch = 1.14; // Bright, pleasant female pitch
      
      let resolved = false;
      const finish = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      utterance.onend = finish;
      utterance.onerror = finish;
      
      setTimeout(finish, Math.max(5000, text.length * 150));

      window.speechSynthesis.speak(utterance);
      (window as any)._lastUtterance = utterance;
    });
  }, [appState.locale]);

  const handleProcess = useCallback(async (textToProcess: string) => {
    if (pauseDebounceTimeoutRef.current) clearTimeout(pauseDebounceTimeoutRef.current);
    isProcessingRef.current = true;
    
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }

    const input = textToProcess.trim();
    if (!input) {
      isProcessingRef.current = false;
      setState('listening');
      return;
    }

    // Add user message to chat history
    setChatHistory(prev => [...prev, { role: 'user', text: input }]);
    setLiveTranscript("");
    setTextInputValue("");
    setState('processing');
    
    try {
      // Send previous turns for conversational multi-turn context
      const historyForBackend = chatHistory.map(m => ({ role: m.role, text: m.text }));
      const result = await processVoiceCommandFn({ text: input, history: historyForBackend });
      const data = result.data as any;

      let shouldTerminate = false;

      if (data.type === 'TOOL_CALL') {
        shouldTerminate = true; // Navigation/action commands auto-close modal
        if (data.toolName === 'navigate' && data.args.path) {
          navigate(data.args.path);
        } else if (data.toolName === 'triggerEvent' && data.args.eventName) {
          window.dispatchEvent(new CustomEvent(data.args.eventName));
        }
      }

      const response = data.message || "I've processed your request.";
      setResponseMessage(response);
      setState('speaking');
      
      await speak(response);
      
      // Save AI turn to chat history AFTER speech stream ends
      setChatHistory(prev => [...prev, { role: 'ai', text: response }]);
      setResponseMessage("");
      setTypedResponse("");
      isProcessingRef.current = false;

      if (shouldTerminate) {
        setChatHistory([]);
        setState('idle');
      } else {
        setState('listening');
      }

    } catch (error: any) {
      console.error("[Voice Assistant] Failed to process command:", error);
      const errorMsg = error.message || "Failed to process voice command. Please try again.";
      setResponseMessage(errorMsg);
      setState('speaking');
      
      await speak(errorMsg);
      
      setChatHistory(prev => [...prev, { role: 'ai', text: errorMsg }]);
      setResponseMessage("");
      setTypedResponse("");
      isProcessingRef.current = false;
      setState('listening');
    }
  }, [speak, navigate, chatHistory]);

  // Robust Speech Recognition with Continuous Listening & Natural Pause Debounce
  useEffect(() => {
    if (state === 'listening' && !isTextInput) {
      setLiveTranscript("");
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        setIsRealSpeech(true);
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        
        // CRITICAL: continuous = true allows the user to pause, breathe, or think without being cut off!
        recognition.continuous = true;
        recognition.interimResults = true;
        
        let recLang = 'en-US';
        if (appState.locale === 'hi') recLang = 'hi-IN';
        if (appState.locale === 'mr') recLang = 'mr-IN';
        recognition.lang = recLang;

        let accumulatedFinal = '';

        recognition.onresult = (event: any) => {
          let currentInterim = '';
          
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const item = event.results[i];
            const transcript = item[0].transcript;
            if (item.isFinal) {
              accumulatedFinal += transcript + ' ';
            } else {
              currentInterim += transcript;
            }
          }
          
          const fullText = (accumulatedFinal + currentInterim).trim();
          setLiveTranscript(fullText);

          // Clear any previous debounce timer
          if (pauseDebounceTimeoutRef.current) {
            clearTimeout(pauseDebounceTimeoutRef.current);
          }

          // When user speaks, set a 2.8s debounce timer.
          // If the user takes a 1-2s breath, they won't be interrupted.
          // Only when they remain silent for a full 2.8s will it automatically submit.
          if (fullText.length > 0) {
            pauseDebounceTimeoutRef.current = setTimeout(() => {
              if (stateRef.current === 'listening' && !isProcessingRef.current) {
                const textToSend = liveTranscriptRef.current.trim();
                if (textToSend) {
                  handleProcess(textToSend);
                }
              }
            }, 2800);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition warning/error:', event.error);
          
          if (event.error === 'not-allowed') {
            setIsRealSpeech(false);
            const errorMsg = "Microphone permission denied. You can still type below!";
            setChatHistory(prev => [...prev, { role: 'ai', text: errorMsg }]);
            setResponseMessage(errorMsg);
            setState('speaking');
            speak(errorMsg).then(() => {
              setResponseMessage("");
              setTypedResponse("");
              setIsTextInput(true);
              setState('listening');
            });
          }
        };

        recognition.onend = () => {
          // If recognition stops unexpectedly while we are still listening and not processing, auto-restart!
          if (stateRef.current === 'listening' && !isProcessingRef.current && !isTextInput) {
            try {
              recognition.start();
            } catch (e) {
              // Ignore if already active
            }
          }
        };

        try {
          recognition.start();
        } catch(e) {
          console.error("Speech recognition start failed:", e);
        }
      } else {
        setIsRealSpeech(false);
      }
    }

    return () => {
      if (pauseDebounceTimeoutRef.current) clearTimeout(pauseDebounceTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    };
  }, [state, isTextInput, appState.locale, handleProcess, setLiveTranscript]);

  // Typewriter streaming effect for active speaking message
  useEffect(() => {
    if (state === 'speaking' && responseMessage) {
      let i = 0;
      setTypedResponse("");
      const typeChar = () => {
        if (i < responseMessage.length) {
          setTypedResponse(responseMessage.substring(0, i + 1));
          i++;
          typewriterTimeoutRef.current = setTimeout(typeChar, 25);
        }
      };
      typeChar();
    } else {
      setTypedResponse("");
      if (typewriterTimeoutRef.current) clearTimeout(typewriterTimeoutRef.current);
    }
    return () => {
      if (typewriterTimeoutRef.current) clearTimeout(typewriterTimeoutRef.current);
    };
  }, [state, responseMessage]);

  // Periodic hint animation
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
      setIsTextInput(false);
      setLiveTranscript("");
      setTextInputValue("");
      setChatHistory([]);
      setState('listening');
    } else if (state === 'listening') {
      // Tapping mic while listening immediately submits current accumulated speech!
      if (pauseDebounceTimeoutRef.current) clearTimeout(pauseDebounceTimeoutRef.current);
      const text = liveTranscriptRef.current.trim();
      if (text) {
        handleProcess(text);
      }
    }
  };

  const closeModal = () => {
    window.speechSynthesis?.cancel();
    if (pauseDebounceTimeoutRef.current) clearTimeout(pauseDebounceTimeoutRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    if (typewriterTimeoutRef.current) clearTimeout(typewriterTimeoutRef.current);
    isProcessingRef.current = false;
    setState('idle');
    setResponseMessage("");
    setTypedResponse("");
    setChatHistory([]);
  };

  const clearChat = () => {
    setChatHistory([]);
    setResponseMessage("");
    setTypedResponse("");
    setLiveTranscript("");
    if (pauseDebounceTimeoutRef.current) clearTimeout(pauseDebounceTimeoutRef.current);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInputValue.trim()) {
      handleProcess(textInputValue);
    }
  };

  if (!mounted) return null;

  return (
    <div className="voice-assistant-container">
      {/* Floating Bottom-Right Trigger Button */}
      <AnimatePresence>
        {state === 'idle' && (
          <motion.button
            className={`voice-assistant-trigger state-idle ${showHint ? 'showing-hint' : ''}`}
            onClick={toggleAssistant}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              y: 0,
              width: showHint ? "auto" : 60,
              paddingRight: showHint ? "1.5rem" : 0,
              paddingLeft: showHint ? "1.5rem" : 0,
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            aria-label="Voice Assistant"
            layout
          >
            <div className="trigger-content">
              <Mic size={26} />
              <AnimatePresence>
                {showHint && (
                  <motion.span
                    className="hint-text"
                    initial={{ opacity: 0, x: -10, width: 0 }}
                    animate={{ opacity: 1, x: 0, width: "auto" }}
                    exit={{ opacity: 0, x: -10, width: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    Tap to talk to AI
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Full-Screen Glass Modal Dialog */}
      {createPortal(
        <AnimatePresence>
          {state !== 'idle' && (
            <motion.div
              className="va-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
            >
              <motion.div 
                className="va-card"
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                transition={{ type: "spring", damping: 26, stiffness: 280 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* ── Top Header ── */}
                <header className="va-header">
                  <div className="va-header-brand">
                    <div className="va-avatar-glow">
                      <Sparkles size={20} />
                    </div>
                    <div className="va-header-titles">
                      <h3>EcoLocker AI</h3>
                      <div className="va-status-tag">
                        <span className="dot" />
                        <span>
                          {state === 'listening' ? (isTextInput ? 'Text Mode' : (liveTranscript ? 'Hearing you...' : 'Listening...')) :
                           state === 'processing' ? 'Thinking...' :
                           state === 'speaking' ? 'Speaking...' : 'Ready'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="va-header-actions">
                    {chatHistory.length > 0 && (
                      <button 
                        className="va-icon-btn" 
                        onClick={clearChat}
                        title="Clear conversation"
                        aria-label="Clear conversation"
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                    <button 
                      className="va-icon-btn" 
                      onClick={closeModal}
                      title="Close"
                      aria-label="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </header>

                {/* ── Chat Messages Scroll Body ── */}
                <div className="va-messages-scroll" ref={chatScrollRef}>
                  {/* Empty Welcome Screen with Suggestions */}
                  {chatHistory.length === 0 && !responseMessage && !liveTranscript && state !== 'processing' && (
                    <motion.div 
                      className="va-empty-state"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="va-hero-orb">
                        <Bot size={36} />
                      </div>
                      <h4 className="va-empty-title">How can I help you today?</h4>
                      <p className="va-empty-subtitle">
                        Speak naturally — take your time to think or breathe. I'll listen until you finish!
                      </p>

                      <div className="va-suggestions-grid">
                        {SUGGESTIONS.map((item, idx) => {
                          const IconComp = item.icon;
                          return (
                            <button
                              key={idx}
                              className="va-chip-btn"
                              onClick={() => handleProcess(item.text)}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <IconComp size={16} color="#10b981" />
                                {item.label}
                              </span>
                              <ArrowRight size={14} opacity={0.5} />
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {/* Message Thread */}
                  {chatHistory.map((msg, idx) => (
                    <motion.div 
                      key={idx} 
                      className={`va-msg-row ${msg.role}`}
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      {msg.role === 'ai' && (
                        <div className="va-msg-avatar">
                          <Bot size={16} />
                        </div>
                      )}
                      <div className={`va-bubble ${msg.role}`}>
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}

                  {/* Active AI Streaming / Typing Bubble (Single instance, zero duplicates) */}
                  {state === 'speaking' && typedResponse && (
                    <motion.div 
                      className="va-msg-row ai"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="va-msg-avatar" style={{ boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)' }}>
                        <Volume2 size={16} />
                      </div>
                      <div className="va-bubble ai va-bubble-ai-streaming">
                        {typedResponse}
                        <span className="va-cursor-blink" />
                      </div>
                    </motion.div>
                  )}

                  {/* Thinking / AI Processing Indicator */}
                  {state === 'processing' && (
                    <motion.div 
                      className="va-msg-row ai"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="va-msg-avatar">
                        <Bot size={16} />
                      </div>
                      <div className="va-thinking-box">
                        <span>Analyzing system</span>
                        <div className="va-dots">
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Live User Voice Transcript Bubble */}
                  {state === 'listening' && liveTranscript && (
                    <motion.div 
                      className="va-msg-row user"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="va-bubble user va-bubble-live-user">
                        {liveTranscript}
                        <span className="va-cursor-blink" />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* ── Bottom Control Deck ── */}
                <footer className="va-footer">
                  {isTextInput ? (
                    <form className="va-input-form" onSubmit={handleTextSubmit}>
                      <input
                        type="text"
                        autoFocus
                        className="va-text-input"
                        value={textInputValue}
                        onChange={(e) => setTextInputValue(e.target.value)}
                        placeholder="Type question or command (e.g. 'What is in chamber 2?')..."
                      />
                      <button 
                        type="submit" 
                        disabled={!textInputValue.trim() || state === 'processing'}
                        className="va-send-btn"
                        aria-label="Send message"
                      >
                        <Send size={18} />
                      </button>
                      <button 
                        type="button"
                        className="va-mode-toggle"
                        onClick={() => {
                          setIsTextInput(false);
                          setState('listening');
                        }}
                        title="Switch to voice mode"
                      >
                        <Mic size={16} />
                      </button>
                    </form>
                  ) : (
                    <div className="va-voice-deck">
                      <div className="va-mic-btn-wrap">
                        {state === 'listening' && (
                          <div className="va-mic-wave-ring" />
                        )}
                        <button 
                          className={`va-main-mic-btn ${state === 'listening' && liveTranscript ? 'active' : ''}`}
                          onClick={toggleAssistant}
                          aria-label={state === 'listening' ? 'Finish speaking' : 'Tap to speak'}
                          title={state === 'listening' && liveTranscript ? 'Tap to send immediately' : 'Listening...'}
                        >
                          {state === 'speaking' ? (
                            <Volume2 size={30} />
                          ) : (
                            <Mic size={30} />
                          )}
                        </button>
                      </div>

                      <div className="va-dock-bar">
                        <div className="va-deck-caption">
                          {state === 'listening' ? (
                            <>
                              <div className="live-eq">
                                <span />
                                <span />
                                <span />
                              </div>
                              <span>
                                {liveTranscript 
                                  ? 'Listening... tap mic to send now' 
                                  : (isRealSpeech ? 'Listening... speak at your own pace' : 'Simulating microphone audio...')}
                              </span>
                            </>
                          ) : state === 'speaking' ? (
                            <span>EcoLocker is answering...</span>
                          ) : state === 'processing' ? (
                            <span>Generating response...</span>
                          ) : (
                            <span>Tap mic to talk</span>
                          )}
                        </div>

                        <button 
                          type="button"
                          className="va-mode-toggle"
                          onClick={() => {
                            if (recognitionRef.current) {
                              try { recognitionRef.current.stop(); } catch(e) {}
                            }
                            setIsTextInput(true);
                          }}
                        >
                          <Keyboard size={15} />
                          <span>Type</span>
                        </button>
                      </div>
                    </div>
                  )}
                </footer>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
