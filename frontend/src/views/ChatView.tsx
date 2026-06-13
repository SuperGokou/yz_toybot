import { useCallback, useState } from 'react';
import { Header } from '../components/Header';
import { RobotAvatar } from '../components/RobotAvatar';
import { MicButton } from '../components/MicButton';
import { JarvisStatus } from '../components/JarvisStatus';
import { ChatHistory } from '../components/ChatHistory';
import { CameraView } from '../components/CameraView';
import { useRealtimeVision } from '../hooks/useRealtimeVision';
import { useStore } from '../store/useStore';
import { MessageCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function ChatView() {
  const { currentMode, addMessage, messages } = useStore();

  const [showMobileChat, setShowMobileChat] = useState(false);

  // Realtime camera + voice loop (Qwen-Omni via backend /ws/realtime).
  // This is the only conversation path: the camera + microphone stream to the
  // backend and Serena's Chinese voice plays back inside the hook (playPcm).
  // Downstream transcript is appended to the chat history as a VV reply.
  const vision = useRealtimeVision(
    useCallback(
      (text: string) => addMessage({ role: 'assistant', content: text }),
      [addMessage]
    )
  );

  // The mic button now mirrors the camera toggle: it starts/stops the single
  // realtime session rather than the retired browser recording pipeline.
  const handleMicClick = useCallback(() => {
    if (vision.active) {
      vision.stop();
    } else {
      void vision.start();
    }
  }, [vision]);

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

            {/* Realtime camera preview + toggle */}
            <div className="mt-4 sm:mt-6 w-full flex flex-col items-center">
              <CameraView
                active={vision.active}
                videoRef={vision.videoRef}
                onStart={() => vision.start()}
                onStop={vision.stop}
              />
              {vision.error && (
                <p className="mt-2 text-xs text-red-500">
                  摄像头无法访问：{vision.error}
                </p>
              )}
            </div>

            {/* Mic button and status */}
            <div className="flex flex-col items-center gap-2 mt-4 sm:mt-8">
              <MicButton
                active={vision.active}
                onStart={handleMicClick}
                onStop={handleMicClick}
              />

              <JarvisStatus sessionActive={vision.active} />

              {/* Mode indicator */}
              <div className="text-xs text-gray-500 mt-1 capitalize">
                Mode: {currentMode}
              </div>
            </div>
          </div>

          {/* Voice-first hint replaces the old echo-only text box */}
          <p className="w-full max-w-sm mt-6 sm:mt-8 text-center text-xs text-gray-400">
            点下方麦克风，或「开启摄像头」，就能和 VV 说话啦~
          </p>
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

            {/* Voice-first hint replaces the old echo-only text box */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 safe-area-bottom">
              <p className="text-center text-xs text-gray-400">
                点下方麦克风，或「开启摄像头」，就能和 VV 说话啦~
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
