import { create } from 'zustand';
import type { Message, ChatMode, JarvisPhase, ViewType, AppStatus } from '../types';

interface AppState {
  // App status
  status: AppStatus;
  setStatus: (status: AppStatus) => void;

  // Messages
  messages: Message[];
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;

  // Current mode
  currentMode: ChatMode;
  setCurrentMode: (mode: ChatMode) => void;

  // Sticky language preference
  currentLanguage: string | null;
  setCurrentLanguage: (language: string | null) => void;

  // Current view (chat, settings, register)
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;

  // Jarvis (voice) state
  jarvisPhase: JarvisPhase;
  setJarvisPhase: (phase: JarvisPhase) => void;
  isListening: boolean;
  setIsListening: (listening: boolean) => void;

  // Settings
  ttsEnabled: boolean;
  setTtsEnabled: (enabled: boolean) => void;
  volume: number;
  setVolume: (volume: number) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Mode switch callback (for voice announcement)
  onModeSwitch: ((mode: ChatMode, greeting: string) => void) | null;
  setOnModeSwitch: (callback: ((mode: ChatMode, greeting: string) => void) | null) => void;
}

export const useStore = create<AppState>((set) => ({
  // App status
  status: {
    status: 'loading',
    ownerRegistered: false,
    robotName: 'VV',
    personality: 'friendly',
  },
  setStatus: (status) => set({ status }),

  // Messages
  messages: [],
  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
      ],
    })),
  clearMessages: () => set({ messages: [] }),

  // Current mode
  currentMode: 'chat',
  setCurrentMode: (mode) => set({ currentMode: mode }),

  // Sticky language
  currentLanguage: null,
  setCurrentLanguage: (language) => set({ currentLanguage: language }),

  // Current view
  currentView: 'chat',
  setCurrentView: (view) => set({ currentView: view }),

  // Jarvis state
  jarvisPhase: 'idle',
  setJarvisPhase: (phase) => set({ jarvisPhase: phase }),
  isListening: false,
  setIsListening: (listening) => set({ isListening: listening }),

  // Settings
  ttsEnabled: true,
  setTtsEnabled: (enabled) => set({ ttsEnabled: enabled }),
  volume: 80,
  setVolume: (volume) => set({ volume }),

  // Loading
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  // Mode switch callback
  onModeSwitch: null,
  setOnModeSwitch: (callback) => set({ onModeSwitch: callback }),
}));
