import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';

interface RobotAvatarProps {
  imageSrc?: string;
}

export function RobotAvatar({ imageSrc }: RobotAvatarProps) {
  const { jarvisPhase } = useStore();

  // Animation based on jarvis phase
  const getFrameAnimation = () => {
    switch (jarvisPhase) {
      case 'listening':
        return {
          boxShadow: [
            '0 0 0 0 rgba(255, 159, 28, 0.3)',
            '0 0 0 30px rgba(255, 159, 28, 0)',
          ],
        };
      case 'processing':
        return {
          rotate: [0, 5, -5, 0],
        };
      case 'speaking':
        return {
          scale: [1, 1.02, 1],
        };
      default:
        return {};
    }
  };

  return (
    <motion.div
      className="flex flex-col items-center justify-center"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, type: 'spring' }}
    >
      {/* Robot circular frame - Responsive sizes */}
      <motion.div
        className="relative w-[200px] h-[200px] xs:w-[240px] xs:h-[240px] sm:w-[320px] sm:h-[320px] md:w-[380px] md:h-[380px] lg:w-[420px] lg:h-[420px] rounded-full flex items-center justify-center"
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 100%)',
          boxShadow: `
            0 25px 50px -12px rgba(0, 0, 0, 0.08),
            0 0 0 1px rgba(255, 255, 255, 0.8),
            inset 0 2px 4px rgba(255, 255, 255, 0.9)
          `,
        }}
        animate={getFrameAnimation()}
        transition={{
          duration: jarvisPhase === 'processing' ? 0.5 : 1.5,
          repeat: jarvisPhase !== 'idle' ? Infinity : 0,
          ease: 'easeInOut',
        }}
      >
        {/* Inner content area - Responsive sizes */}
        <motion.div
          className="w-[180px] h-[180px] xs:w-[220px] xs:h-[220px] sm:w-[290px] sm:h-[290px] md:w-[350px] md:h-[350px] lg:w-[380px] lg:h-[380px] rounded-full overflow-hidden flex items-center justify-center"
          style={{
            background: 'linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%)',
          }}
        >
          {imageSrc ? (
            <motion.img
              src={imageSrc}
              alt="Robot"
              className="w-full h-full object-cover"
              animate={jarvisPhase === 'speaking' ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200">
              <motion.div
                className="text-6xl sm:text-7xl md:text-8xl font-bold text-orange-400"
                animate={jarvisPhase === 'speaking' ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.3, repeat: Infinity }}
              >
                VV
              </motion.div>
            </div>
          )}
        </motion.div>

        {/* Subtle glow effect when active */}
        {jarvisPhase !== 'idle' && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(255,159,28,0.1) 0%, transparent 70%)',
            }}
            animate={{
              opacity: [0.5, 1, 0.5],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
