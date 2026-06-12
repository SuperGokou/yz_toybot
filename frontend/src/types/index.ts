// Chat types
export type ChatMode = 'chat' | 'story' | 'learning' | 'game';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  response: string;
  mode?: ChatMode;
  action?: string;
  language?: string;
}

// Status types
export interface AppStatus {
  status: 'ready' | 'setup_required' | 'loading' | 'error';
  ownerRegistered: boolean;
  robotName: string;
  personality: string;
  parentRegistered?: boolean;
}

// Mode info
export interface ModeInfo {
  mode: ChatMode;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
}

// Settings
export interface Settings {
  ttsEnabled: boolean;
  volume: number;
  currentMode: ChatMode;
  voiceRegistered: boolean;
  memoryCount: number;
}

// Jarvis (voice) state
export type JarvisPhase = 'idle' | 'listening' | 'processing' | 'speaking';

// View state
export type ViewType = 'chat' | 'settings' | 'register';

// Parent registration
export interface ParentProfile {
  id?: string;
  parentName: string;
  parentEmail: string;
  childName: string;
  childAge: number;
  childInterests?: string[];
  dailyReportEnabled: boolean;
  reportTime: string; // HH:MM format
  createdAt?: Date;
}

// Daily report
export interface DailyReport {
  id: string;
  date: Date;
  childName: string;
  summary: string;
  topicsDiscussed: string[];
  skillsPracticed: string[];
  mood: 'happy' | 'curious' | 'calm' | 'energetic';
  recommendations: string[];
  interactionCount: number;
  totalMinutes: number;
}
