import { motion } from 'framer-motion';
import { Volume2, Mic, MessageCircle, Info, ChevronLeft, UserPlus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Header } from '../components/Header';

export function SettingsView() {
  const { ttsEnabled, setTtsEnabled, setCurrentView, status } = useStore();

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <Header />
      
      <main className="pt-20 sm:pt-28 px-4 sm:px-6 max-w-2xl mx-auto md:pl-24">
        {/* Back button */}
        <motion.button
          onClick={() => setCurrentView('chat')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 sm:mb-8"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ x: -5 }}
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="font-medium text-sm sm:text-base">Back to Chat</span>
        </motion.button>

        {/* Title */}
        <motion.h1
          className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 sm:mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Settings
        </motion.h1>

        {/* Settings cards */}
        <div className="space-y-3 sm:space-y-4">
          {/* Parent Registration */}
          {!status.parentRegistered && (
            <SettingCard
              icon={UserPlus}
              title="Parent Registration"
              delay={0.05}
            >
              <div className="py-2 sm:py-3">
                <p className="text-sm text-gray-600 mb-3">
                  Register to receive daily learning reports about your child's activities.
                </p>
                <motion.button
                  onClick={() => setCurrentView('register')}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-xl font-medium text-sm sm:text-base shadow-md"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Register Now
                </motion.button>
              </div>
            </SettingCard>
          )}

          {/* Audio Settings */}
          <SettingCard
            icon={Volume2}
            title="Audio Settings"
            delay={0.1}
          >
            <ToggleSetting
              label="Text to Speech"
              description="Enable voice responses from the bot"
              enabled={ttsEnabled}
              onChange={setTtsEnabled}
            />
          </SettingCard>

          {/* Voice Settings */}
          <SettingCard
            icon={Mic}
            title="Voice Settings"
            delay={0.2}
          >
            <div className="py-2 sm:py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-700 text-sm sm:text-base">Voice Registration</p>
                  <p className="text-xs sm:text-sm text-gray-500">Your voice is registered for security</p>
                </div>
                <div className="px-2 sm:px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs sm:text-sm font-medium">
                  Registered
                </div>
              </div>
            </div>
          </SettingCard>

          {/* Chat Settings */}
          <SettingCard
            icon={MessageCircle}
            title="Chat Settings"
            delay={0.3}
          >
            <div className="py-2 sm:py-3">
              <p className="text-xs sm:text-sm text-gray-500">
                Chat history is stored locally and cleared when you switch modes.
              </p>
            </div>
          </SettingCard>

          {/* About */}
          <SettingCard
            icon={Info}
            title="About"
            delay={0.4}
          >
            <div className="py-2 sm:py-3 space-y-2">
              <p className="text-xs sm:text-sm text-gray-600">
                <span className="font-medium">KidBot (VV)</span> - Your friendly AI companion
              </p>
              <p className="text-xs sm:text-sm text-gray-500">
                Version 1.0.0
              </p>
            </div>
          </SettingCard>
        </div>
      </main>
    </div>
  );
}

// Setting Card component
interface SettingCardProps {
  icon: typeof Volume2;
  title: string;
  children: React.ReactNode;
  delay?: number;
}

function SettingCard({ icon: Icon, title, children, delay = 0 }: SettingCardProps) {
  return (
    <motion.div
      className="bg-white/80 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 pb-2 sm:pb-3 border-b border-gray-100">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-orange-100 flex items-center justify-center">
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
        </div>
        <h2 className="font-semibold text-gray-800 text-sm sm:text-base">{title}</h2>
      </div>
      {children}
    </motion.div>
  );
}

// Toggle Setting component
interface ToggleSettingProps {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}

function ToggleSetting({ label, description, enabled, onChange }: ToggleSettingProps) {
  return (
    <div className="py-2 sm:py-3 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-700 text-sm sm:text-base">{label}</p>
        <p className="text-xs sm:text-sm text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`
          w-11 sm:w-12 h-6 sm:h-7 rounded-full transition-all duration-300 relative flex-shrink-0
          ${enabled ? 'bg-orange-400' : 'bg-gray-300'}
        `}
      >
        <motion.div
          className="absolute top-0.5 sm:top-1 w-5 h-5 bg-white rounded-full shadow"
          animate={{ left: enabled ? '22px' : '2px' }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}
