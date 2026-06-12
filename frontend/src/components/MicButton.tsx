import { motion } from 'framer-motion';
import { Mic, Square } from 'lucide-react';
import { useStore } from '../store/useStore';

interface MicButtonProps {
  onStart: () => void;
  onStop: () => void;
}

export function MicButton({ onStart, onStop }: MicButtonProps) {
  const { isListening, jarvisPhase } = useStore();
  const isActive = isListening || jarvisPhase !== 'idle';

  const handleClick = () => {
    if (isActive) {
      onStop();
    } else {
      onStart();
    }
  };

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <motion.button
        onClick={handleClick}
        className={`
          w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center
          text-white transition-all duration-300
        `}
        style={{
          background: isActive
            ? 'linear-gradient(145deg, #FF6B6B, #E74C3C)'
            : 'linear-gradient(145deg, #FFB347, #FF9F1C)',
          boxShadow: isActive
            ? '0 8px 25px rgba(231, 76, 60, 0.4)'
            : '0 8px 25px rgba(255, 159, 28, 0.4)',
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        animate={
          !isActive
            ? {
                y: [0, -4, 0],
              }
            : {
                boxShadow: [
                  '0 0 0 0 rgba(231, 76, 60, 0.5)',
                  '0 0 0 12px rgba(231, 76, 60, 0)',
                ],
              }
        }
        transition={{
          duration: isActive ? 1.2 : 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {isActive ? (
          <Square className="w-5 h-5 sm:w-6 sm:h-6" fill="white" />
        ) : (
          <Mic className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
        )}
      </motion.button>
    </motion.div>
  );
}
