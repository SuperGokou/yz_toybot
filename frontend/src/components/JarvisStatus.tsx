import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import type { JarvisPhase } from '../types';

interface JarvisStatusProps {
  audioLevel?: number;
}

const PHASE_CONFIG: Record<
  JarvisPhase,
  {
    text: string;
    color: string;
  }
> = {
  idle: {
    text: '',
    color: 'transparent',
  },
  listening: {
    text: 'Listening...',
    color: '#FF9F1C',
  },
  processing: {
    text: 'Thinking...',
    color: '#6366F1',
  },
  speaking: {
    text: 'Speaking...',
    color: '#10B981',
  },
};

export function JarvisStatus({ audioLevel = 0 }: JarvisStatusProps) {
  const { jarvisPhase } = useStore();
  const config = PHASE_CONFIG[jarvisPhase];
  
  // Scale audio level for visualization (0-1 range, amplified for visibility)
  const scaledLevel = Math.min(audioLevel * 20, 1);

  return (
    <AnimatePresence>
      {jarvisPhase !== 'idle' && (
        <motion.div
          className="flex items-center gap-1.5 sm:gap-2"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          transition={{ duration: 0.2 }}
        >
          {/* Animated indicator */}
          <motion.div
            className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full"
            style={{ backgroundColor: config.color }}
            animate={{
              scale: jarvisPhase === 'listening' ? [1, 1 + scaledLevel * 0.5, 1] : [1, 1.3, 1],
              opacity: [1, 0.7, 1],
            }}
            transition={{
              duration: jarvisPhase === 'listening' ? 0.15 : 1,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Status text */}
          <span 
            className="text-xs sm:text-sm font-medium"
            style={{ color: config.color }}
          >
            {config.text}
          </span>
          
          {/* Audio wave visualization for listening - responsive to actual audio */}
          {jarvisPhase === 'listening' && (
            <div className="flex items-center gap-0.5 ml-0.5 sm:ml-1">
              {[...Array(5)].map((_, i) => {
                // Create varying heights based on audio level
                const baseHeight = 5;
                const maxHeight = 14;
                const variation = Math.sin((i + Date.now() / 100) * 0.5) * 0.3 + 0.7;
                const height = baseHeight + (maxHeight - baseHeight) * scaledLevel * variation;
                
                return (
                  <motion.div
                    key={i}
                    className="w-0.5 sm:w-1 rounded-full"
                    style={{ 
                      backgroundColor: config.color,
                      height: `${height}px`,
                    }}
                    animate={{
                      height: scaledLevel > 0.1 
                        ? [`${height}px`, `${height * 1.2}px`, `${height}px`]
                        : ['5px', '8px', '5px'],
                    }}
                    transition={{
                      duration: 0.2,
                      repeat: Infinity,
                      delay: i * 0.05,
                      ease: 'easeInOut',
                    }}
                  />
                );
              })}
            </div>
          )}
          
          {/* Processing spinner */}
          {jarvisPhase === 'processing' && (
            <motion.div
              className="w-3 h-3 sm:w-4 sm:h-4 border-2 rounded-full ml-0.5 sm:ml-1"
              style={{ 
                borderColor: `${config.color}33`,
                borderTopColor: config.color,
              }}
              animate={{ rotate: 360 }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
