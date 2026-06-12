import { motion } from 'framer-motion';
import { Home, BookOpen, Puzzle, Gamepad2, Settings } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { ChatMode } from '../types';

const NAV_ITEMS: {
  id: ChatMode | 'settings';
  icon: typeof Home;
  label: string;
}[] = [
  { id: 'chat', icon: Home, label: 'Chat' },
  { id: 'story', icon: BookOpen, label: 'Story' },
  { id: 'learning', icon: Puzzle, label: 'Learn' },
  { id: 'game', icon: Gamepad2, label: 'Game' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

const MODE_GREETINGS: Record<ChatMode, string> = {
  chat: "Chat mode! What do you want to talk about?",
  story: 'Story mode activated! Should I tell you a fairy tale, or would you like to create one together?',
  learning: 'Learning mode! What would you like to learn about today?',
  game: "Game mode! Let's play a fun game together!",
};

export function Sidebar() {
  const {
    currentMode,
    setCurrentMode,
    currentView,
    setCurrentView,
    clearMessages,
    addMessage,
    onModeSwitch,
  } = useStore();

  const handleNavClick = (id: ChatMode | 'settings') => {
    if (id === 'settings') {
      setCurrentView('settings');
      return;
    }

    if (id !== currentMode || currentView !== 'chat') {
      setCurrentMode(id);
      setCurrentView('chat');
      clearMessages();

      const greeting = MODE_GREETINGS[id];
      
      addMessage({
        role: 'assistant',
        content: greeting,
      });

      if (onModeSwitch) {
        onModeSwitch(id, greeting);
      }
    }
  };

  const isActive = (id: ChatMode | 'settings') => {
    if (id === 'settings') return currentView === 'settings';
    return currentMode === id && currentView === 'chat';
  };

  return (
    <>
      {/* Desktop Sidebar - Left side */}
      <motion.aside
        className="hidden md:flex fixed left-4 lg:left-6 top-1/2 -translate-y-1/2 z-50"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <nav className="flex flex-col gap-2 lg:gap-3">
          {NAV_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.id);

            return (
              <motion.button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`
                  relative w-12 h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl flex flex-col items-center justify-center gap-0.5
                  transition-all duration-300
                  ${
                    active
                      ? 'bg-indigo-100 text-indigo-600'
                      : 'bg-white/60 text-gray-400 hover:bg-white hover:text-gray-600'
                  }
                `}
                style={{
                  boxShadow: active 
                    ? '0 4px 15px rgba(99, 102, 241, 0.2)' 
                    : '0 2px 8px rgba(0, 0, 0, 0.04)',
                }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={item.label}
              >
                <Icon className="w-4 h-4 lg:w-5 lg:h-5" strokeWidth={2} />
                <span className="text-[9px] lg:text-[10px] font-medium">{item.label}</span>
                
                {active && (
                  <motion.div
                    className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 lg:w-1.5 h-5 lg:h-6 bg-indigo-600 rounded-full"
                    layoutId="activeIndicator"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </motion.button>
            );
          })}
        </nav>
      </motion.aside>

      {/* Mobile Bottom Navigation */}
      <motion.nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-t border-gray-100 safe-area-bottom"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.id);

            return (
              <motion.button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`
                  flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl
                  transition-all duration-200
                  ${active ? 'text-indigo-600' : 'text-gray-400'}
                `}
                whileTap={{ scale: 0.9 }}
              >
                <div className={`
                  p-2 rounded-xl transition-all duration-200
                  ${active ? 'bg-indigo-100' : 'bg-transparent'}
                `}>
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <span className={`text-[10px] font-semibold ${active ? 'text-indigo-600' : 'text-gray-500'}`}>
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.nav>
    </>
  );
}
