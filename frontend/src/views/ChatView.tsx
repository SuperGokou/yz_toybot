import { useCallback, useState, useRef, useEffect } from 'react';
import { Header } from '../components/Header';
import { RobotAvatar } from '../components/RobotAvatar';
import { MicButton } from '../components/MicButton';
import { JarvisStatus } from '../components/JarvisStatus';
import { ChatHistory } from '../components/ChatHistory';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import { Send, MessageCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMode, ChatHistoryMessage } from '../types';

export function ChatView() {
  const {
    currentMode,
    setJarvisPhase,
    setIsListening,
    addMessage,
    ttsEnabled,
    jarvisPhase,
    status,
    setOnModeSwitch,
    messages,
    currentLanguage,
    setCurrentLanguage,
  } = useStore();

  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationActive, setConversationActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showMobileChat, setShowMobileChat] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const hasGreetedRef = useRef(false);
  const shouldContinueRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const speechDetectedRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const skipProcessAudioRef = useRef(false);
  const currentModeRef = useRef(currentMode);
  const currentLanguageRef = useRef(currentLanguage);

  useEffect(() => {
    currentModeRef.current = currentMode;
  }, [currentMode]);

  useEffect(() => {
    currentLanguageRef.current = currentLanguage;
  }, [currentLanguage]);

  const getHistory = useCallback((): ChatHistoryMessage[] => {
    return messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
  }, [messages]);

  const SILENCE_THRESHOLD = 0.015;
  const SILENCE_DURATION = 1500;
  const MAX_RECORD_TIME = 20000;

  // Single-instance TTS playback control (prevents overlapping voices)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsUrlRef = useRef<string | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const ttsSeqRef = useRef(0);
  const ttsResolveRef = useRef<(() => void) | null>(null);

  const stopTtsNow = useCallback(() => {
    // Stop browser speech synthesis
    window.speechSynthesis?.cancel();

    // Abort any in-flight TTS request
    if (ttsAbortRef.current) {
      try {
        ttsAbortRef.current.abort();
      } catch {
        // ignore
      }
      ttsAbortRef.current = null;
    }

    // Stop any currently playing audio immediately
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.onended = null;
        ttsAudioRef.current.onerror = null;
        ttsAudioRef.current.pause();
        ttsAudioRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      ttsAudioRef.current = null;
    }

    // Release blob URL
    if (ttsUrlRef.current) {
      try {
        URL.revokeObjectURL(ttsUrlRef.current);
      } catch {
        // ignore
      }
      ttsUrlRef.current = null;
    }

    // Resolve any pending speak() promise so callers don't hang
    if (ttsResolveRef.current) {
      try {
        ttsResolveRef.current();
      } catch {
        // ignore
      }
      ttsResolveRef.current = null;
    }
  }, []);

  // Browser-native TTS fallback when server TTS fails (e.g. edge-tts blocked)
  const speakBrowserTts = useCallback((text: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!window.speechSynthesis) { resolve(); return; }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const speakResponse = useCallback(
    async (text: string): Promise<void> => {
      if (!ttsEnabled) return;

      // Ensure we never overlap audio
      stopTtsNow();
      window.speechSynthesis?.cancel();

      const seq = ++ttsSeqRef.current;
      const abortController = new AbortController();
      ttsAbortRef.current = abortController;

      try {
        const audioData = await api.getTtsAudio(text, { signal: abortController.signal });

        // If a newer TTS request started, ignore this one.
        if (seq !== ttsSeqRef.current) return;

        const audioUrl = URL.createObjectURL(audioData);
        ttsUrlRef.current = audioUrl;
        const audio = new Audio(audioUrl);
        ttsAudioRef.current = audio;

        return await new Promise<void>((resolve) => {
          ttsResolveRef.current = resolve;

          const cleanupAndResolve = () => {
            if (ttsResolveRef.current === resolve) {
              ttsResolveRef.current = null;
            }
            if (ttsAudioRef.current === audio) {
              ttsAudioRef.current = null;
            }
            if (ttsUrlRef.current === audioUrl) {
              URL.revokeObjectURL(audioUrl);
              ttsUrlRef.current = null;
            }
            resolve();
          };

          audio.onended = cleanupAndResolve;
          audio.onerror = cleanupAndResolve;
          audio.play().catch(cleanupAndResolve);
        });
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return;
        // Server TTS failed -- fall back to browser speech synthesis
        console.warn('Server TTS failed, using browser fallback:', e);
        if (seq === ttsSeqRef.current) {
          await speakBrowserTts(text);
        }
      } finally {
        if (ttsAbortRef.current === abortController) {
          ttsAbortRef.current = null;
        }
      }
    },
    [ttsEnabled, stopTtsNow, speakBrowserTts]
  );

  const getAudioLevel = useCallback((analyser: AnalyserNode): number => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return sum / dataArray.length / 255;
  }, []);

  const stopRecording = useCallback(() => {
    console.log('[Chat] Stopping recording...');
    isRecordingRef.current = false;
    
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startRecordingRef = useRef<() => Promise<void>>();

  const processAudio = useCallback(async (audioBlob: Blob) => {
    if (skipProcessAudioRef.current) {
      skipProcessAudioRef.current = false;
      return;
    }

    console.log('[Chat] Processing audio, size:', audioBlob.size, 'speech:', speechDetectedRef.current);

    if (audioBlob.size === 0 || !speechDetectedRef.current) {
      console.log('[Chat] No speech detected, restarting if active...');
      if (shouldContinueRef.current) {
        setTimeout(() => {
          if (shouldContinueRef.current && startRecordingRef.current) {
            startRecordingRef.current();
          }
        }, 300);
      } else {
        setJarvisPhase('idle');
        setIsListening(false);
      }
      return;
    }

    setJarvisPhase('processing');

    try {
      console.log('[Chat] Transcribing...');
      const { text, success } = await api.transcribeAudio(audioBlob, currentLanguageRef.current);
      
      if (!success || !text) {
        console.log('[Chat] Transcription failed');
        setJarvisPhase('speaking');
        await speakResponse("I couldn't hear that. Please try again.");
        
        if (shouldContinueRef.current) {
          setJarvisPhase('listening');
          setIsListening(true);
          setTimeout(() => startRecordingRef.current?.(), 500);
        } else {
          setJarvisPhase('idle');
          setIsListening(false);
        }
        return;
      }

      console.log('[Chat] You said:', text);
      addMessage({ role: 'user', content: text });

      console.log('[Chat] Getting AI response in mode:', currentModeRef.current, 'lang:', currentLanguageRef.current);
      const response = await api.chat(text, currentModeRef.current, currentLanguageRef.current, getHistory());
      if (response.language) {
        setCurrentLanguage(response.language);
        currentLanguageRef.current = response.language;
      }
      console.log('[Chat] AI said:', response.response);

      setJarvisPhase('speaking');
      addMessage({ role: 'assistant', content: response.response });
      await speakResponse(response.response);

      if (shouldContinueRef.current) {
        console.log('[Chat] Continuing conversation...');
        setJarvisPhase('listening');
        setIsListening(true);
        setTimeout(() => startRecordingRef.current?.(), 500);
      } else {
        setJarvisPhase('idle');
        setIsListening(false);
      }
    } catch (error) {
      console.error('[Chat] Error:', error);
      setJarvisPhase('speaking');
      await speakResponse("Sorry, something went wrong!");
      
      if (shouldContinueRef.current) {
        setJarvisPhase('listening');
        setTimeout(() => startRecordingRef.current?.(), 500);
      } else {
        setJarvisPhase('idle');
      }
    }
  }, [setJarvisPhase, setIsListening, addMessage, speakResponse, setCurrentLanguage]);

  const monitorAudio = useCallback(() => {
    if (!analyserRef.current || !isRecordingRef.current) return;

    const level = getAudioLevel(analyserRef.current);
    setAudioLevel(level);
    
    const now = Date.now();
    const isSpeaking = level > SILENCE_THRESHOLD;

    if (isSpeaking) {
      silenceStartRef.current = null;
      if (!speechDetectedRef.current) {
        speechDetectedRef.current = true;
        console.log('[VAD] Speech started! Level:', level.toFixed(4));
      }
    } else if (speechDetectedRef.current) {
      if (!silenceStartRef.current) {
        silenceStartRef.current = now;
        console.log('[VAD] Silence started...');
      } else if (now - silenceStartRef.current > SILENCE_DURATION) {
        console.log('[VAD] Silence threshold reached - stopping');
        stopRecording();
        return;
      }
    }

    rafIdRef.current = requestAnimationFrame(monitorAudio);
  }, [getAudioLevel, stopRecording]);

  const startRecording = useCallback(async () => {
    console.log('[Chat] Starting recording...');
    
    speechDetectedRef.current = false;
    silenceStartRef.current = null;
    audioChunksRef.current = [];
    isRecordingRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        console.log('[Chat] Recorder stopped');
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        
        if (audioContextRef.current?.state !== 'closed') {
          audioContextRef.current?.close();
        }

        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        processAudio(blob);
      };

      recorder.start(100);
      
      rafIdRef.current = requestAnimationFrame(monitorAudio);

      setTimeout(() => {
        if (isRecordingRef.current) {
          console.log('[Chat] Max time reached');
          stopRecording();
        }
      }, MAX_RECORD_TIME);

    } catch (error) {
      console.error('[Chat] Mic error:', error);
      setJarvisPhase('speaking');
      await speakResponse("I can't access your microphone.");
      setConversationActive(false);
      shouldContinueRef.current = false;
      setJarvisPhase('idle');
    }
  }, [monitorAudio, processAudio, stopRecording, setJarvisPhase, speakResponse]);

  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  useEffect(() => {
    return () => {
      shouldContinueRef.current = false;
      isRecordingRef.current = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
    };
  }, []);

  const handleModeSwitch = useCallback(async (mode: ChatMode, greeting: string) => {
    console.log('[Chat] Mode switched to:', mode, 'Active:', conversationActive);
    // Stop any currently speaking voice immediately so we never overlap.
    stopTtsNow();
    
    if (conversationActive || jarvisPhase !== 'idle') {
      isRecordingRef.current = false;
      skipProcessAudioRef.current = true;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      setJarvisPhase('speaking');
      try {
        await speakResponse(greeting);
      } catch (e) {
        console.warn('[Chat] Mode switch greeting failed:', e);
      }

      if (shouldContinueRef.current) {
        setJarvisPhase('listening');
        setIsListening(true);
        setTimeout(() => startRecording(), 500);
      } else {
        setJarvisPhase('idle');
      }
    } else {
      setJarvisPhase('speaking');
      try {
        await speakResponse(greeting);
      } catch (e) {
        console.warn('[Chat] Mode switch greeting failed:', e);
      }
      setJarvisPhase('idle');
    }
  }, [conversationActive, jarvisPhase, speakResponse, setJarvisPhase, setIsListening, startRecording, stopTtsNow]);

  useEffect(() => {
    setOnModeSwitch(handleModeSwitch);
    return () => setOnModeSwitch(null);
  }, [handleModeSwitch, setOnModeSwitch]);

  const startConversation = useCallback(async () => {
    console.log('[Chat] === Starting conversation ===');
    shouldContinueRef.current = true;
    setConversationActive(true);
    
    if (!hasGreetedRef.current) {
      hasGreetedRef.current = true;
      const greeting = `Hello! I'm ${status.robotName || 'VV'}! What would you like to talk about?`;
      
      setJarvisPhase('speaking');
      addMessage({ role: 'assistant', content: greeting });
      await speakResponse(greeting);
    }

    setJarvisPhase('listening');
    setIsListening(true);
    startRecording();
  }, [status.robotName, setJarvisPhase, setIsListening, addMessage, speakResponse, startRecording]);

  const stopConversation = useCallback(() => {
    console.log('[Chat] === Stopping conversation ===');
    shouldContinueRef.current = false;
    setConversationActive(false);
    isRecordingRef.current = false;
    stopTtsNow();
    
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    
    setJarvisPhase('idle');
    setIsListening(false);
    setAudioLevel(0);
  }, [setJarvisPhase, setIsListening, stopTtsNow]);

  const handleMicClick = useCallback(() => {
    if (conversationActive || jarvisPhase !== 'idle') {
      stopConversation();
    } else {
      startConversation();
    }
  }, [conversationActive, jarvisPhase, startConversation, stopConversation]);

  const handleTextSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    const message = textInput.trim();
    if (!message || isLoading || jarvisPhase !== 'idle') return;
    
    setTextInput('');
    setIsLoading(true);
    setJarvisPhase('processing');
    
    try {
      addMessage({ role: 'user', content: message });
      const response = await api.chat(message, currentMode, currentLanguage, getHistory());
      if (response.language) {
        setCurrentLanguage(response.language);
      }

      setJarvisPhase('speaking');
      addMessage({ role: 'assistant', content: response.response });
      await speakResponse(response.response);

      setJarvisPhase('idle');
    } catch (error) {
      console.error('[Chat] Error:', error);
      addMessage({ role: 'assistant', content: 'Sorry, I had trouble responding.' });
      setJarvisPhase('idle');
    } finally {
      setIsLoading(false);
    }
  }, [textInput, isLoading, jarvisPhase, currentMode, currentLanguage, setCurrentLanguage, setJarvisPhase, addMessage, speakResponse]);

  return (
    <div className="h-screen overflow-hidden relative">
      <Header />
      
      {/* Main content */}
      <main className="h-full pt-16 sm:pt-20 pb-20 md:pb-0 md:pl-20 lg:pl-24 flex flex-col md:flex-row">
        {/* Center/Left side - Robot and controls */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
          <div className="flex flex-col items-center">
            {/* Robot Avatar - Smaller on mobile */}
            <div className="scale-75 sm:scale-90 md:scale-100">
              <RobotAvatar imageSrc="/bot.gif" />
            </div>
            
            {/* Mic button and status */}
            <div className="flex flex-col items-center gap-2 mt-4 sm:mt-8">
              <MicButton 
                onStart={handleMicClick} 
                onStop={handleMicClick} 
              />
              
              <JarvisStatus audioLevel={audioLevel} />
              
              {/* Mode indicator */}
              <div className="text-xs text-gray-500 mt-1 capitalize">
                Mode: {currentMode}
              </div>
            </div>
          </div>
          
          {/* Text input - Hidden on mobile when chat overlay is open */}
          <form 
            onSubmit={handleTextSubmit} 
            className="hidden sm:flex items-center gap-2 w-full max-w-sm mt-6 sm:mt-8"
          >
            <input
              ref={inputRef}
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Or type a message..."
              disabled={isLoading || conversationActive}
              className="
                flex-1 px-4 py-2.5 rounded-full text-sm
                bg-white/80 backdrop-blur-sm
                border-2 border-orange-200 
                focus:border-orange-400 focus:outline-none
                text-gray-700 placeholder-gray-400
                shadow-lg transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            />
            <button
              type="submit"
              disabled={!textInput.trim() || isLoading || conversationActive}
              className="
                w-10 h-10 rounded-full flex items-center justify-center
                bg-gradient-to-br from-orange-400 to-orange-500
                text-white shadow-lg
                hover:from-orange-500 hover:to-orange-600
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
              "
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
        
        {/* Desktop Chat history - Right side */}
        <div className="hidden md:block w-[350px] lg:w-[400px] h-full border-l border-gray-200/50 bg-white/30 backdrop-blur-sm">
          <ChatHistory />
        </div>
      </main>

      {/* Mobile Chat Toggle Button */}
      {messages.length > 0 && (
        <motion.button
          className="md:hidden fixed right-4 bottom-24 z-40 w-14 h-14 rounded-full bg-indigo-500 text-white shadow-lg flex items-center justify-center"
          onClick={() => setShowMobileChat(!showMobileChat)}
          whileTap={{ scale: 0.9 }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          {showMobileChat ? (
            <X className="w-6 h-6" />
          ) : (
            <>
              <MessageCircle className="w-6 h-6" />
              {messages.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
                  {messages.length}
                </span>
              )}
            </>
          )}
        </motion.button>
      )}

      {/* Mobile Chat Overlay */}
      <AnimatePresence>
        {showMobileChat && (
          <motion.div
            className="md:hidden fixed inset-0 z-50 bg-white/95 backdrop-blur-lg"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Chat History</h2>
              <button
                onClick={() => setShowMobileChat(false)}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            
            {/* Chat content */}
            <div className="h-[calc(100%-140px)] overflow-y-auto">
              <ChatHistory />
            </div>
            
            {/* Mobile text input */}
            <form 
              onSubmit={(e) => {
                handleTextSubmit(e);
                setShowMobileChat(false);
              }} 
              className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 safe-area-bottom"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type a message..."
                  disabled={isLoading || conversationActive}
                  className="
                    flex-1 px-4 py-3 rounded-full text-sm
                    bg-gray-100
                    border-2 border-transparent
                    focus:border-orange-400 focus:outline-none focus:bg-white
                    text-gray-700 placeholder-gray-400
                    transition-all duration-200
                    disabled:opacity-50
                  "
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isLoading || conversationActive}
                  className="
                    w-12 h-12 rounded-full flex items-center justify-center
                    bg-gradient-to-br from-orange-400 to-orange-500
                    text-white shadow-lg
                    disabled:opacity-50
                    transition-all duration-200
                  "
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
