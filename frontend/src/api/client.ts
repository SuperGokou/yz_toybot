import type { ChatResponse, ChatHistoryMessage, AppStatus, ChatMode, ParentProfile, DailyReport } from '../types';
import { blobToWav } from '../utils/audioEncoder';

// API base URL - uses environment variable in production, proxy in development
const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

// Fetch wrapper with error handling
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// API functions
export const api = {
  // Get system status
  async getStatus(): Promise<AppStatus> {
    const data = await fetchApi<{
      status: string;
      owner_registered: boolean;
      robot_name: string;
      personality: string;
    }>('/status');
    
    return {
      status: data.status as AppStatus['status'],
      ownerRegistered: data.owner_registered,
      robotName: data.robot_name,
      personality: data.personality,
    };
  },

  // Send chat message
  async chat(message: string, mode: ChatMode, language?: string | null, history?: ChatHistoryMessage[]): Promise<ChatResponse> {
    return fetchApi<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        mode,
        language: language || undefined,
        history: history?.length ? history.slice(-10) : undefined,
      }),
    });
  },

  // Stream chat response (SSE)
  async *chatStream(
    message: string,
    mode: ChatMode
  ): AsyncGenerator<{ type: string; content?: string; commands?: Record<string, string> }> {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, mode }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data) {
            yield { type: 'chunk', content: data };
          }
        } else if (line.startsWith('event: done')) {
          yield { type: 'done' };
        } else if (line.startsWith('event: commands')) {
          // Next line will have the commands data
        }
      }
    }
  },

  // Text to speech
  async getTtsAudio(text: string, options?: { signal?: AbortSignal }): Promise<Blob> {
    const response = await fetch(`${API_BASE}/tts?text=${encodeURIComponent(text)}`, {
      method: 'POST',
      signal: options?.signal,
    });
    
    if (!response.ok) {
      throw new Error(`TTS failed: ${response.status}`);
    }
    
    return response.blob();
  },

  // Transcribe audio
  async transcribeAudio(audioBlob: Blob, language?: string | null): Promise<{ text: string; success: boolean }> {
    // Convert webm/opus to WAV on the client so the server doesn't need ffmpeg
    let wavBlob: Blob;
    try {
      wavBlob = await blobToWav(audioBlob);
    } catch (e) {
      console.warn('[Transcribe] Client-side WAV conversion failed, sending raw audio:', e);
      wavBlob = audioBlob;
    }

    const formData = new FormData();
    formData.append('audio', wavBlob, 'recording.wav');

    const langParam = language ? `?language=${language}` : '';
    const response = await fetch(`${API_BASE}/voice/transcribe${langParam}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.status}`);
    }

    return response.json();
  },

  // Verify voice
  async verifyVoice(audioBlob: Blob): Promise<{ verified: boolean }> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    const response = await fetch(`${API_BASE}/voice/verify`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Verification failed: ${response.status}`);
    }

    return response.json();
  },

  // Get settings
  async getSettings() {
    return fetchApi<{
      tts_enabled: boolean;
      volume: number;
      current_mode: string;
      voice_registered: boolean;
      memory_count: number;
    }>('/settings');
  },

  // Clear chat history
  async clearHistory() {
    return fetchApi<{ success: boolean }>('/chat/history', {
      method: 'DELETE',
    });
  },

  // Get memory stats
  async getMemoryStats() {
    return fetchApi<{
      total_documents: number;
      processed_files: number;
      collection_name: string;
    }>('/memory/stats');
  },

  // Save a memory
  async saveMemory(content: string, category: string = 'general') {
    return fetchApi<{ success: boolean; message: string }>('/memory/save', {
      method: 'POST',
      body: JSON.stringify({ content, category }),
    });
  },

  // Search memories
  async searchMemories(query: string, limit: number = 5) {
    return fetchApi<{ results: string[]; count: number }>(
      `/memory/search?query=${encodeURIComponent(query)}&limit=${limit}`
    );
  },

  // Register parent
  async registerParent(profile: ParentProfile) {
    return fetchApi<{ success: boolean; message: string; id: string }>('/parent/register', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  },

  // Get parent profile
  async getParentProfile() {
    return fetchApi<ParentProfile | null>('/parent/profile');
  },

  // Update parent profile
  async updateParentProfile(profile: Partial<ParentProfile>) {
    return fetchApi<{ success: boolean }>('/parent/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
  },

  // Get daily reports
  async getDailyReports(limit: number = 7) {
    return fetchApi<DailyReport[]>(`/reports?limit=${limit}`);
  },

  // Send test report email
  async sendTestReport() {
    return fetchApi<{ success: boolean; message: string }>('/reports/test', {
      method: 'POST',
    });
  },
};
